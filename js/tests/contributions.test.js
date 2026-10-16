import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateByDay, levelFor, buildGrid, rangeSummary, resolveRange } from '../modules/contributions.js';
import { localDateKey, computeStreaks, addDays } from '../utils.js';

const S = (dateKey, sec, status = 'completed', name = 'A') => ({ dateKey, actualSeconds: sec, status, activityName: name, category: 'C' });
const inRangeDays = (y) => buildGrid(new Date(y, 0, 1), new Date(y, 11, 31), 1).flat().filter((d) => d.inRange).length;

test('cancelled sessions never count; multiple sessions add up', () => {
  const agg = aggregateByDay([S('2026-10-10', 1800), S('2026-10-10', 600, 'finished_early'), S('2026-10-09', 900, 'cancelled')]);
  assert.equal(agg.get('2026-10-10').count, 2);
  assert.equal(agg.get('2026-10-10').seconds, 2400);
  assert.equal(agg.has('2026-10-09'), false);
});
test('intensity levels', () => {
  assert.equal(levelFor(undefined, 'minutes'), 0);
  assert.equal(levelFor({ count: 1, seconds: 30 }, 'minutes'), 1);
  assert.equal(levelFor({ count: 1, seconds: 15 * 60 }, 'minutes'), 2);
  assert.equal(levelFor({ count: 1, seconds: 60 * 60 }, 'minutes'), 4);
  assert.equal(levelFor({ count: 4, seconds: 10 }, 'count'), 4);
});
test('leap years have 366 days, others 365', () => {
  assert.equal(inRangeDays(2024), 366);
  assert.equal(inRangeDays(2025), 365);
  assert.equal(inRangeDays(2100), 365);
});
test('grid starts on the chosen week start and covers the year boundaries', () => {
  const weeks = buildGrid(new Date(2026, 0, 1), new Date(2026, 11, 31), 1);
  assert.equal(weeks[0][0].date.getDay(), 1);
  assert.ok(weeks.every((w) => w.length === 7));
  const flat = weeks.flat().filter((d) => d.inRange);
  assert.equal(localDateKey(flat[0].date), '2026-01-01');
  assert.equal(localDateKey(flat.at(-1).date), '2026-12-31');
});
test('date keys use local time (no UTC off-by-one)', () => {
  assert.equal(localDateKey(new Date(2026, 0, 1, 0, 5)), '2026-01-01');
  assert.equal(localDateKey(new Date(2026, 11, 31, 23, 55)), '2026-12-31');
  assert.equal(localDateKey(addDays(new Date(2024, 1, 28), 1)), '2024-02-29');
  assert.equal(localDateKey(addDays(new Date(2025, 1, 28), 1)), '2025-03-01');
});
test('streaks across month, year and leap-day boundaries', () => {
  assert.equal(computeStreaks(['2024-02-28', '2024-02-29', '2024-03-01'], new Date(2024, 2, 1)).current, 3);
  assert.equal(computeStreaks(['2025-12-30', '2025-12-31', '2026-01-01'], new Date(2026, 0, 1)).longest, 3);
});
test('today without a session keeps the streak; a missed day breaks it', () => {
  assert.equal(computeStreaks(['2026-10-09', '2026-10-10'], new Date(2026, 9, 11)).current, 2);
  assert.equal(computeStreaks(['2026-10-08', '2026-10-09'], new Date(2026, 9, 11)).current, 0);
  assert.equal(computeStreaks([], new Date()).longest, 0);
});
test('range summary counts only days inside the range', () => {
  const agg = aggregateByDay([S('2025-12-31', 600), S('2026-01-01', 1200), S('2026-01-01', 600)]);
  const { start, end } = resolveRange('year', 2026);
  const sum = rangeSummary(agg, start, end, new Date(2026, 0, 2));
  assert.equal(sum.contributions, 2);
  assert.equal(sum.activeDays, 1);
  assert.equal(sum.seconds, 1800);
  assert.equal(sum.current, 2);
});
