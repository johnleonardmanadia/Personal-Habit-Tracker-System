import { db, validate } from '../database.js';
import { state, setPrefs, DEFAULT_PREFS } from '../state.js';
import { el, localDateKey } from '../utils.js';
import { openModal } from '../components/modal.js';
import { notify } from '../components/notifications.js';

export const SCHEMA_VERSION = 1;
const DATA_STORES = ['activities', 'sessions', 'planned', 'goals'];
const MAX_BYTES = 20 * 1024 * 1024;

export function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el('a', { href: url, download: filename }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function buildBackup() {
  const data = {};
  for (const s of DATA_STORES) data[s] = await db.getAll(s);
  return { app: 'focus-tracker', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data, preferences: state.prefs };
}
export async function exportJson(prefix = 'focus-tracker-backup') {
  download(`${prefix}-${localDateKey()}.json`, JSON.stringify(await buildBackup(), null, 2), 'application/json');
}

const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // blocks spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function sessionsToCsv(sessions) {
  const head = ['id', 'date', 'started_at', 'ended_at', 'activity', 'category', 'status', 'planned_seconds', 'actual_seconds', 'notes'];
  const rows = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt)).map((s) =>
    [s.id, s.dateKey, s.startedAt, s.endedAt, s.activityName, s.category, s.status, s.plannedSeconds, s.actualSeconds, s.notes]);
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}
export async function exportCsv() {
  download(`focus-tracker-sessions-${localDateKey()}.csv`, sessionsToCsv(await db.getAll('sessions')), 'text/csv');
}

// ---------- Validation ----------
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const validTime = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

export function validateBackup(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['The file is not a Focus Tracker backup.'];
  if (obj.app !== 'focus-tracker') errors.push('Missing app marker: this is not a Focus Tracker backup.');
  if (!Number.isInteger(obj.schemaVersion)) errors.push('Missing or invalid schemaVersion.');
  else if (obj.schemaVersion > SCHEMA_VERSION) errors.push(`Backup schema ${obj.schemaVersion} is newer than this app (${SCHEMA_VERSION}).`);
  const data = obj.data;
  if (!data || typeof data !== 'object') errors.push('Missing "data" section.');
  else for (const store of DATA_STORES) {
    if (!Array.isArray(data[store])) { errors.push(`"${store}" must be a list.`); continue; }
    data[store].forEach((r, i) => {
      try {
        validate(store, r);
        if (typeof r.id !== 'string') throw new Error('id must be text');
        if (store === 'sessions') {
          if (!DATE_RE.test(r.dateKey)) throw new Error('dateKey must be YYYY-MM-DD');
          if (!validTime(r.startedAt) || !validTime(r.endedAt)) throw new Error('startedAt/endedAt must be valid dates');
          if (r.actualSeconds > 172800) throw new Error('actualSeconds is unrealistically large');
          if (!['completed', 'finished_early'].includes(r.status)) throw new Error(`unknown status "${r.status}"`);
        }
        if (store === 'activities') {
          if (typeof r.name !== 'string' || typeof r.category !== 'string') throw new Error('name and category must be text');
          if (r.color !== undefined && !COLOR_RE.test(r.color)) throw new Error('color must look like #aabbcc');
          if (r.icon !== undefined && typeof r.icon !== 'string') throw new Error('icon must be text');
        }
        if (store === 'planned' && !DATE_RE.test(r.dateKey)) throw new Error('dateKey must be YYYY-MM-DD');
      } catch (e) { errors.push(`${store}[${i}]: ${e.message}`); }
    });
  }
  if (errors.length > 10) { const n = errors.length - 10; errors.length = 10; errors.push(`…and ${n} more problems.`); }
  return errors;
}

const fingerprint = (s) => `${s.startedAt}|${s.actualSeconds}|${s.activityName}`;

export async function planImport(backup) {
  const plan = {};
  for (const store of DATA_STORES) {
    const existing = await db.getAll(store), ids = new Set(existing.map((r) => r.id));
    const prints = store === 'sessions' ? new Set(existing.map(fingerprint)) : null;
    const fresh = backup.data[store].filter((r) => !ids.has(r.id) && !(prints && prints.has(fingerprint(r))));
    plan[store] = { total: backup.data[store].length, fresh, duplicates: backup.data[store].length - fresh.length };
  }
  return plan;
}

