const Material = require('../models/Material');
const Summary = require('../models/Summary');
const Question = require('../models/Question');
const {
  summarizeText,
  generateQuestions,
  formatQuestionsToMCQ,
  generateSummaryAndQuestionsParallel,
  generateQuestionsParallel,
  getClientCount,
} = require('../utils/aiHelper');
const crypto = require('crypto');
const { materialCache, questionCache, cacheHelper } = require('../utils/cache');
const { cloudinary } = require('../config/cloudinary');

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

    // Invalidate materials cache for this course
    cacheHelper.invalidatePattern(materialCache, `course_${courseId}_*`);

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
    const cacheKey = `material_${req.params.materialId}_summary`;

    const summary = await cacheHelper.getOrSet(materialCache, cacheKey, async () => {
      return await Summary.findOne({ materialId: req.params.materialId });
    });

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

    const courseId = material.courseId;
    const materialId = material._id;
    await material.deleteOne();

    // Invalidate relevant caches
    cacheHelper.invalidatePattern(materialCache, `course_${courseId}_*`);
    cacheHelper.invalidate(materialCache, `material_${materialId}_summary`);

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
    const cacheKey = `course_${req.params.courseId}_materials`;

    const materialsWithSummaries = await cacheHelper.getOrSet(materialCache, cacheKey, async () => {
      const materials = await Material.find({ courseId: req.params.courseId })
        .sort({ createdAt: -1 })
        .populate('uploadedBy', 'name');

      // For each material, get its summary if available
      return await Promise.all(
        materials.map(async (material) => {
          const summary = await Summary.findOne({ materialId: material._id });
          return {
            ...material.toObject(),
            hasSummary: !!summary,
            summary: summary ? summary.summaryText : null,
          };
        })
      );
    });

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

