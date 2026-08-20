// All screens for the stitched DCR flow. Sources: Figma extractions (NEW screens)
// + current-state video doc (AS-IS screens). See prototype-build-list.md for the map.
import { register, go, log, gate, inactivity, karaoke, makeDrawable, Audio, CFG } from './core.js';

/* ---------- Scripts (audio). Finalized for the test 2026-08-15: Justin approved
   "any reasonable words" over exact transcription of the live audio.
   Spoken texts must match tools/bake-audio.py EXACTLY (manifest keys are the
   raw strings); after editing any spoken text here, update the bake list and
   rerun python3 tools/bake-audio.py. ---------- */
const SCRIPTS = {
  pencil: "To get started, let's make sure your pencil works. Draw a line or mark in the box below.",
  welcome: "We're going to complete a few tasks to check your memory and thinking. Make sure you are in a quiet spot. Once we begin, try to stay focused on the tasks. Do your best on your own without asking for help. When the activity starts, we'll go from one task to the next without pausing. When you finish a task, tap Done.",
  irInstructions: "You will hear three words read aloud. After you hear all three words, you'll be asked to repeat them out loud. Try to remember them. You'll be asked about these three words again later.",
  recallWords: "Apple. Table. Penny.", // classic 3-word registration set (MMSE-style); approved-any-words 2026-08-15
  irRecording: "Please say the words out loud now.",
  clockCommand: "Please draw the face of a clock with all of the numbers, and set the time to ten minutes after eleven.", // standard clock-drawing command ("ten after eleven"); approved-any-words 2026-08-15
  clockCopy: "Please copy the figure in the space below.", // Team-confirmed 2026-08-14. Clinical constraint: must NOT name the figure ("clock"); keep this constraint if transcription differs.
  drRecording: "Please say the three words out loud you were asked to remember.",
};

/* ---------- Shared DOM builders ---------- */

// P1-style app bar (blue screen): name + close X
function appbarClose() {
  const bar = document.createElement('div');
  bar.className = 'appbar';
  bar.innerHTML = `<div class="bar-name">Sam Clarke</div><img class="bar-icon" src="assets/ic-close.svg" alt="">`;
  bar.querySelector('.bar-icon').addEventListener('click', () => log('appbar_icon_tap'));
  return bar;
}

// Patient app bar (extracted 4726:334 / 1024:236): patient + optional center slot + settings/burger
function appbarPatient(centerHTML = '') {
  const bar = document.createElement('div');
  bar.className = 'appbar2';
  bar.innerHTML = `
    <div class="zone"><span class="patient">Patient: Sam Clarke</span></div>
    <div class="zone center">${centerHTML}</div>
    <div class="zone right"><span class="settings">Session Settings</span><img class="burger" src="assets/ic-burger.svg" alt=""></div>
  `;
  bar.querySelector('.burger').addEventListener('click', () => log('appbar_icon_tap'));
  return bar;
}

const audioStatusHTML = `
  <div class="audio-status">
    <div class="audio-pill"><span class="dot"></span><span class="label">Playing instructions…</span></div>
    <div class="audio-progress"><div class="fill"></div></div>
  </div>
  <div class="replay-chip"><span class="glyph">&#8635;</span><span>Replay instructions</span></div>
`;

function toastHTML(text) {
  return `
  <div class="toast">
    <div class="sidebar"></div>
    <div class="content"><img src="assets/ic-info-solid.svg" alt=""><p>${text}</p></div>
  </div>`;
}

function pulseStack(kind) { // 'green' (mic) or 'blue' (listen)
  const rings = kind === 'green'
    ? `<img class="ring r2" src="assets/pulse-2.svg" style="inset:8%; width:84%; height:84%" alt="">
       <img class="ring r1" src="assets/pulse-1.svg" style="inset:13%; width:74%; height:74%" alt="">
       <img class="ring r0" src="assets/pulse-inner.svg" style="inset:20%; width:60%; height:60%" alt="">
       <img class="icon" src="assets/ic-mic.svg" alt="">`
    : `<img class="ring r2" src="assets/pulse-blue-2.svg" style="inset:20%; width:60%; height:60%" alt="">
       <img class="ring r1" src="assets/pulse-blue-1.svg" style="inset:20%; width:60%; height:60%" alt="">
       <img class="ring r0" src="assets/pulse-blue-inner.svg" style="inset:20%; width:60%; height:60%" alt="">
       <img class="icon" src="assets/ic-listen.svg" alt="">`;
  return `<div class="pulse-stack">${rings}</div>`;
}

