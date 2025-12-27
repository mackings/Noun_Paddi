const Faculty = require('../models/Faculty');
const Department = require('../models/Department');
const Course = require('../models/Course');
const Material = require('../models/Material');
const Summary = require('../models/Summary');
const Question = require('../models/Question');
const User = require('../models/User');
const APIUsage = require('../models/APIUsage');

// @desc    Get admin statistics
// @route   GET /api/stats/admin
// @access  Private/Admin
exports.getAdminStats = async (req, res) => {
  try {
    // Get counts
    const [
      totalFaculties,
      totalDepartments,
      totalCourses,
      totalMaterials,
      totalSummaries,
      totalQuestions,
      totalStudents,
      recentMaterials,
      coursesWithMaterials
    ] = await Promise.all([
      Faculty.countDocuments(),
      Department.countDocuments(),
      Course.countDocuments(),
      Material.countDocuments(),
      Summary.countDocuments(),
      Question.countDocuments(),
      User.countDocuments({ role: 'student' }),
      Material.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('courseId', 'courseCode courseName')
        .populate('uploadedBy', 'name'),
      Material.aggregate([
        {
          $group: {
            _id: '$courseId',
            count: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'courses',
            localField: '_id',
            foreignField: '_id',
            as: 'course'
          }
        },
        {
          $unwind: '$course'
        },
        {
          $project: {
            courseName: '$course.courseName',
            courseCode: '$course.courseCode',
            materialCount: '$count'
          }
        },
        {
          $sort: { materialCount: -1 }
        },
        {
          $limit: 5
        }
      ])
    ]);

    // Calculate AI processing stats
    const summaryPercentage = totalMaterials > 0
      ? Math.round((totalSummaries / totalMaterials) * 100)
      : 0;

    const questionsPerMaterial = totalMaterials > 0
      ? Math.round(totalQuestions / totalMaterials)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalFaculties,
          totalDepartments,
          totalCourses,
          totalMaterials,
          totalSummaries,
          totalQuestions,
          totalStudents,
          summaryPercentage,
          questionsPerMaterial
        },
        recentMaterials,
        topCourses: coursesWithMaterials
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get student statistics
// @route   GET /api/stats/student
// @access  Private/Student
exports.getStudentStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get total available materials and summaries
    const [
      totalCourses,
      totalMaterials,
      totalSummaries,
      totalQuestions,
      recentMaterials
    ] = await Promise.all([
      Course.countDocuments(),
      Material.countDocuments(),
      Summary.countDocuments(),
      Question.countDocuments(),
      Material.find()
        .sort({ createdAt: -1 })
        .limit(3)
        .populate('courseId', 'courseCode courseName')
    ]);

    // Calculate averages
    const avgQuestionsPerCourse = totalCourses > 0
      ? Math.round(totalQuestions / totalCourses)
      : 0;

    const materialWithSummaries = totalMaterials > 0
      ? Math.round((totalSummaries / totalMaterials) * 100)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalCourses,
          totalMaterials,
          totalSummaries,
          totalQuestions,
          avgQuestionsPerCourse,
          materialWithSummaries
        },
        recentMaterials
      }
    });
  } catch (error) {
    console.error('Student stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get API usage statistics (Gemini)
// @route   GET /api/stats/api-usage
// @access  Private/Admin
exports.getAPIUsageStats = async (req, res) => {
  try {
    // Get overall counts
    const [
      totalAPICalls,
      successfulCalls,
      failedCalls,
      totalTokens,
      recentUsage
    ] = await Promise.all([
      APIUsage.countDocuments(),
      APIUsage.countDocuments({ success: true }),
      APIUsage.countDocuments({ success: false }),
      APIUsage.aggregate([
        {
          $group: {
            _id: null,
            totalTokens: { $sum: '$totalTokens' },
            totalInputTokens: { $sum: '$inputTokens' },
            totalOutputTokens: { $sum: '$outputTokens' }
          }
        }
      ]),
      APIUsage.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('materialId', 'title')
        .populate('userId', 'name')
    ]);

    // Get usage by operation type
    const usageByType = await APIUsage.aggregate([
      {
        $group: {
          _id: '$operationType',
          count: { $sum: 1 },
          totalTokens: { $sum: '$totalTokens' },
          successCount: {
            $sum: { $cond: ['$success', 1, 0] }
          }
        }
      }
    ]);

    // Get usage over time (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const usageOverTime = await APIUsage.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          calls: { $sum: 1 },
          tokens: { $sum: '$totalTokens' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const tokenData = totalTokens.length > 0 ? totalTokens[0] : {
      totalTokens: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0
    };

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalAPICalls,
          successfulCalls,
          failedCalls,
          successRate: totalAPICalls > 0 ? Math.round((successfulCalls / totalAPICalls) * 100) : 0,
          totalTokensUsed: tokenData.totalTokens,
          totalInputTokens: tokenData.totalInputTokens,
          totalOutputTokens: tokenData.totalOutputTokens
        },
        usageByType,
        usageOverTime,
        recentUsage
      }
    });
  } catch (error) {
    console.error('API usage stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
