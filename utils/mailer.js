const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

async function sendEmail(to, subject, html) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email skipped — EMAIL_USER/EMAIL_PASS not set] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    const t = getTransporter();
    await t.sendMail({
      from: `"Learn With Saurab" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    console.log(`[Email sent] To: ${to} | Subject: ${subject}`);
  } catch (err) {
    console.error(`[Email error] To: ${to} | ${err.message}`);
  }
}

module.exports = { sendEmail };
