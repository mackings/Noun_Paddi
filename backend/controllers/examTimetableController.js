const StudentExamSchedule = require('../models/StudentExamSchedule');
const { processDueExamScoreReminders } = require('../utils/examScoreReminderScheduler');
const {
  findTimetableEntry,
  getExamStartAt,
  normalizeCourseCode,
  searchTimetable,
} = require('../utils/eExamTimetableData');

const serializeSchedule = (item) => ({
  _id: item._id,
  courseCode: item.courseCode,
  courseTitle: item.courseTitle,
  examDate: item.examDate,
  startTime: item.startTime,
  examStartAt: item.examStartAt,
  reminderDueAt: item.reminderDueAt,
  score: item.score,
  scoreRecordedAt: item.scoreRecordedAt,
  scoreReminderSentAt: item.scoreReminderSentAt,
});

exports.searchExamTimetable = async (req, res) => {
  const query = req.query.q || '';
  const results = searchTimetable(query, 25);
  res.status(200).json({
    success: true,
    data: results,
  });
};

exports.getMyExamSchedule = async (req, res) => {
  processDueExamScoreReminders({ source: 'student_timetable_open' }).catch((error) => {
    console.error('[exam-score-reminder] opportunistic processing failed:', error);
  });

  const schedule = await StudentExamSchedule.find({ studentId: req.user._id })
    .sort({ examStartAt: 1, courseCode: 1 });

  res.status(200).json({
    success: true,
    data: schedule.map(serializeSchedule),
  });
};

exports.addCourseToSchedule = async (req, res) => {
  const courseCode = normalizeCourseCode(req.body?.courseCode);
  const entry = findTimetableEntry(courseCode);

  if (!entry) {
    return res.status(404).json({
      success: false,
      message: 'Course code was not found in the 2026_1 e-exam final timetable.',
    });
  }

  const examStartAt = getExamStartAt(entry);
  const reminderDueAt = new Date(examStartAt.getTime() + (2 * 60 * 60 * 1000));

  const schedule = await StudentExamSchedule.findOneAndUpdate(
    { studentId: req.user._id, courseCode: entry.courseCode },
    {
      $setOnInsert: {
        studentId: req.user._id,
        courseCode: entry.courseCode,
        courseTitle: entry.courseTitle,
        examDate: new Date(`${entry.examDate}T00:00:00.000Z`),
        startTime: entry.startTime,
        examStartAt,
        reminderDueAt,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(201).json({
    success: true,
    data: serializeSchedule(schedule),
  });
};

exports.removeCourseFromSchedule = async (req, res) => {
  const deleted = await StudentExamSchedule.findOneAndDelete({
    _id: req.params.id,
    studentId: req.user._id,
  });

  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: 'Scheduled exam was not found.',
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Exam removed from your timetable.',
  });
};

exports.recordExamScore = async (req, res) => {
  const score = Number(req.body?.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return res.status(400).json({
      success: false,
      message: 'Score must be a number from 0 to 100.',
    });
  }

  const schedule = await StudentExamSchedule.findOneAndUpdate(
    { _id: req.params.id, studentId: req.user._id },
    {
      score,
      scoreRecordedAt: new Date(),
    },
    { new: true }
  );

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: 'Scheduled exam was not found.',
    });
  }

  return res.status(200).json({
    success: true,
    data: serializeSchedule(schedule),
  });
};

exports.processExamScoreRemindersCron = async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const requestSecret = req.headers['x-cron-secret'] || req.query.secret;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';

  if (!isVercelCron && (!cronSecret || requestSecret !== cronSecret)) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized cron request.',
    });
  }

  const summary = await processDueExamScoreReminders({ source: 'cron' });
  return res.status(summary.ok ? 200 : 500).json({
    success: summary.ok,
    data: summary,
  });
};
