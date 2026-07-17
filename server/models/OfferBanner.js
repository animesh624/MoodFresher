import mongoose from 'mongoose';

const offerBannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    image: {
      type: String,
      default: '', // ImgBB URL
    },
    couponCode: {
      type: String,
      uppercase: true,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Define index for querying active banners on home screen load
offerBannerSchema.index({ isActive: 1 });

const OfferBanner = mongoose.model('OfferBanner', offerBannerSchema);
export default OfferBanner;