// @desc    Upload course material (Student)
// @route   POST /api/materials/student-upload
// @access  Private/Student
exports.studentUploadMaterial = async (req, res) => {
  try {
    console.log('=== Student Upload Debug Info ===');
    console.log('File:', req.file);
    console.log('Body:', req.body);
    console.log('User:', req.user);

    const hasFileUpload = !!req.file;
    const hasCloudinaryUpload = !!req.body.cloudinaryUrl && !!req.body.cloudinaryPublicId;

    if (!hasFileUpload && !hasCloudinaryUpload) {
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

    // Generate file hash for duplicate detection
    const fileHash = req.body.fileHash
      ? req.body.fileHash
      : crypto
          .createHash('sha256')
          .update(
            hasFileUpload
              ? (req.file.buffer || req.file.path)
              : (req.body.cloudinaryPublicId || req.body.cloudinaryUrl)
          )
          .digest('hex');

    // Check for duplicate
    const duplicate = await Material.findDuplicate(courseId, fileHash);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'This material has already been uploaded for this course',
        existingMaterial: {
          title: duplicate.title,
          uploadedBy: duplicate.uploadedBy,
          uploadDate: duplicate.createdAt,
        },
      });
    }

    console.log('Creating material with data:', {
      title,
      courseId,
      cloudinaryUrl: hasFileUpload ? req.file.path : req.body.cloudinaryUrl,
      cloudinaryPublicId: hasFileUpload ? req.file.filename : req.body.cloudinaryPublicId,
      uploadedBy: req.user._id,
      uploadedByRole: 'student',
      fileHash,
    });

    const material = await Material.create({
      title,
      courseId,
      cloudinaryUrl: hasFileUpload ? req.file.path : req.body.cloudinaryUrl,
      cloudinaryPublicId: hasFileUpload ? req.file.filename : req.body.cloudinaryPublicId,
      fileType: hasFileUpload ? req.file.mimetype : (req.body.fileType || 'application/pdf'),
      uploadedBy: req.user._id,
      uploadedByRole: 'student',
      fileHash,
      status: 'approved', // Auto-approve for now
      processingStatus: 'pending',
    });

    console.log('Material created successfully:', material);

    // Invalidate materials cache for this course
    cacheHelper.invalidatePattern(materialCache, `course_${courseId}_*`);

    // Auto-generate summary and questions in background
    generateSummaryAndQuestions(material._id, req.user._id).catch(err => {
      console.error('Background processing error:', err);
    });

    res.status(201).json({
      success: true,
      message: 'Material uploaded successfully! Summary and questions are being generated.',
      data: material,
    });
  } catch (error) {
    console.error('=== Student Upload Error ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    res.status(500).json({
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get Cloudinary upload signature for client-side upload
// @route   POST /api/materials/upload-signature
// @access  Private
exports.getUploadSignature = async (req, res) => {
  try {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'nounpaddi-materials';
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      process.env.CLOUDINARY_API_SECRET
    );

    res.status(200).json({
      success: true,
      data: {
        timestamp,
        signature,
        folder,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate upload signature',
    });
  }
};

// Helper function to generate summary and questions in background
// OPTIMIZED: Uses parallel generation for faster upload experience
async function generateSummaryAndQuestions(materialId, userId) {
  try {
    const material = await Material.findById(materialId);
    if (!material) {
      console.error('Material not found for background processing:', materialId);
      return;
    }

    // Update status to processing
    material.processingStatus = 'processing';
    await material.save();

    const apiKeyCount = getClientCount();
    console.log(`Starting FAST background processing for material: ${materialId}`);
    console.log(`Available API keys: ${apiKeyCount}`);

    // Use parallel generation if we have multiple API keys
    const { summary: summaryText, questions: mcqQuestions } = await generateSummaryAndQuestionsParallel(
      material.cloudinaryUrl,
      material._id,
      userId
    );

    // Save summary to Material model
    material.summary = summaryText;
    material.hasSummary = true;

    // Also create Summary document for backwards compatibility
    await Summary.create({
      materialId: material._id,
      summaryText,
    });

    console.log(`Summary generated for material: ${materialId}`);

    // Save questions to database (batch insert for speed)
    if (mcqQuestions.length > 0) {
      const questionsToInsert = mcqQuestions.map(q => ({
        materialId: material._id,
        courseId: material.courseId,
        questionText: q.questionText,
        questionType: q.questionType || 'multiple-choice',
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
      }));
      await Question.insertMany(questionsToInsert);
      console.log(`Saved ${mcqQuestions.length} initial questions for material: ${materialId}`);
    }

    material.hasQuestions = false;
    material.processingStatus = 'processing';
    await material.save();

    cacheHelper.invalidate(materialCache, `material_${materialId}_summary`);
    cacheHelper.invalidatePattern(questionCache, `course_${material.courseId}_*`);
    console.log(`Initial questions ready for material: ${materialId}`);
    console.log('Remaining questions will be generated on exam start.');
  } catch (error) {
    console.error('Error in background processing:', error);

    // Update material with error status
    try {
      const material = await Material.findById(materialId);
      if (material) {
        material.processingStatus = 'failed';
        material.processingError = error.message;
        await material.save();
      }
    } catch (updateError) {
      console.error('Error updating failed status:', updateError);
    }
  }
}

// OPTIMIZED: Generate remaining questions using parallel batches
async function generateRemainingQuestions(materialId, userId, targetCount = 70) {
  const material = await Material.findById(materialId);
  if (!material) {
    return;
  }

  let currentCount = await Question.countDocuments({ materialId });
  let remaining = targetCount - currentCount;

  if (remaining <= 0) {
    material.hasQuestions = true;
    material.processingStatus = 'completed';
    material.contributorPoints = 10;
    await material.save();
    console.log(`Material ${materialId} already has ${currentCount} questions, marking complete`);
    return;
  }

  console.log(`Generating ${remaining} more questions for material: ${materialId}`);
  console.log(`Current count: ${currentCount}, Target: ${targetCount}`);

  try {
    // Get existing questions for exclusion
    const existingQuestions = await Question.find({ materialId })
      .select('questionText')
      .lean();

    // Use parallel generation for speed
    const newQuestions = await generateQuestionsParallel(
      material.cloudinaryUrl,
      material._id,
      userId,
      remaining,
      existingQuestions
    );

    if (newQuestions.length > 0) {
      // Batch insert for speed
      const questionsToInsert = newQuestions.map(q => ({
        materialId: material._id,
        courseId: material.courseId,
        questionText: q.questionText,
        questionType: q.questionType || 'multiple-choice',
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
      }));

      await Question.insertMany(questionsToInsert);
      console.log(`Inserted ${newQuestions.length} questions for material: ${materialId}`);
    }

    // Update final count
    const finalCount = await Question.countDocuments({ materialId });
    console.log(`Final question count for material ${materialId}: ${finalCount}`);

    material.hasQuestions = true;
    material.processingStatus = 'completed';
    material.contributorPoints = 10;
    await material.save();

    // Invalidate caches
    cacheHelper.invalidatePattern(materialCache, `course_${material.courseId}_*`);
    cacheHelper.invalidate(materialCache, `material_${materialId}_summary`);
    cacheHelper.invalidatePattern(questionCache, `course_${material.courseId}_*`);

    console.log(`Processing completed for material: ${materialId}`);
  } catch (error) {
    console.error(`Error generating remaining questions for ${materialId}:`, error);

    // Don't mark as failed - mark as completed with partial questions
    const partialCount = await Question.countDocuments({ materialId });
    if (partialCount >= 10) {
      // At least have minimum questions, mark as completed
      material.hasQuestions = true;
      material.processingStatus = 'completed';
      material.contributorPoints = 5; // Partial points
      console.log(`Partial completion for ${materialId}: ${partialCount} questions`);
    } else {
      material.processingStatus = 'failed';
      material.processingError = error.message;
    }
    await material.save();

    // Still invalidate caches so partial results are visible
    cacheHelper.invalidatePattern(questionCache, `course_${material.courseId}_*`);
  }
}

exports.generateRemainingQuestions = generateRemainingQuestions;

// @desc    Get material processing status
// @route   GET /api/materials/:materialId/status
// @access  Private
exports.getMaterialStatus = async (req, res) => {
  try {
    const material = await Material.findById(req.params.materialId);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found',
      });
    }

    const questionsCount = await Question.countDocuments({ materialId: material._id });
    res.status(200).json({
      success: true,
      data: {
        processingStatus: material.processingStatus,
        hasSummary: material.hasSummary,
        hasQuestions: material.hasQuestions,
        questionsCount,
        expectedQuestions: 70,
        processingError: material.processingError,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Stream material processing status (SSE)
// @route   GET /api/materials/:materialId/stream
// @access  Private
exports.streamMaterialStatus = async (req, res) => {
  const materialId = req.params.materialId;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (res.flushHeaders) {
    res.flushHeaders();
  }

  let lastPayload = null;
  let closed = false;

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const sendStatus = async () => {
    try {
      const material = await Material.findById(materialId);
      if (!material) {
        sendEvent('error', { message: 'Material not found' });
        cleanup();
        return;
      }

      const questionsCount = await Question.countDocuments({ materialId: material._id });
      const payload = {
        processingStatus: material.processingStatus,
        hasSummary: material.hasSummary,
        hasQuestions: material.hasQuestions,
        questionsCount,
        expectedQuestions: 70,
        processingError: material.processingError,
      };

      const serialized = JSON.stringify(payload);
      if (serialized !== lastPayload) {
        sendEvent('status', payload);
        lastPayload = serialized;
      }

      if (payload.processingStatus === 'completed' || payload.processingStatus === 'failed') {
        sendEvent('done', payload);
        cleanup();
      }
    } catch (error) {
      sendEvent('error', { message: error.message });
      cleanup();
    }
  };

  const keepAlive = setInterval(() => {
    if (!closed) {
      res.write(': keep-alive\n\n');
    }
  }, 15000);

  const interval = setInterval(sendStatus, 2000);

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(interval);
    clearInterval(keepAlive);
    res.end();
  };

  req.on('close', cleanup);

  await sendStatus();
};

// @desc    Get student's upload statistics
// @route   GET /api/materials/my-stats
// @access  Private/Student
exports.getStudentStats = async (req, res) => {
  try {
    const materials = await Material.find({
      uploadedBy: req.user._id,
      uploadedByRole: 'student'
    });

    const stats = {
      totalUploads: materials.length,
      totalPoints: materials.reduce((sum, m) => sum + (m.contributorPoints || 0), 0),
      approved: materials.filter(m => m.status === 'approved').length,
      pending: materials.filter(m => m.status === 'pending').length,
      rejected: materials.filter(m => m.status === 'rejected').length,
      processing: materials.filter(m => m.processingStatus === 'processing').length,
      completed: materials.filter(m => m.processingStatus === 'completed').length,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
