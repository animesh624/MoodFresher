import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import PushSubscription from '../models/PushSubscription.js';

const router = express.Router();

router.get('/vapid-public-key', protect, (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ message: 'Web push is not configured on the server' });
  }
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

router.post('/subscribe', protect, async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ message: 'Invalid push subscription' });
  }

  try {
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { endpoint, keys, user: req.user._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ message: 'Order notifications enabled' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/subscribe', protect, async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ message: 'Subscription endpoint is required' });

  try {
    await PushSubscription.deleteOne({ endpoint, user: req.user._id });
    res.json({ message: 'Order notifications disabled' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
