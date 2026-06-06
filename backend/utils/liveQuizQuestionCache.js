const LiveQuizQuestion = require('../models/LiveQuizQuestion');

const DEFAULT_TTL_MS = 60 * 60 * 1000;
const quizQuestionCache = new Map();

const serializeQuestion = (question) => ({
  _id: question._id,
  quizId: question.quizId,
  order: question.order,
  questionType: question.questionType,
  prompt: question.prompt,
  options: question.options || [],
  acceptedAnswers: question.acceptedAnswers || [],
  explanation: question.explanation || '',
  points: question.points || 1,
});

const isFresh = (entry) => entry && entry.expiresAt > Date.now();

async function loadQuizQuestions(quizId) {
  const key = String(quizId);
  const questions = await LiveQuizQuestion.find({ quizId })
    .sort({ order: 1 })
    .lean();

  const serialized = questions.map(serializeQuestion);
  const entry = {
    questions: serialized,
    byId: new Map(serialized.map((question) => [String(question._id), question])),
    expiresAt: Date.now() + DEFAULT_TTL_MS,
  };
  quizQuestionCache.set(key, entry);
  return entry;
}

async function getQuizQuestions(quizId) {
  const key = String(quizId);
  const entry = quizQuestionCache.get(key);
  if (isFresh(entry)) return entry.questions;
  return (await loadQuizQuestions(key)).questions;
}

async function getQuizQuestion(quizId, questionId) {
  const key = String(quizId);
  const id = String(questionId);
  let entry = quizQuestionCache.get(key);
  if (!isFresh(entry)) entry = await loadQuizQuestions(key);
  return entry.byId.get(id) || null;
}

function clearQuizQuestionCache(quizId) {
  if (quizId) {
    quizQuestionCache.delete(String(quizId));
    return;
  }
  quizQuestionCache.clear();
}

module.exports = {
  clearQuizQuestionCache,
  getQuizQuestion,
  getQuizQuestions,
  loadQuizQuestions,
};
