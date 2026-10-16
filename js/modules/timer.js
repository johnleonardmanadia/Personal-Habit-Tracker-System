import { db } from '../database.js';
import { state } from '../state.js';
import { el, uid, formatDuration, formatMinutes, iconEl } from '../utils.js';
import { confirmDialog } from '../components/confirmation.js';
import { notify } from '../components/notifications.js';
import { buildRecord, saveSession } from './sessions.js';


// ---------- Pure timer logic (deadline based; never decrements a counter) ----------
export const AWAY_THRESHOLD_MS = 60000;

export function createTimer({ activityId = null, activityName, category, plannedSeconds, notes = '', breakMinutes = 0 }, now = Date.now()) {
  return { id: uid(), activityId, activityName, category, plannedSeconds, breakMinutes, notes,
    startedAt: new Date(now).toISOString(), status: 'running', deadline: now + plannedSeconds * 1000,
    remainingMs: plannedSeconds * 1000, lastSeen: now };
}
export const remainingMs = (t, now = Date.now()) => (t.status === 'running' ? Math.max(0, t.deadline - now) : t.remainingMs);
export const elapsedSeconds = (t, now = Date.now()) =>
  Math.min(t.plannedSeconds, Math.max(0, Math.round((t.plannedSeconds * 1000 - remainingMs(t, now)) / 1000)));
export const pauseTimer = (t, now = Date.now()) => (t.status === 'running' ? { ...t, status: 'paused', remainingMs: Math.max(0, t.deadline - now), lastSeen: now } : t);
export const resumeTimer = (t, now = Date.now()) => (t.status === 'paused' ? { ...t, status: 'running', deadline: now + t.remainingMs, lastSeen: now } : t);
export const needsRecovery = (t, now = Date.now()) => t.status === 'running' && now - t.lastSeen > AWAY_THRESHOLD_MS;
/** 'count' keeps the time away as focus; 'skip' pauses at the last moment the app was seen. */
export const applyRecovery = (t, choice, now = Date.now()) =>
  choice === 'count' ? { ...t, lastSeen: now } : { ...t, status: 'paused', remainingMs: Math.max(0, t.deadline - t.lastSeen), lastSeen: now };

// ---------- Service (runs on every page) ----------
let active = null, recovery = false, breakUntil = null, finishing = false, interval = null, lastPersist = 0;
const listeners = new Set();
export const getTimer = () => active;
export const inRecovery = () => recovery;
export const getBreak = () => breakUntil;
export const subscribeTimer = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (type) => listeners.forEach((fn) => fn(type));
const persist = async () => { lastPersist = Date.now(); await db.put('meta', { key: 'activeTimer', value: active }); };
const clearPersisted = () => db.remove('meta', 'activeTimer');

function beep() {
  if (!state.prefs.sound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((d) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.2, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.25); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.3); });
  } catch { /* audio unavailable */ }
}

async function finish(status) {
  if (!active || finishing) return;
  finishing = true;
  const t = active, actual = status === 'completed' ? t.plannedSeconds : elapsedSeconds(t);
  try {
    if (actual < 1) { notify('Nothing to save yet — less than 1 second of focus.', 'error'); return; }
    await saveSession(buildRecord(t, status, actual));
    active = null; recovery = false; await clearPersisted();
    notify(status === 'completed' ? `Session complete: ${formatMinutes(actual)} of ${t.activityName}.` : `Session saved: ${formatMinutes(actual)}.`);
    if (status === 'completed') {
      beep();
      if (state.prefs.notifications && 'Notification' in window && Notification.permission === 'granted') new Notification('Focus session complete', { body: t.activityName });
      if (t.breakMinutes > 0) breakUntil = Date.now() + t.breakMinutes * 60000;
    }
  } catch (e) { notify(`Could not save session: ${e.message}`, 'error'); }
  finally { finishing = false; emit('change'); }
}

function tick() {
  const now = Date.now();
  if (breakUntil && now >= breakUntil) { breakUntil = null; notify('Break over. Ready for the next session?'); emit('change'); }
  if (active && active.status === 'running' && !recovery) {
    if (needsRecovery(active, now)) { recovery = true; emit('change'); return; }
    if (remainingMs(active, now) <= 0) return void finish('completed');
    active.lastSeen = now;
    if (now - lastPersist > 5000) persist().catch(() => {});
  }
  document.title = active && !recovery ? `${formatDuration(Math.ceil(remainingMs(active, now) / 1000))} · Focus Tracker` : 'Focus Tracker';
  emit('tick');
}

