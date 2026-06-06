const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const LiveQuiz = require('../models/LiveQuiz');
const LiveQuizQuestion = require('../models/LiveQuizQuestion');
const LiveQuizParticipant = require('../models/LiveQuizParticipant');
const LiveQuizAnswer = require('../models/LiveQuizAnswer');
const {
  generateNou107QuizQuestions,
  generateQuizQuestionsFromPdfBuffer,
  normalizeAnswer,
} = require('../utils/liveQuizHelper');
const {
  clearLeaderboard,
  emitAnswerRecorded,
  emitParticipantJoined,
  emitQuizDeleted,
  emitQuizStatus,
  getLeaderboard,
  updateParticipantScore,
} = require('../utils/liveQuizRealtime');
const {
  clearQuizQuestionCache,
  getQuizQuestion,
  getQuizQuestions,
  loadQuizQuestions,
} = require('../utils/liveQuizQuestionCache');
const { getJwtSecret } = require('../utils/jwtSecret');

const DEFAULT_QUESTION_DURATION_SECONDS = 40;
const ROOT_QUIZ_PDF = 'NOU107_A_Study_Guide_For_The_Distance_Learner.pdf';

const hashToken = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
const cleanUsername = (value) => String(value || '').trim().replace(/\s+/g, ' ');

async function syncParticipantRealtime(quizId, participant, { answerRecorded = false } = {}) {
  try {
    await updateParticipantScore(quizId, participant);
    if (answerRecorded) emitAnswerRecorded(quizId, participant);
  } catch (error) {
    console.warn('[live-quiz-realtime] Failed to sync participant update:', error.message);
  }
}

const serializeQuiz = (quiz) => ({
  _id: quiz._id,
  title: quiz.title,
  courseCode: quiz.courseCode,
  description: quiz.description,
  status: quiz.status,
  sourceFileName: quiz.sourceFileName,
  questionCount: quiz.questionCount,
  questionDurationSeconds: quiz.questionDurationSeconds || DEFAULT_QUESTION_DURATION_SECONDS,
  startedAt: quiz.startedAt,
  endedAt: quiz.endedAt,
  createdAt: quiz.createdAt,
});

const serializeQuestionForStudent = (question, answeredIds) => ({
  _id: question._id,
  order: question.order,
  questionType: question.questionType,
  prompt: question.prompt,
  options: question.options,
  points: question.points,
  answered: answeredIds.has(String(question._id)),
});

const getQuestionDeadline = (participant, quiz) => {
  if (!participant.questionStartedAt) return null;
  return new Date(
    participant.questionStartedAt.getTime()
      + ((quiz.questionDurationSeconds || DEFAULT_QUESTION_DURATION_SECONDS) * 1000)
  );
};

async function findNextUnansweredQuestion(quizId, participantId) {
  const answeredQuestionIds = await LiveQuizAnswer.find({ participantId }).distinct('questionId');
  const answeredIds = new Set(answeredQuestionIds.map((id) => String(id)));
  const questions = await getQuizQuestions(quizId);
  return questions.find((question) => !answeredIds.has(String(question._id))) || null;
}

async function setCurrentQuestion(participant, question) {
  participant.currentQuestionId = question?._id || null;
  participant.questionStartedAt = question ? new Date() : null;
  await participant.save();
}

