const StudentExamSchedule = require('../models/StudentExamSchedule');
const { sendUserNotification } = require('./pushService');

const POLL_INTERVAL_MS = Number(process.env.EXAM_SCORE_REMINDER_INTERVAL_MS || 60000);
const BATCH_SIZE = Number(process.env.EXAM_SCORE_REMINDER_BATCH_SIZE || 25);

let schedulerTimer = null;
let isProcessing = false;

const processDueExamScoreReminders = async (options = {}) => {
  const source = options.source || 'runtime';
  if (isProcessing) {
    return { ok: true, source, skipped: true, reason: 'already_processing' };
  }

  isProcessing = true;
  const summary = {
    ok: true,
    source,
    found: 0,
    processed: 0,
    sent: 0,
    failed: 0,
  };

  try {
    const due = await StudentExamSchedule.find({
      score: null,
      scoreReminderSentAt: null,
      reminderDueAt: { $lte: new Date() },
    })
      .sort({ reminderDueAt: 1 })
      .limit(BATCH_SIZE);

    summary.found = due.length;

    for (const exam of due) {
      const locked = await StudentExamSchedule.findOneAndUpdate(
        { _id: exam._id, score: null, scoreReminderSentAt: null },
        { scoreReminderSentAt: new Date() },
        { new: true }
      );

      if (!locked) continue;
      summary.processed += 1;

      try {
        const result = await sendUserNotification({
          userId: locked.studentId,
          title: 'Record your exam score',
          message: `How was ${locked.courseCode}? Add your score now while it is fresh.`,
          url: '/exam-timetable',
        });
        summary.sent += result.sent || 0;
      } catch (error) {
        summary.failed += 1;
        await StudentExamSchedule.findByIdAndUpdate(locked._id, {
          scoreReminderSentAt: null,
        });
      }
    }
  } catch (error) {
    summary.ok = false;
    summary.error = error.message || 'Exam score reminder scheduler error';
  } finally {
    isProcessing = false;
  }

  return summary;
};

const startExamScoreReminderScheduler = () => {
  if (schedulerTimer) return;

  schedulerTimer = setInterval(() => {
    processDueExamScoreReminders().catch((error) => {
      console.error('[exam-score-reminder-scheduler] execution error:', error);
    });
  }, POLL_INTERVAL_MS);

  processDueExamScoreReminders().catch((error) => {
    console.error('[exam-score-reminder-scheduler] startup error:', error);
  });
};

module.exports = {
  processDueExamScoreReminders,
  startExamScoreReminderScheduler,
};
