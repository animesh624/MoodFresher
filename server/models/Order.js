import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerMobile: {
      type: String,
      required: true,
      trim: true,
    },
    customerAddress: {
      type: String,
      required: true,
      trim: true,
    },
    items: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true },
        qty: { type: Number, required: true },
        variant: { type: String, default: null }, // 'half', 'full', or null
      },
    ],
    subtotal: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    deliveryFee: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    couponCode: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Pending', 'Accepted', 'Rejected', 'Preparing', 'OutForDelivery', 'Completed'],
      default: 'Pending',
    },
    imageUrl: {
      type: String,
      default: '',
    },
    // ── Payment fields ──
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed', 'COD'],
      default: 'Pending',
    },
    paymentMethod: {
      type: String,
      default: '',
    },
    paymentId: {
      type: String, // Razorpay payment_id after successful capture
      default: '',
    },
    razorpayOrderId: {
      type: String, // Razorpay order_id used for signature verification
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Create compound index for sorting/filtering by status and date
orderSchema.index({ status: 1, createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);
export default Order;