// Sweeps the audio progress bar over a duration
function sweepProgress(screenEl, durationMs) {
  const fill = screenEl.querySelector('.audio-progress .fill');
  if (!fill) return;
  fill.style.transition = 'none'; fill.style.width = '0';
  requestAnimationFrame(() => {
    fill.style.transition = `width ${durationMs}ms linear`;
    fill.style.width = '213px';
  });
}

/* =================================================================
   P0 · Tap-to-begin gate (build-only)
   [MAZE SYNC] RESOLVED 2026-08-15: the computer-voice heads-up + sound-on
   instruction now live in the Maze welcome and scenario blocks, which both
   precede this screen ("Tap Begin on the first screen with your sound on").
   This gate stays minimal on purpose. If Maze copy changes, re-check here.
================================================================= */
register('p0', (el) => {
  el.classList.add('s-gate');
  el.innerHTML = `
    <div class="gate-inner">
      <h1>Ready to begin?</h1>
      <p>Make sure your sound is on and you can hear clearly.</p>
      <button class="btn btn-primary" id="begin">Begin</button>
    </div>`;
  el.querySelector('#begin').addEventListener('click', () => { Audio.unlock(); log('begin_tap'); go('p1'); });
  return {};
});

/* =================================================================
   P1 · Blue Instructions (AS-IS · 1000:3). Static, Start enabled.
================================================================= */
register('p1', (el) => {
  el.classList.add('s-blue-instructions');
  el.appendChild(appbarClose());
  el.insertAdjacentHTML('beforeend', `
    <img class="ic-steps" src="assets/ic-steps.svg" alt="">
    <h1>Instructions</h1>
    <div class="body">
      <p>For the next few tasks, you will be asked to do speech and drawing activities.</p>
      <p>Tap the Start button when you are ready to begin.</p>
    </div>
    <div class="action">
      <button class="btn btn-secondary" id="start">Start <img src="assets/ic-arrow-right.svg" alt=""></button>
    </div>`);
  el.querySelector('#start').addEventListener('click', () => { log('start_tap', { screen: 'p1' }); go('pencil'); });
  return {};
});

/* =================================================================
   P2 · Pencil check (NEW · 4726:333 / 4773:2600 / 4726:359)
   Drawing-gated Next; helper on disabled tap; Restart clears + relocks.
================================================================= */
register('pencil', (el) => {
  el.classList.add('s-flow', 's-pencil');
  el.appendChild(appbarPatient(audioStatusHTML));
  el.insertAdjacentHTML('beforeend', `
    <div class="card">
      <div class="prompt">
        <p class="karaoke" id="pencil-heading"></p>
        <p class="karaoke" id="pencil-line2"></p>
      </div>
      <div class="draw-area"><span class="placeholder">Draw in this space</span></div>
      <div class="action">
        <button class="btn btn-secondary" id="restart" style="width:220px"><img src="assets/ic-arrow-left.svg" alt=""> Restart</button>
        <div class="btn-caption">
          <span class="helper" id="pencil-helper">Make a mark above to continue</span>
          <button class="btn" id="next" style="width:220px">Next</button>
        </div>
      </div>
    </div>`);

  const kar = karaoke(el.querySelector('#pencil-heading'), "To get started, let's make sure your pencil works.");
  const kar2 = karaoke(el.querySelector('#pencil-line2'), 'Draw a line or mark in the box below.');
  function playPencil() {
    const statusWrap = el.querySelector('.zone.center');
    statusWrap.classList.remove('audio-done');
    el.querySelectorAll('.karaoke').forEach(k => k.classList.remove('settled'));
    kar.resetHighlight();
    kar2.resetHighlight();
    sweepProgress(el, Audio.durationMs("To get started, let's make sure your pencil works.")
      + Audio.durationMs('Draw a line or mark in the box below.'));
    // both lines karaoke in sequence (Justin 2026-08-15: line 2 highlights too)
    kar.play({
      onEnd: () => {
        kar2.play({
          onEnd: () => {
            el.querySelectorAll('.karaoke').forEach(k => k.classList.add('settled'));
            statusWrap.classList.add('audio-done');
            log('audio_end', { screen: 'pencil' });
          },
        });
      },
    });
  }
  el.querySelector('.replay-chip').addEventListener('click', () => { log('replay_tap', { screen: 'pencil' }); playPencil(); });
  const nextBtn = el.querySelector('#next');
  const g = gate(nextBtn, el.querySelector('#pencil-helper'), 'pencil');
  g.onUnlockedTap = () => { log('next_tap', { screen: 'pencil' }); go('welcome'); };

  const surface = makeDrawable(el.querySelector('.draw-area'), {
    onFirstInk: () => {
      log('first_ink', { screen: 'pencil' });
      g.unlock();
      nextBtn.classList.add('btn-primary');
      nextBtn.innerHTML = `Next <img src="assets/ic-arrow-right.svg" alt="">`;
    },
  });
  el.querySelector('#restart').addEventListener('click', () => {
    log('restart_tap', { screen: 'pencil' });
    surface.clear();
    g.lock();
    nextBtn.classList.remove('btn-primary');
    nextBtn.textContent = 'Next';
  });
  return { enter: playPencil };
});

