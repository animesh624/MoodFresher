import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';

// Route imports
import authRoutes from './routes/auth.js';
import itemRoutes from './routes/items.js';
import couponRoutes from './routes/coupons.js';
import bannerRoutes from './routes/banners.js';
import settingsRoutes from './routes/settings.js';
import uploadRoutes from './routes/upload.js';
import cartRoutes from './routes/cart.js';
import ordersRoutes from './routes/orders.js';
import Order from './models/Order.js';

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars if .env file exists (local development)
const envPath = path.resolve(__dirname, './.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', ordersRoutes);

// Dynamic SSR order tracking page for WhatsApp previews and live customer status checks
app.get('/order/:orderId', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Order Not Found - MoodFresher</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body { background-color: #0a0a0f; color: #f1f1f7; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            h1 { color: #d4a24c; font-size: 28px; }
            a { color: #d4a24c; text-decoration: none; border: 1px solid #d4a24c; padding: 10px 20px; border-radius: 20px; margin-top: 20px; display: inline-block; }
          </style>
        </head>
        <body>
          <div>
            <h1>🚫 Order Not Found</h1>
            <p>We couldn't find an order matching that ID. Please check the URL and try again.</p>
            <a href="/">Back to Website</a>
          </div>
        </body>
        </html>
      `);
    }

    const statuses = ['Pending', 'Accepted', 'Preparing', 'OutForDelivery', 'Completed'];
    const currentStatusIndex = statuses.indexOf(order.status);
    const isRejected = order.status === 'Rejected';

    const formattedDate = new Date(order.createdAt).toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Track Order #${order.orderId} - MoodFresher</title>
        
        <!-- Open Graph Meta Tags for WhatsApp Preview Cards -->
        <meta property="og:title" content="MoodFresher Order Summary #${order.orderId}" />
        <meta property="og:description" content="Status: ${order.status} | Total: ₹${order.total} | Customer: ${order.customerName}" />
        <meta property="og:image" content="${order.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80'}" />
        <meta property="og:type" content="website" />
        
        <!-- Admin redirect: if logged in as admin, redirect to admin dashboard for this order -->
        <script>
          (function() {
            try {
              var adminToken = localStorage.getItem('adminToken');
              if (adminToken) {
                // Admin is logged in - redirect to admin dashboard for this order
                window.location.replace('/?admin_order=${order.orderId}');
              }
            } catch(e) {
              // localStorage not available (e.g. private mode), show normal page
            }
          })();
        </script>
        
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
        
        <style>
          :root {
            --gold: #d4a24c;
            --gold-light: #f0c86a;
            --bg-primary: #0a0a0f;
            --bg-secondary: #111118;
            --bg-card: #14141e;
            --text-primary: #f1f1f7;
            --text-secondary: #a0a0b8;
            --text-muted: #9090a8;
            --border-default: rgba(255, 255, 255, 0.12);
            --border-visible: rgba(255, 255, 255, 0.18);
          }
          body {
            background-color: var(--bg-primary);
            color: var(--text-primary);
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
          }
          .container {
            width: 100%;
            max-width: 600px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            margin-bottom: 60px;
          }
          header {
            text-align: center;
            padding: 20px 0;
          }
          .brand {
            font-family: 'Outfit', sans-serif;
            font-size: 28px;
            font-weight: 800;
            color: var(--gold-light);
            margin: 0;
          }
          .brand-tag {
            font-size: 12px;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 4px;
          }
          .card {
            background-color: var(--bg-card);
            border: 1px solid var(--border-default);
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
          }
          .card-title {
            font-family: 'Outfit', sans-serif;
            font-size: 18px;
            color: var(--gold-light);
            margin: 0 0 16px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .status-badge {
            background-color: rgba(212, 162, 76, 0.1);
            border: 1px solid rgba(212, 162, 76, 0.2);
            color: var(--gold-light);
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 20px;
            text-transform: uppercase;
          }
          .status-badge.completed {
            background-color: rgba(37, 211, 102, 0.1);
            border-color: rgba(37, 211, 102, 0.2);
            color: #4ade80;
          }
          .status-badge.rejected {
            background-color: rgba(255, 77, 79, 0.1);
            border-color: rgba(255, 77, 79, 0.2);
            color: #ff4d4f;
          }
          /* Stepper design */
          .stepper {
            display: flex;
            justify-content: space-between;
            position: relative;
            margin: 20px 0;
          }
          .stepper::before {
            content: '';
            position: absolute;
            top: 25px;
            left: 0;
            right: 0;
            height: 2px;
            background-color: var(--border-default);
            z-index: 1;
          }
          .step {
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
            z-index: 2;
            flex: 1;
          }
          .step-icon {
            width: 44px;
            height: 44px;
            background-color: var(--bg-secondary);
            border: 2px solid var(--border-default);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            transition: all 0.3s ease;
          }
          .step.active .step-icon {
            border-color: var(--gold);
            box-shadow: 0 0 12px var(--gold);
            background-color: var(--bg-card);
          }
          .step-label {
            font-size: 10px;
            font-weight: 600;
            color: var(--text-muted);
            margin-top: 8px;
            text-align: center;
          }
          .step.active .step-label {
            color: var(--text-primary);
          }
          
          .details-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            font-size: 14px;
            padding: 6px 0;
            border-bottom: 1px solid rgba(255,255,255,0.05);
          }
          .details-label {
            color: var(--text-muted);
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          .details-value {
            font-weight: 600;
            text-align: right;
            max-width: 65%;
            color: var(--text-primary);
          }
          .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 13px;
            color: var(--text-primary);
          }
          .invoice-table th {
            text-align: left;
            color: var(--gold-light);
            font-weight: 700;
            border-bottom: 2px solid rgba(240, 200, 106, 0.3);
            padding-bottom: 10px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .invoice-table td {
            padding: 11px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.07);
            color: #e8e8f0;
            font-size: 13px;
          }
          .invoice-table tr:last-child td {
            border-bottom: none;
          }
          .invoice-table td:last-child {
            color: var(--text-primary);
            font-weight: 500;
          }
          .total-row {
            margin-top: 16px;
            border-top: 1px solid rgba(240, 200, 106, 0.25);
            padding-top: 16px;
            display: flex;
            justify-content: space-between;
            font-weight: 700;
            font-size: 16px;
            color: var(--text-primary);
          }
          .total-price {
            color: var(--gold-light);
          }
          .btn-refresh {
            background-color: var(--bg-card);
            border: 2px solid var(--gold);
            color: #ffffff !important;
            padding: 14px 20px;
            border-radius: 30px;
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            cursor: pointer;
            width: 100%;
            transition: all 0.2s ease;
            box-shadow: 0 0 15px rgba(212, 162, 76, 0.2);
            margin-bottom: 15px;
            display: block;
            text-align: center;
          }
          .btn-refresh:hover {
            background-color: var(--gold);
            color: #0a0a0f !important;
            box-shadow: 0 0 25px rgba(212, 162, 76, 0.4);
          }
          .alert-rejected {
            background-color: rgba(255, 77, 79, 0.08);
            border-left: 4px solid #ff4d4f;
            color: #ff4d4f;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 10px;
            font-size: 13px;
            line-height: 1.5;
          }
          .invoice-img {
            width: 100%;
            border-radius: 8px;
            margin-top: 10px;
            border: 1px solid var(--border-default);
          }

          /* Stepper vertical layout on mobile screen */
          @media (max-width: 600px) {
            .stepper {
              flex-direction: column;
              gap: 0;
              overflow-x: visible;
              margin: 16px 0;
            }
            .stepper::before {
              /* Vertical connecting line */
              width: 2px;
              height: calc(100% - 44px);
              top: 22px;
              left: 21px;
              right: auto;
            }
            .step {
              flex-direction: row;
              align-items: center;
              gap: 16px;
              padding: 8px 0;
              flex: unset;
              min-width: unset;
            }
            .step-icon {
              flex-shrink: 0;
            }
            .step-label {
              margin-top: 0;
              text-align: left;
              font-size: 13px;
            }
            .step.active .step-label {
              font-weight: 600;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <div class="brand">MoodFresher</div>
            <div class="brand-tag">Cafe & Restaurant</div>
          </header>

          <!-- Refresh Button at the top of the page above status on mobile screen -->
          <button class="btn-refresh" onclick="window.location.reload()">🔄 Refresh Order Status</button>

          <div class="card">
            <div class="card-title">
              <span>Order Tracking</span>
              <span class="status-badge ${order.status.toLowerCase()}">${order.status}</span>
            </div>
            
            ${isRejected ? `
              <div class="alert-rejected">
                <strong>🚫 Order Rejected</strong><br>
                This order was rejected by the kitchen. Please contact support or place a new order.
              </div>
            ` : `
              <div class="stepper">
                <div class="step ${currentStatusIndex >= 0 ? 'active' : ''}">
                  <div class="step-icon">📝</div>
                  <div class="step-label">Submitted</div>
                </div>
                <div class="step ${currentStatusIndex >= 1 ? 'active' : ''}">
                  <div class="step-icon">✅</div>
                  <div class="step-label">Accepted</div>
                </div>
                <div class="step ${currentStatusIndex >= 2 ? 'active' : ''}">
                  <div class="step-icon">🍳</div>
                  <div class="step-label">Preparing</div>
                </div>
                <div class="step ${currentStatusIndex >= 3 ? 'active' : ''}">
                  <div class="step-icon">🚗</div>
                  <div class="step-label">On Way</div>
                </div>
                <div class="step ${currentStatusIndex >= 4 ? 'active' : ''}">
                  <div class="step-icon">🍽️</div>
                  <div class="step-label">Delivered</div>
                </div>
              </div>
            `}
          </div>

          <div class="card">
            <div class="card-title">Customer details</div>
            <div class="details-row">
              <span class="details-label">Name</span>
              <span class="details-value">${order.customerName}</span>
            </div>
            <div class="details-row">
              <span class="details-label">Mobile</span>
              <span class="details-value">${order.customerMobile}</span>
            </div>
            <div class="details-row">
              <span class="details-label">Address</span>
              <span class="details-value">${order.customerAddress}</span>
            </div>
            <div class="details-row">
              <span class="details-label">Order Date</span>
              <span class="details-value">${formattedDate}</span>
            </div>
            <div class="details-row">
              <span class="details-label">Order ID</span>
              <span class="details-value" style="font-family: monospace; font-size: 12px; color: var(--gold-light);">${order.orderId}</span>
            </div>
          </div>

          <div class="card">
            <div class="card-title">Order summary</div>
            <table class="invoice-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align: center;">Qty</th>
                  <th style="text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${order.items.map(item => `
                  <tr>
                    <td>${item.name} ${item.variant ? `(${item.variant})` : ''}</td>
                    <td style="text-align: center;">${item.qty}</td>
                    <td style="text-align: right;">₹${item.qty * item.price}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div style="margin-top: 16px;">
              <div class="details-row">
                <span class="details-label">Subtotal</span>
                <span class="details-value">₹${order.subtotal}</span>
              </div>
              ${order.discount > 0 ? `
                <div class="details-row">
                  <span class="details-label">Discount ${order.couponCode ? `(${order.couponCode})` : ''}</span>
                  <span class="details-value" style="color: #4ade80;">-₹${order.discount}</span>
                </div>
              ` : ''}
              <div class="details-row">
                <span class="details-label">Delivery Fee</span>
                <span class="details-value">₹${order.deliveryFee}</span>
              </div>
              <div class="total-row">
                <span>Grand Total</span>
                <span class="total-price">₹${order.total}</span>
              </div>
            </div>
          </div>

          ${order.imageUrl ? `
            <div class="card">
              <div class="card-title">Order invoice image</div>
              <img class="invoice-img" src="${order.imageUrl}" alt="Order Summary Invoice" />
            </div>
          ` : ''}
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('<h1>Server Error</h1>');
  }
});

app.get('/', (req, res) => {
  res.send('MoodFresher API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5000;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}

export default app;
