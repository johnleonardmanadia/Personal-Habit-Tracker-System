import { db } from '../database.js';
import { state, reload } from '../state.js';
import { el, uid, localDateKey, startOfWeek, formatMinutes, formatDuration, isValidSession } from '../utils.js';
import { openModal } from '../components/modal.js';
import { confirmDialog } from '../components/confirmation.js';
import { notify } from '../components/notifications.js';

const STATUS_LABEL = { completed: 'Completed', finished_early: 'Finished early' };

export function buildRecord(t, status, actualSeconds, now = Date.now()) {
  return {
    id: t.id, activityId: t.activityId || null, activityName: t.activityName, category: t.category,
    startedAt: t.startedAt, endedAt: new Date(now).toISOString(), actualSeconds: Math.round(actualSeconds),
    plannedSeconds: t.plannedSeconds, status, notes: t.notes || '', dateKey: localDateKey(t.startedAt),
  };
}

/** Saves a session once. A repeated id is ignored, which prevents duplicate counting. */
export async function saveSession(rec) {
  if (await db.get('sessions', rec.id)) return false;
  await db.add('sessions', rec);
  await reload();
  return true;
}

function logManual() {
  const acts = state.activities.filter((a) => a.status === 'active');
  const sel = el('select', {}, el('option', { value: '' }, 'General focus'), acts.map((a) => el('option', { value: a.id }, a.name)));
  const date = el('input', { type: 'date', value: localDateKey(), max: localDateKey(), required: true });
  const mins = el('input', { type: 'number', min: 1, max: 1440, value: 30 });
  const notes = el('textarea', { rows: 2, maxlength: 500 });
  const err = el('p', { class: 'error-state', role: 'alert', style: 'padding:0 0 .5rem;text-align:left' });
  const cancel = el('button', { class: 'btn', type: 'button' }, 'Cancel');
  const f = (l, i) => el('label', { class: 'field' }, l, i);
  const form = el('form', {}, f('Activity', sel), f('Date', date), f('Minutes focused', mins), f('Notes', notes), err,
    el('div', { class: 'modal-actions' }, cancel, el('button', { class: 'btn btn-primary', type: 'submit' }, 'Save session')));
  const modal = openModal({ title: 'Log a session', body: form });
  cancel.addEventListener('click', () => modal.close());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = Number(mins.value);
    if (!date.value || date.value > localDateKey()) return void (err.textContent = 'Choose today or an earlier date.');
    if (!Number.isFinite(m) || m < 1 || m > 1440) return void (err.textContent = 'Minutes must be 1–1440.');
    const a = acts.find((x) => x.id === sel.value);
    const [y, mo, d] = date.value.split('-').map(Number);
    const end = date.value === localDateKey() ? Date.now() : new Date(y, mo - 1, d, 12, 0).getTime() + m * 60000;
    const rec = buildRecord({ id: uid(), activityId: a?.id, activityName: a?.name || 'General focus', category: a?.category || 'Other',
      plannedSeconds: m * 60, notes: notes.value.trim(), startedAt: new Date(end - m * 60000).toISOString() }, 'completed', m * 60, end);
    rec.dateKey = date.value; rec.manual = true;
    try { await saveSession(rec); modal.close(); notify('Session logged.'); } catch (ex) { err.textContent = ex.message; }
  });
}

function showDetail(s) {
  const row = (k, v) => [el('dt', {}, k), el('dd', {}, v)];
  openModal({ title: 'Session details', body: el('dl', { class: 'detail-list' },
    row('Activity', s.activityName), row('Category', s.category), row('Status', STATUS_LABEL[s.status] || s.status),
    row('Date', s.dateKey), row('Started', new Date(s.startedAt).toLocaleString()), row('Ended', new Date(s.endedAt).toLocaleString()),
    row('Focus time', formatDuration(s.actualSeconds)), row('Planned', formatDuration(s.plannedSeconds)),
    row('Notes', s.notes || '—'), row('Source', s.manual ? 'Logged manually' : 'Timer'), row('ID', s.id)) });
}