/* =================================================================
   Instruction screens factory (Welcome + IR instructions)
   NEW · Welcome 1036:244/1153:1218/1130:1264 · IR 1037:612/1153:1283/1037:641
================================================================= */
function instructionScreen({ id, paragraphs, nextId }) {
  register(id, (el) => {
    el.classList.add('s-flow', 's-instructions');
    el.appendChild(appbarPatient());
    el.insertAdjacentHTML('beforeend', `
      <div class="audio-float">${audioStatusHTML}</div>
      <div class="card">
        <div class="paras">${paragraphs.map((_, i) => `<p class="karaoke" id="${id}-p${i}"></p>`).join('')}</div>
        <div class="bottom">
          <span class="helper" id="${id}-helper">You can start when the instructions are finished playing</span>
          <button class="btn" id="${id}-start" style="min-width:213px">Start <img src="assets/ic-arrow-right.svg" alt=""></button>
        </div>
      </div>`);

    // sequential karaoke across paragraphs
    const kars = paragraphs.map((text, i) => karaoke(el.querySelector(`#${id}-p${i}`), text));
    const startBtn = el.querySelector(`#${id}-start`);
    const g = gate(startBtn, el.querySelector(`#${id}-helper`), id);
    g.onUnlockedTap = () => { log('start_tap', { screen: id }); go(nextId); };

    function playAll() {
      const statusWrap = el.querySelector('.audio-float');
      statusWrap.classList.remove('audio-done');
      el.querySelectorAll('.karaoke').forEach(k => k.classList.remove('settled'));
      kars.forEach(k => k.resetHighlight());
      const fill = el.querySelector('.audio-progress .fill');
      const totalMs = paragraphs.reduce((sum, t) => sum + Audio.durationMs(t), 0);
      if (fill) {
        fill.style.transition = 'none'; fill.style.width = '0';
        requestAnimationFrame(() => {
          fill.style.transition = `width ${totalMs}ms linear`;
          fill.style.width = '213px';
        });
      }
      let i = 0;
      const playNext = () => {
        if (i >= kars.length) {
          el.querySelectorAll('.karaoke').forEach(k => k.classList.add('settled'));
          statusWrap.classList.add('audio-done');
          log('audio_end', { screen: id });
          g.unlock();
          startBtn.classList.add('btn-primary'); // enabled Start renders primary (was unstyled after unlock)
          return;
        }
        kars[i].play({ onEnd: () => { i += 1; playNext(); } });
      };
      playNext();
    }
    el.querySelector('.replay-chip').addEventListener('click', () => { log('replay_tap', { screen: id }); playAll(); });
    return { enter: playAll };
  });
}

instructionScreen({
  id: 'welcome',
  paragraphs: [
    "We're going to complete a few tasks to check your memory and thinking.",
    "Make sure you are in a quiet spot. Once we begin, try to stay focused on the tasks. Do your best on your own without asking for help.",
    "When the activity starts, we'll go from one task to the next without pausing.",
    "When you finish a task, tap Done.",
  ],
  nextId: 'ir-instructions',
});

instructionScreen({
  id: 'ir-instructions',
  paragraphs: [
    "You will hear three words read aloud. After you hear all three words, you'll be asked to repeat them out loud.",
    "Try to remember them. You'll be asked about these three words again later.",
  ],
  nextId: 'ir-listen',
});

/* =================================================================
   P9 · IR listen (AS-IS · 1000:35 + video B5). Words speak; auto-advance.
================================================================= */
register('ir-listen', (el) => {
  el.classList.add('s-flow', 's-listen');
  el.appendChild(appbarPatient());
  el.insertAdjacentHTML('beforeend', `
    <div class="card">
      ${pulseStack('blue')}
      <p class="caption">Please listen</p>
    </div>`);
  return {
    enter() {
      Audio.speak(SCRIPTS.recallWords, {
        onEnd: () => setTimeout(() => go('ir-recording'), 800),
      });
    },
  };
});

