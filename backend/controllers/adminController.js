const crypto = require('crypto');
const Faculty = require('../models/Faculty');
const Department = require('../models/Department');
const Course = require('../models/Course');
const User = require('../models/User');
const { sendAdminInviteEmail } = require('../utils/emailService');
const { auditLog } = require('../utils/securityAudit');
const BroadcastSchedule = require('../models/BroadcastSchedule');
const {
  dispatchBroadcast,
  validateBroadcastConfig,
  normalizeChannels,
  normalizeEmailList,
} = require('../utils/broadcastDispatcher');
const { processDueBroadcasts } = require('../utils/broadcastScheduler');

const sanitizeText = (value) => String(value || '')
  .replace(/<[^>]*>/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const sanitizeImageUrl = (value) => {
  const cleaned = sanitizeText(value);
  if (!cleaned) return '';

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }
    return parsed.toString();
  } catch {
    return '';
  }
};

const normalizeChannelsWithLegacy = (rawChannels, legacyChannel) => {
  if (Array.isArray(rawChannels) && rawChannels.length > 0) {
    return normalizeChannels(rawChannels);
  }

  const legacy = sanitizeText(legacyChannel).toLowerCase();
  if (!legacy) return ['push'];
  if (legacy === 'both') return ['push', 'email'];
  if (legacy === 'push' || legacy === 'email') return [legacy];
  return ['push'];
};

const buildArchiveFilter = (includeArchived) => {
  if (includeArchived) {
    return {};
  }
  return { isArchived: { $ne: true } };
};

const safeSecretEqual = (left, right) => {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

// @desc    Get faculties (admin)
// @route   GET /api/admin/faculties
// @access  Private/Admin
exports.getFacultiesAdmin = async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const faculties = await Faculty.find(buildArchiveFilter(includeArchived)).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: faculties.length,
      data: faculties,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get departments (admin)
// @route   GET /api/admin/departments
// @access  Private/Admin
exports.getDepartmentsAdmin = async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const departments = await Department.find(buildArchiveFilter(includeArchived))
      .populate('facultyId', 'name code')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: departments.length,
      data: departments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get courses (admin)
// @route   GET /api/admin/courses
// @access  Private/Admin
exports.getCoursesAdmin = async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const courses = await Course.find(buildArchiveFilter(includeArchived))
      .populate('departmentId', 'name facultyId')
      .sort({ courseCode: 1 });

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Invite admin (admin)
// @route   POST /api/admin/invite
// @access  Private/Admin
exports.inviteAdmin = async (req, res) => {
  try {
    const name = sanitizeText(req.body.name);
    const email = sanitizeText(req.body.email).toLowerCase();

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      await auditLog({
        eventType: 'admin.invite',
        req,
        userId: req.user?._id,
        email,
        success: false,
        message: 'Invite target already exists',
      });
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists',
      });
    }

    const rawPassword = crypto.randomBytes(10).toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 12);

    const adminUser = await User.create({
      name,
      email,
      password: rawPassword,
      role: 'admin',
    });

    await sendAdminInviteEmail({
      email,
      userName: name,
      tempPassword: rawPassword,
    });
    await auditLog({
      eventType: 'admin.invite',
      req,
      userId: req.user?._id,
      email,
      success: true,
      message: 'Admin invite sent',
      metadata: { invitedUserId: adminUser._id },
    });

    res.status(201).json({
      success: true,
      data: {
        _id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
      },
    });
  } catch (error) {
    await auditLog({
      eventType: 'admin.invite',
      req,
      userId: req.user?._id,
      email: req.body?.email,
      success: false,
      message: error.message,
    });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Send push notification broadcast (admin)
// @route   POST /api/admin/notifications
// @access  Private/Admin
exports.sendPushNotification = async (req, res) => {
  try {
    const title = sanitizeText(req.body.title);
    const message = sanitizeText(req.body.message);
    const url = sanitizeText(req.body.url) || '/';
    const imageUrl = sanitizeImageUrl(req.body.imageUrl);
    const channels = normalizeChannelsWithLegacy(req.body.channels, req.body.channel);
    const emailTarget = sanitizeText(req.body.emailTarget || 'all').toLowerCase();
    const emailRecipients = normalizeEmailList(req.body.emails);
    const sendAtValue = sanitizeText(req.body.sendAt);
    const sendAt = sendAtValue ? new Date(sendAtValue) : null;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required.',
      });
    }

    if (sendAt && Number.isNaN(sendAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scheduled date/time.',
      });
    }

    const isScheduled = sendAt && sendAt.getTime() > Date.now();

    if (isScheduled) {
      const validated = validateBroadcastConfig({
        channels,
        emailTarget,
        emails: emailRecipients,
      });

      const scheduled = await BroadcastSchedule.create({
        title,
        message,
        url,
        imageUrl,
        channels: validated.channels,
        emailTarget: validated.emailTarget,
        emails: validated.emailTarget === 'single' ? validated.emails.slice(0, 3) : [],
        sendAt,
        createdBy: req.user._id,
      });

      console.log(
        `[broadcast] scheduled job=${scheduled._id} by=${req.user?._id} ` +
        `sendAt=${scheduled.sendAt.toISOString()} channels=${scheduled.channels.join(',')} ` +
        `emailTarget=${scheduled.emailTarget} recipients=${scheduled.emails.length}`
      );

      return res.status(200).json({
        success: true,
        message: `Broadcast scheduled for ${sendAt.toISOString()}.`,
        data: {
          scheduled: true,
          id: scheduled._id,
          sendAt: scheduled.sendAt,
          channels: scheduled.channels,
        },
      });
    }

    const result = await dispatchBroadcast({
      title,
      message,
      url,
      imageUrl,
      channels,
      emailTarget,
      emails: emailRecipients,
    });
    await auditLog({
      eventType: 'admin.broadcast.send',
      req,
      userId: req.user?._id,
      success: true,
      message: 'Broadcast dispatched',
      metadata: {
        channels: result.channels,
        pushSent: result.push?.sent || 0,
        emailSent: result.email?.sent || 0,
        errors: result.errors?.length || 0,
      },
    });

    return res.status(200).json({
      success: true,
      message: result.errors.length > 0 ? 'Broadcast completed with partial errors.' : 'Broadcast completed.',
      data: {
        scheduled: false,
        ...result,
      },
    });
  } catch (error) {
    await auditLog({
      eventType: 'admin.broadcast.send',
      req,
      userId: req.user?._id,
      success: false,
      message: error.message,
    });
    console.error('[broadcast] send failed:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to send broadcast notification.',
    });
  }
};