export async function initTimerService() {
  const rec = await db.get('meta', 'activeTimer');
  if (rec && rec.value) { active = rec.value; recovery = needsRecovery(active); }
  clearInterval(interval);
  interval = setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  tick();
}

export async function startTimer(opts) {
  if (active) throw new Error('A timer is already active.');
  active = createTimer(opts); breakUntil = null; await persist(); emit('change');
}
export async function pause() { active = pauseTimer(active); await persist(); emit('change'); }
export async function resume() { active = resumeTimer(active); await persist(); emit('change'); }
export const finishEarly = () => finish('finished_early');
export async function cancelTimer() { active = null; recovery = false; await clearPersisted(); emit('change'); }
export async function resetTimer() { const n = Date.now(); active = { ...active, startedAt: new Date(n).toISOString(), status: 'paused', remainingMs: active.plannedSeconds * 1000, lastSeen: n }; await persist(); emit('change'); }
export async function setNotes(v) { if (active) { active.notes = v; await persist(); } }
export async function setActivity(id) {
  const a = state.activities.find((x) => x.id === id);
  active = { ...active, activityId: a?.id || null, activityName: a?.name || 'General focus', category: a?.category || 'Other' }; await persist(); emit('change');
}
export async function resolveRecovery(choice) {
  if (choice === 'discard') return cancelTimer();
  active = applyRecovery(active, choice); recovery = false; await persist(); emit('change'); tick();
}
export const skipBreak = () => { breakUntil = null; emit('change'); };

// ---------- Page ----------
const clock = (ms) => formatDuration(Math.ceil(ms / 1000));
const PRESETS = [5, 15, 25, 30, 45, 60];

