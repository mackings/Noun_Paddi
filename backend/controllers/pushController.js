const {
  getPublicVapidKey,
  saveUserSubscription,
  removeUserSubscription,
} = require('../utils/pushService');

exports.getPublicKey = async (req, res) => {
  try {
    const publicKey = getPublicVapidKey();
    res.status(200).json({
      success: true,
      data: { publicKey },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.subscribe = async (req, res) => {
  try {
    const subscription = req.body?.subscription;
    if (!subscription) {
      return res.status(400).json({
        success: false,
        message: 'Subscription payload is required.',
      });
    }

    await saveUserSubscription({
      userId: req.user._id,
      subscription,
      userAgent: req.headers['user-agent'] || '',
    });

    return res.status(200).json({
      success: true,
      message: 'Push subscription saved.',
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Unable to save push subscription.',
    });
  }
};

exports.unsubscribe = async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Subscription endpoint is required.',
      });
    }

    const deleted = await removeUserSubscription({
      endpoint,
      userId: req.user._id,
    });

    return res.status(200).json({
      success: true,
      message: deleted ? 'Push subscription removed.' : 'No push subscription found for endpoint.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to unsubscribe from push notifications.',
    });
  }
};