// @desc    Upload notification image (admin)
// @route   POST /api/admin/notifications/upload-image
// @access  Private/Admin
exports.uploadNotificationImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        imageUrl: sanitizeImageUrl(req.file.secure_url || req.file.path),
        publicId: req.file.filename,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to upload notification image.',
    });
  }
};

// @desc    Trigger processing for due scheduled broadcasts (cron/admin)
// @route   POST /api/admin/notifications/process-scheduled
// @route   GET /api/admin/notifications/process-scheduled/cron
// @access  Private/Admin or Cron secret
exports.processScheduledBroadcasts = async (req, res) => {
  try {
    const cronSecret = sanitizeText(process.env.BROADCAST_CRON_SECRET || process.env.CRON_SECRET);
    const authorizationHeader = sanitizeText(req.headers.authorization || '');
    const bearerToken = authorizationHeader.toLowerCase().startsWith('bearer ')
      ? authorizationHeader.slice(7).trim()
      : '';
    const providedSecret = sanitizeText(
      req.query.key ||
      req.headers['x-broadcast-cron-secret'] ||
      bearerToken ||
      ''
    );
    const isCronRequest = req.path.includes('/cron');
    const isAuthorizedCron = cronSecret && safeSecretEqual(providedSecret, cronSecret);

    if (isCronRequest && !isAuthorizedCron) {
      return res.status(401).json({
        success: false,
        message: 'Invalid cron secret.',
      });
    }

    const source = isCronRequest ? 'cron' : `admin:${req.user?._id || 'unknown'}`;
    const summary = await processDueBroadcasts({ source });

    console.log(
      `[broadcast] process-scheduled source=${source} ok=${summary.ok} ` +
      `skipped=${summary.skipped} found=${summary.found || 0} ` +
      `processed=${summary.processed || 0} sent=${summary.sent || 0} failed=${summary.failed || 0}`
    );

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('[broadcast] process-scheduled failed:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to process scheduled broadcasts.',
    });
  }
};
