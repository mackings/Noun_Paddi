const mongoose = require('mongoose');

const StudentExamScheduleSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  courseCode: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  courseTitle: {
    type: String,
    required: true,
    trim: true,
  },
  examDate: {
    type: Date,
    required: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  examStartAt: {
    type: Date,
    required: true,
    index: true,
  },
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: null,
  },
  scoreRecordedAt: {
    type: Date,
    default: null,
  },
  reminderDueAt: {
    type: Date,
    required: true,
    index: true,
  },
  scoreReminderSentAt: {
    type: Date,
    default: null,
    index: true,
  },
}, {
  timestamps: true,
});

StudentExamScheduleSchema.index({ studentId: 1, courseCode: 1 }, { unique: true });
StudentExamScheduleSchema.index({ score: 1, scoreReminderSentAt: 1, reminderDueAt: 1 });

module.exports = mongoose.model('StudentExamSchedule', StudentExamScheduleSchema);
