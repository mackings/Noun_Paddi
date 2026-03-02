const User = require('../models/User');
const { sendBroadcastNotification } = require('./pushService');
const { sendBroadcastEmail } = require('./emailService');

const sanitizeText = (value) => String(value || '')
  .replace(/<[^>]*>/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const normalizeChannels = (rawChannels) => {
  if (!Array.isArray(rawChannels)) return ['push'];
  const channels = [...new Set(rawChannels.map((item) => sanitizeText(item).toLowerCase()).filter(Boolean))];
  return channels.length > 0 ? channels : ['push'];
};

const normalizeEmailList = (rawEmails) => {
  if (!Array.isArray(rawEmails)) return [];
  return [...new Set(rawEmails.map((item) => sanitizeText(item).toLowerCase()).filter(Boolean))];
};

const validateBroadcastConfig = ({ channels = ['push'], emailTarget = 'all', emails = [] }) => {
  const safeChannels = normalizeChannels(channels);
  const safeEmailTarget = sanitizeText(emailTarget).toLowerCase() === 'single' ? 'single' : 'all';
  const safeEmails = normalizeEmailList(emails);

  if (!safeChannels.includes('push') && !safeChannels.includes('email')) {
    throw new Error('Select at least one delivery channel.');
  }

  if (safeChannels.includes('email') && safeEmailTarget === 'single') {
    if (safeEmails.length === 0 || safeEmails.length > 3) {
      throw new Error('For single email mode, provide between 1 and 3 email addresses.');
    }
    const invalid = safeEmails.filter((item) => !isValidEmail(item));
    if (invalid.length > 0) {
      throw new Error(`Invalid email(s): ${invalid.join(', ')}`);
    }
  }

  return {
    channels: safeChannels,
    emailTarget: safeEmailTarget,
    emails: safeEmails,
  };
};

const dispatchBroadcast = async ({
  title,
  message,
  url = '/',
  imageUrl = '',
  channels = ['push'],
  emailTarget = 'all',
  emails = [],
}) => {
  const normalized = validateBroadcastConfig({ channels, emailTarget, emails });
  const safeChannels = normalized.channels;
  const safeEmailTarget = normalized.emailTarget;
  const safeEmails = normalized.emails;

  const result = {
    push: null,
    email: null,
    errors: [],
  };

  if (safeChannels.includes('push')) {
    try {
      result.push = await sendBroadcastNotification({
        title,
        message,
        url,
        imageUrl,
      });
    } catch (error) {
      result.errors.push(`Push delivery failed: ${error.message}`);
    }
  }

  if (safeChannels.includes('email')) {
    let recipients = [];

    if (safeEmailTarget === 'single') {
      recipients = safeEmails;
    } else {
      const students = await User.find({ role: 'student' }).select('email');
      recipients = [...new Set(
        students
          .map((student) => sanitizeText(student.email).toLowerCase())
          .filter((email) => isValidEmail(email))
      )];
    }

    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const delivery = await sendBroadcastEmail({
        to: recipient,
        title,
        message,
        url,
        imageUrl,
      });
      if (delivery.success) {
        sent += 1;
      } else {
        failed += 1;
      }
    }

    result.email = {
      target: safeEmailTarget,
      total: recipients.length,
      sent,
      failed,
    };
  }

  return result;
};

module.exports = {
  dispatchBroadcast,
  validateBroadcastConfig,
  normalizeChannels,
  normalizeEmailList,
};
