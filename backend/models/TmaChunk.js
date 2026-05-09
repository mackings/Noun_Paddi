const mongoose = require('mongoose');

const tmaChunkSchema = new mongoose.Schema({
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TmaSource',
    required: true,
    index: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    default: null,
    index: true,
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
  chunkIndex: {
    type: Number,
    required: true,
  },
  pageNumber: {
    type: Number,
    default: null,
  },
  moduleTitle: {
    type: String,
    default: '',
  },
  unitTitle: {
    type: String,
    default: '',
  },
  text: {
    type: String,
    required: true,
  },
  normalizedText: {
    type: String,
    required: true,
  },
  embedding: {
    type: [Number],
    default: undefined,
  },
  embeddingModel: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

tmaChunkSchema.index({ normalizedText: 'text' });
tmaChunkSchema.index({ sourceId: 1, chunkIndex: 1 }, { unique: true });
tmaChunkSchema.index({ courseId: 1, embeddingModel: 1 });
tmaChunkSchema.index({ courseId: 1, sourceQuality: -1 });

module.exports = mongoose.model('TmaChunk', tmaChunkSchema);
