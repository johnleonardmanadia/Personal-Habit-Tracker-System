import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimer, remainingMs, elapsedSeconds, pauseTimer, resumeTimer, needsRecovery, applyRecovery } from '../modules/timer.js';

const T0 = 1_000_000;
const make = (sec = 600) => createTimer({ activityName: 'Study', category: 'Academic', plannedSeconds: sec }, T0);

test('remaining time comes from the deadline, not a counter', () => {
  const t = make();
  assert.equal(remainingMs(t, T0), 600_000);
  assert.equal(remainingMs(t, T0 + 100_000), 500_000);
  assert.equal(remainingMs(t, T0 + 10_000_000), 0);
});
test('elapsed is clamped between 0 and planned', () => {
  const t = make();
  assert.equal(elapsedSeconds(t, T0 - 5000), 0);
  assert.equal(elapsedSeconds(t, T0 + 100_000), 100);
  assert.equal(elapsedSeconds(t, T0 + 9_999_999), 600);
});
test('paused time does not count', () => {
  let t = pauseTimer(make(), T0 + 100_000);
  assert.equal(t.status, 'paused');
  assert.equal(elapsedSeconds(t, T0 + 900_000), 100);
  t = resumeTimer(t, T0 + 900_000);
  assert.equal(elapsedSeconds(t, T0 + 950_000), 150);
});
test('pause and resume are idempotent', () => {
  const t = make();
  assert.equal(resumeTimer(t, T0), t);
  const p = pauseTimer(t, T0 + 1000);
  assert.equal(pauseTimer(p, T0 + 2000), p);
});
test('recovery is needed only after a long gap while running', () => {
  const t = make();
  assert.equal(needsRecovery(t, T0 + 30_000), false);
  assert.equal(needsRecovery(t, T0 + 120_000), true);
  assert.equal(needsRecovery(pauseTimer(t, T0 + 1000), T0 + 9_000_000), false);
});
test('recovery "skip" pauses at the last seen moment; "count" keeps running', () => {
  const t = { ...make(), lastSeen: T0 + 100_000 };
  const skip = applyRecovery(t, 'skip', T0 + 900_000);
  assert.equal(skip.status, 'paused');
  assert.equal(skip.remainingMs, 500_000);
  assert.equal(elapsedSeconds(skip, T0 + 5_000_000), 100);
  const count = applyRecovery(t, 'count', T0 + 900_000);
  assert.equal(count.status, 'running');
  assert.equal(count.deadline, t.deadline);
  assert.equal(elapsedSeconds(count, T0 + 900_000), 600);
});
