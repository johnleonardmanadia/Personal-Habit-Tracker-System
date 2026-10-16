import { db } from '../database.js';
import { state, reload } from '../state.js';
import { el, uid, formatMinutes, iconEl, normalizeIcon } from '../utils.js';
import { openModal } from '../components/modal.js';
import { confirmDialog } from '../components/confirmation.js';
import { notify } from '../components/notifications.js';

export const CATEGORIES = ['Spiritual', 'Study', 'Design', 'Development', 'Academic', 'Health', 'Personal', 'Other'];
const ICONS = ['book-bible', 'book', 'chart-line', 'pen-ruler', 'laptop-code', 'code', 'rocket', 'graduation-cap', 'person-running', 'dumbbell', 'brain', 'lightbulb', 'pen', 'bullseye', 'music', 'heart', 'bolt', 'star'];
const STARTERS = [
  ['Bible Reading', 'Spiritual', 'book-bible', '#2ea66a', 20], ['Digital Marketing Study', 'Study', 'chart-line', '#e3b341', 45],
  ['UI/UX Design', 'Design', 'pen-ruler', '#a371f7', 45], ['Front-End Development', 'Development', 'laptop-code', '#58a6ff', 60],
  ['Coding & Personal Projects', 'Development', 'rocket', '#f0883e', 60], ['School & Academic Study', 'Academic', 'graduation-cap', '#db61a2', 45],
  ['Exercise & Personal Development', 'Health', 'person-running', '#3fb950', 30],
];

const newActivity = (o = {}) => ({
  id: uid(), name: '', description: '', category: 'Other', icon: 'star', color: '#2ea66a',
  defaultMinutes: 25, dailyTargetMinutes: 0, status: 'active', createdAt: new Date().toISOString(), ...o,
});

function cardIcon(a) { const i = iconEl(a.icon); i.style.color = a.color; return i; }

function lastUsedMap() {
  const m = new Map();
  for (const s of state.sessions) if (s.activityId && (m.get(s.activityId) || '') < s.startedAt) m.set(s.activityId, s.startedAt);
  return m;
}

function openForm(existing) {
  const a = existing ? { ...existing } : newActivity();
  const f = (label, input) => el('label', { class: 'field' }, label, input);
  const name = el('input', { type: 'text', required: true, maxlength: 60, value: a.name });
  const desc = el('textarea', { rows: 2, maxlength: 300 }, a.description);
  const cat = el('input', { type: 'text', list: 'cat-list', maxlength: 30, value: a.category });
  const cats = el('datalist', { id: 'cat-list' }, CATEGORIES.map((c) => el('option', { value: c })));
  let chosenIcon = normalizeIcon(a.icon);
  const iconGrid = el('div', { class: 'icon-grid', role: 'radiogroup', 'aria-label': 'Icon' }, ICONS.map((n) => {
    const r = el('input', { type: 'radio', name: 'icon', value: n, 'aria-label': n.replace(/-/g, ' '), checked: n === chosenIcon });
    r.addEventListener('change', () => { chosenIcon = n; });
    return el('label', { class: 'icon-opt', title: n.replace(/-/g, ' ') }, r, iconEl(n));
  }));
  const color = el('input', { type: 'color', value: a.color });
  const dur = el('input', { type: 'number', min: 1, max: 600, value: a.defaultMinutes });
  const daily = el('input', { type: 'number', min: 0, max: 1440, value: a.dailyTargetMinutes });
  const status = el('select', {}, ['active', 'archived'].map((s) => el('option', { value: s, selected: s === a.status }, s)));
  const err = el('p', { class: 'error-state', role: 'alert', style: 'padding:0 0 .5rem;text-align:left' });
  const cancel = el('button', { class: 'btn', type: 'button' }, 'Cancel');
  const form = el('form', { novalidate: true },
    f('Name', name), f('Description', desc),
    el('div', { class: 'form-row' }, f('Category', cat), f('Status', status)),
    el('div', { class: 'form-row' }, el('div', { class: 'field' }, el('span', {}, 'Icon'), iconGrid), f('Accent color', color)),
    el('div', { class: 'form-row' }, f('Default session (minutes)', dur), f('Daily target (minutes, 0 = none)', daily)),
    cats, err, el('div', { class: 'modal-actions' }, cancel, el('button', { class: 'btn btn-primary', type: 'submit' }, 'Save')));
  const modal = openModal({ title: existing ? 'Edit activity' : 'New activity', body: form });
  cancel.addEventListener('click', () => modal.close('cancel'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Number(dur.value), t = Number(daily.value);
    if (!name.value.trim()) return void (err.textContent = 'Please enter a name.');
    if (!cat.value.trim()) return void (err.textContent = 'Please enter a category.');
    if (!Number.isFinite(d) || d < 1 || d > 600) return void (err.textContent = 'Default session must be 1–600 minutes.');
    if (!Number.isFinite(t) || t < 0 || t > 1440) return void (err.textContent = 'Daily target must be 0–1440 minutes.');
    Object.assign(a, { name: name.value.trim(), description: desc.value.trim(), category: cat.value.trim(),
      icon: chosenIcon, color: color.value, defaultMinutes: Math.round(d), dailyTargetMinutes: Math.round(t), status: status.value });
    try { await db.put('activities', a); await reload(); modal.close('saved'); notify('Activity saved.'); }
    catch (ex) { err.textContent = `Could not save: ${ex.message}`; }
  });
}