export function renderTimer(main) {
  const root = el('div');
  main.append(el('h1', { class: 'page-title' }, 'Focus timer'), root);
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  let clockEl, elapsedEl, barEl;
  const note = el('p', { class: 'notice' }, 'Browsers can’t guarantee an alarm or background running (for example when the device sleeps or the tab is frozen). Your time is calculated from a saved deadline, so it stays accurate when you come back.');

  function update() {
    const t = getTimer();
    if (!t || !clockEl || recovery) return;
    clockEl.textContent = clock(remainingMs(t));
    elapsedEl.textContent = `Elapsed ${formatDuration(elapsedSeconds(t))} of ${formatDuration(t.plannedSeconds)}`;
    const pct = Math.round((elapsedSeconds(t) / t.plannedSeconds) * 100);
    barEl.firstChild.style.width = `${pct}%`; barEl.setAttribute('aria-valuenow', pct);
  }

  function recoveryView() {
    const t = active, away = Math.round((Date.now() - t.lastSeen) / 60000);
    const btn = (label, cls, fn) => el('button', { class: `btn ${cls}`, type: 'button', onclick: fn }, label);
    return el('div', { class: 'card timer-card warn-card' }, el('h2', {}, 'Welcome back'),
      el('p', { class: 'muted' }, `The app wasn’t running for about ${away} min during “${t.activityName}”. Nothing was saved automatically. How should that time be treated?`),
      el('div', { class: 'timer-controls', style: 'flex-direction:column' },
        btn('Count the time away as focus', 'btn-primary', () => resolveRecovery('count')),
        btn(`Don’t count it (pause at ${formatDuration(Math.max(0, Math.round((t.deadline - t.lastSeen) / 1000)))} left)`, '', () => resolveRecovery('skip')),
        btn('Discard this session', 'btn-danger', () => resolveRecovery('discard'))));
  }

  function activeView() {
    const t = active, acts = state.activities.filter((a) => a.status === 'active');
    clockEl = el('div', { class: `timer-clock${t.status === 'paused' ? ' paused' : ''}`, role: 'timer', 'aria-live': 'off' });
    elapsedEl = el('div', { class: 'muted' });
    barEl = el('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Session progress' }, el('div'));
    const sel = el('select', { 'aria-label': 'Activity' }, el('option', { value: '' }, 'General focus'),
      acts.map((a) => el('option', { value: a.id, selected: a.id === t.activityId }, a.name)));
    sel.addEventListener('change', () => setActivity(sel.value));
    const notes = el('textarea', { rows: 2, maxlength: 500, placeholder: 'Session notes (optional)' }, t.notes);
    notes.addEventListener('input', () => setNotes(notes.value));
    const b = (label, cls, fn) => el('button', { class: `btn ${cls}`, type: 'button', onclick: fn }, label);
    const card = el('div', { class: 'card timer-card' },
      el('div', { class: 'timer-activity' }, t.activityName), el('div', { class: 'muted' }, t.status === 'paused' ? 'Paused' : 'Focusing'),
      clockEl, elapsedEl, barEl,
      el('div', { class: 'timer-controls' },
        t.status === 'running' ? b('Pause', '', pause) : b('Resume', 'btn-primary', resume),
        b('Finish early', '', finishEarly),
        b('Reset', '', async () => { if (await confirmDialog({ title: 'Reset timer?', message: 'The countdown restarts from the full duration and the time so far is discarded.', confirmText: 'Reset' })) resetTimer(); }),
        b('Cancel', 'btn-danger', async () => { if (await confirmDialog({ title: 'Cancel session?', danger: true, confirmText: 'Cancel session', message: 'This session will not be saved or counted.' })) cancelTimer(); })),
      el('label', { class: 'field', style: 'margin-top:1rem' }, 'Activity', sel), el('label', { class: 'field' }, 'Notes', notes), note);
    return card;
  }

  function breakView() {
    const c = el('div', { class: 'timer-clock' }); const upd = () => { c.textContent = clock((getBreak() || Date.now()) - Date.now()); }; upd(); c.dataset.break = '1';
    return el('div', { class: 'card timer-card' }, el('div', { class: 'timer-activity' }, 'Break time'), c,
      el('div', { class: 'timer-controls' }, el('button', { class: 'btn', type: 'button', onclick: skipBreak }, 'Skip break')));
  }

  function setupView() {
    const acts = state.activities.filter((a) => a.status === 'active');
    const sel = el('select', { id: 't-act' }, el('option', { value: '' }, 'General focus (no activity)'), acts.map((a) => el('option', { value: a.id }, a.name)));
    const want = params.get('activity'); if (want && acts.some((a) => a.id === want)) sel.value = want;
    const num = (max, v) => el('input', { type: 'number', min: 0, max, value: v, inputmode: 'numeric' });
    const h = num(23, 0), m = num(59, 0), s = num(59, 0);
    const setMin = (min) => { h.value = Math.floor(min / 60); m.value = min % 60; s.value = 0; };
    const cur = () => acts.find((a) => a.id === sel.value);
    setMin(want && cur() ? cur().defaultMinutes : state.prefs.defaultMinutes);
    sel.addEventListener('change', () => { if (cur()) setMin(cur().defaultMinutes); });
    const brk = el('input', { type: 'number', min: 0, max: 60, value: 0 });
    const notes = el('textarea', { rows: 2, maxlength: 500, placeholder: 'Optional' });
    const err = el('p', { class: 'error-state', role: 'alert', style: 'padding:0 0 .5rem' });
    const f = (l, i) => el('label', { class: 'field' }, l, i);
    const start = el('button', { class: 'btn btn-primary', type: 'button', style: 'width:100%' }, iconEl('play'), 'Start focus session');
    start.addEventListener('click', async () => {
      const total = Number(h.value) * 3600 + Number(m.value) * 60 + Number(s.value);
      if (!Number.isFinite(total) || total < 1 || total > 86400) return void (err.textContent = 'Choose a duration between 1 second and 24 hours.');
      const a = cur(), bm = Math.max(0, Math.min(60, Number(brk.value) || 0));
      try { await startTimer({ activityId: a?.id || null, activityName: a?.name || 'General focus', category: a?.category || 'Other', plannedSeconds: total, notes: notes.value.trim(), breakMinutes: bm }); }
      catch (e) { err.textContent = e.message; }
    });
    return el('div', { class: 'card timer-card' }, f('Activity', sel),
      el('div', { class: 'presets' }, PRESETS.map((p) => el('button', { class: 'btn', type: 'button', onclick: () => setMin(p) }, `${p}m`))),
      el('div', { class: 'hms' }, f('Hours', h), f('Minutes', m), f('Seconds', s)),
      f('Break after session (minutes, 0 = none)', brk), f('Notes', notes), err, start, note);
  }

  function draw() {
    clockEl = elapsedEl = barEl = null;
    let view;
    if (active && recovery) view = recoveryView();
    else if (active) view = activeView();
    else if (breakUntil) view = breakView();
    else view = setupView();
    root.replaceChildren(view); update();
  }
  const off = subscribeTimer((type) => {
    if (type === 'change') draw();
    else { update(); const b = root.querySelector('[data-break]'); if (b && breakUntil) b.textContent = clock(breakUntil - Date.now()); }
  });
  draw();
  return { cleanup: off };
}
