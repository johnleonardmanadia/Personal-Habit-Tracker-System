import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, weeklyTrend, monthlyTrend, topActivities, byCategory, dailyBreakdown, activityStreaks } from '../modules/statistics.js';

const S = (dateKey, sec, status = 'completed', name = 'A', category = 'C') => ({ dateKey, actualSeconds: sec, status, activityName: name, category });
const NOW = new Date(2026, 9, 11); // Sunday 11 Oct 2026
const data = [S('2026-10-11', 3600), S('2026-10-10', 1800, 'finished_early', 'B', 'D'), S('2026-10-04', 600), S('2026-09-30', 1200, 'completed', 'B', 'D')];

test('summary windows (Monday week start)', () => {
  const s = summarize(data, NOW, 1);
  assert.equal(s.today, 3600);
  assert.equal(s.week, 5400);
  assert.equal(s.month, 6000);
  assert.equal(s.lifetime, 7200);
  assert.equal(s.sessions, 4);
  assert.equal(s.average, 1800);
  assert.equal(s.completionRate, 75);
});
test('week start preference changes the week window', () => {
  assert.equal(summarize(data, NOW, 0).week, 3600); // Sunday-start week begins today
});
test('empty data gives zeros, not NaN', () => {
  const s = summarize([], NOW, 1);
  assert.deepEqual([s.lifetime, s.average, s.completionRate], [0, 0, 0]);
});
test('weekly and monthly trends', () => {
  const w = weeklyTrend(data, NOW, 1, 2);
  assert.deepEqual(w.map((x) => x.seconds), [1800, 5400]);
  const m = monthlyTrend(data, NOW, 2);
  assert.deepEqual(m.map((x) => x.seconds), [1200, 6000]);
});
test('monthly trend crosses a year boundary', () => {
  const m = monthlyTrend([S('2025-12-31', 60), S('2026-01-01', 120)], new Date(2026, 0, 15), 2);
  assert.deepEqual(m.map((x) => x.seconds), [60, 120]);
});
test('groupings', () => {
  assert.equal(topActivities(data)[0].name, 'A');
  assert.equal(byCategory(data).find((c) => c.name === 'D').seconds, 3000);
  assert.equal(dailyBreakdown(data, '2026-10-10')[0].name, 'B');
});
test('per-activity streaks', () => {
  const st = activityStreaks([S('2026-10-09', 60), S('2026-10-10', 60), S('2026-10-11', 60), S('2026-10-01', 60, 'completed', 'Z')], NOW);
  assert.deepEqual(st.find((x) => x.name === 'A'), { name: 'A', current: 3, longest: 3 });
  assert.equal(st.find((x) => x.name === 'Z').current, 0);
});
