const mongoose = require('mongoose');

const tmaSourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  sourceType: {
    type: String,
    enum: ['course_material', 'past_question', 'tma_1', 'tma_2', 'tma_3', 'other'],
    default: 'course_material',
  },
  sourceQuality: {
    type: Number,
    default: 0.5,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    default: null,
  },
  detectedCourseCode: {
    type: String,
    trim: true,
    default: '',
  },
  detectedCourseName: {
    type: String,
    trim: true,
    default: '',
  },
  cloudinaryUrl: {
    type: String,
    required: true,
  },
  cloudinaryPublicId: {
    type: String,
    required: true,
  },
  fileType: {
    type: String,
    default: '',
  },
  extractionStatus: {
    type: String,
    enum: ['completed', 'failed'],
    default: 'completed',
  },
  extractionError: {
    type: String,
    default: '',
  },
  textLength: {
    type: Number,
    default: 0,
  },
  chunkCount: {
    type: Number,
    default: 0,
  },
  embeddingStatus: {
    type: String,
    enum: ['completed', 'partial', 'failed', 'not_started'],
    default: 'not_started',
  },
  embeddingModel: {
    type: String,
    default: '',
  },
  pageCount: {
    type: Number,
    default: 0,
  },
  metadataStatus: {
    type: String,
    enum: ['completed', 'partial', 'not_started'],
    default: 'not_started',
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

tmaSourceSchema.index({ courseId: 1, sourceType: 1 });
tmaSourceSchema.index({ detectedCourseCode: 1 });
tmaSourceSchema.index({ createdAt: -1 });

module.exports = mongoose.model('TmaSource', tmaSourceSchema);
