import express from 'express';
import Coupon from '../models/Coupon.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    Get all coupons (admin view)
// @route   GET /api/coupons
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Create a coupon
// @route   POST /api/coupons
// @access  Private
router.post('/', protect, async (req, res) => {
  const { code, discountPercent, minAmount, description, isActive } = req.body;

  try {
    const codeUpper = code.trim().toUpperCase();
    
    // Check if code exists
    const couponExists = await Coupon.findOne({ code: codeUpper });
    if (couponExists) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }

    const coupon = new Coupon({
      code: codeUpper,
      discountPercent,
      minAmount,
      description,
      isActive: isActive !== undefined ? isActive : true,
    });

    const createdCoupon = await coupon.save();
    res.status(201).json(createdCoupon);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc    Update a coupon
// @route   PUT /api/coupons/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
  const { code, discountPercent, minAmount, description, isActive } = req.body;

  try {
    const coupon = await Coupon.findById(req.params.id);

    if (coupon) {
      if (code) {
        const codeUpper = code.trim().toUpperCase();
        // Check if code exists on another coupon
        const otherCoupon = await Coupon.findOne({ code: codeUpper, _id: { $ne: coupon._id } });
        if (otherCoupon) {
          return res.status(400).json({ message: 'Coupon code already exists' });
        }
        coupon.code = codeUpper;
      }
      coupon.discountPercent = discountPercent !== undefined ? discountPercent : coupon.discountPercent;
      coupon.minAmount = minAmount !== undefined ? minAmount : coupon.minAmount;
      coupon.description = description !== undefined ? description : coupon.description;
      coupon.isActive = isActive !== undefined ? isActive : coupon.isActive;

      const updatedCoupon = await coupon.save();
      res.json(updatedCoupon);
    } else {
      res.status(404).json({ message: 'Coupon not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc    Delete a coupon
// @route   DELETE /api/coupons/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (coupon) {
      await Coupon.deleteOne({ _id: req.params.id });
      res.json({ message: 'Coupon deleted' });
    } else {
      res.status(404).json({ message: 'Coupon not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Validate a coupon code for customer use
// @route   POST /api/coupons/validate
// @access  Public
router.post('/validate', async (req, res) => {
  const { code, subtotal } = req.body;

  if (!code) {
    return res.status(400).json({ message: 'Coupon code is required' });
  }

  try {
    const coupon = await Coupon.findOne({ code: code.trim().toUpperCase(), isActive: true });

    if (!coupon) {
      return res.status(404).json({ valid: false, message: 'Invalid or expired coupon code' });
    }

    if (subtotal < coupon.minAmount) {
      return res.status(400).json({
        valid: false,
        message: `This coupon requires a minimum subtotal of ₹${coupon.minAmount}. Add ₹${coupon.minAmount - subtotal} more.`,
      });
    }

    res.json({
      valid: true,
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      minAmount: coupon.minAmount,
      description: coupon.description,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
