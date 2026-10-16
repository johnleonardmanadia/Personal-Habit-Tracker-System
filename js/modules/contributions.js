import { state } from '../state.js';
import { el, localDateKey, addDays, startOfWeek, parseDateKey, computeStreaks, formatMinutes, isValidSession, iconEl } from '../utils.js';

const NS = 'http://www.w3.org/2000/svg';
const CELL = 12, GAP = 3, LEFT = 30, TOP = 18;

/** dateKey -> { count, seconds, byActivity: Map(name -> {count, seconds}) }. Only valid sessions. */
export function aggregateByDay(sessions) {
  const map = new Map();
  for (const s of sessions) {
    if (!isValidSession(s)) continue;
    const d = map.get(s.dateKey) || { count: 0, seconds: 0, byActivity: new Map() };
    d.count += 1; d.seconds += s.actualSeconds;
    const a = d.byActivity.get(s.activityName) || { count: 0, seconds: 0 };
    a.count += 1; a.seconds += s.actualSeconds; d.byActivity.set(s.activityName, a);
    map.set(s.dateKey, d);
  }
  return map;
}

/** Level 0-4. Minutes mode: 1-14, 15-29, 30-59, 60+ min. Count mode: 1, 2, 3, 4+ sessions. Any activity gives at least level 1. */
export function levelFor(day, mode) {
  if (!day || (day.count === 0 && day.seconds === 0)) return 0;
  const value = mode === 'count' ? day.count : day.seconds / 60;
  const steps = mode === 'count' ? [2, 3, 4] : [15, 30, 60];
  return 1 + steps.filter((t) => value >= t).length;
}

export function resolveRange(range, year, today = new Date()) {
  if (range === 'rolling') return { start: addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate()), -364), end: new Date(today.getFullYear(), today.getMonth(), today.getDate()) };
  return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
}

/** Columns of weeks; each day { date, inRange }. Uses local dates, so leap years and DST are safe. */
export function buildGrid(start, end, weekStart = 1) {
  const weeks = [];
  let d = startOfWeek(start, weekStart);
  while (d <= end) {
    const week = [];
    for (let i = 0; i < 7; i++) { week.push({ date: d, inRange: d >= start && d <= end }); d = addDays(d, 1); }
    weeks.push(week);
  }
  return weeks;
}

export function rangeSummary(agg, start, end, today = new Date()) {
  const a = localDateKey(start), b = localDateKey(end);
  let contributions = 0, seconds = 0, activeDays = 0; const keys = [];
  for (const [k, v] of agg) if (k >= a && k <= b) { contributions += v.count; seconds += v.seconds; activeDays++; keys.push(k); }
  return { contributions, seconds, activeDays, longest: computeStreaks(keys, today).longest, current: computeStreaks([...agg.keys()], today).current };
}

const svg = (tag, attrs, text) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (text != null) n.textContent = text; return n; };
const fmtDay = (k) => parseDateKey(k).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

function dayLabel(k, day) {
  if (!day) return `${k}: no activity`;
  return `${k}: ${formatMinutes(day.seconds)}, ${day.count} session${day.count === 1 ? '' : 's'}`;
}

/** Draws heatmap + legend + detail panel into container. */
export function drawHeatmap(container, { agg, start, end, mode, weekStart, today = new Date() }) {
  const weeks = buildGrid(start, end, weekStart), todayKey = localDateKey(today);
  const width = LEFT + weeks.length * (CELL + GAP), height = TOP + 7 * (CELL + GAP);
  const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'group', 'aria-label': 'Contribution calendar' });
  const detail = el('div', { class: 'hm-detail', 'aria-live': 'polite' });
  let selected = null;
  const show = (key, rect) => {
    selected?.classList.remove('selected'); selected = rect; rect?.classList.add('selected');
    const day = agg.get(key);
    detail.replaceChildren(el('strong', {}, fmtDay(key)), el('div', {}, day ? `${formatMinutes(day.seconds)} focused · ${day.count} session${day.count === 1 ? '' : 's'}` : 'No sessions recorded.'),
      day ? el('ul', {}, [...day.byActivity].map(([n, v]) => el('li', {}, `${n}: ${formatMinutes(v.seconds)} (${v.count})`))) : '');
  };
  const dayNames = Array.from({ length: 7 }, (_, i) => addDays(weeks[0][0].date, i).toLocaleDateString(undefined, { weekday: 'short' }));
  [1, 3, 5].forEach((i) => root.append(svg('text', { x: 0, y: TOP + i * (CELL + GAP) + 10 }, dayNames[i])));
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const x = LEFT + wi * (CELL + GAP);
    const first = week.find((d) => d.inRange);
    if (first && first.date.getMonth() !== lastMonth && (wi === 0 ? week.filter((d) => d.inRange).length >= 4 || true : true)) {
      if (wi === 0 || first.date.getDate() <= 7 || lastMonth === -1) { lastMonth = first.date.getMonth(); root.append(svg('text', { x, y: 11 }, first.date.toLocaleDateString(undefined, { month: 'short' }))); }
    }
    week.forEach((d, di) => {
      if (!d.inRange) return;
      const key = localDateKey(d.date), future = key > todayKey, day = agg.get(key);
      const rect = svg('rect', { x, y: TOP + di * (CELL + GAP), width: CELL, height: CELL, class: future ? 'cell future' : `cell l${levelFor(day, mode)}`, 'aria-label': future ? `${key}: upcoming` : dayLabel(key, day), role: 'img' });
      rect.append(svg('title', {}, future ? key : dayLabel(key, day)));
      if (!future) { rect.addEventListener('click', () => show(key, rect)); rect.addEventListener('mouseenter', () => show(key, rect)); }
      root.append(rect);
    });
  });
  const scroll = el('div', { class: 'heatmap-scroll' }, root);
  const steps = mode === 'count' ? ['0', '1', '2', '3', '4+ sessions'] : ['0', '1–14', '15–29', '30–59', '60+ min'];
  const legend = el('div', { class: 'legend' }, 'Less', [0, 1, 2, 3, 4].map((l) => el('i', { class: `l${l}`, title: steps[l] })), 'More', el('span', {}, `(${steps.join(' · ')})`));
  container.replaceChildren(scroll, legend, detail);
  const initial = todayKey >= localDateKey(start) && todayKey <= localDateKey(end) ? todayKey : null;
  if (initial) show(initial, null); else detail.textContent = 'Hover or tap a day for details.';
  requestAnimationFrame(() => { scroll.scrollLeft = scroll.scrollWidth; });
}

