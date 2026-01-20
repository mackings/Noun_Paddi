const ProjectSubmission = require('../models/ProjectSubmission');
const { runPlagiarismCheck } = require('../utils/plagiarismChecker');
const { cloudinary } = require('../config/cloudinary');

// @desc    Submit project for plagiarism check
// @route   POST /api/plagiarism/check
// @access  Private
exports.submitForCheck = async (req, res) => {
  try {
    console.log('=== Plagiarism Check Request ===');
    console.log('File:', req.file);
    console.log('Body:', req.body);
    console.log('User:', req.user?._id);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a file (PDF or Word document)',
      });
    }

    const { title, facultyId, departmentId } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a project title',
      });
    }

    if (!facultyId) {
      return res.status(400).json({
        success: false,
        message: 'Please select a faculty',
      });
    }

    // Determine file type
    const originalFilename = req.file.originalname;
    const extension = originalFilename.split('.').pop().toLowerCase();
    let fileType;

    if (extension === 'pdf') {
      fileType = 'pdf';
    } else if (extension === 'doc') {
      fileType = 'doc';
    } else if (extension === 'docx') {
      fileType = 'docx';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Please upload a PDF or Word document.',
      });
    }

    // Create initial submission record
    const submission = await ProjectSubmission.create({
      title,
      userId: req.user._id,
      facultyId,
      departmentId: departmentId || null,
      fileUrl: req.file.path,
      filePublicId: req.file.filename,
      fileType,
      originalFilename,
      status: 'checking',
    });

    console.log('Submission created:', submission._id);

    // Return immediately - process in background to avoid Vercel timeout
    res.status(202).json({
      success: true,
      message: 'Plagiarism check started. Poll for status.',
      data: {
        submissionId: submission._id,
        status: 'checking',
      },
    });

    // Run plagiarism check in background (after response sent)
    setImmediate(async () => {
      try {
        console.log('Starting background plagiarism check for:', submission._id);
        const result = await runPlagiarismCheck(req.file.path, fileType);

        // Update submission with results
        submission.wordCount = result.wordCount;
        submission.extractedText = result.extractedText;
        submission.plagiarismReport = result.report;
        submission.status = 'completed';
        await submission.save();

        console.log('Plagiarism check completed for:', submission._id);
      } catch (checkError) {
        console.error('Plagiarism check failed:', checkError.message);

        // Update submission with error
        submission.status = 'failed';
        submission.errorMessage = checkError.message;
        await submission.save();
      }
    });

  } catch (error) {
    console.error('Submit for check error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit for plagiarism check',
    });
  }
};

// @desc    Get plagiarism check status
// @route   GET /api/plagiarism/status/:id
// @access  Private
exports.getCheckStatus = async (req, res) => {
  try {
    const submission = await ProjectSubmission.findOne({
      _id: req.params.id,
      userId: req.user._id,
    })
      .select('-extractedText')
      .populate('facultyId', 'name')
      .populate('departmentId', 'name code');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    res.status(200).json({
      success: true,
      data: submission,
    });

  } catch (error) {
    console.error('Get check status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get status',
    });
  }
};

// @desc    Get user's plagiarism reports
// @route   GET /api/plagiarism/reports
// @access  Private
exports.getUserReports = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reports = await ProjectSubmission.find({ userId: req.user._id })
      .select('-extractedText')
      .populate('facultyId', 'name')
      .populate('departmentId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ProjectSubmission.countDocuments({ userId: req.user._id });

    res.status(200).json({
      success: true,
      count: reports.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      data: reports,
    });

  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve reports',
    });
  }
};

// @desc    Get specific plagiarism report
// @route   GET /api/plagiarism/reports/:id
// @access  Private
exports.getReportById = async (req, res) => {
  try {
    const report = await ProjectSubmission.findOne({
      _id: req.params.id,
      userId: req.user._id,
    })
      .select('-extractedText')
      .populate('facultyId', 'name')
      .populate('departmentId', 'name code');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
      });
    }

    res.status(200).json({
      success: true,
      data: report,
    });

  } catch (error) {
    console.error('Get report by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve report',
    });
  }
};

// @desc    Delete a plagiarism report
// @route   DELETE /api/plagiarism/reports/:id
// @access  Private
exports.deleteReport = async (req, res) => {
  try {
    const report = await ProjectSubmission.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
      });
    }

    // Delete file from Cloudinary
    if (report.filePublicId) {
      try {
        await cloudinary.uploader.destroy(report.filePublicId, {
          resource_type: 'raw',
        });
      } catch (cloudinaryError) {
        console.error('Cloudinary delete error:', cloudinaryError.message);
        // Continue with deletion even if Cloudinary fails
      }
    }

    await report.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Report deleted successfully',
    });

  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete report',
    });
  }
};

// @desc    Get plagiarism statistics for user
// @route   GET /api/plagiarism/stats
// @access  Private
exports.getUserStats = async (req, res) => {
  try {
    const submissions = await ProjectSubmission.find({
      userId: req.user._id,
      status: 'completed',
    }).select('plagiarismReport.overallScore plagiarismReport.aiScore createdAt');

    const totalChecks = submissions.length;
    const averageScore = totalChecks > 0
      ? Math.round(submissions.reduce((sum, s) => sum + (s.plagiarismReport?.overallScore || 0), 0) / totalChecks)
      : 0;
    const highRiskCount = submissions.filter(s => (s.plagiarismReport?.overallScore || 0) < 60).length;

    res.status(200).json({
      success: true,
      data: {
        totalChecks,
        averageScore,
        highRiskCount,
        recentChecks: submissions.slice(0, 5).map(s => ({
          score: s.plagiarismReport?.overallScore,
          date: s.createdAt,
        })),
      },
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve statistics',
    });
  }
};
