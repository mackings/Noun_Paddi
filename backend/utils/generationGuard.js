const Material = require('../models/Material');

const DEFAULT_LOCK_TTL_MS = 20 * 60 * 1000;

const acquireGenerationLock = async (materialId, lockKey, ttlMs = DEFAULT_LOCK_TTL_MS) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  const material = await Material.findOneAndUpdate(
    {
      _id: materialId,
      $or: [
        { generationLockExpiresAt: null },
        { generationLockExpiresAt: { $exists: false } },
        { generationLockExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        generationLockKey: lockKey,
        generationLockExpiresAt: expiresAt,
        lastGenerationStartedAt: now,
      },
    },
    { new: true }
  );

  if (material) {
    return { acquired: true, material };
  }

  const current = await Material.findById(materialId).select('generationLockKey generationLockExpiresAt processingStatus');
  return {
    acquired: false,
    currentLockKey: current?.generationLockKey || '',
    lockExpiresAt: current?.generationLockExpiresAt || null,
    processingStatus: current?.processingStatus || '',
  };
};

const releaseGenerationLock = async (materialId, lockKey) => {
  await Material.updateOne(
    {
      _id: materialId,
      generationLockKey: lockKey,
    },
    {
      $set: {
        generationLockKey: '',
        generationLockExpiresAt: null,
        lastGenerationCompletedAt: new Date(),
      },
    }
  );
};

module.exports = {
  DEFAULT_LOCK_TTL_MS,
  acquireGenerationLock,
  releaseGenerationLock,
};
