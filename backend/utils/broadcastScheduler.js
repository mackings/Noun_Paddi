const BroadcastSchedule = require('../models/BroadcastSchedule');
const { dispatchBroadcast } = require('./broadcastDispatcher');

const POLL_INTERVAL_MS = Number(process.env.BROADCAST_SCHEDULER_INTERVAL_MS || 30000);
const BATCH_SIZE = Number(process.env.BROADCAST_SCHEDULER_BATCH_SIZE || 10);

let schedulerTimer = null;
let isProcessing = false;
const log = (...args) => console.log('[broadcast-scheduler]', ...args);
const logError = (...args) => console.error('[broadcast-scheduler]', ...args);

const processDueBroadcasts = async (options = {}) => {
  const source = options.source || 'runtime';
  if (isProcessing) {
    return {
      ok: true,
      source,
      skipped: true,
      reason: 'already_processing',
    };
  }
  isProcessing = true;
  const summary = {
    ok: true,
    source,
    skipped: false,
    found: 0,
    processed: 0,
    sent: 0,
    failed: 0,
  };

  try {
    const now = new Date();
    const dueJobs = await BroadcastSchedule.find({
      status: 'pending',
      sendAt: { $lte: now },
    })
      .sort({ sendAt: 1 })
      .limit(BATCH_SIZE);
    summary.found = dueJobs.length;

    if (dueJobs.length > 0) {
      log(`Found ${dueJobs.length} due job(s) at ${now.toISOString()}`);
    }

    for (const job of dueJobs) {
      log(
        `Processing job=${job._id} sendAt=${job.sendAt?.toISOString?.() || job.sendAt} ` +
        `channels=${(job.channels || []).join(',')} emailTarget=${job.emailTarget}`
      );

      const locked = await BroadcastSchedule.findOneAndUpdate(
        { _id: job._id, status: 'pending' },
        {
          $set: {
            status: 'processing',
            processedAt: new Date(),
            lastError: '',
          },
        },
        { new: true }
      );

      if (!locked) continue;
      summary.processed += 1;

      try {
        const result = await dispatchBroadcast({
          title: locked.title,
          message: locked.message,
          url: locked.url,
          imageUrl: locked.imageUrl,
          channels: locked.channels,
          emailTarget: locked.emailTarget,
          emails: locked.emails,
        });

        const isFailed = Array.isArray(result.errors) && result.errors.length > 0
          && !result.push
          && (!result.email || result.email.sent === 0);

        await BroadcastSchedule.findByIdAndUpdate(locked._id, {
          $set: {
            status: isFailed ? 'failed' : 'sent',
            result,
            sentAt: new Date(),
            lastError: isFailed ? result.errors.join(' ') : '',
          },
        });
        if (isFailed) {
          summary.failed += 1;
        } else {
          summary.sent += 1;
        }
        log(
          `Completed job=${locked._id} status=${isFailed ? 'failed' : 'sent'} ` +
          `pushSent=${result.push?.sent ?? 0}/${result.push?.total ?? 0} ` +
          `emailSent=${result.email?.sent ?? 0}/${result.email?.total ?? 0} ` +
          `errors=${(result.errors || []).length}`
        );
      } catch (error) {
        await BroadcastSchedule.findByIdAndUpdate(locked._id, {
          $set: {
            status: 'failed',
            sentAt: new Date(),
            lastError: error.message || 'Scheduled broadcast failed.',
          },
        });
        summary.failed += 1;
        logError(`Failed job=${locked._id}: ${error.message}`);
      }
    }
  } catch (error) {
    summary.ok = false;
    summary.error = error.message || 'Broadcast scheduler error';
    logError('Broadcast scheduler error:', error);
  } finally {
    isProcessing = false;
  }
  return summary;
};

const startBroadcastScheduler = () => {
  if (schedulerTimer) return;

  log(`Starting scheduler interval=${POLL_INTERVAL_MS}ms batchSize=${BATCH_SIZE}`);

  schedulerTimer = setInterval(() => {
    processDueBroadcasts().catch((error) => {
      logError('Broadcast scheduler execution error:', error);
    });
  }, POLL_INTERVAL_MS);

  processDueBroadcasts().catch((error) => {
    logError('Broadcast scheduler startup run error:', error);
  });
};

module.exports = {
  startBroadcastScheduler,
  processDueBroadcasts,
};
