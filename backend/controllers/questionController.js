const Question = require('../models/Question');
const Material = require('../models/Material');
const { questionCache, cacheHelper } = require('../utils/cache');
const { gradePopAnswers, generatePopPaper } = require('../utils/aiHelper');
const { generateRemainingQuestions } = require('./materialController');

// @desc    Get questions by course
// @route   GET /api/questions/course/:courseId
// @access  Public
exports.getQuestionsByCourse = async (req, res) => {
  try {
    const cacheKey = `course_${req.params.courseId}_questions`;

    const questionsFormatted = await cacheHelper.getOrSet(questionCache, cacheKey, async () => {
      const questions = await Question.find({ courseId: req.params.courseId });

      // Send questions with answers (needed for client-side transformation)
      return questions.map(q => ({
        _id: q._id,
        questionText: q.questionText,
        questionType: q.questionType || 'multiple-choice',
        options: q.options,
        correctAnswer: q.correctAnswer, // Include for client-side transformation
        difficulty: q.difficulty,
        explanation: q.explanation,
      }));
    });

    res.status(200).json({
      success: true,
      count: questionsFormatted.length,
      data: questionsFormatted,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Ensure question generation for course
// @route   POST /api/questions/course/:courseId/ensure
// @access  Private
exports.ensureQuestionsForCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    console.log(`Ensure questions requested for course ${courseId} by user ${req.user?._id || 'unknown'}`);
    const existingCount = await Question.countDocuments({ courseId });
    if (existingCount >= 70) {
      return res.status(200).json({
        success: true,
        status: 'ready',
        count: existingCount,
      });
    }

    const material = await Material.findOne({ courseId }).sort({ createdAt: -1 });
    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'No material available for this course',
      });
    }

    if (material.processingStatus !== 'processing') {
      material.processingStatus = 'processing';
      await material.save();
    }

    setImmediate(() => {
      generateRemainingQuestions(material._id, req.user?._id).catch((error) => {
        console.error('Ensure questions generation failed:', error);
      });
    });

    return res.status(200).json({
      success: true,
      status: 'queued',
      count: existingCount,
      expectedQuestions: 70,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Check answer
// @route   POST /api/questions/:questionId/check
// @access  Public
exports.checkAnswer = async (req, res) => {
  try {
    const { answer } = req.body; // Can be a single number or array of numbers
    const question = await Question.findById(req.params.questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found',
      });
    }

    let isCorrect = false;
    const questionType = question.questionType || 'multiple-choice';

    // Handle different question types
    if (questionType === 'multi-select') {
      // For multi-select, answer should be an array
      const userAnswers = Array.isArray(answer) ? answer.sort() : [answer];
      const correctAnswers = Array.isArray(question.correctAnswer)
        ? question.correctAnswer.sort()
        : [question.correctAnswer];

      // Check if arrays are equal
      isCorrect =
        userAnswers.length === correctAnswers.length &&
        userAnswers.every((val, index) => val === correctAnswers[index]);
    } else {
      // For single-answer questions (multiple-choice, true-false)
      const userAnswer = Array.isArray(answer) ? answer[0] : parseInt(answer);
      const correctAnswer = Array.isArray(question.correctAnswer)
        ? question.correctAnswer[0]
        : question.correctAnswer;

      isCorrect = correctAnswer === userAnswer;
    }

    // Prepare response with explanation
    let explanationText = question.explanation || 'No explanation available.';

    // Add correct answer(s) to explanation if available
    if (questionType === 'multi-select' && Array.isArray(question.correctAnswer)) {
      const correctOptions = question.correctAnswer.map(idx => question.options[idx]);
      explanationText = `Correct answers: ${correctOptions.join(', ')}. ${explanationText}`;
    } else {
      const correctIdx = Array.isArray(question.correctAnswer)
        ? question.correctAnswer[0]
        : question.correctAnswer;
      const correctOption = question.options[correctIdx];
      if (correctOption) {
        explanationText = `The correct answer is: ${correctOption}. ${explanationText}`;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        isCorrect,
        correctAnswer: question.correctAnswer,
        explanation: explanationText,
        questionType: questionType,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update question
// @route   PUT /api/questions/:id
// @access  Private/Admin
exports.updateQuestion = async (req, res) => {
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found',
      });
    }

    // Invalidate questions cache for this course
    cacheHelper.invalidatePattern(questionCache, `course_${question.courseId}_*`);

    res.status(200).json({
      success: true,
      data: question,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete question
// @route   DELETE /api/questions/:id
// @access  Private/Admin
exports.deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found',
      });
    }

    const courseId = question.courseId;
    await question.deleteOne();

    // Invalidate questions cache for this course
    cacheHelper.invalidatePattern(questionCache, `course_${courseId}_*`);

    res.status(200).json({
      success: true,
      message: 'Question deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Grade POP answers (AI)
// @route   POST /api/questions/pop-grade
// @access  Private
exports.gradePopAnswers = async (req, res) => {
  try {
    const { answers, maxScorePerQuestion } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Answers are required for grading',
      });
    }

    const cleaned = answers
      .filter((item) => item && item.question && typeof item.answer === 'string')
      .map((item) => ({
        question: item.question,
        answer: item.answer,
        maxScore: typeof item.maxScore === 'number' ? item.maxScore : undefined,
      }));

    if (cleaned.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid answers provided',
      });
    }

    const grading = await gradePopAnswers(cleaned, maxScorePerQuestion || 10);

    res.status(200).json({
      success: true,
      data: grading,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to grade answers',
    });
  }
};

// @desc    Generate POP exam paper
// @route   GET /api/questions/pop-paper/:courseId
// @access  Public
exports.getPopPaperByCourse = async (req, res) => {
  try {
    const questions = await Question.find({ courseId: req.params.courseId }).limit(80);
    const questionTexts = questions.map((q) => q.questionText);

    if (questionTexts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No questions available for this course',
      });
    }

    try {
      const popPaper = await generatePopPaper(questionTexts, 5);
      return res.status(200).json({
        success: true,
        data: popPaper,
      });
    } catch (error) {
      // Fallback: simple POP paper if AI generation fails
      const fallback = {
        instructions: 'Answer question 1 and any other three questions',
        questions: questionTexts.slice(0, 5).map((text, index) => ({
          number: index + 1,
          parts: [
            {
              label: 'a',
              text,
              marks: 10,
            },
          ],
        })),
      };
      return res.status(200).json({
        success: true,
        data: fallback,
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate POP paper',
    });
  }
};
