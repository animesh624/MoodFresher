import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Import Models
import User from '../models/User.js';
import Item from '../models/Item.js';
import Settings from '../models/Settings.js';
import Coupon from '../models/Coupon.js';

// Setup __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/moodfresher';
    console.log(`Connecting to MongoDB at: ${mongoUri}`);
    await mongoose.connect(mongoUri);

    console.log('Clearing existing database collections...');
    await User.deleteMany({});
    await Item.deleteMany({});
    await Settings.deleteMany({});
    await Coupon.deleteMany({});

    console.log('Seeding admin user...');
    // Default admin user: admin@moodfresher.com / admin123
    const adminUser = new User({
      email: 'admin@moodfresher.com',
      password: 'admin123', // Will be hashed automatically by userSchema pre-save hook
    });
    await adminUser.save();
    console.log('Admin user created successfully! (Email: admin@moodfresher.com, Password: admin123)');

    // Read items.json
    const itemsJsonPath = path.resolve(__dirname, '../../src/data/items.json');
    console.log(`Reading initial data from: ${itemsJsonPath}`);
    const rawData = fs.readFileSync(itemsJsonPath, 'utf-8');
    const parsedData = JSON.parse(rawData);

    // Seed Settings
    console.log('Seeding store settings...');
    const settings = new Settings({
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
    await settings.save();
    console.log('Settings seeded successfully!');

    // Seed Items
    console.log('Seeding menu items...');
    const itemsToInsert = parsedData.items.map((item) => {
      // Handle pricing formats
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
    console.log(`Seeded ${itemsToInsert.length} menu items successfully!`);

    // Seed default coupons matching initial DISCOUNT_TIERS
    console.log('Seeding default coupons...');
    const defaultCoupons = [
      {
        code: 'MOOD10',
        discountPercent: 10,
        minAmount: 300,
        description: 'Get 10% OFF on orders of ₹300 or above!',
        isActive: true,
      },
      {
        code: 'MOOD15',
        discountPercent: 15,
        minAmount: 500,
        description: 'Get 15% OFF on orders of ₹500 or above!',
        isActive: true,
      },
      {
        code: 'MOOD20',
        discountPercent: 20,
        minAmount: 800,
        description: 'Get 20% OFF on orders of ₹800 or above!',
        isActive: true,
      },
    ];
    await Coupon.insertMany(defaultCoupons);
    console.log('Default coupons seeded successfully!');

    console.log('Seeding complete! Database is ready.');
    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(`Error seeding database: ${error.message}`);
    if (mongoose.connection) {
      mongoose.connection.close();
    }
    process.exit(1);
  }
};

seedData();
