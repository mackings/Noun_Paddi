import api from './api';

const isPushSupported = () => (
  typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window
  && 'Notification' in window
);

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const setupPushNotifications = async () => {
  if (!isPushSupported()) {
    return { supported: false };
  }

  if (Notification.permission === 'denied') {
    return { supported: true, subscribed: false, reason: 'denied' };
  }

  let permission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    return { supported: true, subscribed: false, reason: 'not-granted' };
  }

  const registration = await navigator.serviceWorker.register('/push-sw.js');
  const existing = await registration.pushManager.getSubscription();
  const response = await api.get('/push/public-key');
  const publicKey = response?.data?.data?.publicKey;

  if (!publicKey) {
    throw new Error('Missing VAPID public key.');
  }

  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await api.post('/push/subscribe', { subscription: subscription.toJSON() });

  return { supported: true, subscribed: true };
};

export const removePushSubscription = async () => {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration('/push-sw.js');
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  try {
    await api.post('/push/unsubscribe', { endpoint });
  } catch (error) {
    // Ignore backend unsubscribe errors; client is already unsubscribed.
  }
};
