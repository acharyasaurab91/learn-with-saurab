function reviewNotificationEmailHtml({ studentName, studentEmail, courseTitle, courseUrl, rating, comment, adminReviewsUrl }) {
  const year = new Date().getFullYear();
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
  const ratingColor = rating >= 4 ? '#10B981' : rating === 3 ? '#F59E0B' : '#EF4444';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>New Course Review</title>
</head>
<body style="margin:0;padding:0;background:#0F1623;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0F1623;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <tr>
        <td style="background:linear-gradient(135deg,#0A0F1E 0%,#161D2E 100%);border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;border-bottom:2px solid #00D4FF;">
          <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:8px;">
            <span style="font-size:28px;">🎓</span>
            <span style="font-size:22px;font-weight:900;color:#F9FAFB;letter-spacing:-0.5px;">Learn With <span style="color:#00D4FF;">Saurab</span></span>
          </div>
          <p style="margin:0;font-size:13px;color:#4B5563;">Admin Notification</p>
        </td>
      </tr>

      <tr>
        <td style="background:#161D2E;padding:0 40px;">
          <div style="background:linear-gradient(135deg,rgba(0,212,255,0.08),rgba(124,58,237,0.08));border:1px solid rgba(0,212,255,0.2);border-radius:12px;padding:28px;margin:28px 0 0;text-align:center;">
            <div style="width:64px;height:64px;background:rgba(0,212,255,0.12);border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;border:2px solid rgba(0,212,255,0.3);">
              <span style="font-size:28px;">⭐</span>
            </div>
            <h1 style="margin:0 0 8px;font-size:24px;font-weight:900;color:#F9FAFB;">New Review Submitted</h1>
            <p style="margin:0;font-size:15px;color:#9CA3AF;">A student just left a review on your platform.</p>
          </div>
        </td>
      </tr>

      <tr>
        <td style="background:#161D2E;padding:24px 40px 0;">
          <h2 style="margin:0 0 16px;font-size:14px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">Review Details</h2>
          <div style="background:#0A0F1E;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px 24px;">
            <p style="margin:0 0 6px;font-size:12px;color:#00D4FF;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${courseTitle}</p>
            <p style="margin:0 0 14px;font-size:26px;font-weight:800;color:${ratingColor};letter-spacing:2px;">${stars} <span style="font-size:14px;color:#9CA3AF;font-weight:600;">(${rating}/5)</span></p>
            ${comment ? `<div style="background:#161D2E;border-left:3px solid #00D4FF;border-radius:6px;padding:14px 16px;margin-bottom:14px;"><p style="margin:0;font-size:14px;color:#F9FAFB;line-height:1.6;font-style:italic;">"${comment}"</p></div>` : ''}
            <p style="margin:0;font-size:13px;color:#6B7280;">By <span style="color:#F9FAFB;font-weight:600;">${studentName}</span> (${studentEmail})</p>
          </div>
        </td>
      </tr>

      <tr>
        <td style="background:#161D2E;padding:28px 40px;">
          <div style="background:linear-gradient(135deg,rgba(0,212,255,0.05),rgba(124,58,237,0.05));border:1px solid rgba(0,212,255,0.1);border-radius:12px;padding:24px;text-align:center;">
            <a href="${adminReviewsUrl}" style="display:inline-block;background:linear-gradient(135deg,#00D4FF 0%,#7C3AED 100%);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:800;font-size:14px;margin-bottom:10px;">
              Moderate in Admin Panel →
            </a>
            <p style="margin:12px 0 0;font-size:12px;color:#6B7280;">
              <a href="${courseUrl}" style="color:#00D4FF;text-decoration:none;">View course page</a>
            </p>
          </div>
        </td>
      </tr>

      <tr>
        <td style="background:#0A0F1E;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:#374151;">© ${year} Learn With Saurab. All rights reserved.<br>Nepal's #1 Exam Preparation Platform</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

module.exports = { reviewNotificationEmailHtml };
