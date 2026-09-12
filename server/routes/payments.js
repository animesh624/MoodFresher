import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import Order from '../models/Order.js';
import { sendNewOrderNotification } from '../services/pushNotifications.js';

const router = express.Router();

// Initialize Razorpay instance
const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('Razorpay keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

// @desc    Create a Razorpay order (step 1 of payment flow)
// @route   POST /api/payments/create-order
// @access  Public
router.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', notes = {} } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid order amount' });
    }

    // Check if online payment is enabled in settings
    const Settings = (await import('../models/Settings.js')).default;
    const settings = await Settings.findOne({});
    if (settings && settings.onlinePaymentEnabled === false) {
      return res.status(403).json({ message: 'Online payment is currently disabled by store management.' });
    }

    const razorpay = getRazorpayInstance();

    // Amount must be in paise (1 INR = 100 paise)
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100), // convert ₹ to paise
      currency,
      notes,
    });

    res.json({
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Razorpay create-order error:', error.message);
    res.status(500).json({ message: error.message || 'Failed to create payment order' });
  }
});

// @desc    Verify Razorpay payment signature + create DB order (step 2 of payment flow)
// @route   POST /api/payments/verify
// @access  Public
router.post('/verify', async (req, res) => {
  const {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    orderPayload, // full order data (customerName, items, total, etc.)
  } = req.body;

  try {
    // ── Security: Verify HMAC-SHA256 Signature ──
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(500).json({ message: 'Payment gateway not configured' });
    }

    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      console.error('Razorpay signature mismatch!', { expected: expectedSignature, received: razorpaySignature });
      return res.status(400).json({ message: 'Payment verification failed. Invalid signature.' });
    }

    // ── Signature valid: Create order in DB ──
    const {
      customerName, customerMobile, customerAddress,
      items, subtotal, discount, deliveryFee, total, couponCode,
    } = orderPayload;

    if (!customerName || !customerMobile || !customerAddress || !items || !items.length) {
      return res.status(400).json({ message: 'Missing order details' });
    }

    const rand = () => Math.random().toString(36).substring(2, 7);
    const orderId = `mf_ord_${rand()}${rand()}`;

    const order = new Order({
      orderId,
      customerName,
      customerMobile,
      customerAddress,
      items,
      subtotal,
      discount,
      deliveryFee,
      total,
      couponCode,
      status: 'Pending',
      paymentStatus: 'Paid',
      paymentMethod: 'razorpay',
      paymentId: razorpayPaymentId,
      razorpayOrderId,
    });

    const createdOrder = await order.save();
    await sendNewOrderNotification(createdOrder);
    res.status(201).json({ success: true, order: createdOrder });
  } catch (error) {
    console.error('Razorpay verify error:', error.message);
    res.status(500).json({ message: error.message || 'Payment verification failed' });
  }
});

// @desc    Create a COD order (Cash on Delivery — only allowed if codEnabled in settings)
// @route   POST /api/payments/cod-order
// @access  Public
router.post('/cod-order', async (req, res) => {
  try {
    const { orderPayload } = req.body;
    const {
      customerName, customerMobile, customerAddress,
      items, subtotal, discount, deliveryFee, total, couponCode,
    } = orderPayload;

    if (!customerName || !customerMobile || !customerAddress || !items || !items.length) {
      return res.status(400).json({ message: 'Missing order details' });
    }

    // Import Settings inline to check if COD is enabled
    const Settings = (await import('../models/Settings.js')).default;
    const settings = await Settings.findOne({});
    if (!settings || !settings.codEnabled) {
      return res.status(403).json({ message: 'Cash on Delivery is not available at this time.' });
    }

    const rand = () => Math.random().toString(36).substring(2, 7);
    const orderId = `mf_ord_${rand()}${rand()}`;

    const order = new Order({
      orderId,
      customerName,
      customerMobile,
      customerAddress,
      items,
      subtotal,
      discount,
      deliveryFee,
      total,
      couponCode,
      status: 'Pending',
      paymentStatus: 'COD',
      paymentMethod: 'cod',
      paymentId: '',
      razorpayOrderId: '',
    });

    const createdOrder = await order.save();
    await sendNewOrderNotification(createdOrder);
    res.status(201).json({ success: true, order: createdOrder });
  } catch (error) {
    console.error('COD order error:', error.message);
    res.status(500).json({ message: error.message || 'Failed to place COD order' });
  }
});

export default router;
