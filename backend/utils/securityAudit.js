const SecurityAuditLog = require('../models/SecurityAuditLog');

const getClientIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
  req.connection?.remoteAddress ||
  req.socket?.remoteAddress ||
  '';

const getUserAgent = (req) => String(req.headers['user-agent'] || '').slice(0, 300);

const auditLog = async ({
  eventType,
  req,
  userId = null,
  email = '',
  success = true,
  message = '',
  metadata = {},
}) => {
  try {
    await SecurityAuditLog.create({
      eventType,
      success,
      userId: userId || req?.user?._id || undefined,
      email: String(email || '').toLowerCase(),
      ip: req ? getClientIp(req) : '',
      userAgent: req ? getUserAgent(req) : '',
      message: String(message || '').slice(0, 500),
      metadata,
    });
  } catch (error) {
    console.error('Security audit logging failed:', error.message);
  }
};

module.exports = { auditLog };
