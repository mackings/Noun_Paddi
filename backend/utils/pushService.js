const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

let pushConfigured = false;

const ensurePushConfigured = () => {
  if (pushConfigured) return;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@paddi.com.ng';

  if (!publicKey || !privateKey) {
    throw new Error('Push notifications are not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  pushConfigured = true;
};

const getPublicVapidKey = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error('VAPID_PUBLIC_KEY is missing on the server.');
  }
  return publicKey;
};

const normalizeSubscription = (subscription) => ({
  endpoint: String(subscription.endpoint || '').trim(),
  expirationTime: subscription.expirationTime || null,
  keys: {
    p256dh: String(subscription.keys?.p256dh || '').trim(),
    auth: String(subscription.keys?.auth || '').trim(),
  },
});

const saveUserSubscription = async ({ userId, subscription, userAgent = '' }) => {
  const normalized = normalizeSubscription(subscription || {});

  if (!normalized.endpoint || !normalized.keys.p256dh || !normalized.keys.auth) {
    throw new Error('Invalid push subscription payload.');
  }

  return PushSubscription.findOneAndUpdate(
    { endpoint: normalized.endpoint },
    {
      userId,
      endpoint: normalized.endpoint,
      expirationTime: normalized.expirationTime,
      keys: normalized.keys,
      userAgent,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const removeUserSubscription = async ({ endpoint, userId }) => {
  const endpointValue = String(endpoint || '').trim();
  if (!endpointValue) return 0;

  const result = await PushSubscription.deleteOne({
    endpoint: endpointValue,
    userId,
  });
  return result.deletedCount || 0;
};

const sendBroadcastNotification = async ({ title, message, url = '/', imageUrl = '' }) => {
  ensurePushConfigured();

  const subscriptions = await PushSubscription.find({});
  if (subscriptions.length === 0) {
    return { total: 0, sent: 0, failed: 0, removed: 0 };
  }

  const payload = JSON.stringify({
    title,
    body: message,
    url,
    imageUrl,
  });

  let sent = 0;
  let failed = 0;
  let removed = 0;

  await Promise.all(
    subscriptions.map(async (record) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: record.endpoint,
            expirationTime: record.expirationTime || null,
            keys: record.keys,
          },
          payload
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode = error?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await PushSubscription.deleteOne({ _id: record._id });
          removed += 1;
        }
      }
    })
  );

  return {
    total: subscriptions.length,
    sent,
    failed,
    removed,
  };
};

const sendUserNotification = async ({ userId, title, message, url = '/', imageUrl = '' }) => {
  ensurePushConfigured();

  const subscriptions = await PushSubscription.find({ userId });
  if (subscriptions.length === 0) {
    return { total: 0, sent: 0, failed: 0, removed: 0 };
  }

  const payload = JSON.stringify({
    title,
    body: message,
    url,
    imageUrl,
  });

  let sent = 0;
  let failed = 0;
  let removed = 0;

  await Promise.all(
    subscriptions.map(async (record) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: record.endpoint,
            expirationTime: record.expirationTime || null,
            keys: record.keys,
          },
          payload
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode = error?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await PushSubscription.deleteOne({ _id: record._id });
          removed += 1;
        }
      }
    })
  );

  return {
    total: subscriptions.length,
    sent,
    failed,
    removed,
  };
};

module.exports = {
  getPublicVapidKey,
  saveUserSubscription,
  removeUserSubscription,
  sendBroadcastNotification,
  sendUserNotification,
};
