const express = require('express');
const router = express.Router();
const https = require('https');
const { requireLogin } = require('../middleware/auth');
const Course = require('../models/Course');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const crypto = require('crypto');
const { sendEmail } = require('../utils/mailer');
const { enrollmentEmailHtml } = require('../utils/enrollmentEmail');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBaseUrl(req) {
  return process.env.BASE_URL ||
    (req ? `${req.protocol}://${req.get('host')}` : 'http://localhost:5000');
}

// Simple HTTPS POST helper — avoids needing axios/node-fetch
function httpsPost(url, data, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    };
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Send enrollment confirmation email (non-blocking) ────────────────────────

async function sendEnrollmentEmail({ user, course, txnId, paymentMethod, amount, baseUrl }) {
  const studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'Student';
  const courseUrl = `${baseUrl}/courses/${course._id}/learn`;
  const html = enrollmentEmailHtml({
    studentName,
    courseTitle: course.title,
    courseUrl,
    txnId,
    amount,
    paymentMethod,
    examType: course.examType || course.category || ''
  });
  await sendEmail(
    user.email,
    `✅ Enrollment Confirmed: ${course.title} — Learn With Saurab`,
    html
  );
}

// ─── Enroll (entry point) ─────────────────────────────────────────────────────

router.get('/enroll/:courseId', requireLogin, async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.render('error', { title: 'Not Found', message: 'Course not found.', user: req.user });

    const isEnrolled = req.user.enrolledCourses.some(id => id.toString() === course._id.toString());
    if (isEnrolled) return res.redirect(`/courses/${course._id}/learn`);

    if (course.price === 0) {
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { enrolledCourses: course._id } });
      await Course.findByIdAndUpdate(course._id, { $inc: { enrolledCount: 1 } });
      // Fire-and-forget confirmation for free enroll
      sendEnrollmentEmail({
        user: req.user,
        course,
        txnId: 'FREE',
        paymentMethod: 'Free',
        amount: 0,
        baseUrl: getBaseUrl(req)
      }).catch(err => console.error('Free enroll email error:', err));
      return res.redirect(`/courses/${course._id}/learn?welcome=1`);
    }

    res.render('payment', { title: 'Enroll: ' + course.title, course, user: req.user });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Could not process enrollment.', user: req.user });
  }
});

// ─── eSewa ────────────────────────────────────────────────────────────────────

router.post('/esewa/initiate', requireLogin, async (req, res) => {
  try {
    const { courseId } = req.body;
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const txnId = 'LWS-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    await Transaction.create({
      userId: req.user._id,
      courseId: course._id,
      amount: course.price,
      transactionId: txnId,
      paymentMethod: 'eSewa',
      status: 'pending'
    });

    const baseUrl = getBaseUrl(req);
    const esewaData = {
      amt: course.price,
      psc: 0, pdc: 0, txAmt: 0,
      tAmt: course.price,
      pid: txnId,
      scd: process.env.ESEWA_MERCHANT_CODE || 'EPAYTEST',
      su: `${baseUrl}/payment/esewa/success?pid=${txnId}`,
      fu: `${baseUrl}/payment/esewa/failure?pid=${txnId}`
    };

    const isLive = process.env.NODE_ENV === 'production' && process.env.ESEWA_MERCHANT_CODE && process.env.ESEWA_MERCHANT_CODE !== 'EPAYTEST';
    const esewaUrl = isLive
      ? 'https://esewa.com.np/epay/main'
      : 'https://uat.esewa.com.np/epay/main';

    res.json({ success: true, esewaData, esewaUrl });
  } catch (err) {
    console.error('eSewa initiate error:', err);
    res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

router.get('/esewa/success', requireLogin, async (req, res) => {
  try {
    const { pid, oid, amt, refId } = req.query;
    const txn = await Transaction.findOne({ transactionId: pid, status: 'pending' });
    if (!txn) return res.render('error', { title: 'Error', message: 'Transaction not found.', user: req.user });

    txn.status = 'completed';
    txn.esewaData = { oid, amt, refId };
    await txn.save();
    await User.findByIdAndUpdate(txn.userId, { $addToSet: { enrolledCourses: txn.courseId } });
    await Course.findByIdAndUpdate(txn.courseId, { $inc: { enrolledCount: 1 } });

    // Send confirmation email (fire-and-forget — don't block the redirect)
    const course = await Course.findById(txn.courseId);
    if (course) {
      sendEnrollmentEmail({
        user: req.user,
        course,
        txnId: pid,
        paymentMethod: 'eSewa',
        amount: txn.amount,
        baseUrl: getBaseUrl(req)
      }).catch(err => console.error('eSewa enroll email error:', err));
    }

    res.redirect(`/courses/${txn.courseId}/learn?enrolled=1`);
  } catch (err) {
    console.error('eSewa success error:', err);
    res.render('error', { title: 'Payment Error', message: 'Could not verify payment. Contact support.', user: req.user });
  }
});

router.get('/esewa/failure', requireLogin, async (req, res) => {
  try {
    const { pid } = req.query;
    if (pid) await Transaction.findOneAndUpdate({ transactionId: pid }, { status: 'failed' });
    res.redirect(`/payment/failed?method=esewa`);
  } catch (err) {
    res.redirect('/payment/failed?method=esewa');
  }
});

// ─── Khalti ───────────────────────────────────────────────────────────────────

router.post('/khalti/initiate', requireLogin, async (req, res) => {
  try {
    const { courseId } = req.body;
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const txnId = 'LWS-K-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    await Transaction.create({
      userId: req.user._id,
      courseId: course._id,
      amount: course.price,
      transactionId: txnId,
      paymentMethod: 'Khalti',
      status: 'pending'
    });

    const baseUrl = getBaseUrl(req);
    const amountInPaisa = Math.round(course.price * 100);

    const khaltiPayload = {
      return_url: `${baseUrl}/payment/khalti/callback`,
      website_url: baseUrl,
      amount: amountInPaisa,
      purchase_order_id: txnId,
      purchase_order_name: course.title,
      customer_info: {
        name: `${req.user.firstName} ${req.user.lastName}`.trim() || req.user.username,
        email: req.user.email,
        phone: req.user.mobile || '9800000000'
      }
    };

    const secretKey = process.env.KHALTI_SECRET_KEY || 'test_secret_key_c9f20e5e87d74b8f9fdbb0fcbdac0f31';
    const khaltiBaseUrl = process.env.KHALTI_SECRET_KEY
      ? 'https://khalti.com'
      : 'https://a.khalti.com';

    const response = await httpsPost(
      `${khaltiBaseUrl}/api/v2/epayment/initiate/`,
      khaltiPayload,
      { Authorization: `key ${secretKey}` }
    );

    if (response.status === 200 && response.data.payment_url) {
      return res.json({
        success: true,
        payment_url: response.data.payment_url,
        pidx: response.data.pidx
      });
    }

    console.error('Khalti initiate response:', response.data);
    res.status(500).json({
      success: false,
      message: response.data?.detail || response.data?.error_key || 'Khalti payment initiation failed'
    });
  } catch (err) {
    console.error('Khalti initiate error:', err);
    res.status(500).json({ success: false, message: 'Khalti payment initiation failed. Please try again.' });
  }
});

