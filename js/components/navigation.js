import { el, iconEl } from '../utils.js';

export const NAV_ITEMS = [
  ['dashboard', 'Dashboard', 'gauge-high'], ['activities', 'Activities', 'list-check'], ['timer', 'Timer', 'stopwatch'],
  ['history', 'History', 'clock-rotate-left'], ['contributions', 'Contributions', 'calendar-days'], ['statistics', 'Statistics', 'chart-column'],
  ['planner', 'Planner', 'clipboard-list'], ['settings', 'Settings', 'gear'],
];

export function initNavigation() {
  const nav = document.getElementById('nav');
  nav.replaceChildren(
    el('div', { class: 'brand' }, 'Focus Tracker'),
    el('ul', { class: 'nav-list' }, NAV_ITEMS.map(([route, label, icon]) =>
      el('li', {}, el('a', { href: `#/${route}`, 'data-route': route }, iconEl(icon), el('span', {}, label))))),
  );

  // Hamburger drawer (phone widths only; CSS hides the button and drawer styling elsewhere)
  const btn = document.getElementById('menu-toggle'), backdrop = document.getElementById('nav-backdrop');
  if (!btn || !backdrop) return;
  const isOpen = () => document.body.classList.contains('nav-open');
  const links = () => [...nav.querySelectorAll('a')];

  function setOpen(open, { restoreFocus = true } = {}) {
    document.body.classList.toggle('nav-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    btn.replaceChildren(iconEl(open ? 'xmark' : 'bars'));
    if (open) links()[0]?.focus(); else if (restoreFocus) btn.focus();
  }
  setOpen(false, { restoreFocus: false });

  btn.addEventListener('click', () => setOpen(!isOpen()));
  backdrop.addEventListener('click', () => setOpen(false));
  nav.addEventListener('click', (e) => { if (e.target.closest('a') && isOpen()) setOpen(false, { restoreFocus: false }); });
  window.addEventListener('hashchange', () => { if (isOpen()) setOpen(false, { restoreFocus: false }); });
  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') return setOpen(false);
    if (e.key === 'Tab') { // keep keyboard focus inside the open drawer
      const items = [btn, ...links()], i = items.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); items.at(-1).focus(); }
      else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); btn.focus(); }
    }
  });
  window.addEventListener('resize', () => { if (isOpen() && window.innerWidth > 600) setOpen(false, { restoreFocus: false }); });
}
