import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    shopOpen: {
      type: Boolean,
      default: true,
    },
    maxDeliveryDistance: {
      type: Number,
      default: 8,
    },
    operatingHours: {
      enabled: {
        type: Boolean,
        default: true,
      },
      days: {
        type: [String],
        default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      },
      openTime: {
        type: String,
        default: '17:00', // HH:MM (24-hour format)
      },
      closeTime: {
        type: String,
        default: '23:59', // HH:MM (24-hour format)
      },
    },
    whatsappNumber: {
      type: String,
      default: () => process.env.WHATSAPP_NUMBER || '918736066574',
    },
    minOrderAmount: {
      type: Number,
      default: 200,
    },
  },
  {
    timestamps: true,
  }
);

const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
