import { state } from '../state.js';
import { el, localDateKey, addDays, startOfWeek, computeStreaks, formatMinutes, isValidSession } from '../utils.js';

const sum = (arr) => arr.reduce((n, s) => n + s.actualSeconds, 0);
function group(valid, field) {
  const m = new Map();
  for (const s of valid) { const g = m.get(s[field]) || { seconds: 0, count: 0 }; g.seconds += s.actualSeconds; g.count++; m.set(s[field], g); }
  return [...m].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.seconds - a.seconds);
}

export function summarize(valid, now = new Date(), weekStart = 1) {
  const today = localDateKey(now), wk = localDateKey(startOfWeek(now, weekStart)), month = today.slice(0, 7);
  const completed = valid.filter((s) => s.status === 'completed').length;
  return {
    today: sum(valid.filter((s) => s.dateKey === today)), week: sum(valid.filter((s) => s.dateKey >= wk && s.dateKey <= today)),
    month: sum(valid.filter((s) => s.dateKey.startsWith(month))), lifetime: sum(valid), sessions: valid.length,
    average: valid.length ? sum(valid) / valid.length : 0,
    // Completion rate: sessions that ran their full planned time / all saved sessions (cancelled ones are never saved).
    completionRate: valid.length ? Math.round((completed / valid.length) * 100) : 0,
  };
}
export const topActivities = (valid, n = 5) => group(valid, 'activityName').slice(0, n);
export const byCategory = (valid) => group(valid, 'category');
export function weeklyTrend(valid, now = new Date(), weekStart = 1, n = 8) {
  const first = startOfWeek(now, weekStart);
  return Array.from({ length: n }, (_, i) => {
    const s = addDays(first, -7 * (n - 1 - i)), a = localDateKey(s), b = localDateKey(addDays(s, 6));
    return { label: s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), seconds: sum(valid.filter((x) => x.dateKey >= a && x.dateKey <= b)) };
  });
}
export function monthlyTrend(valid, now = new Date(), n = 6) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1), p = localDateKey(d).slice(0, 7);
    return { label: d.toLocaleDateString(undefined, { month: 'short' }), seconds: sum(valid.filter((x) => x.dateKey.startsWith(p))) };
  });
}
export const dailyBreakdown = (valid, dateKey) => group(valid.filter((s) => s.dateKey === dateKey), 'activityName');
export function activityStreaks(valid, now = new Date()) {
  const by = new Map();
  for (const s of valid) (by.get(s.activityName) || by.set(s.activityName, []).get(s.activityName)).push(s.dateKey);
  return [...by].map(([name, keys]) => ({ name, ...computeStreaks(keys, now) })).sort((a, b) => b.longest - a.longest);
}

function trendChart(items, title) {
  const NS = 'http://www.w3.org/2000/svg', max = Math.max(1, ...items.map((i) => i.seconds)), w = 44;
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', `0 0 ${items.length * w + 10} 170`); s.setAttribute('class', 'trend-chart'); s.setAttribute('role', 'img');
  s.setAttribute('aria-label', `${title}: ` + items.map((i) => `${i.label} ${formatMinutes(i.seconds)}`).join(', '));
  items.forEach((it, i) => {
    const h = (it.seconds / max) * 110, x = 8 + i * w;
    const add = (tag, a, t) => { const n = document.createElementNS(NS, tag); for (const k in a) n.setAttribute(k, a[k]); if (t != null) n.textContent = t; s.append(n); };
    add('rect', { x, y: 130 - h, width: w - 10, height: Math.max(h, 2), rx: 3, fill: it.seconds ? 'var(--accent)' : 'var(--surface-2)' });
    add('text', { x: x + (w - 10) / 2, y: 124 - h, 'text-anchor': 'middle' }, it.seconds ? formatMinutes(it.seconds) : '');
    add('text', { x: x + (w - 10) / 2, y: 148, 'text-anchor': 'middle' }, it.label);
  });
  return s;
}
function bars(rows, empty) {
  if (!rows.length) return el('p', { class: 'muted' }, empty);
  const max = Math.max(...rows.map((r) => r.seconds));
  return el('div', {}, rows.map((r) => el('div', { class: 'bar-row' }, el('span', {}, r.name),
    el('div', { class: 'bar-track', 'aria-hidden': 'true' }, el('div', { style: `width:${(r.seconds / max) * 100}%` })), el('span', { class: 'muted' }, `${formatMinutes(r.seconds)} · ${r.count}`))));
}

export function renderStatistics(main) {
  const valid = state.sessions.filter(isValidSession), now = new Date(), s = summarize(valid, now, state.prefs.weekStart);
  const card = (title, ...kids) => el('div', { class: 'card dash-section' }, el('h2', {}, title), ...kids);
  const stat = (v, l) => el('div', { class: 'card' }, el('div', { class: 'stat-value' }, v), el('div', { class: 'stat-label' }, l));
  const dayInput = el('input', { type: 'date', value: localDateKey(now), max: localDateKey(now), 'aria-label': 'Choose a day' });
  const dayOut = el('div');
  const drawDay = () => { dayOut.replaceChildren(bars(dailyBreakdown(valid, dayInput.value), 'No sessions on this day.')); };
  dayInput.addEventListener('input', drawDay); drawDay();
  const streaks = activityStreaks(valid, now);
  main.append(el('h1', { class: 'page-title' }, 'Statistics'),
    el('div', { class: 'stat-grid' }, stat(formatMinutes(s.today), 'Today'), stat(formatMinutes(s.week), 'This week'), stat(formatMinutes(s.month), 'This month'),
      stat(formatMinutes(s.lifetime), 'Lifetime focus'), stat(String(s.sessions), 'Sessions'), stat(formatMinutes(s.average), 'Average session'), stat(`${s.completionRate}%`, 'Completion rate')),
    el('p', { class: 'rules', style: 'margin-top:.5rem' }, 'Completion rate = sessions that ran their full planned time ÷ all saved sessions. Cancelled sessions are never saved or counted.'),
    card('Weekly trend (8 weeks)', trendChart(weeklyTrend(valid, now, state.prefs.weekStart), 'Weekly focus')),
    card('Monthly trend (6 months)', trendChart(monthlyTrend(valid, now), 'Monthly focus')),
    card('Most-used activities', bars(topActivities(valid), 'No sessions yet.')),
    card('Focus time by category', bars(byCategory(valid), 'No sessions yet.')),
    card('Daily activity breakdown', dayInput, dayOut),
    card('Activity streaks', streaks.length ? el('div', {}, streaks.map((a) => el('div', { class: 'list-row' }, el('span', {}, a.name), el('span', { class: 'muted' }, `current ${a.current} · longest ${a.longest} days`)))) : el('p', { class: 'muted' }, 'No sessions yet.')),
    el('p', { class: 'rules', style: 'margin-top:1rem' }, 'A streak is consecutive local calendar days with at least one valid session. Today without a session does not break the current streak until the day ends.'));
}