export async function applyImport(backup, plan, mode) {
  if (mode === 'replace') {
    await exportJson('focus-tracker-before-import'); // safety copy of the current data
    for (const s of DATA_STORES) await db.clear(s);
    for (const s of DATA_STORES) for (const r of backup.data[s]) await db.put(s, r);
    if (backup.preferences && typeof backup.preferences === 'object') setPrefs({ ...DEFAULT_PREFS, ...backup.preferences });
  } else {
    for (const s of DATA_STORES) for (const r of plan[s].fresh) await db.put(s, r);
  }
}

export async function startImport(file) {
  if (!file) return;
  if (file.size > MAX_BYTES) return void notify('That file is too large to be a backup.', 'error');
  let backup;
  try { backup = JSON.parse(await file.text()); } catch { return void notify('This file is not valid JSON.', 'error'); }
  const errors = validateBackup(backup);
  if (errors.length) {
    return void openModal({ title: 'Import rejected', body: el('div', {}, el('p', {}, 'Nothing was changed. Problems found:'), el('ul', { style: 'margin:.5rem 0 0 1.2rem;list-style:disc' }, errors.map((e) => el('li', {}, e)))) });
  }
  const plan = await planImport(backup);
  const done = async (mode, modal) => {
    try { await applyImport(backup, plan, mode); modal.close(); notify('Import complete. Reloading…'); setTimeout(() => location.reload(), 800); }
    catch (e) { notify(`Import failed: ${e.message}`, 'error'); }
  };
  const mk = (label, cls, fn) => el('button', { class: `btn ${cls}`, type: 'button', onclick: fn }, label);
  const body = el('div', {}, el('p', { class: 'muted' }, `Backup from ${new Date(backup.exportedAt || Date.now()).toLocaleString()}`),
    el('table', { class: 'preview-table' }, el('thead', {}, el('tr', {}, ['Data', 'In file', 'New', 'Already here'].map((h) => el('th', {}, h)))),
      el('tbody', {}, DATA_STORES.map((s) => el('tr', {}, el('td', {}, s), el('td', {}, String(plan[s].total)), el('td', {}, String(plan[s].fresh.length)), el('td', {}, String(plan[s].duplicates)))))),
    el('p', { class: 'muted' }, 'Merge only adds new records and keeps everything you have. Replace swaps all current data for the file (a safety backup downloads first).'));
  const actions = el('div', { class: 'modal-actions' });
  const modal = openModal({ title: 'Import preview', body: el('div', {}, body, actions) });
  actions.append(mk('Cancel', '', () => modal.close()), mk('Replace all data', 'btn-danger', () => done('replace', modal)), mk('Merge', 'btn-primary', () => done('merge', modal)));
}

export function resetAllData() {
  const input = el('input', { type: 'text', 'aria-label': 'Type RESET to confirm', autocomplete: 'off' });
  const go = el('button', { class: 'btn btn-danger', type: 'button', disabled: true }, 'Erase everything');
  input.addEventListener('input', () => { go.disabled = input.value !== 'RESET'; });
  const modal = openModal({ title: 'Erase all data?', body: el('div', {}, el('p', {}, 'This permanently deletes every activity, session, plan, goal and your preferences from this browser. It cannot be undone.'),
    el('div', { class: 'btn-row', style: 'margin:1rem 0' }, el('button', { class: 'btn', type: 'button', onclick: () => exportJson('focus-tracker-backup') }, 'Download a backup first')),
    el('label', { class: 'field' }, 'Type RESET to confirm', input), el('div', { class: 'modal-actions' }, el('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Cancel'), go)) });
  go.addEventListener('click', async () => {
    for (const s of [...DATA_STORES, 'meta']) await db.clear(s);
    try { localStorage.removeItem('focus-tracker:prefs'); } catch { /* ignore */ }
    location.reload();
  });
}
