import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true,
      unique: true,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    subcategory: {
      type: String,
      trim: true,
      default: '',
    },
    photoName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      default: null,
    },
    priceHalf: {
      type: Number,
      default: null,
    },
    priceFull: {
      type: Number,
      default: null,
    },
    hasHalfFull: {
      type: Boolean,
      default: false,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    weight: {
      type: String,
      default: '',
    },
    breakdown: {
      type: String,
      default: '',
    },
    originalPrice: {
      type: Number,
      default: null,
    },
    originalPriceHalf: {
      type: Number,
      default: null,
    },
    originalPriceFull: {
      type: Number,
      default: null,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Define compound index for optimal menu queries (sorting by category and id)
itemSchema.index({ category: 1, id: 1 });

const Item = mongoose.model('Item', itemSchema);
export default Item;