/* =================================================================
   Recording screens factory (IR P10-11 + DR P16)
   NEW · 1024:228 / 1153:1318 / 1027:227. Done starts DISABLED and unlocks
   2s after the audio finishes (Justin 2026-08-18; was tappable-from-load);
   disabled taps reveal the helper. The 15s toast timer arms at unlock.
================================================================= */
function recordingScreen({ id, heading, script, nextId }) {
  register(id, (el) => {
    el.classList.add('s-flow', 's-recording');
    el.appendChild(appbarPatient());
    el.insertAdjacentHTML('beforeend', `
      <div class="card">
        <div class="top-group">
          <h1>${heading}</h1>
          ${pulseStack('green')}
          <p class="subline">When you're finished, tap the Done button.</p>
        </div>
        <div class="bottom">
          ${toastHTML("If you're finished, tap the Done button below.")}
          <div class="btn-caption">
            <span class="helper" id="${id}-helper">Complete task to move forward.</span>
            <div class="nudge-wrap">
              <button class="btn btn-secondary" id="${id}-done" style="width:220px">Done</button>
              <div class="nudge-ring"></div>
            </div>
          </div>
        </div>
      </div>`);
    const doneBtn = el.querySelector(`#${id}-done`);
    const wrap = el.querySelector('.nudge-wrap');
    const timer = inactivity(CFG.toastMs, () => {
      el.querySelector('.toast').classList.add('shown');
      doneBtn.classList.remove('btn-secondary');
      doneBtn.classList.add('btn-primary');
      wrap.classList.add('pulsing');
      log('toast_shown', { screen: id, provoked: false });
    });
    const g = gate(doneBtn, el.querySelector(`#${id}-helper`), id);
    g.onUnlockedTap = () => { timer.cancel(); log('done_tap', { screen: id }); go(nextId); };
    // Audio speaks the heading, then the subline (Justin 2026-08-15: the
    // "When you're finished..." line must be heard, not just shown). Done
    // unlocks a beat after the audio ends; the toast countdown starts then.
    return {
      enter() {
        Audio.speak(script, {
          onEnd: () => Audio.speak("When you're finished, tap the Done button.", {
            onEnd: () => setTimeout(() => {
              g.unlock();
              log('audio_end', { screen: id });
              timer.start();
            }, CFG.doneDelayMs),
          }),
        });
      },
      exit() { timer.cancel(); },
    };
  });
}

recordingScreen({ id: 'ir-recording', heading: 'Please say the words out loud now', script: SCRIPTS.irRecording, nextId: 'clock-command' });
recordingScreen({ id: 'dr-recording', heading: 'Please say the three words out loud<br>you were asked to remember.', script: SCRIPTS.drRecording, nextId: 'saving' });

/* =================================================================
   Clock listen screens (AS-IS · video B7/B9): dim + Please Listen card,
   then choice modal (Repeat Instructions / Ready to Draw).
================================================================= */
/* Each clock phase is ONE screen: the listen modal overlays its own canvas and
   fades away in place (no slide) on Ready to Draw. Both canvases share the
   Done progression (disabled → ink: secondary → 15s idle after ink: toast +
   primary + pulse; timer resets while actively drawing). */
