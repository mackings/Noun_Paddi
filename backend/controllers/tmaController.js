const Course = require('../models/Course');
const mongoose = require('mongoose');
const TmaSource = require('../models/TmaSource');
const TmaChunk = require('../models/TmaChunk');
const TmaAnswer = require('../models/TmaAnswer');
const { cloudinary } = require('../config/cloudinary');
const {
  answerWithGeminiPro,
  chunkText,
  compactText,
  cosineSimilarity,
  detectCourseMetadata,
  detectQuestionType,
  embedTexts,
  extractDocumentBuffer,
  generateEmbedding,
  getActiveEmbeddingModel,
  GEMINI_EMBEDDING_MODEL,
  getSourceQuality,
  inferChunkMetadata,
  scoreChunk,
  tokenize,
  verifyAnswerWithGeminiPro,
} = require('../utils/tmaHelper');

const VALID_SOURCE_TYPES = new Set(['course_material', 'past_question', 'tma_1', 'tma_2', 'tma_3', 'other']);

function normalizeOptionsFromRequest(value) {
  if (Array.isArray(value)) {
    return value.map(compactText).filter(Boolean).slice(0, 6);
  }

  if (typeof value === 'string') {
    return value
      .split(/\n|(?=\b[A-F][.)]\s+)/i)
      .map((item) => item.replace(/^[A-F][.)]\s*/i, '').trim())
      .map(compactText)
      .filter(Boolean)
      .slice(0, 6);
  }

  return [];
}

function shouldUseAtlasVectorSearch() {
  return String(process.env.TMA_USE_ATLAS_VECTOR_SEARCH || '').toLowerCase() === 'true';
}

async function findChunksWithAtlasVectorSearch({ courseId, queryEmbedding }) {
  if (!shouldUseAtlasVectorSearch() || !queryEmbedding) return [];

  const index = process.env.TMA_VECTOR_INDEX_NAME || 'tma_chunk_embedding_index';
  const limit = Number(process.env.TMA_VECTOR_SEARCH_LIMIT || 80);
  const numCandidates = Number(process.env.TMA_VECTOR_NUM_CANDIDATES || 600);
  const vectorSearch = {
    index,
    path: 'embedding',
    queryVector: queryEmbedding,
    numCandidates,
    limit,
  };

  if (courseId && mongoose.Types.ObjectId.isValid(courseId)) {
    vectorSearch.filter = { courseId: new mongoose.Types.ObjectId(courseId) };
  }

  const pipeline = [
    {
      $vectorSearch: vectorSearch,
    },
    {
      $addFields: {
        semanticScore: { $meta: 'vectorSearchScore' },
      },
    },
  ];

  pipeline.push({
    $lookup: {
      from: 'tmasources',
      localField: 'sourceId',
      foreignField: '_id',
      as: 'sourceDoc',
    },
  });
  pipeline.push({
    $addFields: {
      sourceId: { $first: '$sourceDoc' },
    },
  });
  pipeline.push({ $project: { sourceDoc: 0 } });

  return TmaChunk.aggregate(pipeline);
}

function uploadBufferToCloudinary(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'nounpaddi-tma-sources',
        resource_type: 'raw',
        use_filename: true,
        unique_filename: true,
        filename_override: file.originalname,
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );

    stream.end(file.buffer);
  });
}

async function resolveCourse({ courseId, detectedCourseCode }) {
  if (courseId) {
    const course = await Course.findById(courseId);
    if (course) return course;
  }

  if (detectedCourseCode) {
    const compact = detectedCourseCode.replace(/\s+/g, '');
    return Course.findOne({
      $or: [
        { courseCode: new RegExp(`^${detectedCourseCode.replace(/\s+/g, '\\s*')}$`, 'i') },
        { courseCode: new RegExp(`^${compact}$`, 'i') },
      ],
    });
  }

  return null;
}

