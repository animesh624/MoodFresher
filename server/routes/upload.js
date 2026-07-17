import express from 'express';
import multer from 'multer';
import axios from 'axios';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Multer setup using memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // limit file size to 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

// @desc    Upload image to ImgBB
// @route   POST /api/upload
// @access  Private
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image file' });
    }

    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      console.warn('WARNING: IMGBB_API_KEY is not configured. Falling back to a placeholder food image.');
      
      // Return a premium food placeholder image for testing
      const mockImages = [
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=600&auto=format&fit=crop&q=80'
      ];
      const randomImage = mockImages[Math.floor(Math.random() * mockImages.length)];
      
      return res.json({
        url: randomImage,
        message: 'No ImgBB API key found. Saved using a fallback placeholder image.',
        isPlaceholder: true
      });
    }

    // Convert file buffer to base64
    const base64Image = req.file.buffer.toString('base64');

    // Create URLSearchParams for URL-encoded body
    const params = new URLSearchParams();
    params.append('image', base64Image);

    // Call ImgBB API
    const response = await axios.post(`https://api.imgbb.com/1/upload?key=${apiKey}`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (response.data && response.data.data && response.data.data.url) {
      res.json({
        url: response.data.data.url,
        deleteUrl: response.data.data.delete_url,
      });
    } else {
      res.status(500).json({ message: 'Failed to upload image to ImgBB' });
    }
  } catch (error) {
    console.error('Upload Error:', error.response?.data || error.message);
    res.status(500).json({
      message: 'Image upload failed',
      error: error.response?.data?.error?.message || error.message,
    });
  }
});

export default router;
