import './screens.js';
import { go, fitStage, log, Audio } from './core.js';

fitStage();
log('boot', { ua: navigator.userAgent.slice(0, 60) });

// ?screen=p2 jumps straight to a screen for dev/review; default starts at the gate.
// Dev jumps go through a one-tap scrim first: speaking with no prior user gesture
// is blocked by autoplay policy and can wedge Chrome's speech engine until the
// browser restarts (observed 2026-08-15). Participants always tap at P0 anyway.
const jump = new URLSearchParams(location.search).get('screen');
if (jump && jump !== 'p0') {
  const scrim = document.createElement('div');
  scrim.className = 'dev-scrim';
  scrim.innerHTML = `<div class="dev-scrim-card">Tap anywhere to open “${jump}” with sound</div>`;
  Object.assign(scrim.style, {
    position: 'fixed', inset: '0', zIndex: '999', display: 'flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    background: 'rgba(22, 22, 22, 0.72)', color: '#fff',
    font: '500 17px/1.4 "IBM Plex Sans", sans-serif', textAlign: 'center',
  });
  scrim.addEventListener('pointerdown', () => {
    scrim.remove();
    Audio.unlock();
    go(jump);
  }, { once: true });
  document.body.appendChild(scrim);
} else {
  go(jump || 'p0');
}