function clockScreen({ id, printed, script, nextId, helper }) {
  register(id, (el) => {
    el.classList.add('s-flow', 's-clock', printed ? 'designed' : 'as-is');
    el.appendChild(appbarPatient());
    el.insertAdjacentHTML('beforeend', `
      <div class="card">
        ${printed ? `<img class="printed-clock" src="assets/clock-printed.png?v=2" alt="">` : ''}
        <div class="clock-draw"></div>
        ${printed ? `
        <div class="toast-slot">${toastHTML("If you're finished, tap the Done button below.")}</div>
        <div class="bottom-right">
          <span class="helper" id="${id}-helper">${helper || ''}</span>
          <div class="nudge-wrap"><button class="btn" id="${id}-done" style="width:220px">Done</button><div class="nudge-ring"></div></div>
        </div>` : ''}
      </div>
      ${printed ? '' : `
      <div class="toast-out">${toastHTML("If you're finished, tap the Done button below.")}</div>
      <div class="action-out">
        <div class="nudge-wrap"><button class="btn" id="${id}-done" style="width:220px">Done <img src="assets/ic-arrow-right.svg" alt=""></button><div class="nudge-ring"></div></div>
      </div>`}
      <div class="dim-overlay">
        <div class="modal-card" id="${id}-modal"><p class="modal-title">Please Listen</p></div>
      </div>`);

    const overlay = el.querySelector('.dim-overlay');
    const modal = el.querySelector(`#${id}-modal`);
    const doneBtn = el.querySelector(`#${id}-done`);
    const wrap = doneBtn.closest('.nudge-wrap');
    const g = gate(doneBtn, helper ? el.querySelector(`#${id}-helper`) : null, id);
    const timer = inactivity(CFG.toastMs, () => {
      el.querySelector('.toast').classList.add('shown');
      doneBtn.classList.remove('btn-secondary');
      doneBtn.classList.add('btn-primary');
      wrap.classList.add('pulsing');
      log('toast_shown', { screen: id, provoked: false });
    });
    g.onUnlockedTap = () => { timer.cancel(); log('done_tap', { screen: id }); go(nextId); };
    makeDrawable(el.querySelector('.clock-draw'), {
      onFirstInk: () => {
        log('first_ink', { screen: id });
        g.unlock();
        doneBtn.classList.add('btn-secondary');
        timer.start();
      },
      onStroke: () => timer.reset(),
    });
    function showChoice() {
      modal.innerHTML = `
        <p class="modal-body">You can start drawing now or repeat the instructions.</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="${id}-repeat">Repeat Instructions</button>
          <button class="btn btn-primary" id="${id}-ready">Ready to Draw <img src="assets/ic-arrow-right.svg" alt=""></button>
        </div>`;
      modal.querySelector(`#${id}-repeat`).addEventListener('click', () => { log('repeat_tap', { screen: id }); playIt(); });
      modal.querySelector(`#${id}-ready`).addEventListener('click', () => {
        log('ready_tap', { screen: id });
        overlay.classList.add('hidden');
      });
    }
    function playIt() {
      overlay.classList.remove('hidden');
      modal.innerHTML = `<p class="modal-title">Please Listen</p>`;
      Audio.speak(script, { onEnd: showChoice });
    }
    return { enter: playIt, exit() { timer.cancel(); } };
  });
}

clockScreen({ id: 'clock-command', printed: false, script: SCRIPTS.clockCommand, nextId: 'clock-copy' });
clockScreen({ id: 'clock-copy', printed: true, script: SCRIPTS.clockCopy, nextId: 'dr-recording', helper: 'Complete task to move forward.' });

/* =================================================================
   P17 · Results saving (AS-IS · video B12)
================================================================= */
register('saving', (el) => {
  el.classList.add('s-flow');
  el.appendChild(appbarPatient());
  el.insertAdjacentHTML('beforeend', `
    <div class="dim-overlay">
      <div class="modal-card s-saving-card">
        <p class="modal-title">Results saving...</p>
        <img src="assets/logo-mark.svg" alt="" style="width:72px;height:72px">
        <p class="modal-body">You are done and do not have to do anything further. We are saving your results. Please stay on this screen.</p>
      </div>
    </div>`);
  return { enter() { setTimeout(() => go('alldone'), 4000); } };
});

/* =================================================================
   P18 · You're all done (AS-IS · video B13; expiry countdown dropped)
================================================================= */
register('alldone', (el) => {
  el.classList.add('s-flow', 's-alldone');
  el.insertAdjacentHTML('beforeend', `
    <div class="card">
      <div class="middle">
        <img src="assets/alldone-check.png" alt="" style="width:159px;height:115px;mix-blend-mode:multiply">
        <h1>You're all done!</h1>
        <p class="sub">You have completed all of the tasks.</p>
      </div>
      <button class="btn btn-secondary" id="alldone-done" style="width:220px">Done</button>
    </div>`);
  el.querySelector('#alldone-done').addEventListener('click', () => { log('done_tap', { screen: 'alldone' }); go('end'); });
  return {};
});

/* ---------- End card (Maze exit) ----------
   [MAZE SYNC] RESOLVED 2026-08-15 against the built Maze study: the mission
   tells participants to close this window, return to the study tab, and press
   End task; this copy tells them to close the window and return to the survey.
   If the Maze mission wording changes, re-sync here. */
register('end', (el) => {
  el.classList.add('s-gate');
  el.innerHTML = `
    <div class="gate-inner">
      <h1>This is the end of the test.</h1>
      <p>Thank you for participating. You can now close this window and return to the survey to answer a few questions.</p>
    </div>`;
  return {};
});
