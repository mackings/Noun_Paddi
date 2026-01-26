const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  courseCode: {
    type: String,
    required: [true, 'Please add a course code'],
    unique: true,
    uppercase: true,
    trim: true,
  },
  courseName: {
    type: String,
    required: [true, 'Please add a course name'],
    trim: true,
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  creditUnits: {
    type: Number,
    default: 3,
  },
  isArchived: {
    type: Boolean,
    default: false,
  },
  archivedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Course', courseSchema);
