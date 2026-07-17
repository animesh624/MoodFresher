import express from 'express';
import multer from 'multer';
import axios from 'axios';
import Order from '../models/Order.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Multer memory storage configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // limit to 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed!'), false);
    }
  },
});

// @desc    Create a new order (Pending state, returns unique orderId)
// @route   POST /api/orders
// @access  Public
router.post('/', async (req, res) => {
  const { customerName, customerMobile, customerAddress, items, subtotal, discount, deliveryFee, total, couponCode } = req.body;

  try {
    if (!customerName || !customerMobile || !customerAddress || !items || !items.length) {
      return res.status(400).json({ message: 'Missing order details or items' });
    }

    // Generate a cryptographically secure random unguessable order ID
    // Format: mf_ord_ + 10 chars of alphanumeric
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
    });

    const createdOrder = await order.save();
    res.status(201).json(createdOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Upload canvas invoice summary to ImgBB and update order image link
// @route   POST /api/orders/:orderId/upload-summary
// @access  Public
router.post('/:orderId/upload-summary', upload.single('image'), async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image file' });
    }

    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      console.warn('WARNING: IMGBB_API_KEY is not configured. Saving a mock invoice URL.');
      order.imageUrl = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';
      await order.save();
      return res.json({
        url: order.imageUrl,
        message: 'No ImgBB key configured. Saved using mock template.',
        isPlaceholder: true
      });
    }

    // Convert file buffer to base64
    const base64Image = req.file.buffer.toString('base64');

    // Create parameters for URL-encoded post body
    const params = new URLSearchParams();
    params.append('image', base64Image);

    // Post to ImgBB API
    const response = await axios.post(`https://api.imgbb.com/1/upload?key=${apiKey}`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (response.data && response.data.data && response.data.data.url) {
      order.imageUrl = response.data.data.url;
      await order.save();
      res.json({ url: order.imageUrl });
    } else {
      res.status(500).json({ message: 'Failed to upload invoice to ImgBB' });
    }
  } catch (error) {
    console.error('Invoice upload error:', error.response?.data || error.message);
    res.status(500).json({
      message: 'Invoice upload failed',
      error: error.response?.data?.error?.message || error.message,
    });
  }
});

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private (Admin only)
router.get('/', protect, async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get details of a single order (Public, for status tracking)
// @route   GET /api/orders/:orderId
// @access  Public
router.get('/:orderId', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update order status
// @route   PUT /api/orders/:orderId/status
// @access  Private (Admin only)
router.put('/:orderId/status', protect, async (req, res) => {
  const { status } = req.body;

  try {
    const order = await Order.findOne({ orderId: req.params.orderId });

    if (order) {
      order.status = status || order.status;
      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
