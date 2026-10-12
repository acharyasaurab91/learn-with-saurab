// ============================================
// helpers/emailHelpers.js
// HTML email templates: verification, password reset, welcome.
// Each function RETURNS an HTML string — sending happens in the
// caller via utils/mailer.js (nodemailer).
// Brand: teal #0E7C72 · logo on top · footer line · mobile-friendly
// Table-based layout so Gmail, Outlook and Apple Mail render it.
// ============================================

function getBaseUrl() {
  return (process.env.BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Shared shell: outer background → white card → logo → heading →
// body → teal button → note → footer.
function shell({ title, heading, bodyHtml, button, note }) {
  const buttonRow = button
    ? `        <tr>
            <td align="center" style="padding:22px 32px 6px 32px;">
              <a href="${esc(button.url)}" style="display:inline-block;background:#0E7C72;color:#FFFFFF;padding:14px 34px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.2px;">${esc(button.label)}</a>
            </td>
          </tr>
`
    : '';
  const noteRow = note
    ? `        <tr>
            <td style="padding:14px 32px 4px 32px;">
              <p style="font-size:13px;line-height:1.6;color:#5F6C76;margin:0;">${note}</p>
            </td>
          </tr>
`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#F3F6F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F3F6F5" style="background:#F3F6F5;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #E2E8E4;border-radius:12px;">
          <tr>
            <td style="padding:30px 32px 6px 32px;text-align:center;">
              <div style="font-size:32px;line-height:1;">&#127891;</div>
              <div style="font-size:20px;font-weight:800;color:#0E7C72;margin-top:8px;letter-spacing:0.3px;">Learn With Saurab</div>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 32px 0 32px;">
              <h1 style="font-size:22px;line-height:1.3;color:#14212B;margin:14px 0 10px 0;">${esc(heading)}</h1>
              ${bodyHtml}
            </td>
          </tr>
${buttonRow}${noteRow}          <tr>
            <td style="padding:18px 32px 26px 32px;text-align:center;border-top:1px solid #E2E8E4;">
              <p style="font-size:12px;color:#8A969E;margin:0;">&copy; Learn With Saurab | learnwithsaurab.com.np</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// 1. Signup verification — link expires in 24 hours
function sendVerificationEmail(user, token) {
  const url = `${getBaseUrl()}/verify-email/${encodeURIComponent(token)}`;
  const name = esc(user.firstName || 'there');
  return shell({
    title: 'Verify your email',
    heading: `Hi ${name}, confirm your email address`,
    bodyHtml: `              <p style="font-size:15px;line-height:1.7;color:#3D4A54;margin:0 0 10px 0;">Welcome to <strong>Learn With Saurab</strong>! Please verify your email address to activate your account and start learning.</p>`,
    button: { url, label: 'Verify My Email' },
    note: 'This link expires in <strong>24 hours</strong>. If you didn&rsquo;t create an account, you can safely ignore this email.'
  });
}

// 2. Password reset — link expires in 1 hour
function sendPasswordResetEmail(user, token) {
  const url = `${getBaseUrl()}/reset-password/${encodeURIComponent(token)}`;
  const name = esc(user.firstName || 'there');
  return shell({
    title: 'Reset your password',
    heading: `Hi ${name}, reset your password`,
    bodyHtml: `              <p style="font-size:15px;line-height:1.7;color:#3D4A54;margin:0 0 10px 0;">We received a request to reset the password for your Learn With Saurab account. Click the button below to choose a new one.</p>`,
    button: { url, label: 'Reset Password' },
    note: 'This link expires in <strong>1 hour</strong>. If you didn&rsquo;t request a password reset, you can safely ignore this email &mdash; your password will not change.'
  });
}

// 3. Welcome — sent after successful verification, links to dashboard
function sendWelcomeEmail(user) {
  const url = `${getBaseUrl()}/dashboard`;
  const name = esc(user.firstName || 'there');
  return shell({
    title: 'Welcome to Learn With Saurab',
    heading: `Welcome to Learn With Saurab, ${name}!`,
    bodyHtml: `              <p style="font-size:15px;line-height:1.7;color:#3D4A54;margin:0 0 10px 0;">Your email has been verified and your account is ready. Head to your dashboard to explore courses, track your progress and start preparing for your exams.</p>`,
    button: { url, label: 'Go to Dashboard' },
    note: ''
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail };
