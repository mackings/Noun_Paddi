const TmaRecord = require('../models/TmaRecord');

const TMA_NUMBERS = new Set(['tma_1', 'tma_2', 'tma_3']);

exports.listTmaRecords = async (req, res) => {
  try {
    const { course, tmaNumber, search } = req.query;
    const filter = {};

    if (course && course.trim()) {
      filter.course = new RegExp(course.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    if (tmaNumber && TMA_NUMBERS.has(tmaNumber)) filter.tmaNumber = tmaNumber;
    if (search && search.trim()) {
      const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ studentName: regex }, { matricNumber: regex }];
    }

    const records = await TmaRecord.find(filter)
      .sort({ createdAt: -1 })
      .populate('recordedBy', 'name')
      .lean();

    return res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load TMA records.',
    });
  }
};

exports.createTmaRecord = async (req, res) => {
  try {
    const { studentName, matricNumber, course, tmaNumber, score } = req.body || {};

    if (!studentName || !String(studentName).trim()) {
      return res.status(400).json({ success: false, message: 'Student name is required.' });
    }
    if (!matricNumber || !String(matricNumber).trim()) {
      return res.status(400).json({ success: false, message: 'Matric number is required.' });
    }
    if (!course || !String(course).trim()) {
      return res.status(400).json({ success: false, message: 'Course is required.' });
    }
    if (!TMA_NUMBERS.has(tmaNumber)) {
      return res.status(400).json({ success: false, message: 'Select a valid TMA (TMA 1, 2, or 3).' });
    }
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore) || numericScore < 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid score.' });
    }

    const record = await TmaRecord.create({
      studentName: String(studentName).trim(),
      matricNumber: String(matricNumber).trim(),
      course: String(course).trim(),
      tmaNumber,
      score: numericScore,
      recordedBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      data: record,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A record for this student, course, and TMA already exists. Edit the existing record instead.',
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to save TMA record.',
    });
  }
};

exports.updateTmaRecord = async (req, res) => {
  try {
    const record = await TmaRecord.findById(req.params.recordId);
    if (!record) {
      return res.status(404).json({ success: false, message: 'TMA record not found.' });
    }

    const { studentName, matricNumber, course, score } = req.body || {};

    if (studentName !== undefined) {
      if (!String(studentName).trim()) {
        return res.status(400).json({ success: false, message: 'Student name cannot be empty.' });
      }
      record.studentName = String(studentName).trim();
    }

    if (matricNumber !== undefined) {
      if (!String(matricNumber).trim()) {
        return res.status(400).json({ success: false, message: 'Matric number cannot be empty.' });
      }
      record.matricNumber = String(matricNumber).trim();
    }

    if (course !== undefined) {
      if (!String(course).trim()) {
        return res.status(400).json({ success: false, message: 'Course cannot be empty.' });
      }
      record.course = String(course).trim();
    }

    if (score !== undefined) {
      const numericScore = Number(score);
      if (!Number.isFinite(numericScore) || numericScore < 0) {
        return res.status(400).json({ success: false, message: 'Enter a valid score.' });
      }
      record.score = numericScore;
    }

    await record.save();

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A record for this student, course, and TMA already exists.',
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update TMA record.',
    });
  }
};

exports.deleteTmaRecord = async (req, res) => {
  try {
    const record = await TmaRecord.findById(req.params.recordId);
    if (!record) {
      return res.status(404).json({ success: false, message: 'TMA record not found.' });
    }

    await record.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'TMA record deleted.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete TMA record.',
    });
  }
};
