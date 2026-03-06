const mongoose = require('mongoose');
const GamificationActivity = require('../models/GamificationActivity');
const Material = require('../models/Material');
const {
  recordSummaryCompletionActivity,
} = require('../services/gamificationService');

const TOP_LIMIT_CAP = 50;

const toLimit = (value, fallback = 10) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, TOP_LIMIT_CAP);
};

const buildLeaderboardPipeline = ({ type, limit }) => {
  const match = type ? { type } : {};

  return [
    { $match: match },
    {
      $group: {
        _id: '$studentId',
        totalPoints: { $sum: '$points' },
        attempts: { $sum: 1 },
        lastActivity: { $max: '$occurredAt' },
      },
    },
    { $sort: { totalPoints: -1, lastActivity: 1 } },
    { $limit: limit },
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
        _id: 0,
        studentId: '$_id',
        studentName: '$student.name',
        totalPoints: 1,
        attempts: 1,
        lastActivity: 1,
      },
    },
  ];
};

const addRanks = (rows, currentUserId) => rows.map((row, index) => ({
  ...row,
  rank: index + 1,
  isMe: currentUserId ? String(row.studentId) === String(currentUserId) : false,
}));

exports.completeSummaryReading = async (req, res) => {
  try {
    const { courseId, materialId, metrics } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(courseId) || !mongoose.Types.ObjectId.isValid(materialId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid courseId and materialId are required',
      });
    }

    const material = await Material.findById(materialId).select('courseId').lean();
    if (!material || String(material.courseId) !== String(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid material/course combination',
      });
    }

    const result = await recordSummaryCompletionActivity({
      studentId: req.user._id,
      courseId,
      materialId,
      metrics,
    });

    if (!result.accepted) {
      return res.status(400).json({
        success: false,
        message: result.reason,
        data: {
          metrics: result.metrics,
          alreadyAwarded: result.alreadyAwarded,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        pointsAwarded: result.pointsAwarded,
        alreadyAwarded: result.alreadyAwarded,
        metrics: result.metrics,
      },
    });
  } catch (error) {
    console.error('completeSummaryReading error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to save reading completion',
    });
  }
};

exports.getDashboardGamification = async (req, res) => {
  try {
    const studentId = req.user._id;

    const [totals, recentRaw, overallRows, practiceRows, readersRows] = await Promise.all([
      GamificationActivity.aggregate([
        { $match: { studentId: new mongoose.Types.ObjectId(studentId) } },
        {
          $group: {
            _id: null,
            totalPoints: { $sum: '$points' },
            practicePoints: {
              $sum: {
                $cond: [{ $eq: ['$type', 'practice_attempt'] }, '$points', 0],
              },
            },
            readingPoints: {
              $sum: {
                $cond: [{ $eq: ['$type', 'summary_completion'] }, '$points', 0],
              },
            },
            practiceAttempts: {
              $sum: {
                $cond: [{ $eq: ['$type', 'practice_attempt'] }, 1, 0],
              },
            },
            summariesCompleted: {
              $sum: {
                $cond: [{ $eq: ['$type', 'summary_completion'] }, 1, 0],
              },
            },
          },
        },
      ]),
      GamificationActivity.find({ studentId })
        .sort({ occurredAt: -1 })
        .limit(20)
        .populate('courseId', 'courseCode courseName')
        .lean(),
      GamificationActivity.aggregate(buildLeaderboardPipeline({ limit: 10 })),
      GamificationActivity.aggregate(buildLeaderboardPipeline({ type: 'practice_attempt', limit: 10 })),
      GamificationActivity.aggregate(buildLeaderboardPipeline({ type: 'summary_completion', limit: 10 })),
    ]);

    const totalsData = totals[0] || {
      totalPoints: 0,
      practicePoints: 0,
      readingPoints: 0,
      practiceAttempts: 0,
      summariesCompleted: 0,
    };

    const recent = recentRaw.map((item) => ({
      _id: item._id,
      type: item.type,
      points: item.points,
      occurredAt: item.occurredAt,
      score: item.score,
      reading: item.reading,
      course: item.courseId
        ? {
            _id: item.courseId._id,
            courseCode: item.courseId.courseCode,
            courseName: item.courseId.courseName,
          }
        : null,
    }));

    res.status(200).json({
      success: true,
      data: {
        totals: totalsData,
        recentActivities: recent,
        leaderboards: {
          overall: addRanks(overallRows, studentId),
          practice: addRanks(practiceRows, studentId),
          readers: addRanks(readersRows, studentId),
        },
      },
    });
  } catch (error) {
    console.error('getDashboardGamification error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load gamification dashboard',
    });
  }
};

exports.getGamificationLeaderboard = async (req, res) => {
  try {
    const { category = 'overall' } = req.query;
    const limit = toLimit(req.query.limit, 20);

    const type =
      category === 'practice'
        ? 'practice_attempt'
        : category === 'readers'
          ? 'summary_completion'
          : null;

    const rows = await GamificationActivity.aggregate(buildLeaderboardPipeline({ type, limit }));

    res.status(200).json({
      success: true,
      data: addRanks(rows),
    });
  } catch (error) {
    console.error('getGamificationLeaderboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch leaderboard',
    });
  }
};
