const mongoose = require('mongoose');

const projectSubmissionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a project title'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters'],
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: [true, 'Please select a faculty'],
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
  },
  fileUrl: {
    type: String,
    required: true,
  },
  filePublicId: {
    type: String,
    required: true,
  },
  fileType: {
    type: String,
    enum: ['pdf', 'doc', 'docx'],
    required: true,
  },
  originalFilename: {
    type: String,
    required: true,
  },
  wordCount: {
    type: Number,
    default: 0,
  },
  extractedText: {
    type: String,
    select: false, // Don't include in queries by default (can be large)
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },

  // Plagiarism Report
  plagiarismReport: {
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null, // Percentage of original content
    },
    aiScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null, // Likelihood of AI-generated content
    },
    webMatchScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null, // Percentage of content found online
    },

    aiAnalysis: {
      isAiGenerated: {
        type: Boolean,
        default: false,
      },
      confidence: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      indicators: [{
        type: String,
      }],
      details: {
        type: String,
        default: '',
      },
    },

    webMatches: [{
      matchedText: {
        type: String,
        required: true,
      },
      sourceUrl: {
        type: String,
        required: true,
      },
      sourceTitle: {
        type: String,
        default: 'Unknown Source',
      },
      matchPercentage: {
        type: Number,
        min: 0,
        max: 100,
      },
      matchType: {
        type: String,
        enum: ['exact', 'paraphrase', 'similar'],
        default: 'similar',
      },
    }],

    suggestions: [{
      type: String,
    }],

    checkedAt: {
      type: Date,
    },
  },

  status: {
    type: String,
    enum: ['pending', 'checking', 'completed', 'failed'],
    default: 'pending',
  },
  errorMessage: {
    type: String,
  },
}, {
  timestamps: true,
});

// Index for faster queries
projectSubmissionSchema.index({ userId: 1, createdAt: -1 });
projectSubmissionSchema.index({ facultyId: 1 });
projectSubmissionSchema.index({ status: 1 });

// Virtual for formatted submission date
projectSubmissionSchema.virtual('formattedDate').get(function() {
  return this.submittedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
});

// Ensure virtuals are included in JSON
projectSubmissionSchema.set('toJSON', { virtuals: true });
projectSubmissionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ProjectSubmission', projectSubmissionSchema);
