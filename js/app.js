import { openDB, db } from './database.js';
import { setState, applyTheme } from './state.js';
import { register, startRouter } from './router.js';
import { el } from './utils.js';
import { initNavigation } from './components/navigation.js';
import { renderActivities } from './modules/activities.js';
import { renderDashboard } from './modules/dashboard.js';
import { renderTimer, initTimerService } from './modules/timer.js';
import { renderHistory } from './modules/sessions.js';
import { renderContributions } from './modules/contributions.js';
import { renderStatistics } from './modules/statistics.js';
import { renderPlanner } from './modules/goals.js';
import { renderSettings } from './modules/settings.js';

const PAGES = {
  dashboard: ['Dashboard', 2], activities: ['Activities', 2], timer: ['Focus timer', 3],
  history: ['Session history', 3], contributions: ['Contributions', 4], statistics: ['Statistics', 4],
  planner: ['Planner & goals', 5], settings: ['Settings', 5],
};

// Temporary placeholders; each later batch replaces its route by calling register() from its own module.
const placeholder = (name) => (main) => {
  const [title, batch] = PAGES[name];
  main.append(el('h1', { class: 'page-title' }, title),
    el('div', { class: 'card empty-state' }, `This page is implemented in Batch ${batch}.`));
};

async function init() {
  applyTheme();
  initNavigation();
  Object.keys(PAGES).forEach((n) => register(n, placeholder(n)));
  register('dashboard', renderDashboard);
  register('activities', renderActivities);
  register('timer', renderTimer);
  register('history', renderHistory);
  register('contributions', renderContributions);
  register('statistics', renderStatistics);
  register('planner', renderPlanner);
  register('settings', renderSettings);
  try {
    await openDB();
    const [activities, sessions] = await Promise.all([db.getAll('activities'), db.getAll('sessions')]);
    setState({ activities, sessions, ready: true, error: null });
    await initTimerService();
  } catch (err) {
    console.error(err);
    setState({ error: err.message });
    register('dashboard', (main) => {
      main.append(el('div', { class: 'card error-state' },
        `Database unavailable: ${err.message} Try reloading, and make sure the browser allows site storage (not private mode).`));
    });
  }
  await startRouter();
}
init();

// Offline support (optional). Skipped on file:// and where service workers are unsupported.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch((e) => console.warn('Service worker not registered:', e.message)));
}