async function recordMissedQuestion({ quiz, participant, question }) {
  try {
    await LiveQuizAnswer.create({
      quizId: quiz._id,
      questionId: question._id,
      participantId: participant._id,
      answer: '[No answer - time elapsed]',
      normalizedAnswer: 'no answer time elapsed',
      isCorrect: false,
      awardedPoints: 0,
    });
    participant.answeredCount += 1;
    participant.lastAnsweredAt = new Date();
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
}

async function ensureParticipantCurrentQuestion(quiz, participant) {
  if (quiz.status !== 'live') {
    if (participant.currentQuestionId || participant.questionStartedAt) {
      await setCurrentQuestion(participant, null);
    }
    return null;
  }

  let currentQuestion = participant.currentQuestionId
    ? await getQuizQuestion(quiz._id, participant.currentQuestionId)
    : null;

  if (!currentQuestion) {
    currentQuestion = await findNextUnansweredQuestion(quiz._id, participant._id);
    await setCurrentQuestion(participant, currentQuestion);
    return currentQuestion;
  }

  const deadline = getQuestionDeadline(participant, quiz);
  if (deadline && deadline.getTime() <= Date.now()) {
    await recordMissedQuestion({ quiz, participant, question: currentQuestion });
    currentQuestion = await findNextUnansweredQuestion(quiz._id, participant._id);
    await setCurrentQuestion(participant, currentQuestion);
    await syncParticipantRealtime(quiz._id, participant, { answerRecorded: true });
  }

  return currentQuestion;
}

async function getParticipantFromRequest(req) {
  const participantId = String(req.headers['x-quiz-participant'] || '').trim();
  const token = String(req.headers['x-quiz-token'] || '').trim();
  if (participantId && token) {
    const tokenParticipant = await LiveQuizParticipant.findOne({
      _id: participantId,
      tokenHash: hashToken(token),
    });
    if (tokenParticipant) return tokenParticipant;
  }

  const authHeader = String(req.headers.authorization || '');
  const jwtSecret = getJwtSecret();
  if (!authHeader.startsWith('Bearer ') || !jwtSecret) return null;

  try {
    const decoded = jwt.verify(authHeader.slice(7), jwtSecret);
    const user = await User.findById(decoded.id).select('email');
    if (!user?.email) return null;

    const currentQuiz = await LiveQuiz.findOne({ status: 'live' }).sort({ createdAt: -1 })
      || await LiveQuiz.findOne({ status: 'draft' }).sort({ createdAt: -1 });
    if (!currentQuiz) return null;

    return LiveQuizParticipant.findOne({
      quizId: currentQuiz._id,
      email: String(user.email).trim().toLowerCase(),
    });
  } catch (error) {
    return null;
  }
}

async function requireParticipant(req, res, next) {
  try {
    const participant = await getParticipantFromRequest(req);
    if (!participant) {
      return res.status(401).json({
        success: false,
        message: 'Join the quiz to continue.',
      });
    }
    req.quizParticipant = participant;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Quiz access could not be verified.',
    });
  }
}

async function createQuizFromBuffer({
  buffer,
  fileName,
  title,
  courseCode,
  description,
  userId,
  questionDurationSeconds = DEFAULT_QUESTION_DURATION_SECONDS,
  questionGenerator = generateQuizQuestionsFromPdfBuffer,
  questionCount = 100,
}) {
  const quiz = await LiveQuiz.create({
    title: String(title || 'NOU107 Live Quiz').trim(),
    courseCode: String(courseCode || 'NOU107').trim().toUpperCase(),
    description: String(description || '').trim(),
    sourceFileName: fileName,
    questionDurationSeconds,
    createdBy: userId,
  });

  try {
    const generated = await questionGenerator(buffer, questionCount);
    if (generated.length < 20) {
      throw new Error(`Gemini generated only ${generated.length} usable questions.`);
    }

    await LiveQuizQuestion.insertMany(generated.map((question, index) => ({
      ...question,
      quizId: quiz._id,
      order: index + 1,
    })));
    clearQuizQuestionCache(quiz._id);

    quiz.questionCount = generated.length;
    await quiz.save();
    return quiz;
  } catch (error) {
    await LiveQuiz.deleteOne({ _id: quiz._id });
    throw error;
  }
}

exports.requireParticipant = requireParticipant;

