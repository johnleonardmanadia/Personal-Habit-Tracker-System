import { state, setPrefs } from '../state.js';
import { el } from '../utils.js';
import { notify } from '../components/notifications.js';
import { enableNotifications, notificationsSupported } from './notifications.js';
import { exportJson, exportCsv, startImport, resetAllData, SCHEMA_VERSION } from './export-import.js';

export function renderSettings(main) {
  const p = state.prefs;
  const field = (label, input) => el('label', { class: 'field' }, label, input);
  const num = (key, min, max, label) => { const i = el('input', { type: 'number', min, max, value: p[key] });
    i.addEventListener('change', () => { const v = Number(i.value); if (Number.isFinite(v) && v >= min && v <= max) setPrefs({ [key]: Math.round(v) }); else { i.value = state.prefs[key]; notify(`${label} must be ${min}–${max}.`, 'error'); } }); return field(label, i); };
  const select = (key, label, opts, cast = (v) => v) => { const s = el('select', {}, opts.map(([v, l]) => el('option', { value: v, selected: String(p[key]) === String(v) }, l)));
    s.addEventListener('change', () => setPrefs({ [key]: cast(s.value) })); return field(label, s); };
  const check = (label, checked, onChange) => { const i = el('input', { type: 'checkbox', checked }); i.addEventListener('change', () => onChange(i)); return el('label', { class: 'check' }, i, label); };
  const info = el('p', { class: 'muted' }, 'Checking storage…');
  const file = el('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'import-file' });
  file.addEventListener('change', () => { startImport(file.files[0]); file.value = ''; });
  const btn = (label, cls, fn) => el('button', { class: `btn ${cls}`, type: 'button', onclick: fn }, label);

  main.append(el('h1', { class: 'page-title' }, 'Settings'),
    el('section', { class: 'card section' }, el('h2', {}, 'Appearance & timer'), el('div', { class: 'settings-grid' },
      select('theme', 'Theme', [['dark', 'Dark'], ['light', 'Light']]),
      select('weekStart', 'Week starts on', [[1, 'Monday'], [0, 'Sunday']], Number),
      select('timeFormat', 'Time display', [['24h', '24-hour'], ['12h', '12-hour (AM/PM)']]),
      num('defaultMinutes', 1, 600, 'Default timer (minutes)'), num('dailyGoalMinutes', 0, 1440, 'Daily focus goal (minutes)')),
      check('Play a sound when a session completes', p.sound, (i) => setPrefs({ sound: i.checked })),
      check('Show a system notification when a session completes', p.notifications && notificationsSupported() && Notification.permission === 'granted', async (i) => {
        if (!i.checked) return setPrefs({ notifications: false });
        const ok = await enableNotifications(); i.checked = ok; setPrefs({ notifications: ok }); })),
    el('section', { class: 'card section' }, el('h2', {}, 'Your data'),
      el('p', { class: 'muted', style: 'margin-bottom:1rem' }, 'Everything is stored only in this browser (IndexedDB). Clearing site data or switching browser/device removes it, and nothing syncs automatically. Download backups regularly.'),
      el('div', { class: 'btn-row' }, btn('Export backup (JSON)', 'btn-primary', exportJson), btn('Export sessions (CSV)', '', exportCsv),
        el('label', { class: 'btn', for: 'import-file', tabindex: 0, role: 'button', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } } }, 'Import backup…'), file,
        btn('Keep my data (persistent storage)', '', async () => { const ok = navigator.storage?.persist ? await navigator.storage.persist() : false; notify(ok ? 'Browser will try to keep your data.' : 'The browser did not grant persistent storage.', ok ? 'info' : 'error'); }),
        btn('Erase all data…', 'btn-danger', resetAllData)), info),
    el('section', { class: 'card section' }, el('h2', {}, 'About'), el('p', { class: 'muted' }, `Focus Tracker 1.0 · data schema v${SCHEMA_VERSION} · works without an account, with no tracking or analytics.`)));
  if (navigator.storage?.estimate) navigator.storage.estimate().then((e) => { info.textContent = `Storage used by this site: ${(e.usage / 1024).toFixed(1)} KB.`; }).catch(() => { info.textContent = ''; });
  else info.textContent = '';
}
