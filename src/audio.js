// Âm thanh tổng hợp bằng Web Audio: không cần file asset.
let ctx = null;
let master = null;
let musicGain = null;
let muted = false;
let musicTimer = null;
let nextNoteTime = 0;
let step = 0;

try { muted = localStorage.getItem('office-tycoon-muted') === '1'; } catch { /* bỏ qua */ }

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.6;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.18;
  musicGain.connect(master);
  return ctx;
}

function tone(freq, start, dur, { type = 'sine', vol = 0.3, dest = master, slide = 0 } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(dest);
  o.start(start);
  o.stop(start + dur + 0.02);
}

const SFX = {
  click: (t) => tone(880, t, 0.05, { type: 'triangle', vol: 0.15 }),
  command: (t) => { tone(660, t, 0.06, { type: 'triangle', vol: 0.18 }); tone(990, t + 0.05, 0.07, { type: 'triangle', vol: 0.15 }); },
  place: (t) => { tone(220, t, 0.12, { type: 'square', vol: 0.12, slide: -60 }); tone(440, t + 0.03, 0.08, { type: 'triangle', vol: 0.12 }); },
  remove: (t) => tone(330, t, 0.15, { type: 'sawtooth', vol: 0.08, slide: -200 }),
  coffee: (t) => { tone(523, t, 0.1, { vol: 0.2 }); tone(784, t + 0.08, 0.15, { vol: 0.2 }); },
  hire: (t) => [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.07, 0.12, { type: 'triangle', vol: 0.2 })),
  accept: (t) => { tone(587, t, 0.08, { type: 'triangle', vol: 0.2 }); tone(880, t + 0.07, 0.12, { type: 'triangle', vol: 0.2 }); },
  complete: (t) => [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.2, { type: 'triangle', vol: 0.22 })),
  alert: (t) => { tone(440, t, 0.12, { type: 'square', vol: 0.12 }); tone(330, t + 0.13, 0.18, { type: 'square', vol: 0.12 }); },
  dayend: (t) => [784, 659, 523].forEach((f, i) => tone(f, t + i * 0.12, 0.25, { vol: 0.2 })),
  gameover: (t) => [392, 349, 311, 262].forEach((f, i) => tone(f, t + i * 0.2, 0.35, { type: 'triangle', vol: 0.2 })),
};

export function play(name) {
  if (!ensure() || muted) return;
  if (ctx.state === 'suspended') ctx.resume();
  SFX[name]?.(ctx.currentTime + 0.01);
}

// Nhạc nền: vòng hợp âm nhẹ nhàng, lặp vô hạn
const CHORDS = [[261.6, 329.6, 392.0], [220.0, 261.6, 329.6], [174.6, 220.0, 261.6], [196.0, 246.9, 293.7]];
const BEAT = 0.42;

function scheduler() {
  while (nextNoteTime < ctx.currentTime + 0.3) {
    const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
    const i = step % 8;
    const note = chord[[0, 1, 2, 1, 0, 2, 1, 2][i]] * 2;
    tone(note, nextNoteTime, BEAT * 0.9, { type: 'triangle', vol: 0.25, dest: musicGain });
    if (i === 0) tone(chord[0] / 2, nextNoteTime, BEAT * 7.5, { type: 'sine', vol: 0.3, dest: musicGain });
    nextNoteTime += BEAT;
    step++;
  }
}

export function startMusic() {
  if (!ensure()) return;
  if (ctx.state === 'suspended') ctx.resume();
  if (musicTimer) return;
  nextNoteTime = ctx.currentTime + 0.1;
  musicTimer = setInterval(scheduler, 100);
}

export function isMuted() { return muted; }

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('office-tycoon-muted', muted ? '1' : '0'); } catch { /* bỏ qua */ }
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.6, ctx.currentTime, 0.05);
  return muted;
}
