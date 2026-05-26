const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const Course = require('../models/Course');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const crypto = require('crypto');

router.get('/enroll/:courseId', requireLogin, async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.render('error', { title: 'Not Found', message: 'Course not found.', user: req.user });
    const isEnrolled = req.user.enrolledCourses.some(id => id.toString() === course._id.toString());
    if (isEnrolled) return res.redirect(`/courses/${course._id}/learn`);
    if (course.price === 0) {
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { enrolledCourses: course._id } });
      await Course.findByIdAndUpdate(course._id, { $inc: { enrolledCount: 1 } });
      return res.redirect(`/courses/${course._id}/learn?welcome=1`);
    }
    res.render('payment', { title: 'Enroll: ' + course.title, course, user: req.user });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Could not process enrollment.', user: req.user });
  }
});

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
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const esewaData = {
      amt: course.price,
      psc: 0, pdc: 0, txAmt: 0,
      tAmt: course.price,
      pid: txnId,
      scd: process.env.ESEWA_MERCHANT_CODE || 'EPAYTEST',
      su: `${baseUrl}/payment/esewa/success?pid=${txnId}`,
      fu: `${baseUrl}/payment/esewa/failure?pid=${txnId}`
    };
    res.json({ success: true, esewaData, esewaUrl: 'https://uat.esewa.com.np/epay/main' });
  } catch (err) {
    console.error(err);
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
    res.redirect(`/courses/${txn.courseId}/learn?enrolled=1`);
  } catch (err) {
    res.render('error', { title: 'Payment Error', message: 'Could not verify payment.', user: req.user });
  }
});

router.get('/esewa/failure', requireLogin, async (req, res) => {
  try {
    const { pid } = req.query;
    await Transaction.findOneAndUpdate({ transactionId: pid }, { status: 'failed' });
    res.render('error', { title: 'Payment Failed', message: 'Your payment was not successful. Please try again.', user: req.user });
  } catch (err) {
    res.render('error', { title: 'Error', message: 'Payment error.', user: req.user });
  }
});

module.exports = router;
