// Core: screen registry, slide navigation, event logging, shared interaction helpers.
import { Audio, CFG } from './audio.js';

/* ---------- Event log (study instrumentation) ---------- */
const T0 = Date.now();
export const EVLOG = [];
export function log(type, data = {}) {
  const entry = { t: Math.round((Date.now() - T0) / 100) / 10, type, ...data };
  EVLOG.push(entry);
  console.log('[ev]', entry);
}
window.EVLOG = EVLOG; // moderator can dump via console; download hook added later

/* ---------- Screen registry + navigation ---------- */
const screens = new Map();
let activeId = null;
let activeApi = null;

export function register(id, factory) { screens.set(id, factory); }

export function go(id) {
  const stage = document.getElementById('stage');
  const factory = screens.get(id);
  if (!factory) { console.error('no screen', id); return; }

  Audio.stop(true); // leaving a screen always fades any running audio
  if (activeApi && activeApi.exit) activeApi.exit();

  const prev = stage.querySelector('.screen.active');
  const el = document.createElement('div');
  el.className = 'screen enter-right';
  const api = factory(el) || {};
  stage.appendChild(el);

  // force layout so the transition runs
  void el.offsetWidth;
  el.classList.remove('enter-right');
  el.classList.add('active');
  if (prev) {
    prev.classList.remove('active');
    prev.classList.add('exit-left');
    setTimeout(() => prev.remove(), 460);
  }

  log('screen', { id });
  activeId = id; activeApi = api;
  if (api.enter) api.enter();
}

/* ---------- Gated primary button + persistent helper caption ----------
   Justin's logic: primary starts disabled; tapping it reveals the helper,
   which persists until unlock. Uses aria-disabled so taps register + log. */
export function gate(btn, helperEl, screenId) {
  btn.setAttribute('aria-disabled', 'true');
  let unlocked = false;
  const api = {
    onUnlockedTap: null,
    unlock() {
      if (unlocked) return;
      unlocked = true;
      btn.removeAttribute('aria-disabled');
      log('unlock', { screen: screenId, btn: btn.textContent.trim() });
    },
    lock() {
      unlocked = false;
      btn.setAttribute('aria-disabled', 'true');
    },
    unlockedNow: () => unlocked,
  };
  btn.addEventListener('click', () => {
    if (!unlocked) {
      log('disabled_tap', { screen: screenId, btn: btn.textContent.trim() });
      if (helperEl && !helperEl.classList.contains('shown')) {
        helperEl.classList.add('shown');
        log('helper_shown', { screen: screenId });
      }
      return;
    }
    if (api.onUnlockedTap) api.onUnlockedTap();
  });
  return api;
}

/* ---------- Inactivity timer (toast + pulse trigger) ----------
   fire() after ms of no reset(). start() arms it; reset() re-arms while active. */
export function inactivity(ms, onFire) {
  let handle = null; let fired = false;
  const arm = () => { clearTimeout(handle); handle = setTimeout(() => { fired = true; onFire(); }, ms); };
  return {
    start: arm,
    reset() { if (!fired && handle !== null) arm(); },
    cancel() { clearTimeout(handle); handle = null; },
    fired: () => fired,
  };
}

/* ---------- Karaoke text ----------
   Splits text into word spans; play() highlights spoken words via Audio events.
   Current-state convention: blue once spoken (memory: karaoke = blue-once-spoken). */
export function karaoke(container, text) {
  container.innerHTML = '';
  const words = text.split(/\s+/).filter(Boolean);
  const spans = words.map(w => {
    const s = document.createElement('span');
    s.textContent = w + ' ';
    container.appendChild(s);
    return s;
  });
  return {
    play({ onEnd } = {}) {
      return Audio.speak(text, {
        onWord: i => { if (spans[i]) spans[i].classList.add('spoken'); },
        onEnd: () => {
          spans.forEach(s => s.classList.add('spoken'));
          if (onEnd) onEnd();
        },
      });
    },
    finishInstantly() { spans.forEach(s => s.classList.add('spoken')); },
    resetHighlight() { spans.forEach(s => s.classList.remove('spoken')); },
  };
}

/* ---------- Drawing surface (pencil check + clock canvases) ----------
   Pointer events: finger, Apple Pencil, and mouse all draw. touch-action:none
   is set in CSS so strokes aren't stolen by scroll/zoom. */
export function makeDrawable(container, { onFirstInk, onStroke, color = '#171820', width = 3 } = {}) {
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const dpr = window.devicePixelRatio || 1;
  let inked = false, drawing = false;

  function size() {
    const r = container.getBoundingClientRect();
    const scale = r.width / container.offsetWidth || 1; // stage is CSS-scaled; draw in logical px
    canvas.width = container.offsetWidth * dpr;
    canvas.height = container.offsetHeight * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color;
    return ctx;
  }
  let ctx = null;
  requestAnimationFrame(() => { ctx = size(); });

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / (r.width / container.offsetWidth), y: (e.clientY - r.top) / (r.height / container.offsetHeight) };
  }
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers may lack capture */ }
    drawing = true;
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.1, p.y + 0.1); ctx.stroke();
    if (!inked) { inked = true; if (onFirstInk) onFirstInk(); }
    if (onStroke) onStroke();
  });
  canvas.addEventListener('pointermove', e => {
    if (!drawing) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
    if (onStroke) onStroke();
  });
  const end = () => { drawing = false; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  return {
    clear() { const c = canvas.getContext('2d'); c.save(); c.setTransform(1,0,0,1,0,0); c.clearRect(0, 0, canvas.width, canvas.height); c.restore(); inked = false; },
    hasInk: () => inked,
  };
}

/* ---------- Stage scaling ---------- */
export function fitStage() {
  const stage = document.getElementById('stage');
  const w = window.innerWidth, h = window.innerHeight;
  const scale = Math.min(w / 834, h / 1194);
  stage.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', fitStage);

export { Audio, CFG };
