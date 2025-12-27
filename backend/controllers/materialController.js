const Material = require('../models/Material');
const Summary = require('../models/Summary');
const Question = require('../models/Question');
const { summarizeText, generateQuestions, formatQuestionsToMCQ } = require('../utils/aiHelper');

// @desc    Upload course material
// @route   POST /api/materials/upload
// @access  Private/Admin
exports.uploadMaterial = async (req, res) => {
  try {
    console.log('=== Upload Debug Info ===');
    console.log('File:', req.file);
    console.log('Body:', req.body);
    console.log('User:', req.user);
    console.log('User ID:', req.user?._id);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a file',
      });
    }

    const { title, courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Please select a course',
      });
    }

    console.log('Creating material with data:', {
      title,
      courseId,
      cloudinaryUrl: req.file.path,
      cloudinaryPublicId: req.file.filename,
      uploadedBy: req.user._id
    });

    const material = await Material.create({
      title,
      courseId,
      cloudinaryUrl: req.file.path,
      cloudinaryPublicId: req.file.filename,
      fileType: req.file.mimetype,
      uploadedBy: req.user._id,  // Changed from req.user.id
    });

    console.log('Material created successfully:', material);

    res.status(201).json({
      success: true,
      data: material,
    });
  } catch (error) {
    console.error('=== Upload Error ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', error);
    
    res.status(500).json({
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Generate summary for material
// @route   POST /api/materials/:materialId/summarize
// @access  Private/Admin
exports.generateSummary = async (req, res) => {
  try {
    const material = await Material.findById(req.params.materialId);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found',
      });
    }

    // Generate summary using AI with File API (pass PDF URL directly)
    const summaryText = await summarizeText(null, material.cloudinaryUrl, material._id, req.user._id);

    // Save summary
    const summary = await Summary.create({
      materialId: material._id,
      summaryText,
    });

    res.status(201).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Generate questions for material
// @route   POST /api/materials/:materialId/generate-questions
// @access  Private/Admin
exports.generateQuestionsForMaterial = async (req, res) => {
  try {
    const material = await Material.findById(req.params.materialId);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found',
      });
    }

    // Generate questions using AI with File API (pass PDF URL directly)
    const generatedQuestions = await generateQuestions(null, material.cloudinaryUrl, material._id, req.user._id);
    const mcqQuestions = formatQuestionsToMCQ(generatedQuestions, '');

    // Save questions to database
    const savedQuestions = [];
    for (const q of mcqQuestions) {
      const question = await Question.create({
        materialId: material._id,
        courseId: material.courseId,
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        difficulty: q.difficulty,
      });
      savedQuestions.push(question);
    }

    res.status(201).json({
      success: true,
      count: savedQuestions.length,
      data: savedQuestions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get summary for material
// @route   GET /api/materials/:materialId/summary
// @access  Public
exports.getMaterialSummary = async (req, res) => {
  try {
    const summary = await Summary.findOne({ materialId: req.params.materialId });

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'Summary not found',
      });
    }

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete material
// @route   DELETE /api/materials/:id
// @access  Private/Admin
exports.deleteMaterial = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found',
      });
    }

    await material.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Material deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all materials for a course
// @route   GET /api/materials/course/:courseId
// @access  Public
exports.getCourseMaterials = async (req, res) => {
  try {
    const materials = await Material.find({ courseId: req.params.courseId })
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'name');

    // For each material, get its summary if available
    const materialsWithSummaries = await Promise.all(
      materials.map(async (material) => {
        const summary = await Summary.findOne({ materialId: material._id });
        return {
          ...material.toObject(),
          hasSummary: !!summary,
          summary: summary ? summary.summaryText : null,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: materialsWithSummaries.length,
      data: materialsWithSummaries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all materials (admin)
// @route   GET /api/materials
// @access  Private/Admin
exports.getAllMaterials = async (req, res) => {
  try {
    const materials = await Material.find()
      .sort({ createdAt: -1 })
      .populate('courseId', 'courseCode courseName')
      .populate('uploadedBy', 'name');

    // For each material, get its summary status
    const materialsWithStatus = await Promise.all(
      materials.map(async (material) => {
        const [summary, questionsCount] = await Promise.all([
          Summary.findOne({ materialId: material._id }),
          Question.countDocuments({ materialId: material._id })
        ]);

        return {
          ...material.toObject(),
          hasSummary: !!summary,
          questionsCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: materialsWithStatus.length,
      data: materialsWithStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