export function renderHistory(main) {
  const q = el('input', { type: 'search', placeholder: 'Search name or notes…', 'aria-label': 'Search sessions' });
  const act = el('select', { 'aria-label': 'Filter by activity' });
  const cat = el('select', { 'aria-label': 'Filter by category' });
  const from = el('input', { type: 'date', 'aria-label': 'From date' });
  const to = el('input', { type: 'date', 'aria-label': 'To date' });
  const sort = el('select', { 'aria-label': 'Sort' }, el('option', { value: 'new' }, 'Newest first'), el('option', { value: 'old' }, 'Oldest first'));
  const summary = el('div', { class: 'summary' });
  const list = el('div', { class: 'grid', style: 'grid-template-columns:1fr' });

  function fill(select, label, values) {
    const keep = select.value;
    select.replaceChildren(el('option', { value: '' }, label), ...values.map((v) => el('option', { value: v }, v)));
    select.value = values.includes(keep) ? keep : '';
  }
  function draw() {
    const all = state.sessions.filter(isValidSession);
    fill(act, 'All activities', [...new Set(all.map((s) => s.activityName))].sort());
    fill(cat, 'All categories', [...new Set(all.map((s) => s.category))].sort());
    const today = localDateKey(), wk = localDateKey(startOfWeek(new Date(), state.prefs.weekStart));
    const sum = (f) => formatMinutes(all.filter(f).reduce((n, s) => n + s.actualSeconds, 0));
    summary.replaceChildren(el('div', {}, el('strong', {}, sum((s) => s.dateKey === today)), ' today'),
      el('div', {}, el('strong', {}, sum((s) => s.dateKey >= wk)), ' this week'), el('div', {}, el('strong', {}, String(all.length)), ' sessions total'));
    const term = q.value.trim().toLowerCase();
    const items = all.filter((s) => (!act.value || s.activityName === act.value) && (!cat.value || s.category === cat.value) &&
      (!from.value || s.dateKey >= from.value) && (!to.value || s.dateKey <= to.value) &&
      (!term || `${s.activityName} ${s.notes}`.toLowerCase().includes(term)));
    items.sort((a, b) => (sort.value === 'new' ? b.startedAt.localeCompare(a.startedAt) : a.startedAt.localeCompare(b.startedAt)));
    if (!items.length) return list.replaceChildren(el('div', { class: 'card empty-state' }, all.length ? 'No sessions match your filters.' : 'No sessions yet. Finish a timer session or log one manually.'));
    list.replaceChildren(...items.map((s) => el('article', { class: 'card session-row' },
      el('div', {}, el('strong', {}, s.activityName), el('div', { class: 'muted' }, `${s.dateKey} · ${new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: state.prefs.timeFormat === '12h' })} · ${formatMinutes(s.actualSeconds)} · ${s.category}`),
        el('span', { class: 'badge' }, STATUS_LABEL[s.status] || s.status)),
      el('div', { class: 'actions' },
        el('button', { class: 'btn', type: 'button', onclick: () => showDetail(s) }, 'Details'),
        el('button', { class: 'btn', type: 'button', onclick: async () => {
          if (!(await confirmDialog({ title: 'Delete session?', danger: true, confirmText: 'Delete', message: `Delete this ${formatMinutes(s.actualSeconds)} session? This changes your totals and streaks.` }))) return;
          await db.remove('sessions', s.id); await reload(); draw(); notify('Session deleted.');
        } }, 'Delete')))));
  }
  [q, act, cat, from, to, sort].forEach((c) => c.addEventListener('input', draw));
  main.append(el('h1', { class: 'page-title' }, 'Session history'), summary,
    el('div', { class: 'toolbar' }, q, act, cat, from, to, sort, el('button', { class: 'btn btn-primary', type: 'button', onclick: logManual }, '+ Log session')), list);
  draw();
}
