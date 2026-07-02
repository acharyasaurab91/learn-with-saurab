function enrollmentEmailHtml({ studentName, courseTitle, courseUrl, txnId, amount, paymentMethod, examType }) {
  const methodLabel = paymentMethod === 'eSewa' ? 'eSewa' : paymentMethod === 'Khalti' ? 'Khalti' : 'Manual';
  const methodColor = paymentMethod === 'Khalti' ? '#5C2D91' : paymentMethod === 'eSewa' ? '#60BB46' : '#374151';
  const amountStr = amount > 0 ? `Rs. ${Number(amount).toLocaleString('en-NP')}` : 'Free';
  const txnDisplay = txnId || 'N/A';
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Enrollment Confirmed</title>
</head>
<body style="margin:0;padding:0;background:#0F1623;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0F1623;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#0A0F1E 0%,#161D2E 100%);border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;border-bottom:2px solid #00D4FF;">
          <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:8px;">
            <span style="font-size:28px;">🎓</span>
            <span style="font-size:22px;font-weight:900;color:#F9FAFB;letter-spacing:-0.5px;">Learn With <span style="color:#00D4FF;">Saurab</span></span>
          </div>
          <p style="margin:0;font-size:13px;color:#4B5563;">Nepal's #1 Exam Preparation Platform</p>
        </td>
      </tr>

      <!-- Success Banner -->
      <tr>
        <td style="background:#161D2E;padding:0 40px;">
          <div style="background:linear-gradient(135deg,rgba(0,212,255,0.08),rgba(124,58,237,0.08));border:1px solid rgba(0,212,255,0.2);border-radius:12px;padding:28px;margin:28px 0 0;text-align:center;">
            <div style="width:64px;height:64px;background:rgba(16,185,129,0.12);border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;border:2px solid rgba(16,185,129,0.3);">
              <span style="font-size:28px;">✅</span>
            </div>
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:900;color:#F9FAFB;">Enrollment Confirmed!</h1>
            <p style="margin:0;font-size:15px;color:#9CA3AF;">You're in, ${studentName}! Start learning right now.</p>
          </div>
        </td>
      </tr>

      <!-- Course Info -->
      <tr>
        <td style="background:#161D2E;padding:24px 40px 0;">
          <h2 style="margin:0 0 16px;font-size:14px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">Your Course</h2>
          <div style="background:#0A0F1E;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px 24px;">
            ${examType ? `<p style="margin:0 0 6px;font-size:12px;color:#00D4FF;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${examType}</p>` : ''}
            <h3 style="margin:0 0 16px;font-size:19px;font-weight:800;color:#F9FAFB;line-height:1.4;">${courseTitle}</h3>
            <a href="${courseUrl}" style="display:inline-block;background:linear-gradient(135deg,#00D4FF 0%,#7C3AED 100%);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:800;font-size:14px;letter-spacing:0.3px;">
              ▶ Start Learning Now
            </a>
          </div>
        </td>
      </tr>

      <!-- Payment Details -->
      <tr>
        <td style="background:#161D2E;padding:24px 40px 0;">
          <h2 style="margin:0 0 16px;font-size:14px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">Payment Receipt</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0F1E;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;color:#6B7280;">Transaction ID</td>
              <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;color:#F9FAFB;text-align:right;font-family:monospace;">${txnDisplay}</td>
            </tr>
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;color:#6B7280;">Payment Method</td>
              <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;">
                <span style="background:${methodColor};color:#fff;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">${methodLabel}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 20px;font-size:13px;color:#6B7280;">Amount Paid</td>
              <td style="padding:14px 20px;font-size:16px;font-weight:800;color:#00D4FF;text-align:right;">${amountStr}</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- What's included -->
      <tr>
        <td style="background:#161D2E;padding:24px 40px 0;">
          <h2 style="margin:0 0 16px;font-size:14px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">What's Included</h2>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="50%" style="padding:0 8px 0 0;vertical-align:top;">
                <div style="background:#0A0F1E;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px 16px;">
                  <span style="font-size:20px;">♾️</span>
                  <p style="margin:6px 0 0;font-size:13px;font-weight:700;color:#F9FAFB;">Lifetime Access</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#6B7280;">No expiry, ever</p>
                </div>
              </td>
              <td width="50%" style="padding:0 0 0 8px;vertical-align:top;">
                <div style="background:#0A0F1E;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px 16px;">
                  <span style="font-size:20px;">📹</span>
                  <p style="margin:6px 0 0;font-size:13px;font-weight:700;color:#F9FAFB;">HD Video Lessons</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#6B7280;">Watch anytime</p>
                </div>
              </td>
            </tr>
            <tr><td colspan="2" style="height:12px;"></td></tr>
            <tr>
              <td width="50%" style="padding:0 8px 0 0;vertical-align:top;">
                <div style="background:#0A0F1E;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px 16px;">
                  <span style="font-size:20px;">📝</span>
                  <p style="margin:6px 0 0;font-size:13px;font-weight:700;color:#F9FAFB;">Practice Tests</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#6B7280;">Exam-style questions</p>
                </div>
              </td>
              <td width="50%" style="padding:0 0 0 8px;vertical-align:top;">
                <div style="background:#0A0F1E;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px 16px;">
                  <span style="font-size:20px;">🔄</span>
                  <p style="margin:6px 0 0;font-size:13px;font-weight:700;color:#F9FAFB;">7-Day Refund</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#6B7280;">Satisfaction guarantee</p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td style="background:#161D2E;padding:28px 40px;">
          <div style="background:linear-gradient(135deg,rgba(0,212,255,0.05),rgba(124,58,237,0.05));border:1px solid rgba(0,212,255,0.1);border-radius:12px;padding:24px;text-align:center;">
            <p style="margin:0 0 16px;font-size:15px;color:#9CA3AF;">Ready to start your exam preparation?</p>
            <a href="${courseUrl}" style="display:inline-block;background:linear-gradient(135deg,#00D4FF 0%,#7C3AED 100%);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:800;font-size:15px;">
              Go to My Course →
            </a>
          </div>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#0A0F1E;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0 0 8px;font-size:13px;color:#4B5563;">Questions? We're here to help.</p>
          <a href="mailto:contactsaurabsir@gmail.com" style="color:#00D4FF;text-decoration:none;font-size:13px;font-weight:600;">contactsaurabsir@gmail.com</a>
          <p style="margin:16px 0 0;font-size:11px;color:#374151;">© ${year} Learn With Saurab. All rights reserved.<br>Nepal's #1 Exam Preparation Platform</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

module.exports = { enrollmentEmailHtml };
