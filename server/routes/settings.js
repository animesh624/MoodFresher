import express from 'express';
import Settings from '../models/Settings.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    Get store settings
// @route   GET /api/settings
// @access  Public
router.get('/', async (req, res) => {
  try {
    let settings = await Settings.findOne({});
    if (!settings) {
      // Create default settings if not exists
      settings = await Settings.create({});
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update store settings
// @route   PUT /api/settings
// @access  Private
router.put('/', protect, async (req, res) => {
  const { shopOpen, maxDeliveryDistance, operatingHours, whatsappNumber, minOrderAmount } = req.body;

  try {
    let settings = await Settings.findOne({});
    if (!settings) {
      settings = new Settings({});
    }

    settings.shopOpen = shopOpen !== undefined ? shopOpen : settings.shopOpen;
    settings.maxDeliveryDistance = maxDeliveryDistance !== undefined ? maxDeliveryDistance : settings.maxDeliveryDistance;
    settings.whatsappNumber = whatsappNumber !== undefined ? whatsappNumber : settings.whatsappNumber;
    settings.minOrderAmount = minOrderAmount !== undefined ? minOrderAmount : settings.minOrderAmount;

    if (operatingHours) {
      settings.operatingHours = {
        enabled: operatingHours.enabled !== undefined ? operatingHours.enabled : settings.operatingHours.enabled,
        days: operatingHours.days !== undefined ? operatingHours.days : settings.operatingHours.days,
        openTime: operatingHours.openTime !== undefined ? operatingHours.openTime : settings.operatingHours.openTime,
        closeTime: operatingHours.closeTime !== undefined ? operatingHours.closeTime : settings.operatingHours.closeTime,
      };
    }

    const updatedSettings = await settings.save();
    res.json(updatedSettings);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