exports.getCurrentQuiz = async (req, res) => {
  try {
    const quiz = await LiveQuiz.findOne({ status: 'live' }).sort({ createdAt: -1 })
      || await LiveQuiz.findOne({ status: 'draft' }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: quiz ? serializeQuiz(quiz) : null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load the current quiz.' });
  }
};

exports.joinQuiz = async (req, res) => {
  try {
    const quiz = await LiveQuiz.findById(req.params.quizId);
    const username = cleanUsername(req.body?.username);
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!quiz || quiz.status === 'ended') {
      return res.status(404).json({ success: false, message: 'This quiz is not available.' });
    }
    if (username.length < 2 || username.length > 40) {
      return res.status(400).json({ success: false, message: 'Choose a username between 2 and 40 characters.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }

    const conflictingUsername = await LiveQuizParticipant.findOne({
      quizId: quiz._id,
      username: { $regex: `^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      email: { $ne: email },
    });
    if (conflictingUsername) {
      return res.status(409).json({ success: false, message: 'That username is already in use for this quiz.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const participant = await LiveQuizParticipant.findOneAndUpdate(
      { quizId: quiz._id, email },
      {
        $set: {
          username,
          tokenHash: hashToken(token),
        },
        $setOnInsert: {
          quizId: quiz._id,
          email,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );
    emitParticipantJoined(quiz._id, participant);
    await syncParticipantRealtime(quiz._id, participant);

    return res.status(200).json({
      success: true,
      data: {
        participantId: participant._id,
        token,
        username: participant.username,
        quiz: serializeQuiz(quiz),
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'That username or email is already in use.' });
    }
    return res.status(500).json({ success: false, message: error.message || 'Failed to join the quiz.' });
  }
};

exports.getQuizState = async (req, res) => {
  try {
    const participant = req.quizParticipant;
    const quiz = await LiveQuiz.findById(participant.quizId);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found.' });

    const currentQuestion = await ensureParticipantCurrentQuestion(quiz, participant);
    const answers = await LiveQuizAnswer.find({ participantId: participant._id }).select('questionId');
    const answeredIds = new Set(answers.map((answer) => String(answer.questionId)));

    return res.status(200).json({
      success: true,
      data: {
        quiz: serializeQuiz(quiz),
        participant: {
          _id: participant._id,
          username: participant.username,
          answeredCount: participant.answeredCount,
        },
        questions: currentQuestion ? [serializeQuestionForStudent(currentQuestion, answeredIds)] : [],
        questionDeadline: getQuestionDeadline(participant, quiz),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load quiz questions.' });
  }
};

exports.submitQuizAnswer = async (req, res) => {
  try {
    const participant = req.quizParticipant;
    const quiz = await LiveQuiz.findById(participant.quizId);
    if (!quiz || quiz.status !== 'live') {
      return res.status(409).json({ success: false, message: 'The quiz is not currently live.' });
    }

    const currentQuestion = await ensureParticipantCurrentQuestion(quiz, participant);
    const question = await getQuizQuestion(quiz._id, req.params.questionId);
    if (!question) return res.status(404).json({ success: false, message: 'Question not found.' });
    if (!currentQuestion || String(currentQuestion._id) !== String(question._id)) {
      return res.status(409).json({ success: false, message: 'This question is no longer active.' });
    }

    const deadline = getQuestionDeadline(participant, quiz);
    if (deadline && deadline.getTime() <= Date.now()) {
      await recordMissedQuestion({ quiz, participant, question });
      const nextQuestion = await findNextUnansweredQuestion(quiz._id, participant._id);
      await setCurrentQuestion(participant, nextQuestion);
      await syncParticipantRealtime(quiz._id, participant, { answerRecorded: true });
      return res.status(409).json({ success: false, message: 'Time elapsed. The question was recorded as missed.' });
    }

    const answer = String(req.body?.answer || '').trim();
    if (!answer || answer.length > 500) {
      return res.status(400).json({ success: false, message: 'Enter a valid answer.' });
    }

    const normalized = normalizeAnswer(answer);
    const accepted = question.acceptedAnswers.map(normalizeAnswer).filter(Boolean);
    const isCorrect = accepted.includes(normalized);
    const awardedPoints = isCorrect ? question.points : 0;

    await LiveQuizAnswer.create({
      quizId: quiz._id,
      questionId: question._id,
      participantId: participant._id,
      answer,
      normalizedAnswer: normalized,
      isCorrect,
      awardedPoints,
    });

    participant.answeredCount += 1;
    participant.correctCount += isCorrect ? 1 : 0;
    participant.score += awardedPoints;
    participant.lastAnsweredAt = new Date();
    const nextQuestion = await findNextUnansweredQuestion(quiz._id, participant._id);
    await setCurrentQuestion(participant, nextQuestion);
    await syncParticipantRealtime(quiz._id, participant, { answerRecorded: true });

    return res.status(201).json({
      success: true,
      message: 'Answer submitted.',
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'You have already answered this question.' });
    }
    return res.status(500).json({ success: false, message: error.message || 'Failed to submit answer.' });
  }
};

exports.markQuestionMissed = async (req, res) => {
  try {
    const participant = req.quizParticipant;
    const quiz = await LiveQuiz.findById(participant.quizId);
    if (!quiz || quiz.status !== 'live') {
      return res.status(409).json({ success: false, message: 'The quiz is not currently live.' });
    }

    const currentQuestion = await ensureParticipantCurrentQuestion(quiz, participant);
    if (!currentQuestion || String(currentQuestion._id) !== String(req.params.questionId)) {
      return res.status(200).json({ success: true, message: 'Question already advanced.' });
    }

    const deadline = getQuestionDeadline(participant, quiz);
    if (deadline && deadline.getTime() > Date.now()) {
      return res.status(409).json({ success: false, message: 'This question still has time remaining.' });
    }

    await recordMissedQuestion({ quiz, participant, question: currentQuestion });
    const nextQuestion = await findNextUnansweredQuestion(quiz._id, participant._id);
    await setCurrentQuestion(participant, nextQuestion);
    await syncParticipantRealtime(quiz._id, participant, { answerRecorded: true });

    return res.status(200).json({ success: true, message: 'Question recorded as missed.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to advance the question.' });
  }
};

exports.getQuizLeaderboard = async (req, res) => {
  try {
    const quiz = await LiveQuiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found.' });

    return res.status(200).json({
      success: true,
      data: await getLeaderboard(quiz._id),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load leaderboard.' });
  }
};

exports.adminListQuizzes = async (req, res) => {
  try {
    const quizzes = await LiveQuiz.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: quizzes.map(serializeQuiz) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load quizzes.' });
  }
};

exports.adminImportRootPdf = async (req, res) => {
  try {
    const filePath = path.resolve(__dirname, '..', '..', ROOT_QUIZ_PDF);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: `${ROOT_QUIZ_PDF} was not found in the project root.`,
      });
    }

    const quiz = await createQuizFromBuffer({
      buffer: fs.readFileSync(filePath),
      fileName: path.basename(filePath),
      title: req.body?.title || 'NOU107 Live Quiz',
      courseCode: req.body?.courseCode || 'NOU107',
      description: req.body?.description
        || '120 difficult questions sourced exclusively from the NOU107 study guide.',
      userId: req.user._id,
      questionGenerator: generateNou107QuizQuestions,
      questionCount: 120,
    });

    return res.status(201).json({ success: true, data: serializeQuiz(quiz) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to generate quiz questions.' });
  }
};

exports.adminImportUploadedPdf = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: 'Choose a PDF file.' });
    }

    const quiz = await createQuizFromBuffer({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      title: req.body?.title || 'Live Quiz',
      courseCode: req.body?.courseCode || 'QUIZ',
      description: req.body?.description || '',
      userId: req.user._id,
    });

    return res.status(201).json({ success: true, data: serializeQuiz(quiz) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to generate quiz questions.' });
  }
};

exports.adminSetQuizStatus = async (req, res) => {
  try {
    const status = String(req.body?.status || '').trim();
    if (!['draft', 'live', 'ended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid quiz status.' });
    }

    const existingQuiz = await LiveQuiz.findById(req.params.quizId);
    if (!existingQuiz) return res.status(404).json({ success: false, message: 'Quiz not found.' });

    if (status === 'live') {
      await LiveQuiz.updateMany({ status: 'live', _id: { $ne: req.params.quizId } }, {
        $set: { status: 'ended', endedAt: new Date() },
      });

      if (existingQuiz.status !== 'live') {
        await LiveQuizAnswer.deleteMany({ quizId: req.params.quizId });
        clearLeaderboard(req.params.quizId);
        clearQuizQuestionCache(req.params.quizId);
        await LiveQuizParticipant.updateMany(
          { quizId: req.params.quizId },
          {
            $set: {
              score: 0,
              correctCount: 0,
              answeredCount: 0,
              lastAnsweredAt: null,
              currentQuestionId: null,
              questionStartedAt: null,
            },
          }
        );
      }
    }

    const updates = { status };
    if (status === 'live') {
      updates.startedAt = existingQuiz.status === 'live' ? existingQuiz.startedAt : new Date();
      updates.endedAt = null;
    }
    if (status === 'ended') updates.endedAt = new Date();

    const quiz = await LiveQuiz.findByIdAndUpdate(req.params.quizId, { $set: updates }, { new: true });
    clearLeaderboard(quiz._id);
    if (status === 'live') await loadQuizQuestions(quiz._id);
    emitQuizStatus(quiz);

    return res.status(200).json({ success: true, data: serializeQuiz(quiz) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update quiz status.' });
  }
};


exports.adminGetQuizDetail = async (req, res) => {
  try {
    const quiz = await LiveQuiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found.' });

    const includeQuestions = String(req.query.includeQuestions || '').toLowerCase() === 'true';
    const answersLimit = Math.max(0, Math.min(100, Number(req.query.answersLimit || 20)));
    const participantsLimit = Math.max(10, Math.min(100, Number(req.query.participantsLimit || 50)));

    const [questions, participants, answers, answerCount, participantCount] = await Promise.all([
      includeQuestions
        ? LiveQuizQuestion.find({ quizId: quiz._id }).sort({ order: 1 })
        : Promise.resolve([]),
      LiveQuizParticipant.find({ quizId: quiz._id })
        .sort({ correctCount: -1, score: -1, lastAnsweredAt: 1, createdAt: 1 })
        .select('username email score correctCount answeredCount lastAnsweredAt createdAt')
        .limit(participantsLimit),
      LiveQuizAnswer.find({ quizId: quiz._id })
        .populate('participantId', 'username email')
        .populate('questionId', 'order prompt questionType acceptedAnswers')
        .sort({ createdAt: -1 })
        .limit(answersLimit),
      LiveQuizAnswer.countDocuments({ quizId: quiz._id }),
      LiveQuizParticipant.countDocuments({ quizId: quiz._id }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        quiz: serializeQuiz(quiz),
        participantCount,
        leaderboard: participants.map((participant, index) => ({
          rank: index + 1,
          _id: participant._id,
          username: participant.username,
          email: participant.email,
          score: participant.score,
          correctCount: participant.correctCount,
          answeredCount: participant.answeredCount,
          lastAnsweredAt: participant.lastAnsweredAt,
        })),
        questions,
        answers,
        answerCount,
        answersLimit,
        participantsLimit,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load quiz details.' });
  }
};

exports.adminDeleteQuiz = async (req, res) => {
  try {
    const quiz = await LiveQuiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found.' });

    await Promise.all([
      LiveQuizAnswer.deleteMany({ quizId: quiz._id }),
      LiveQuizParticipant.deleteMany({ quizId: quiz._id }),
      LiveQuizQuestion.deleteMany({ quizId: quiz._id }),
      LiveQuiz.deleteOne({ _id: quiz._id }),
    ]);

    clearLeaderboard(quiz._id);
    clearQuizQuestionCache(quiz._id);
    emitQuizDeleted(quiz._id);

    return res.status(200).json({ success: true, message: 'Quiz deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete quiz.' });
  }
};


exports.adminModerateAnswer = async (req, res) => {
  try {
    const answer = await LiveQuizAnswer.findById(req.params.answerId);
    if (!answer) return res.status(404).json({ success: false, message: 'Answer not found.' });

    const isCorrect = req.body?.isCorrect === true;
    const question = await getQuizQuestion(answer.quizId, answer.questionId);
    const oldPoints = answer.awardedPoints;
    const newPoints = isCorrect ? (question?.points || 1) : 0;
    const correctDelta = Number(isCorrect) - Number(answer.isCorrect);

    answer.isCorrect = isCorrect;
    answer.awardedPoints = newPoints;
    answer.moderationStatus = 'overridden';
    await answer.save();

    await LiveQuizParticipant.updateOne(
      { _id: answer.participantId },
      {
        $inc: {
          score: newPoints - oldPoints,
          correctCount: correctDelta,
        },
      }
    );
    const participant = await LiveQuizParticipant.findById(answer.participantId);
    if (participant) {
      await syncParticipantRealtime(answer.quizId, participant, { answerRecorded: true });
    }

    return res.status(200).json({ success: true, data: answer });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to moderate answer.' });
  }
};
