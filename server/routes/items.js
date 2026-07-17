import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Item from '../models/Item.js';
import Settings from '../models/Settings.js';
import Coupon from '../models/Coupon.js';
import User from '../models/User.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const autoSeed = async () => {
  try {
    const itemsJsonPath = path.resolve(__dirname, '../../src/data/items.json');
    if (!fs.existsSync(itemsJsonPath)) {
      console.warn(`items.json not found at ${itemsJsonPath}, skipping auto-seed`);
      return;
    }
    const rawData = fs.readFileSync(itemsJsonPath, 'utf-8');
    const parsedData = JSON.parse(rawData);

    // Seed Admin User if empty
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const adminUser = new User({
        email: 'admin@moodfresher.com',
        password: 'admin123',
      });
      await adminUser.save();
      console.log('Auto-seeded default admin user.');
    }

    // Seed Settings if empty
    const settingsCount = await Settings.countDocuments();
    if (settingsCount === 0) {
      await Settings.create({
        shopOpen: parsedData.shopOpen !== undefined ? parsedData.shopOpen : true,
        maxDeliveryDistance: parsedData.maxDeliveryDistance || 8,
        operatingHours: parsedData.operatingHours || {
          enabled: true,
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          openTime: '17:00',
          closeTime: '23:59',
        },
        whatsappNumber: process.env.WHATSAPP_NUMBER || '918736066574',
        minOrderAmount: 200,
      });
      console.log('Auto-seeded settings.');
    }

    // Seed Coupons if empty
    const couponCount = await Coupon.countDocuments();
    if (couponCount === 0) {
      const defaultCoupons = [
        { code: 'MOOD10', discountPercent: 10, minAmount: 300, description: 'Get 10% OFF on orders of ₹300 or above!' },
        { code: 'MOOD15', discountPercent: 15, minAmount: 500, description: 'Get 15% OFF on orders of ₹500 or above!' },
        { code: 'MOOD20', discountPercent: 20, minAmount: 800, description: 'Get 20% OFF on orders of ₹800 or above!' },
      ];
      await Coupon.insertMany(defaultCoupons);
      console.log('Auto-seeded coupons.');
    }

    // Seed Items
    const itemsToInsert = parsedData.items.map((item) => {
      const hasHalfFull = !!(item.priceHalf != null && item.priceFull != null);
      return {
        id: item.id,
        itemName: item.itemName,
        category: item.category,
        subcategory: item.subcategory || '',
        photoName: item.photoName || '',
        description: item.description || '',
        price: item.price !== undefined ? item.price : null,
        priceHalf: item.priceHalf !== undefined ? item.priceHalf : null,
        priceFull: item.priceFull !== undefined ? item.priceFull : null,
        hasHalfFull,
        isAvailable: true,
      };
    });

    await Item.insertMany(itemsToInsert);
    console.log(`Auto-seeded ${itemsToInsert.length} items from items.json into MongoDB.`);
  } catch (err) {
    console.error('Error during auto-seed:', err.message);
  }
};

// @desc    Get all items
// @route   GET /api/items
// @access  Public
router.get('/', async (req, res) => {
  try {
    const itemsCount = await Item.countDocuments();
    if (process.env.USE_HARDCODED_ITEMS === 'true' && itemsCount === 0) {
      await autoSeed();
    }

    // Safety check: ensure admin user exists if USE_HARDCODED_ITEMS is enabled
    if (process.env.USE_HARDCODED_ITEMS === 'true') {
      const userCount = await User.countDocuments();
      if (userCount === 0) {
        const adminUser = new User({
          email: 'admin@moodfresher.com',
          password: 'admin123',
        });
        await adminUser.save();
        console.log('Safety check: Auto-seeded default admin user.');
      }
    }

    const items = await Item.find({}).sort({ category: 1, id: 1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Create a new item
// @route   POST /api/items
// @access  Private
router.post('/', protect, async (req, res) => {
  const { itemName, category, subcategory, photoName, description, price, priceHalf, priceFull, hasHalfFull, isAvailable } = req.body;

  try {
    // Generate new unique numeric id (highest id + 1)
    const maxItem = await Item.findOne({}).sort({ id: -1 });
    const newId = maxItem ? maxItem.id + 1 : 1;

    const item = new Item({
      id: newId,
      itemName,
      category,
      subcategory,
      photoName,
      description,
      price: price === '' ? null : price,
      priceHalf: priceHalf === '' ? null : priceHalf,
      priceFull: priceFull === '' ? null : priceFull,
      hasHalfFull: !!hasHalfFull,
      isAvailable: isAvailable !== undefined ? isAvailable : true,
    });

    const createdItem = await item.save();
    res.status(201).json(createdItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc    Update an item
// @route   PUT /api/items/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
  const { itemName, category, subcategory, photoName, description, price, priceHalf, priceFull, hasHalfFull, isAvailable } = req.body;

  try {
    const item = await Item.findOne({ id: req.params.id });

    if (item) {
      item.itemName = itemName !== undefined ? itemName : item.itemName;
      item.category = category !== undefined ? category : item.category;
      item.subcategory = subcategory !== undefined ? subcategory : item.subcategory;
      item.photoName = photoName !== undefined ? photoName : item.photoName;
      item.description = description !== undefined ? description : item.description;
      item.price = price === '' ? null : (price !== undefined ? price : item.price);
      item.priceHalf = priceHalf === '' ? null : (priceHalf !== undefined ? priceHalf : item.priceHalf);
      item.priceFull = priceFull === '' ? null : (priceFull !== undefined ? priceFull : item.priceFull);
      item.hasHalfFull = hasHalfFull !== undefined ? !!hasHalfFull : item.hasHalfFull;
      item.isAvailable = isAvailable !== undefined ? isAvailable : item.isAvailable;

      const updatedItem = await item.save();
      res.json(updatedItem);
    } else {
      res.status(404).json({ message: 'Item not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc    Delete an item
// @route   DELETE /api/items/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const result = await Item.deleteOne({ id: req.params.id });
    if (result.deletedCount > 0) {
      res.json({ message: 'Item removed' });
    } else {
      res.status(404).json({ message: 'Item not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
