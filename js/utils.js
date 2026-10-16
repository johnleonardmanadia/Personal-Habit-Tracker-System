export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date key (YYYY-MM-DD). Never uses UTC. */
export function localDateKey(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
/** weekStart: 0 = Sunday, 1 = Monday */
export function startOfWeek(date = new Date(), weekStart = 1) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return addDays(d, -((d.getDay() - weekStart + 7) % 7));
}
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
export function formatMinutes(seconds) {
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/** Safe element builder: text is always inserted as text nodes. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const c of children.flat()) node.append(c instanceof Node ? c : document.createTextNode(c ?? ''));
  return node;
}
/** A session counts toward totals, streaks and contributions only when completed or finished early. */
export const VALID_STATUSES = ['completed', 'finished_early'];
export const isValidSession = (s) => VALID_STATUSES.includes(s.status);

/** Streaks over local date keys. Today without a session does not break the current streak. */
export function computeStreaks(dateKeys, today = new Date()) {
  const set = new Set(dateKeys);
  const sorted = [...set].sort();
  let longest = 0, run = 0, prev = null;
  for (const k of sorted) {
    const d = parseDateKey(k);
    run = prev && localDateKey(addDays(prev, 1)) === k ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  let cursor = set.has(localDateKey(today)) ? today : addDays(today, -1);
  let current = 0;
  while (set.has(localDateKey(cursor))) { current++; cursor = addDays(cursor, -1); }
  return { current, longest };
}

// ---- Icons (Font Awesome Free, self-hosted) ----
const ICON_RE = /^[a-z0-9-]{1,40}$/;
const LEGACY_ICONS = { '\u{1F4D6}': 'book-bible', '\u{1F4C8}': 'chart-line', '\u{1F3A8}': 'pen-ruler', '\u{1F4BB}': 'laptop-code', '\u{1F680}': 'rocket',
  '\u{1F393}': 'graduation-cap', '\u{1F3C3}': 'person-running', '\u{2B50}': 'star', '\u{270D}': 'pen', '\u{1F3AF}': 'bullseye', '\u{1F9E0}': 'brain', '\u{1F3B5}': 'music' };
/** Always returns a safe Font Awesome icon name (older saved emoji icons are converted). */
export function normalizeIcon(value) {
  const v = String(value ?? '').replace(/\uFE0F/g, '');
  if (LEGACY_ICONS[v]) return LEGACY_ICONS[v];
  return ICON_RE.test(v) ? v : 'star';
}
export function iconEl(name) {
  return el('i', { class: `fa-solid fa-${normalizeIcon(name)}`, 'aria-hidden': 'true' });
}
