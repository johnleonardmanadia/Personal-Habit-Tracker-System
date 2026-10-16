import { state } from '../state.js';
import { aggregateByDay, resolveRange, drawHeatmap } from './contributions.js';
import { el, localDateKey, startOfWeek, addDays, formatMinutes, computeStreaks, isValidSession, iconEl } from '../utils.js';

const svgNS = 'http://www.w3.org/2000/svg';

function weekChart(valid, weekStart) {
  const start = startOfWeek(new Date(), weekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const mins = days.map((d) => valid.filter((s) => s.dateKey === localDateKey(d)).reduce((n, s) => n + s.actualSeconds, 0) / 60);
  const max = Math.max(60, ...mins);
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 350 180'); svg.setAttribute('class', 'week-chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Focus minutes this week: ' + days.map((d, i) => `${d.toLocaleDateString(undefined, { weekday: 'long' })} ${Math.round(mins[i])}`).join(', '));
  days.forEach((d, i) => {
    const h = (mins[i] / max) * 130, x = 10 + i * 48;
    const mk = (tag, attrs, text) => { const n = document.createElementNS(svgNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (text != null) n.textContent = text; svg.append(n); };
    mk('rect', { x, y: 140 - h, width: 36, height: Math.max(h, 2), rx: 4, fill: mins[i] ? 'var(--accent)' : 'var(--surface-2)' });
    mk('text', { x: x + 18, y: 158, 'text-anchor': 'middle' }, d.toLocaleDateString(undefined, { weekday: 'short' }));
    mk('text', { x: x + 18, y: 134 - h, 'text-anchor': 'middle' }, mins[i] ? `${Math.round(mins[i])}m` : '');
  });
  return svg;
}

export function renderDashboard(main) {
  const today = localDateKey();
  const valid = state.sessions.filter(isValidSession);
  const todays = valid.filter((s) => s.dateKey === today);
  const todaySecs = todays.reduce((n, s) => n + s.actualSeconds, 0);
  const goal = state.prefs.dailyGoalMinutes;
  const pct = goal > 0 ? Math.min(100, Math.round((todaySecs / 60 / goal) * 100)) : 0;
  const streaks = computeStreaks(valid.map((s) => s.dateKey));
  const doneActs = new Set(todays.map((s) => s.activityId || s.activityName)).size;
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const stat = (v, l) => el('div', { class: 'card' }, el('div', { class: 'stat-value' }, v), el('div', { class: 'stat-label' }, l));

  const targets = state.activities.filter((a) => a.status === 'active' && a.dailyTargetMinutes > 0).map((a) => {
    const secs = todays.filter((s) => s.activityId === a.id).reduce((n, s) => n + s.actualSeconds, 0);
    return el('div', { class: 'list-row' }, el('span', {}, iconEl(a.icon), ' ', a.name),
      el('span', { class: 'muted' }, `${formatMinutes(secs)} / ${formatMinutes(a.dailyTargetMinutes * 60)}`));
  });
  const recent = [...valid].sort((a, b) => b.endedAt.localeCompare(a.endedAt)).slice(0, 5).map((s) =>
    el('div', { class: 'list-row' }, el('span', {}, s.activityName || 'Session'),
      el('span', { class: 'muted' }, `${formatMinutes(s.actualSeconds)} · ${s.dateKey}`)));

  const heat = el('div');
  { const { start, end } = resolveRange('rolling'); drawHeatmap(heat, { agg: aggregateByDay(state.sessions), start, end, mode: 'minutes', weekStart: state.prefs.weekStart }); }
  main.append(
    el('div', { class: 'dash-head' },
      el('div', {}, el('h1', { class: 'page-title', style: 'margin-bottom:.25rem' }, `${hello}!`),
        el('p', { class: 'muted' }, new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))),
      el('a', { class: 'btn btn-primary', href: '#/timer' }, iconEl('play'), 'Quick start timer')),
    el('div', { class: 'grid' },
      stat(formatMinutes(todaySecs), 'Focus time today'), stat(String(todays.length), 'Sessions today'),
      stat(String(doneActs), 'Activities done today'), stat(`${streaks.current} days`, 'Current streak'),
      stat(`${streaks.longest} days`, 'Longest streak')),
    el('div', { class: 'card dash-section' }, el('h2', {}, `Daily goal: ${formatMinutes(todaySecs)} of ${formatMinutes(goal * 60)}`),
      el('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Daily goal progress' },
        el('div', { style: `width:${pct}%` }))),
    el('div', { class: 'card dash-section' }, el('h2', {}, 'This week'), weekChart(valid, state.prefs.weekStart)),
    el('div', { class: 'card dash-section' }, el('h2', {}, 'Contributions (last 12 months)'), heat, el('a', { href: '#/contributions', class: 'muted' }, 'Open full calendar ', iconEl('arrow-right'))),
    el('div', { class: 'card dash-section' }, el('h2', {}, "Today's activity targets"),
      targets.length ? targets : el('p', { class: 'muted' }, 'Set a daily target on an activity to track it here.')),
    el('div', { class: 'card dash-section' }, el('h2', {}, 'Recent sessions'),
      recent.length ? recent : el('p', { class: 'muted' }, 'No sessions yet. Finish a timer session to see it here.')),
  );
}
