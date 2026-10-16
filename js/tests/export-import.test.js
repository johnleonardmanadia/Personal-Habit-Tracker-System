import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBackup, sessionsToCsv } from '../modules/export-import.js';

const session = { id: 's1', startedAt: '2026-10-01T10:00:00Z', endedAt: '2026-10-01T10:30:00Z', actualSeconds: 1800, dateKey: '2026-10-01', status: 'completed', activityName: 'X', category: 'C', notes: '' };
const good = () => ({ app: 'focus-tracker', schemaVersion: 1, data: { activities: [{ id: 'a', name: 'X', category: 'C', color: '#112233' }], sessions: [{ ...session }], planned: [], goals: [] } });

test('accepts a valid backup', () => assert.deepEqual(validateBackup(good()), []));
test('rejects non-backups', () => {
  assert.ok(validateBackup([]).length);
  assert.ok(validateBackup({ app: 'other' }).length);
});
test('rejects malformed records with useful messages', () => {
  const b = good(); b.data.sessions[0].dateKey = '10/01/2026'; b.data.activities[0].color = 'red;x'; delete b.data.goals;
  const e = validateBackup(b).join(' | ');
  assert.match(e, /dateKey/); assert.match(e, /color/); assert.match(e, /goals/);
});
test('rejects newer schema versions', () => { const b = good(); b.schemaVersion = 99; assert.match(validateBackup(b)[0], /newer/); });
test('CSV escapes quotes and blocks formula injection', () => {
  const csv = sessionsToCsv([{ ...session, activityName: '=SUM(A1)', notes: 'say "hi", ok' }]);
  assert.match(csv, /'=SUM\(A1\)/);
  assert.match(csv, /"say ""hi"", ok"/);
});
