// Generates a unique referral slug from a user's first name (e.g. "Mac Kingsley" -> "mac"),
// appending an incrementing number on collision (mac2, mac3, ...). Used both at signup
// (every new student gets one automatically) and lazily for accounts created before this
// feature existed (backfilled the first time they open their referral card).
async function generateUniqueReferralSlug(User, name) {
  const firstName = String(name || '').trim().split(/\s+/)[0] || 'student';
  const base = firstName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) || 'student';

  let candidate = base;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await User.exists({ referralSlug: candidate })) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }

  return candidate;
}

module.exports = { generateUniqueReferralSlug };
