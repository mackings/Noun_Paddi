const ExamResult = require('../models/ExamResult');
const Question = require('../models/Question');
const mongoose = require('mongoose');
const { recordPracticeAttemptActivity } = require('../services/gamificationService');

// @desc    Submit exam result
// @route   POST /api/leaderboard/submit
// @access  Private
exports.submitExamResult = async (req, res) => {
  try {
    const { courseId, duration, timeTaken, answers } = req.body;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid courseId',
      });
    }

    const submittedAnswers = Array.isArray(answers) ? answers : [];
    const answerMap = new Map();
    submittedAnswers.forEach((item) => {
      if (!item?.questionId || !mongoose.Types.ObjectId.isValid(item.questionId)) return;
      answerMap.set(String(item.questionId), item.answer);
    });

    const questionIds = [...answerMap.keys()];
    const matchedQuestions = questionIds.length > 0
      ? await Question.find({
          _id: { $in: questionIds },
          courseId,
        }).select('_id correctAnswer questionType')
      : [];

    const compareAnswers = (question, providedAnswer) => {
      const questionType = question.questionType || 'multiple-choice';
      const correctAnswer = question.correctAnswer;

      if (questionType === 'multi-select') {
        const provided = (Array.isArray(providedAnswer) ? providedAnswer : [providedAnswer])
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
          .sort((a, b) => a - b);
        const correct = (Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer])
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
          .sort((a, b) => a - b);
        return provided.length === correct.length && provided.every((value, idx) => value === correct[idx]);
      }

      const provided = Array.isArray(providedAnswer) ? Number(providedAnswer[0]) : Number(providedAnswer);
      const correct = Array.isArray(correctAnswer) ? Number(correctAnswer[0]) : Number(correctAnswer);
      return Number.isFinite(provided) && Number.isFinite(correct) && provided === correct;
    };

    let computedScore = 0;
    const verifiedAnswers = matchedQuestions.map((question) => {
      const providedAnswer = answerMap.get(String(question._id));
      const isCorrect = compareAnswers(question, providedAnswer);
      if (isCorrect) computedScore += 1;
      return {
        questionId: question._id,
        answer: providedAnswer,
        isCorrect,
      };
    });

    const totalQuestionsInCourse = await Question.countDocuments({ courseId });
    const computedTotalQuestions = Math.max(1, Math.min(70, totalQuestionsInCourse || 70));
    const safeDuration = Math.max(1, Math.min(3 * 60 * 60, Number(duration) || 60 * 60));
    const safeTimeTaken = Math.max(0, Math.min(safeDuration, Number(timeTaken) || 0));
    const percentage = Number(((computedScore / computedTotalQuestions) * 100).toFixed(2));

    const result = await ExamResult.create({
      studentId: req.user._id,
      courseId,
      score: computedScore,
      totalQuestions: computedTotalQuestions,
      percentage,
      duration: safeDuration,
      timeTaken: safeTimeTaken,
      answers: verifiedAnswers,
    });

    try {
      await recordPracticeAttemptActivity({
        studentId: req.user._id,
        courseId,
        score: computedScore,
        totalQuestions: computedTotalQuestions,
        percentage,
        timeTaken: safeTimeTaken,
      });
    } catch (activityError) {
      console.error('Practice activity tracking failed:', activityError);
    }

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error submitting exam result:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error submitting exam result',
    });
  }
};

// @desc    Get leaderboard for a course
// @route   GET /api/leaderboard/course/:courseId
// @access  Public
exports.getCourseLeaderboard = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { limit = 100 } = req.query;

    // Get top scorers - best attempt per student
    const leaderboard = await ExamResult.aggregate([
      { $match: { courseId: mongoose.Types.ObjectId(courseId) } },
      {
        $sort: {
          percentage: -1,
          timeTaken: 1, // Tie-breaker: faster time wins
        },
      },
      {
        $group: {
          _id: '$studentId',
          bestScore: { $first: '$score' },
          bestPercentage: { $first: '$percentage' },
          totalQuestions: { $first: '$totalQuestions' },
          timeTaken: { $first: '$timeTaken' },
          completedAt: { $first: '$completedAt' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: '$student' },
      {
        $project: {
          studentName: '$student.name',
          studentEmail: '$student.email',
          score: '$bestScore',
          percentage: '$bestPercentage',
          totalQuestions: 1,
          timeTaken: 1,
          completedAt: 1,
        },
      },
      { $sort: { percentage: -1, timeTaken: 1 } },
      { $limit: parseInt(limit) },
    ]);

    // Add rankings
    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    res.status(200).json({
      success: true,
      data: rankedLeaderboard,
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching leaderboard',
    });
  }
};

// @desc    Get student's exam history
// @route   GET /api/leaderboard/my-results
// @access  Private
exports.getMyResults = async (req, res) => {
  try {
    const results = await ExamResult.find({ studentId: req.user._id })
      .populate('courseId', 'courseCode courseName')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching results',
    });
  }
};

// @desc    Get student's rank for a course
// @route   GET /api/leaderboard/my-rank/:courseId
// @access  Private
exports.getMyRank = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Get student's best score
    const myBest = await ExamResult.findOne({
      studentId: req.user._id,
      courseId,
    })
      .sort({ percentage: -1, timeTaken: 1 })
      .lean();

    if (!myBest) {
      return res.status(404).json({
        success: false,
        message: 'No results found for this course',
      });
    }

    // Count how many students scored better
    const betterScores = await ExamResult.aggregate([
      { $match: { courseId: mongoose.Types.ObjectId(courseId) } },
      {
        $sort: {
          percentage: -1,
          timeTaken: 1,
        },
      },
      {
        $group: {
          _id: '$studentId',
          bestPercentage: { $first: '$percentage' },
          timeTaken: { $first: '$timeTaken' },
        },
      },
      {
        $match: {
          $or: [
            { bestPercentage: { $gt: myBest.percentage } },
            {
              bestPercentage: myBest.percentage,
              timeTaken: { $lt: myBest.timeTaken },
            },
          ],
        },
      },
      { $count: 'count' },
    ]);

    const rank = betterScores.length > 0 ? betterScores[0].count + 1 : 1;

    res.status(200).json({
      success: true,
      data: {
        rank,
        score: myBest.score,
        percentage: myBest.percentage,
        totalQuestions: myBest.totalQuestions,
        timeTaken: myBest.timeTaken,
      },
    });
  } catch (error) {
    console.error('Error fetching rank:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching rank',
    });
  }
};
