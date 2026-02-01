const FeatureCount = require('../models/FeatureCount');

const sanitizeFeature = (value) => String(value || '')
  .replace(/[^a-zA-Z0-9_-]/g, '')
  .slice(0, 64)
  .trim();

// @desc    Track feature visit
// @route   POST /api/analytics/feature-visit
// @access  Public
exports.trackFeatureVisit = async (req, res) => {
  try {
    const feature = sanitizeFeature(req.body.feature);
    if (!feature) {
      return res.status(400).json({
        success: false,
        message: 'Feature is required',
      });
    }

    const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    await FeatureCount.findOneAndUpdate(
      { feature, date: dateKey },
      { $inc: { count: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get feature visit stats
// @route   GET /api/analytics/feature-stats
// @access  Private/Admin
exports.getFeatureStats = async (req, res) => {
  try {
    const totals = await FeatureCount.aggregate([
      {
        $group: {
          _id: '$feature',
          total: { $sum: '$count' },
        }
      },
      { $sort: { total: -1 } }
    ]);

    const last7Days = new Date();
    last7Days.setUTCDate(last7Days.getUTCDate() - 6);
    const startKey = last7Days.toISOString().slice(0, 10);

    const recent = await FeatureCount.aggregate([
      { $match: { date: { $gte: startKey } } },
      {
        $group: {
          _id: '$feature',
          total: { $sum: '$count' },
        }
      },
      { $sort: { total: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totals,
        last7Days: recent,
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