export function renderActivities(main) {
  const q = el('input', { type: 'search', placeholder: 'Search activities…', 'aria-label': 'Search activities' });
  const catSel = el('select', { 'aria-label': 'Filter by category' });
  const statSel = el('select', { 'aria-label': 'Filter by status' },
    ['active', 'archived', 'all'].map((s) => el('option', { value: s }, s === 'all' ? 'All statuses' : s[0].toUpperCase() + s.slice(1))));
  const sortSel = el('select', { 'aria-label': 'Sort' },
    [['name', 'Sort: name'], ['category', 'Sort: category'], ['recent', 'Sort: recently used']].map(([v, l]) => el('option', { value: v }, l)));
  const list = el('div', { class: 'grid' });

  async function toggleArchive(a) {
    await db.put('activities', { ...a, status: a.status === 'active' ? 'archived' : 'active' });
    await reload();
  }
  async function remove(a) {
    const ok = await confirmDialog({ title: 'Delete activity?', danger: true, confirmText: 'Delete',
      message: `Delete "${a.name}"? Your saved session history is kept and still shows this activity's name.` });
    if (!ok) return;
    await db.remove('activities', a.id); await reload(); notify('Activity deleted.');
  }
  async function addStarters() {
    const have = new Set(state.activities.map((a) => a.name));
    for (const [n, c, i, col, m] of STARTERS) if (!have.has(n)) await db.put('activities', newActivity({ name: n, category: c, icon: i, color: col, defaultMinutes: m }));
    await reload(); notify('Starter activities added.');
  }

  function draw() {
    const used = lastUsedMap();
    const cats = [...new Set(state.activities.map((a) => a.category))].sort();
    const keep = catSel.value;
    catSel.replaceChildren(el('option', { value: '' }, 'All categories'), ...cats.map((c) => el('option', { value: c }, c)));
    catSel.value = cats.includes(keep) ? keep : '';
    const term = q.value.trim().toLowerCase();
    const items = state.activities.filter((a) =>
      (statSel.value === 'all' || a.status === statSel.value) && (!catSel.value || a.category === catSel.value) &&
      (!term || `${a.name} ${a.description} ${a.category}`.toLowerCase().includes(term)));
    const by = { name: (x, y) => x.name.localeCompare(y.name), category: (x, y) => x.category.localeCompare(y.category) || x.name.localeCompare(y.name),
      recent: (x, y) => (used.get(y.id) || '').localeCompare(used.get(x.id) || '') };
    items.sort(by[sortSel.value]);
    if (!items.length) {
      list.replaceChildren(el('div', { class: 'card empty-state', style: 'grid-column:1/-1' },
        el('p', {}, state.activities.length ? 'No activities match your filters.' : 'No activities yet.'),
        state.activities.length ? '' : el('button', { class: 'btn btn-primary', type: 'button', style: 'margin-top:1rem', onclick: addStarters }, 'Add starter activities')));
      return;
    }
    list.replaceChildren(...items.map((a) => el('article', { class: `card activity-card${a.status === 'archived' ? ' archived' : ''}`, style: `border-left-color:${a.color}` },
      el('h3', {}, cardIcon(a), a.name),
      el('div', {}, el('span', { class: 'badge' }, a.category), ' ', a.status === 'archived' ? el('span', { class: 'badge' }, 'archived') : ''),
      a.description ? el('p', { class: 'muted' }, a.description) : '',
      el('p', { class: 'muted' }, `Default ${a.defaultMinutes}m` + (a.dailyTargetMinutes ? ` · Daily target ${formatMinutes(a.dailyTargetMinutes * 60)}` : '')),
      el('div', { class: 'actions' },
        a.status === 'active' ? el('a', { class: 'btn btn-primary', href: `#/timer?activity=${encodeURIComponent(a.id)}` }, iconEl('play'), 'Start') : '',
        el('button', { class: 'btn', type: 'button', onclick: () => openForm(a) }, 'Edit'),
        el('button', { class: 'btn', type: 'button', onclick: () => toggleArchive(a) }, a.status === 'active' ? 'Archive' : 'Restore'),
        el('button', { class: 'btn', type: 'button', onclick: () => remove(a) }, 'Delete')))));
  }

  [q, catSel, statSel, sortSel].forEach((c) => c.addEventListener('input', draw));
  main.append(el('h1', { class: 'page-title' }, 'Activities'),
    el('div', { class: 'toolbar' }, q, catSel, statSel, sortSel,
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => openForm() }, '+ New activity')), list);
  draw();
  return { cleanup: () => {} };
}
