import express from 'express';
import Cart from '../models/Cart.js';

const router = express.Router();

// @desc    Get customer cart by sessionId
// @route   GET /api/cart/:sessionId
// @access  Public
router.get('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    let cart = await Cart.findOne({ sessionId });
    
    // If no cart exists, return a default empty cart structure instead of 404
    if (!cart) {
      return res.json({ items: [], couponCode: '' });
    }

    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Save/Update customer cart
// @route   POST /api/cart/:sessionId
// @access  Public
router.post('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { items, couponCode } = req.body;

  try {
    // Upsert cart for this session
    const cart = await Cart.findOneAndUpdate(
      { sessionId },
      { items, couponCode: couponCode || '' },
      { new: true, upsert: true }
    );

    res.json(cart);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
