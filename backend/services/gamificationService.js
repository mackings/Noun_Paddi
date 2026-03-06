const GamificationActivity = require('../models/GamificationActivity');

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeSummaryMetrics = (metrics = {}) => {
  const wordCount = Math.max(0, Math.round(toNumber(metrics.wordCount, 0)));
  const activeSeconds = Math.max(0, Math.round(toNumber(metrics.activeSeconds, 0)));
  const scrollDepth = clamp(toNumber(metrics.scrollDepth, 0), 0, 1);
  const sectionCoverage = clamp(toNumber(metrics.sectionCoverage, 0), 0, 1);
  const interactionCount = Math.max(0, Math.round(toNumber(metrics.interactionCount, 0)));

  const expectedSeconds = wordCount > 0 ? Math.round((wordCount / 220) * 60) : 45;
  const requiredActiveSeconds = clamp(Math.round(expectedSeconds * 0.45), 45, 240);

  return {
    sessionId: String(metrics.sessionId || '').trim(),
    wordCount,
    activeSeconds,
    scrollDepth,
    sectionCoverage,
    interactionCount,
    requiredActiveSeconds,
  };
};

const validateSummaryMetrics = (metrics) => {
  const failures = [];

  if (metrics.activeSeconds < metrics.requiredActiveSeconds) {
    failures.push(`active reading time below minimum (${metrics.activeSeconds}s < ${metrics.requiredActiveSeconds}s)`);
  }
  if (metrics.scrollDepth < 0.92) {
    failures.push(`scroll depth too low (${Math.round(metrics.scrollDepth * 100)}%)`);
  }
  if (metrics.sectionCoverage < 0.9) {
    failures.push(`content coverage too low (${Math.round(metrics.sectionCoverage * 100)}%)`);
  }
  if (metrics.interactionCount < 8) {
    failures.push('insufficient reading interactions');
  }

  return failures;
};

exports.recordPracticeAttemptActivity = async ({
  studentId,
  courseId,
  score,
  totalQuestions,
  percentage,
  timeTaken,
}) => {
  const normalizedPercentage = clamp(toNumber(percentage, 0), 0, 100);
  const normalizedScore = Math.max(0, Math.round(toNumber(score, 0)));
  const normalizedTotal = Math.max(0, Math.round(toNumber(totalQuestions, 0)));

  const bestPrevious = await GamificationActivity.findOne({
    studentId,
    courseId,
    type: 'practice_attempt',
  })
    .sort({ 'score.percentage': -1, occurredAt: -1 })
    .lean();

  const previousBest = toNumber(bestPrevious?.score?.percentage, 0);
  const isFirstAttempt = !bestPrevious;
  const improvement = Math.max(0, normalizedPercentage - previousBest);

  let points = 0;
  if (isFirstAttempt) {
    points = Math.round(normalizedPercentage);
  } else if (improvement > 0) {
    points = Math.round(improvement);
  }

  const activity = await GamificationActivity.create({
    studentId,
    courseId,
    type: 'practice_attempt',
    points,
    score: {
      value: normalizedScore,
      max: normalizedTotal,
      percentage: normalizedPercentage,
      timeTaken: Math.max(0, Math.round(toNumber(timeTaken, 0))),
    },
    metadata: {
      isFirstAttempt,
      previousBest,
      improvement,
      pointsRule: isFirstAttempt ? 'first_attempt_percentage' : 'best_improvement_delta',
    },
  });

  return {
    activity,
    pointsAwarded: points,
    isFirstAttempt,
    improvement,
  };
};

exports.recordSummaryCompletionActivity = async ({
  studentId,
  courseId,
  materialId,
  metrics,
}) => {
  const normalized = normalizeSummaryMetrics(metrics);
  const failures = validateSummaryMetrics(normalized);

  if (failures.length > 0) {
    return {
      accepted: false,
      reason: failures.join('; '),
      metrics: normalized,
      alreadyAwarded: false,
    };
  }

  const dedupeKey = `summary:${studentId}:${materialId}`;
  const existing = await GamificationActivity.findOne({ dedupeKey }).lean();
  if (existing) {
    return {
      accepted: true,
      alreadyAwarded: true,
      pointsAwarded: 0,
      metrics: normalized,
      activity: existing,
    };
  }

  const pointsAwarded = 15;
  const activity = await GamificationActivity.create({
    studentId,
    courseId,
    materialId,
    type: 'summary_completion',
    points: pointsAwarded,
    reading: normalized,
    metadata: {
      completionMode: 'validated_scroll_read',
    },
    dedupeKey,
  });

  return {
    accepted: true,
    alreadyAwarded: false,
    pointsAwarded,
    metrics: normalized,
    activity,
  };
};

exports.getSummaryValidationThreshold = (wordCount) => {
  const normalized = normalizeSummaryMetrics({ wordCount });
  return {
    requiredActiveSeconds: normalized.requiredActiveSeconds,
    requiredScrollDepth: 0.92,
    requiredSectionCoverage: 0.9,
    requiredInteractionCount: 8,
  };
};
