const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a department name'],
    trim: true,
  },
  code: {
    type: String,
    required: [true, 'Please add a department code'],
    trim: true,
    uppercase: true,
  },
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true,
  },
  description: {
    type: String,
    default: '',
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

module.exports = mongoose.model('Department', departmentSchema);
