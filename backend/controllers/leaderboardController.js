const ExamResult = require('../models/ExamResult');
const mongoose = require('mongoose');
const { recordPracticeAttemptActivity } = require('../services/gamificationService');

// @desc    Submit exam result
// @route   POST /api/leaderboard/submit
// @access  Private
exports.submitExamResult = async (req, res) => {
  try {
    const { courseId, score, totalQuestions, duration, timeTaken, answers } = req.body;

    const percentage = ((score / totalQuestions) * 100).toFixed(2);

    const result = await ExamResult.create({
      studentId: req.user._id,
      courseId,
      score,
      totalQuestions,
      percentage,
      duration,
      timeTaken,
      answers,
    });

    try {
      await recordPracticeAttemptActivity({
        studentId: req.user._id,
        courseId,
        score,
        totalQuestions,
        percentage,
        timeTaken,
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
