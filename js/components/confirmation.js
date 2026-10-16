import { el } from '../utils.js';
import { openModal } from './modal.js';

/** Resolves true only when the user presses the confirm button. */
export function confirmDialog({ title = 'Are you sure?', message, confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const confirmBtn = el('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, type: 'button' }, confirmText);
    const cancelBtn = el('button', { class: 'btn', type: 'button' }, 'Cancel');
    const body = el('div', {}, el('p', { style: 'margin-bottom:1rem' }, message),
      el('div', { class: 'modal-actions' }, cancelBtn, confirmBtn));
    const modal = openModal({ title, body, onClose: (r) => resolve(r === 'confirm') });
    confirmBtn.addEventListener('click', () => modal.close('confirm'));
    cancelBtn.addEventListener('click', () => modal.close('cancel'));
    cancelBtn.focus();
  });
}
