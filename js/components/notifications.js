import { el } from '../utils.js';

export function notify(message, type = 'info') {
  const host = document.getElementById('toasts');
  if (!host) return;
  const t = el('div', { class: `toast ${type}`, role: type === 'error' ? 'alert' : 'status' }, message);
  host.append(t);
  setTimeout(() => t.remove(), 4000);
}
