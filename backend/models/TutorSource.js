const mongoose = require('mongoose');

const tutorSourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
  },
  courseLabel: {
    type: String,
    default: '',
    trim: true,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  chunkCount: {
    type: Number,
    default: 0,
  },
  embeddingStatus: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing',
  },
}, {
  timestamps: true,
});

tutorSourceSchema.index({ uploadedBy: 1, createdAt: -1 });

module.exports = mongoose.model('TutorSource', tutorSourceSchema);
