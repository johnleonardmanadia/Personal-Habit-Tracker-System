import { db } from './database.js';
// Small observable store + preferences in LocalStorage.
const PREF_KEY = 'focus-tracker:prefs';
export const DEFAULT_PREFS = {
  theme: 'dark', defaultMinutes: 25, sound: false, weekStart: 1,
  dailyGoalMinutes: 120, timeFormat: '24h', notifications: false,
};

function loadPrefs() {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; }
  catch { return { ...DEFAULT_PREFS }; }
}

const listeners = new Set();
export const state = { prefs: loadPrefs(), activities: [], sessions: [], ready: false, error: null };

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit() { listeners.forEach((fn) => fn(state)); }
export function setState(patch) { Object.assign(state, patch); emit(); }

export function applyTheme() {
  document.documentElement.dataset.theme = state.prefs.theme === 'light' ? 'light' : 'dark';
}
export function setPrefs(patch) {
  state.prefs = { ...state.prefs, ...patch };
  try { localStorage.setItem(PREF_KEY, JSON.stringify(state.prefs)); } catch { /* storage unavailable */ }
  applyTheme();
  emit();
}

/** Reload activities and sessions from IndexedDB into state. */
export async function reload() {
  const [activities, sessions] = await Promise.all([db.getAll('activities'), db.getAll('sessions')]);
  setState({ activities, sessions });
}
