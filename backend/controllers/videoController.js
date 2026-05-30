const VideoComment = require('../models/VideoComment');

const isValidVideoId = (value) => /^[a-zA-Z0-9_-]{6,20}$/.test(String(value || '').trim());

exports.getVideoComments = async (req, res) => {
  try {
    const videoId = String(req.params.videoId || '').trim();

    if (!isValidVideoId(videoId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid video reference.',
      });
    }

    const comments = await VideoComment.find({ videoId })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      count: comments.length,
      data: comments.map((item) => ({
        _id: item._id,
        videoId: item.videoId,
        comment: item.comment,
        createdAt: item.createdAt,
        user: {
          _id: item.userId?._id,
          name: item.userId?.name || 'Student',
        },
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load comments.',
    });
  }
};

exports.createVideoComment = async (req, res) => {
  try {
    const videoId = String(req.params.videoId || '').trim();
    const comment = String(req.body?.comment || '').trim();

    if (!isValidVideoId(videoId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid video reference.',
      });
    }

    if (!comment) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a comment.',
      });
    }

    if (comment.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Comments must be 1000 characters or less.',
      });
    }

    const created = await VideoComment.create({
      videoId,
      userId: req.user._id,
      comment,
    });

    await created.populate('userId', 'name');

    return res.status(201).json({
      success: true,
      data: {
        _id: created._id,
        videoId: created.videoId,
        comment: created.comment,
        createdAt: created.createdAt,
        user: {
          _id: created.userId?._id,
          name: created.userId?.name || 'Student',
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to save comment.',
    });
  }
};