router.get('/khalti/callback', requireLogin, async (req, res) => {
  try {
    const { pidx, txnId, amount, mobile, purchase_order_id, purchase_order_name, transaction_id, status } = req.query;
    const orderId = purchase_order_id;

    if (!orderId) return res.redirect('/payment/failed?method=khalti&reason=missing_order');

    const secretKey = process.env.KHALTI_SECRET_KEY || 'test_secret_key_c9f20e5e87d74b8f9fdbb0fcbdac0f31';
    const khaltiBaseUrl = process.env.KHALTI_SECRET_KEY ? 'https://khalti.com' : 'https://a.khalti.com';

    let verified = false;
    try {
      const lookupRes = await httpsPost(
        `${khaltiBaseUrl}/api/v2/epayment/lookup/`,
        { pidx },
        { Authorization: `key ${secretKey}` }
      );
      verified = lookupRes.status === 200 && lookupRes.data.status === 'Completed';
    } catch (lookupErr) {
      console.error('Khalti lookup error:', lookupErr);
      verified = status === 'Completed';
    }

    const txn = await Transaction.findOne({ transactionId: orderId, status: 'pending' });
    if (!txn) return res.render('error', { title: 'Error', message: 'Transaction not found.', user: req.user });

    if (verified) {
      txn.status = 'completed';
      txn.khaltiData = { pidx, transaction_id, mobile, amount };
      await txn.save();
      await User.findByIdAndUpdate(txn.userId, { $addToSet: { enrolledCourses: txn.courseId } });
      await Course.findByIdAndUpdate(txn.courseId, { $inc: { enrolledCount: 1 } });

      // Send confirmation email (fire-and-forget)
      const course = await Course.findById(txn.courseId);
      if (course) {
        sendEnrollmentEmail({
          user: req.user,
          course,
          txnId: orderId,
          paymentMethod: 'Khalti',
          amount: txn.amount,
          baseUrl: getBaseUrl(req)
        }).catch(err => console.error('Khalti enroll email error:', err));
      }

      return res.redirect(`/courses/${txn.courseId}/learn?enrolled=1`);
    } else {
      txn.status = 'failed';
      await txn.save();
      return res.redirect('/payment/failed?method=khalti');
    }
  } catch (err) {
    console.error('Khalti callback error:', err);
    res.render('error', { title: 'Payment Error', message: 'Could not verify Khalti payment. Contact support.', user: req.user });
  }
});

// ─── Admin: Manual Enrollment ─────────────────────────────────────────────────

router.post('/manual-enroll', async (req, res) => {
  try {
    const { userId, courseId, amount, notes } = req.body;
    if (!req.session.isAdmin) return res.status(403).json({ success: false, message: 'Unauthorized' });

    const txnId = 'LWS-MANUAL-' + Date.now();
    await Transaction.create({
      userId, courseId,
      amount: amount || 0,
      transactionId: txnId,
      paymentMethod: 'manual',
      status: 'completed',
      notes: notes || 'Manual enrollment by admin'
    });
    await User.findByIdAndUpdate(userId, { $addToSet: { enrolledCourses: courseId } });
    await Course.findByIdAndUpdate(courseId, { $inc: { enrolledCount: 1 } });

    // Send confirmation email to the student (fire-and-forget)
    const [user, course] = await Promise.all([
      User.findById(userId),
      Course.findById(courseId)
    ]);
    if (user && course) {
      const baseUrl = getBaseUrl(req);
      sendEnrollmentEmail({
        user,
        course,
        txnId,
        paymentMethod: 'manual',
        amount: amount || 0,
        baseUrl
      }).catch(err => console.error('Manual enroll email error:', err));
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Manual enroll error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Payment failed page ───────────────────────────────────────────────────────

router.get('/failed', requireLogin, (req, res) => {
  const method = req.query.method || 'payment';
  res.render('payment-failed', { title: 'Payment Failed', method, user: req.user });
});

module.exports = router;
