import { el, iconEl } from '../utils.js';

/** Opens a native <dialog> (focus trap + Escape handled by the browser). Returns { close, dialog }. */
export function openModal({ title, body, onClose }) {
  const dialog = el('dialog', { class: 'modal', 'aria-labelledby': 'modal-title' });
  const close = (result) => { if (dialog.open) dialog.close(result); };
  dialog.append(
    el('div', { class: 'modal-head' },
      el('h2', { id: 'modal-title' }, title),
      el('button', { class: 'btn', type: 'button', 'aria-label': 'Close', onclick: () => close('dismiss') }, iconEl('xmark'))),
    el('div', { class: 'modal-body' }, body),
  );
  dialog.addEventListener('close', () => { dialog.remove(); onClose?.(dialog.returnValue); });
  document.body.append(dialog);
  dialog.showModal();
  return { close, dialog };
}
