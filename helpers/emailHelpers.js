// ============================================
// helpers/emailHelpers.js
// Email helper functions
// ============================================

async function sendWelcomeEmail(userId) {
  console.log('Welcome email queued for user:', userId);
}

async function sendPasswordResetEmail(userId, token) {
  console.log('Password reset email queued for user:', userId);
}

module.exports = { sendWelcomeEmail, sendPasswordResetEmail };
