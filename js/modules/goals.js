import { db } from '../database.js';
import { state, setPrefs, reload } from '../state.js';
import { el, uid, localDateKey, formatMinutes, isValidSession, iconEl } from '../utils.js';
import { notify } from '../components/notifications.js';
import { confirmDialog } from '../components/confirmation.js';

const bar = (secs, targetMin) => { const pct = targetMin > 0 ? Math.min(100, Math.round((secs / 60 / targetMin) * 100)) : 0;
  return el('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, el('div', { style: `width:${pct}%` })); };

export function renderPlanner(main) {
  let dateKey = localDateKey(), goals = [], planned = [];
  const root = el('div');
  main.append(el('h1', { class: 'page-title' }, 'Planner & goals'), root);
  const todays = () => state.sessions.filter((s) => isValidSession(s) && s.dateKey === localDateKey());
  const secsFor = (day, f) => state.sessions.filter((s) => isValidSession(s) && s.dateKey === day && f(s)).reduce((n, s) => n + s.actualSeconds, 0);
  const err = (m) => notify(m, 'error');

  async function load() { [goals, planned] = await Promise.all([db.getAll('goals'), db.getAll('planned')]); draw(); }

  function goalsSection() {
    const today = todays(), total = today.reduce((n, s) => n + s.actualSeconds, 0), p = state.prefs;
    const totalIn = el('input', { type: 'number', min: 0, max: 1440, value: p.dailyGoalMinutes, 'aria-label': 'Daily total goal in minutes' });
    totalIn.addEventListener('change', () => { const v = Number(totalIn.value); if (v >= 0 && v <= 1440) setPrefs({ dailyGoalMinutes: Math.round(v) }), draw(); else err('Goal must be 0–1440 minutes.'); });
    const cats = [...new Set([...state.activities.map((a) => a.category), ...state.sessions.map((s) => s.category)])].sort();
    const catSel = el('select', { 'aria-label': 'Category' }, cats.map((c) => el('option', { value: c }, c)));
    const catMin = el('input', { type: 'number', min: 1, max: 1440, value: 30, 'aria-label': 'Minutes' });
    const catGoals = goals.filter((g) => g.type === 'category');
    const activeActs = state.activities.filter((a) => a.status === 'active');
    return el('section', { class: 'card section' }, el('h2', {}, 'Daily goals'),
      el('div', { class: 'inline-form' }, el('label', { class: 'field' }, 'Total daily goal (minutes)', totalIn), el('div', { class: 'grow', style: 'flex:1;min-width:160px' }, el('div', { class: 'muted' }, `${formatMinutes(total)} of ${formatMinutes(p.dailyGoalMinutes * 60)} today`), bar(total, p.dailyGoalMinutes))),
      el('h3', { style: 'margin:1rem 0 .5rem;font-size:.95rem' }, 'Category goals'),
      catGoals.map((g) => el('div', { class: 'plan-item' }, el('span', { class: 'grow' }, g.target, el('div', { class: 'muted' }, `${formatMinutes(secsFor(localDateKey(), (s) => s.category === g.target))} of ${g.minutes}m`), bar(secsFor(localDateKey(), (s) => s.category === g.target), g.minutes)),
        el('button', { class: 'btn', type: 'button', onclick: async () => { await db.remove('goals', g.id); load(); } }, 'Remove'))),
      cats.length ? el('div', { class: 'inline-form' }, catSel, catMin, el('button', { class: 'btn', type: 'button', onclick: async () => {
        const m = Number(catMin.value); if (!(m >= 1 && m <= 1440)) return err('Minutes must be 1–1440.');
        await db.put('goals', { id: `cat:${catSel.value}`, type: 'category', target: catSel.value, minutes: Math.round(m) }); load(); } }, 'Set category goal')) : el('p', { class: 'muted' }, 'Add activities to set category goals.'),
      el('h3', { style: 'margin:1rem 0 .5rem;font-size:.95rem' }, 'Activity goals (minutes per day, 0 = none)'),
      activeActs.length ? activeActs.map((a) => { const i = el('input', { type: 'number', min: 0, max: 1440, value: a.dailyTargetMinutes, style: 'width:5.5rem', 'aria-label': `${a.name} daily goal` });
        i.addEventListener('change', async () => { const v = Number(i.value); if (!(v >= 0 && v <= 1440)) return err('Goal must be 0–1440.'); await db.put('activities', { ...a, dailyTargetMinutes: Math.round(v) }); await reload(); load(); });
        const secs = secsFor(localDateKey(), (s) => s.activityId === a.id);
        return el('div', { class: 'plan-item' }, el('span', { class: 'grow' }, iconEl(a.icon), ' ', a.name, el('div', { class: 'muted' }, a.dailyTargetMinutes ? `${formatMinutes(secs)} of ${a.dailyTargetMinutes}m` : 'No goal'), a.dailyTargetMinutes ? bar(secs, a.dailyTargetMinutes) : ''), i); })
        : el('p', { class: 'muted' }, 'No active activities yet.'));
  }

  function plannerSection() {
    const items = planned.filter((i) => i.dateKey === dateKey).sort((a, b) => a.order - b.order);
    const dateIn = el('input', { type: 'date', value: dateKey, 'aria-label': 'Plan date' }); dateIn.addEventListener('change', () => { if (dateIn.value) { dateKey = dateIn.value; draw(); } });
    const acts = state.activities.filter((a) => a.status === 'active');
    const kind = el('select', { 'aria-label': 'Type' }, el('option', { value: 'timed' }, 'Timed focus'), el('option', { value: 'task' }, 'Task (no timer)'));
    const actSel = el('select', { 'aria-label': 'Activity' }, acts.map((a) => el('option', { value: a.id }, a.name)));
    const title = el('input', { type: 'text', maxlength: 80, placeholder: 'Task name', 'aria-label': 'Task name' });
    const mins = el('input', { type: 'number', min: 1, max: 1440, value: 30, 'aria-label': 'Planned minutes', style: 'width:5.5rem' });
    const sync = () => { const t = kind.value === 'timed'; actSel.style.display = t ? '' : 'none'; mins.style.display = t ? '' : 'none'; title.style.display = t ? 'none' : ''; }; kind.addEventListener('change', sync); sync();
    const add = async () => {
      const timed = kind.value === 'timed', a = acts.find((x) => x.id === actSel.value), m = Number(mins.value);
      if (timed && !a) return err('Create an activity first.');
      if (timed && !(m >= 1 && m <= 1440)) return err('Minutes must be 1–1440.');
      if (!timed && !title.value.trim()) return err('Enter a task name.');
      const order = items.length ? Math.max(...items.map((i) => i.order)) + 1 : 0;
      await db.put('planned', { id: uid(), dateKey, kind: kind.value, activityId: timed ? a.id : null, title: timed ? a.name : title.value.trim(), plannedMinutes: timed ? Math.round(m) : 0, done: false, order, createdAt: new Date().toISOString() });
      title.value = ''; load();
    };
    const swap = async (a, b) => { if (!b) return; await db.put('planned', { ...a, order: b.order }); await db.put('planned', { ...b, order: a.order }); load(); };
    const rows = items.map((it, idx) => {
      const actual = it.kind === 'timed' ? secsFor(dateKey, (s) => s.activityId === it.activityId) : 0;
      const done = it.kind === 'timed' ? actual >= it.plannedMinutes * 60 : it.done;
      const label = it.kind === 'timed' ? `${formatMinutes(actual)} of ${it.plannedMinutes}m focused` : 'Task';
      const box = it.kind === 'task' ? el('input', { type: 'checkbox', checked: it.done, 'aria-label': `Mark ${it.title} complete`, style: 'width:20px;height:20px;accent-color:var(--accent)' }) : iconEl(done ? 'circle-check' : 'hourglass-half');
      if (it.kind === 'task') box.addEventListener('change', async () => { await db.put('planned', { ...it, done: box.checked }); load(); });
      return el('div', { class: `plan-item${done ? ' done' : ''}` }, box, el('span', { class: 'grow' }, it.title, el('div', { class: 'muted' }, label)),
        it.kind === 'timed' && !done ? el('a', { class: 'btn', href: `#/timer?activity=${encodeURIComponent(it.activityId)}` }, 'Start') : '',
        el('button', { class: 'btn', type: 'button', 'aria-label': 'Move up', disabled: idx === 0, onclick: () => swap(it, items[idx - 1]) }, iconEl('arrow-up')),
        el('button', { class: 'btn', type: 'button', 'aria-label': 'Move down', disabled: idx === items.length - 1, onclick: () => swap(it, items[idx + 1]) }, iconEl('arrow-down')),
        el('button', { class: 'btn', type: 'button', onclick: async () => { if (await confirmDialog({ title: 'Remove item?', message: `Remove "${it.title}" from the plan? Saved sessions are not affected.`, confirmText: 'Remove', danger: true })) { await db.remove('planned', it.id); load(); } } }, 'Remove'));
    });
    const today = localDateKey();
    const late = planned.filter((i) => i.dateKey < today && (i.kind === 'task' ? !i.done : secsFor(i.dateKey, (s) => s.activityId === i.activityId) < i.plannedMinutes * 60)).sort((a, b) => b.dateKey.localeCompare(a.dateKey)).slice(0, 10);
    const planned_total = items.filter((i) => i.kind === 'timed').reduce((n, i) => n + i.plannedMinutes, 0);
    const actual_total = items.filter((i) => i.kind === 'timed').reduce((n, i) => n + Math.min(secsFor(dateKey, (s) => s.activityId === i.activityId), i.plannedMinutes * 60), 0);
    return el('section', { class: 'card section' }, el('h2', {}, 'Daily planner'),
      el('div', { class: 'inline-form', style: 'margin-bottom:1rem' }, el('label', { class: 'field' }, 'Date', dateIn), kind, actSel, title, mins, el('button', { class: 'btn btn-primary', type: 'button', onclick: add }, 'Add')),
      items.length ? [el('p', { class: 'muted' }, `Planned focus ${formatMinutes(planned_total * 60)} · actual toward plan ${formatMinutes(actual_total)}`), rows] : el('p', { class: 'muted' }, 'Nothing planned for this day.'),
      late.length ? el('div', { style: 'margin-top:1.5rem' }, el('h3', { style: 'font-size:.95rem;margin-bottom:.5rem' }, 'Incomplete from earlier days'),
        late.map((i) => el('div', { class: 'plan-item' }, el('span', { class: 'grow' }, i.title, el('div', { class: 'muted' }, i.dateKey)),
          el('button', { class: 'btn', type: 'button', onclick: async () => { await db.put('planned', { ...i, dateKey: today, order: 999, done: false }); dateKey = today; load(); } }, 'Move to today')))) : '');
  }

  function draw() { root.replaceChildren(goalsSection(), plannerSection()); }
  load().catch((e) => err(`Could not load planner: ${e.message}`));
}
