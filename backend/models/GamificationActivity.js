const mongoose = require('mongoose');

const gamificationActivitySchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
  },
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
  },
  type: {
    type: String,
    enum: ['practice_attempt', 'summary_completion'],
    required: true,
    index: true,
  },
  points: {
    type: Number,
    default: 0,
  },
  score: {
    value: Number,
    max: Number,
    percentage: Number,
    timeTaken: Number,
  },
  reading: {
    sessionId: String,
    wordCount: Number,
    activeSeconds: Number,
    scrollDepth: Number,
    sectionCoverage: Number,
    interactionCount: Number,
    requiredActiveSeconds: Number,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  dedupeKey: {
    type: String,
    index: true,
    sparse: true,
  },
  occurredAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

gamificationActivitySchema.index({ studentId: 1, type: 1, occurredAt: -1 });
gamificationActivitySchema.index({ courseId: 1, type: 1, occurredAt: -1 });

module.exports = mongoose.model('GamificationActivity', gamificationActivitySchema);
