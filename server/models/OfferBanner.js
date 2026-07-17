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

const OfferBanner = mongoose.model('OfferBanner', offerBannerSchema);
export default OfferBanner;
