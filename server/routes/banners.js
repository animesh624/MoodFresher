import express from 'express';
import OfferBanner from '../models/OfferBanner.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    Get active banners for homepage
// @route   GET /api/banners
// @access  Public
router.get('/', async (req, res) => {
  try {
    const banners = await OfferBanner.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get all banners for admin dashboard
// @route   GET /api/banners/all
// @access  Private
router.get('/all', protect, async (req, res) => {
  try {
    const banners = await OfferBanner.find({}).sort({ createdAt: -1 });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Create banner
// @route   POST /api/banners
// @access  Private
router.post('/', protect, async (req, res) => {
  const { title, description, image, couponCode, isActive } = req.body;

  try {
    const banner = new OfferBanner({
      title,
      description,
      image,
      couponCode: couponCode ? couponCode.trim().toUpperCase() : '',
      isActive: isActive !== undefined ? isActive : true,
    });

    const createdBanner = await banner.save();
    res.status(201).json(createdBanner);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc    Update banner
// @route   PUT /api/banners/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
  const { title, description, image, couponCode, isActive } = req.body;

  try {
    const banner = await OfferBanner.findById(req.params.id);

    if (banner) {
      banner.title = title !== undefined ? title : banner.title;
      banner.description = description !== undefined ? description : banner.description;
      banner.image = image !== undefined ? image : banner.image;
      banner.couponCode = couponCode !== undefined ? (couponCode ? couponCode.trim().toUpperCase() : '') : banner.couponCode;
      banner.isActive = isActive !== undefined ? isActive : banner.isActive;

      const updatedBanner = await banner.save();
      res.json(updatedBanner);
    } else {
      res.status(404).json({ message: 'Banner not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc    Delete banner
// @route   DELETE /api/banners/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const banner = await OfferBanner.findById(req.params.id);
    if (banner) {
      await OfferBanner.deleteOne({ _id: req.params.id });
      res.json({ message: 'Banner removed' });
    } else {
      res.status(404).json({ message: 'Banner not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
