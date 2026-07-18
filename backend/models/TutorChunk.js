const mongoose = require('mongoose');

const tutorChunkSchema = new mongoose.Schema({
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TutorSource',
    required: true,
    index: true,
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

tutorChunkSchema.index({ normalizedText: 'text' });
tutorChunkSchema.index({ sourceId: 1, chunkIndex: 1 }, { unique: true });

module.exports = mongoose.model('TutorChunk', tutorChunkSchema);
