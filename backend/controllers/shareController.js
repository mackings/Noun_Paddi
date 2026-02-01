const crypto = require('crypto');
const Material = require('../models/Material');
const ShareLink = require('../models/ShareLink');

const DEFAULT_SHARE_TTL_DAYS = 30;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken() {
  // 12-char url-safe token (base64url)
  return crypto.randomBytes(9).toString('base64url');
}

async function createUniqueToken() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const existing = await ShareLink.findOne({ tokenHash }).select('_id').lean();
    if (!existing) {
      return { token, tokenHash };
    }
  }
  throw new Error('Failed to generate unique share token');
}

function getShareExpiry() {
  const ttlDays = parseInt(process.env.SHARE_LINK_TTL_DAYS || `${DEFAULT_SHARE_TTL_DAYS}`, 10);
  if (!Number.isFinite(ttlDays) || ttlDays <= 0) {
    return null;
  }
  return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
}

// @desc    Create a share link for a material PDF
// @route   POST /api/share/materials/:materialId
// @access  Private
exports.createShareLink = async (req, res) => {
  try {
    const material = await Material.findById(req.params.materialId).select('courseId title');
    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found',
      });
    }

    const { token, tokenHash } = await createUniqueToken();
    const expiresAt = getShareExpiry();

    await ShareLink.create({
      materialId: material._id,
      tokenHash,
      createdBy: req.user?._id,
      expiresAt: expiresAt || undefined,
    });

    const baseUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const shareUrl = baseUrl ? `${baseUrl}/share/${token}` : `/share/${token}`;

    return res.status(201).json({
      success: true,
      data: {
        token,
        shareUrl,
        expiresAt,
        materialTitle: material.title,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create share link',
    });
  }
};

// @desc    Resolve a share link token
// @route   GET /api/share/:token
// @access  Public
exports.getShareLink = async (req, res) => {
  try {
    const token = req.params.token;
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Share token is required',
      });
    }

    const tokenHash = hashToken(token);
    const shareLink = await ShareLink.findOne({
      tokenHash,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).populate('materialId', 'courseId title');

    if (!shareLink || !shareLink.materialId) {
      return res.status(404).json({
        success: false,
        message: 'Share link not found or expired',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        materialId: shareLink.materialId._id,
        title: shareLink.materialId.title,
        courseId: shareLink.materialId.courseId,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to resolve share link',
    });
  }
};
