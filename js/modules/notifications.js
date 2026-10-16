import { notify } from '../components/notifications.js';

export const notificationsSupported = () => 'Notification' in window;

/** Must be called from a user click. Returns true only when permission is granted. */
export async function enableNotifications() {
  if (!notificationsSupported()) { notify('This browser does not support notifications.', 'error'); return false; }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') { notify('Notifications are blocked. Allow them in your browser’s site settings.', 'error'); return false; }
  return (await Notification.requestPermission()) === 'granted';
}

export function systemNotify(title, body) {
  if (notificationsSupported() && Notification.permission === 'granted') new Notification(title, { body });
}
