const { sendUserReviewEmail } = require('../utils/emailService');

// @desc    Submit user review
// @route   POST /api/reviews
// @access  Private
exports.submitReview = async (req, res) => {
  try {
    const {
      featureUsed,
      sentiment,
      rating,
      reasons,
      details,
    } = req.body || {};

    const trimmedFeature = String(featureUsed || '').trim();
    const trimmedSentiment = String(sentiment || '').trim().toLowerCase();
    const trimmedReasons = String(reasons || '').trim();
    const trimmedDetails = String(details || '').trim();
    const numericRating = Number(rating);

    if (!trimmedFeature || !trimmedSentiment || !numericRating || !trimmedReasons) {
      return res.status(400).json({
        success: false,
        message: 'Please complete all required review fields.',
      });
    }

    if (!['positive', 'neutral', 'negative'].includes(trimmedSentiment)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sentiment selection.',
      });
    }

    if (numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5.',
      });
    }

    await sendUserReviewEmail({
      featureUsed: trimmedFeature,
      sentiment: trimmedSentiment,
      rating: numericRating,
      reasons: trimmedReasons,
      details: trimmedDetails,
      user: req.user,
    });

    return res.status(200).json({
      success: true,
      message: 'Review submitted. Thank you for your feedback!',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit review',
    });
  }
};
