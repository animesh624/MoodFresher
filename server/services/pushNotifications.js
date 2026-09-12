import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

const isConfigured = () => (
  process.env.VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY &&
  process.env.VAPID_SUBJECT
);

const configureWebPush = () => {
  if (!isConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  return true;
};

export const sendNewOrderNotification = async (order) => {
  try {
    if (!configureWebPush()) {
      console.warn('Web push is not configured. Add VAPID keys to server/.env.');
      return;
    }

    const subscriptions = await PushSubscription.find({});
    const payload = JSON.stringify({
      title: 'New MoodFresher order',
      body: `${order.customerName} placed order ${order.orderId} for ₹${order.total}.`,
      orderId: order.orderId,
      url: `/order/${order.orderId}?admin_order=${order.orderId}`,
    });

    await Promise.all(subscriptions.map(async (savedSubscription) => {
      try {
        await webpush.sendNotification(savedSubscription.toObject(), payload);
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: savedSubscription._id });
          return;
        }
        console.error('Web push notification failed:', error.message);
      }
    }));
  } catch (error) {
    console.error('Web push service error:', error.message);
  }
};
