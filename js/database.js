// IndexedDB wrapper, schema version 1.
//  activities  key id   indexes: category, status
//  sessions    key id   indexes: dateKey, activityId, category, startedAt
//  planned     key id   indexes: dateKey
//  goals       key id
//  meta        key key  (activeTimer, etc.)
export const DB_NAME = 'focus-tracker';
export const DB_VERSION = 1;

let dbPromise = null;

const migrations = {
  1(db) {
    const a = db.createObjectStore('activities', { keyPath: 'id' });
    a.createIndex('category', 'category');
    a.createIndex('status', 'status');
    const s = db.createObjectStore('sessions', { keyPath: 'id' });
    ['dateKey', 'activityId', 'category', 'startedAt'].forEach((i) => s.createIndex(i, i));
    db.createObjectStore('planned', { keyPath: 'id' }).createIndex('dateKey', 'dateKey');
    db.createObjectStore('goals', { keyPath: 'id' });
    db.createObjectStore('meta', { keyPath: 'key' });
  },
};

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB is not supported in this browser.'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      for (let v = e.oldVersion + 1; v <= DB_VERSION; v++) migrations[v](req.result);
    };
    req.onsuccess = () => {
      const conn = req.result;
      conn.onversionchange = () => { conn.close(); dbPromise = null; };
      resolve(conn);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
    req.onblocked = () => { dbPromise = null; reject(new Error('Database is blocked by another open tab. Close other tabs and reload.')); };
  });
  return dbPromise;
}

async function run(store, mode, fn) {
  const conn = await openDB();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = (e) => reject((e.target && e.target.error) || tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

const REQUIRED = {
  activities: ['id', 'name', 'category'],
  sessions: ['id', 'startedAt', 'endedAt', 'actualSeconds', 'dateKey', 'status'],
  planned: ['id', 'dateKey'],
  goals: ['id'],
  meta: ['key'],
};

export function validate(store, record) {
  if (!record || typeof record !== 'object') throw new Error(`Invalid ${store} record.`);
  for (const f of REQUIRED[store]) {
    if (record[f] === undefined || record[f] === null || record[f] === '') throw new Error(`${store}: missing field "${f}".`);
  }
  if (store === 'sessions' && !(Number.isFinite(record.actualSeconds) && record.actualSeconds >= 0)) {
    throw new Error('sessions: actualSeconds must be a non-negative number.');
  }
  return record;
}

export const db = {
  getAll: (store) => run(store, 'readonly', (s) => s.getAll()),
  get: (store, key) => run(store, 'readonly', (s) => s.get(key)),
  put: (store, record) => run(store, 'readwrite', (s) => s.put(validate(store, record))),
  /** add() fails if the id exists, which prevents duplicate session records. */
  add: (store, record) => run(store, 'readwrite', (s) => s.add(validate(store, record))),
  remove: (store, key) => run(store, 'readwrite', (s) => s.delete(key)),
  clear: (store) => run(store, 'readwrite', (s) => s.clear()),
  count: (store) => run(store, 'readonly', (s) => s.count()),
  getByIndex: (store, index, value) => run(store, 'readonly', (s) => s.index(index).getAll(value)),
};
