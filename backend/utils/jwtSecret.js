function getJwtSecret() {
  if (process.env.JWT_SECRET_BASE64) {
    return Buffer.from(process.env.JWT_SECRET_BASE64, 'base64').toString('utf8');
  }
  return process.env.JWT_SECRET;
}

module.exports = { getJwtSecret };
