const mongoose = require('mongoose');
const crypto = require('crypto');

const materialSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
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
    default: 'pdf',
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  uploadDate: {
    type: Date,
    default: Date.now,
  },
  // Student upload fields
  uploadedByRole: {
    type: String,
    enum: ['admin', 'student'],
    default: 'admin',
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved', // Auto-approve for now, can add manual approval later
  },
  fileHash: {
    type: String,
    index: true, // For quick duplicate detection
  },
  contributorPoints: {
    type: Number,
    default: 0, // Points awarded for uploading quality materials
  },
  summary: {
    type: String,
  },
  hasSummary: {
    type: Boolean,
    default: false,
  },
  hasQuestions: {
    type: Boolean,
    default: false,
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  processingError: {
    type: String,
  },
  generationLockKey: {
    type: String,
    default: '',
  },
  generationLockExpiresAt: {
    type: Date,
    default: null,
  },
  lastGenerationStartedAt: {
    type: Date,
    default: null,
  },
  lastGenerationCompletedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
});

// Index for duplicate detection
materialSchema.index({ courseId: 1, fileHash: 1 });

// Method to generate file hash (for duplicate detection)
materialSchema.methods.generateFileHash = function(fileBuffer) {
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
};

// Static method to check for duplicates
materialSchema.statics.findDuplicate = async function(courseId, fileHash) {
  return await this.findOne({
    courseId,
    fileHash,
    status: { $ne: 'rejected' } // Don't count rejected materials
  });
};

module.exports = mongoose.model('Material', materialSchema);
