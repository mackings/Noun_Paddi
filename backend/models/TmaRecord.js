const mongoose = require('mongoose');

const tmaRecordSchema = new mongoose.Schema({
  studentName: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true,
  },
  matricNumber: {
    type: String,
    required: [true, 'Matric number is required'],
    trim: true,
    uppercase: true,
  },
  course: {
    type: String,
    required: [true, 'Course is required'],
    trim: true,
    uppercase: true,
  },
  tmaNumber: {
    type: String,
    enum: ['tma_1', 'tma_2', 'tma_3'],
    required: true,
  },
  score: {
    type: Number,
    required: true,
    min: 0,
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

tmaRecordSchema.index({ course: 1, tmaNumber: 1, matricNumber: 1 }, { unique: true });
tmaRecordSchema.index({ matricNumber: 1 });
tmaRecordSchema.index({ createdAt: -1 });

module.exports = mongoose.model('TmaRecord', tmaRecordSchema);