exports.uploadTmaSource = async (req, res) => {
  let uploadedPublicId = '';
  let source = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a PDF, DOC, DOCX, or TXT file.',
      });
    }

    const title = compactText(req.body?.title || req.file.originalname || 'TMA source');
    const sourceType = VALID_SOURCE_TYPES.has(req.body?.sourceType) ? req.body.sourceType : 'course_material';

    const extracted = await extractDocumentBuffer({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      filename: req.file.originalname,
    });

    const detected = detectCourseMetadata(extracted.text, `${title} ${req.file.originalname || ''}`);
    const course = await resolveCourse({
      courseId: req.body?.courseId,
      detectedCourseCode: detected.detectedCourseCode,
    });

    const chunks = chunkText(extracted.text);
    if (chunks.length === 0) {
      throw new Error('The source was read, but no usable text chunks were produced.');
    }

    const embeddings = await embedTexts(chunks);
    if (embeddings.length !== chunks.length || embeddings.some((item) => !Array.isArray(item) || item.length === 0)) {
      throw new Error('The source was read, but semantic indexing failed.');
    }
    const embeddingModel = getActiveEmbeddingModel();

    const sourceQuality = getSourceQuality(sourceType);
    const cloudinaryUpload = await uploadBufferToCloudinary(req.file);
    uploadedPublicId = cloudinaryUpload.public_id;

    source = await TmaSource.create({
      title,
      sourceType,
      sourceQuality,
      courseId: course?._id || null,
      detectedCourseCode: detected.detectedCourseCode,
      detectedCourseName: detected.detectedCourseName,
      cloudinaryUrl: cloudinaryUpload.secure_url,
      cloudinaryPublicId: cloudinaryUpload.public_id,
      fileType: req.file.mimetype,
      extractionStatus: 'completed',
      textLength: extracted.text.length,
      pageCount: extracted.pageCount,
      chunkCount: chunks.length,
      embeddingStatus: 'completed',
      embeddingModel,
      metadataStatus: 'completed',
      uploadedBy: req.user._id,
    });

    await TmaChunk.insertMany(chunks.map((text, index) => ({
      sourceId: source._id,
      courseId: course?._id || null,
      sourceType,
      sourceQuality,
      chunkIndex: index,
      ...inferChunkMetadata(text, index),
      text,
      normalizedText: text.toLowerCase(),
      embedding: embeddings[index],
      embeddingModel,
    })));

    return res.status(201).json({
      success: true,
      data: {
        ...source.toObject(),
        courseId: course ? {
          _id: course._id,
          courseCode: course.courseCode,
          courseName: course.courseName,
        } : null,
      },
    });
  } catch (error) {
    if (source?._id) {
      await Promise.allSettled([
        TmaChunk.deleteMany({ sourceId: source._id }),
        TmaSource.deleteOne({ _id: source._id }),
      ]);
    }

    if (uploadedPublicId) {
      await cloudinary.uploader.destroy(uploadedPublicId, { resource_type: 'raw' }).catch(() => {});
    }

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to read and save TMA source.',
    });
  }
};

exports.listTmaSources = async (req, res) => {
  try {
    const sources = await TmaSource.find()
      .sort({ createdAt: -1 })
      .populate('courseId', 'courseCode courseName')
      .populate('uploadedBy', 'name email')
      .lean();

    return res.status(200).json({
      success: true,
      count: sources.length,
      data: sources,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load TMA sources.',
    });
  }
};

exports.deleteTmaSource = async (req, res) => {
  try {
    const source = await TmaSource.findById(req.params.sourceId);
    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'TMA source not found.',
      });
    }

    await Promise.allSettled([
      TmaChunk.deleteMany({ sourceId: source._id }),
      TmaAnswer.deleteMany({ 'evidence.sourceId': source._id }),
      source.cloudinaryPublicId
        ? cloudinary.uploader.destroy(source.cloudinaryPublicId, { resource_type: 'raw' })
        : Promise.resolve(),
    ]);

    await source.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'TMA source deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete TMA source.',
    });
  }
};