export function renderContributions(main) {
  const thisYear = new Date().getFullYear();
  const valid = state.sessions.filter(isValidSession);
  const years = valid.map((s) => Number(s.dateKey.slice(0, 4)));
  const minYear = Math.min(thisYear, ...years);
  let year = thisYear;
  const range = el('select', { 'aria-label': 'Date range' }, el('option', { value: 'year' }, 'Calendar year'), el('option', { value: 'rolling' }, 'Last 12 months'));
  const mode = el('select', { 'aria-label': 'Heatmap view' }, el('option', { value: 'minutes' }, 'Focus minutes'), el('option', { value: 'count' }, 'Session count'));
  const prev = el('button', { class: 'btn', type: 'button', 'aria-label': 'Previous year' }, iconEl('chevron-left'));
  const next = el('button', { class: 'btn', type: 'button', 'aria-label': 'Next year' }, iconEl('chevron-right'));
  const label = el('strong', { style: 'min-width:4rem;text-align:center' });
  const nav = el('div', { style: 'display:flex;align-items:center;gap:.5rem' }, prev, label, next);
  const stats = el('div', { class: 'stat-grid' }), host = el('div', { class: 'card' }), table = el('div');
  const stat = (v, l) => el('div', { class: 'card' }, el('div', { class: 'stat-value' }, v), el('div', { class: 'stat-label' }, l));

  function draw() {
    const agg = aggregateByDay(state.sessions), { start, end } = resolveRange(range.value, year);
    const sum = rangeSummary(agg, start, end);
    label.textContent = range.value === 'year' ? String(year) : '12 mo';
    nav.style.visibility = range.value === 'year' ? 'visible' : 'hidden';
    prev.disabled = year <= minYear; next.disabled = year >= thisYear;
    stats.replaceChildren(stat(String(sum.contributions), 'Contributions (saved sessions)'), stat(String(sum.activeDays), 'Active days'), stat(formatMinutes(sum.seconds), 'Focus time'),
      stat(`${sum.current} days`, 'Current streak'), stat(`${sum.longest} days`, 'Longest streak in range'));
    drawHeatmap(host, { agg, start, end, mode: mode.value, weekStart: state.prefs.weekStart });
    const rows = []; const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    for (let d = cur; d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const p = localDateKey(d).slice(0, 7); let c = 0, s = 0;
      for (const [k, v] of agg) if (k.startsWith(p) && k >= localDateKey(start) && k <= localDateKey(end)) { c += v.count; s += v.seconds; }
      rows.push(el('tr', {}, el('td', {}, d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })), el('td', {}, String(c)), el('td', {}, formatMinutes(s))));
    }
    table.replaceChildren(el('details', { class: 'card', style: 'margin-top:1rem' }, el('summary', {}, 'Monthly totals (text version)'),
      el('table', { class: 'hm-table' }, el('thead', {}, el('tr', {}, el('th', {}, 'Month'), el('th', {}, 'Sessions'), el('th', {}, 'Focus'))), el('tbody', {}, rows))));
  }
  prev.addEventListener('click', () => { year--; draw(); }); next.addEventListener('click', () => { year++; draw(); });
  [range, mode].forEach((c) => c.addEventListener('input', draw));
  main.append(el('h1', { class: 'page-title' }, 'Contributions'),
    el('div', { class: 'toolbar' }, range, nav, mode), stats, el('div', { style: 'height:1rem' }), host, table,
    el('p', { class: 'rules', style: 'margin-top:1rem' }, 'Each saved completed or finished-early session counts as one contribution; cancelled sessions are never saved. A streak is consecutive local calendar days with at least one session. If you haven’t recorded anything yet today, your current streak stays alive until the day ends.'));
  draw();
}