exports.backfillTmaEmbeddings = async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(1000, Number(req.body?.limit || 200)));
    const sourceId = req.body?.sourceId;
    const query = {
      $or: [
        { embedding: { $exists: false } },
        { embedding: { $size: 0 } },
        { embeddingModel: { $ne: GEMINI_EMBEDDING_MODEL } },
      ],
    };

    if (sourceId) {
      if (!mongoose.Types.ObjectId.isValid(sourceId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid sourceId.',
        });
      }
      query.sourceId = sourceId;
    }

    const chunks = await TmaChunk.find(query)
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    if (chunks.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          processed: 0,
          remaining: 0,
          message: 'All TMA chunks already have current embeddings.',
        },
      });
    }

    const embeddings = await embedTexts(chunks.map((chunk) => chunk.text));
    const embeddingModel = getActiveEmbeddingModel();
    const operations = chunks.map((chunk, index) => {
      const sourceQuality = chunk.sourceQuality || getSourceQuality(chunk.sourceType);
      return {
        updateOne: {
          filter: { _id: chunk._id },
          update: {
            $set: {
              embedding: embeddings[index],
              embeddingModel,
              sourceQuality,
              ...inferChunkMetadata(chunk.text, chunk.chunkIndex),
            },
          },
        },
      };
    });

    await TmaChunk.bulkWrite(operations);

    const affectedSourceIds = [...new Set(chunks.map((chunk) => String(chunk.sourceId)).filter(Boolean))];
    for (const id of affectedSourceIds) {
      const remaining = await TmaChunk.countDocuments({
        sourceId: id,
        $or: [
          { embedding: { $exists: false } },
          { embedding: { $size: 0 } },
          { embeddingModel: { $ne: GEMINI_EMBEDDING_MODEL } },
        ],
      });
      const source = await TmaSource.findById(id).select('sourceType');
      await TmaSource.updateOne(
        { _id: id },
        {
          $set: {
            embeddingStatus: remaining === 0 ? 'completed' : 'partial',
            embeddingModel,
            metadataStatus: 'completed',
            sourceQuality: getSourceQuality(source?.sourceType),
          },
        }
      );
    }

    const remaining = await TmaChunk.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: {
        processed: chunks.length,
        remaining,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to backfill TMA embeddings.',
    });
  }
};

exports.answerTmaQuestion = async (req, res) => {
  try {
    const question = compactText(req.body?.question);
    const options = normalizeOptionsFromRequest(req.body?.options);
    const courseId = req.body?.courseId || null;
    const questionType = detectQuestionType(question, options);

    if (!question || question.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid TMA question.',
      });
    }

    const cachedAnswer = await TmaAnswer.findOne({
      courseId: courseId || null,
      question,
      options,
      questionType,
    }).sort({ createdAt: -1 }).lean();

    if (cachedAnswer) {
      return res.status(200).json({
        success: true,
        cached: true,
        data: cachedAnswer,
      });
    }

    const queryTerms = tokenize(`${question} ${options.join(' ')}`);
    if (queryTerms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'The question does not contain enough searchable terms.',
      });
    }

    const filter = courseId ? { courseId } : {};
    let chunks = [];
    let queryEmbedding = null;

    try {
      queryEmbedding = await generateEmbedding(`${question}\n${options.join('\n')}`);
    } catch (error) {
      queryEmbedding = null;
    }
    const embeddingModel = getActiveEmbeddingModel();

    if (queryEmbedding) {
      try {
        chunks = await findChunksWithAtlasVectorSearch({ courseId, queryEmbedding });
      } catch (error) {
        chunks = [];
      }

      if (chunks.length === 0) {
        const vectorCandidates = await TmaChunk.find({
          ...filter,
          embeddingModel,
          embedding: { $exists: true, $type: 'array' },
        })
          .populate('sourceId', 'title sourceType courseId sourceQuality')
          .limit(Number(process.env.TMA_VECTOR_CANDIDATE_LIMIT || 2500))
          .lean();

        chunks = vectorCandidates
          .map((chunk) => ({
            ...chunk,
            semanticScore: cosineSimilarity(queryEmbedding, chunk.embedding),
          }))
          .filter((chunk) => chunk.semanticScore > 0.18)
          .sort((a, b) => b.semanticScore - a.semanticScore)
          .slice(0, 80);
      }
    }

    const textQuery = queryTerms.slice(0, 14).join(' ');

    if (chunks.length < 12) {
      try {
        const textChunks = await TmaChunk.find({
          ...filter,
          $text: { $search: textQuery },
        }, {
          score: { $meta: 'textScore' },
        })
          .sort({ score: { $meta: 'textScore' } })
          .populate('sourceId', 'title sourceType courseId sourceQuality')
          .limit(90)
          .lean();

        const seen = new Set(chunks.map((chunk) => String(chunk._id)));
        for (const chunk of textChunks) {
          if (!seen.has(String(chunk._id))) {
            chunks.push(chunk);
          }
        }
      } catch (error) {
        // Keep semantic results and continue to fallback if needed.
      }
    }

    if (chunks.length === 0) {
      try {
        chunks = await TmaChunk.find({
          ...filter,
          $text: { $search: textQuery },
        }, {
          score: { $meta: 'textScore' },
        })
          .sort({ score: { $meta: 'textScore' } })
          .populate('sourceId', 'title sourceType courseId sourceQuality')
          .limit(90)
          .lean();
      } catch (error) {
        chunks = [];
      }
    }

    if (chunks.length < 8) {
      const fallbackChunks = await TmaChunk.find(filter)
        .populate('sourceId', 'title sourceType courseId sourceQuality')
        .limit(800)
        .lean();

      const seen = new Set(chunks.map((chunk) => String(chunk._id)));
      for (const chunk of fallbackChunks) {
        if (!seen.has(String(chunk._id))) {
          chunks.push(chunk);
        }
      }
    }

    if (chunks.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No TMA knowledge sources are available for this course yet.',
      });
    }

    const ranked = chunks
      .map((chunk) => ({
        chunk,
        score: (Number(chunk.semanticScore || 0) * 12) +
          scoreChunk(chunk, queryTerms) +
          (Number(chunk.sourceQuality || chunk.sourceId?.sourceQuality || getSourceQuality(chunk.sourceType)) * 4),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    if (ranked.length === 0) {
      return res.status(422).json({
        success: false,
        message: 'No strong evidence was found in the uploaded course material or TMA sources.',
      });
    }

    
    const evidence = ranked.map(({ chunk }) => ({
      sourceId: chunk.sourceId?._id,
      title: chunk.sourceId?.title || 'TMA source',
      sourceType: chunk.sourceId?.sourceType || chunk.sourceType,
      sourceQuality: chunk.sourceQuality || chunk.sourceId?.sourceQuality || getSourceQuality(chunk.sourceType),
      moduleTitle: chunk.moduleTitle || '',
      unitTitle: chunk.unitTitle || '',
      pageNumber: chunk.pageNumber || null,
      text: chunk.text,
    }));

    const geminiAnswer = await answerWithGeminiPro({
      question,
      options,
      evidence,
      questionType,
    });

    const verifiedAnswer = await verifyAnswerWithGeminiPro({
      question,
      options,
      questionType,
      answer: geminiAnswer.answer,
      explanation: geminiAnswer.explanation,
      evidence,
    }).catch(() => null);

    const finalAnswer = verifiedAnswer?.finalAnswer || geminiAnswer.answer || 'Not enough evidence to answer confidently.';
    const finalExplanation = verifiedAnswer?.finalExplanation || geminiAnswer.explanation;
    const finalConfidence = verifiedAnswer
      ? Math.min(verifiedAnswer.confidence || 0, geminiAnswer.confidence || 0)
      : geminiAnswer.confidence;

    const evidenceUsed = verifiedAnswer?.evidenceUsed?.length
      ? verifiedAnswer.evidenceUsed
      : geminiAnswer.evidenceUsed.length
      ? geminiAnswer.evidenceUsed
      : evidence.map((_, index) => index + 1);

    const selectedEvidence = evidenceUsed
      .map((number) => evidence[Number(number) - 1])
      .filter(Boolean)
      .slice(0, 4);

    const saved = await TmaAnswer.create({
      courseId,
      question,
      options,
      questionType,
      answer: finalAnswer,
      explanation: finalExplanation,
      confidence: finalConfidence,
      evidence: selectedEvidence.map((item) => ({
        sourceId: item.sourceId,
        title: item.title,
        sourceType: item.sourceType,
        sourceQuality: item.sourceQuality,
        moduleTitle: item.moduleTitle,
        unitTitle: item.unitTitle,
        pageNumber: item.pageNumber,
        excerpt: item.text.slice(0, 900),
      })),
      verification: {
        isSupported: Boolean(verifiedAnswer?.isSupported),
        conflictNotes: verifiedAnswer?.conflictNotes || '',
        needsReview: verifiedAnswer ? Boolean(verifiedAnswer.needsReview) : true,
      },
      model: geminiAnswer.model,
      createdBy: req.user._id,
    });

    return res.status(200).json({
      success: true,
      data: saved,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to answer TMA question.',
    });
  }
};
