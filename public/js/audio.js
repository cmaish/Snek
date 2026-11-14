// All sounds are synthesised with WebAudio — no audio files to download.
let ac = null, master, sfxBus, musicBus;
let soundOn = true, musicOn = true;
let musicTimer = null, nextNote = 0, step = 0, noiseBuf = null;

export function initAudio() {
  if (ac) {
    if (ac.state === 'suspended') ac.resume();
    return;
  }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
  } catch { return; }
  master = ac.createGain();
  master.gain.value = 0.7;
  master.connect(ac.destination);
  sfxBus = ac.createGain();
  sfxBus.gain.value = soundOn ? 1 : 0;
  sfxBus.connect(master);
  musicBus = ac.createGain();
  musicBus.gain.value = musicOn ? 0.16 : 0;
  musicBus.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startMusic();
}

export function setSound(on) {
  soundOn = on;
  if (sfxBus) sfxBus.gain.value = on ? 1 : 0;
}

export function setMusic(on) {
  musicOn = on;
  if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.16 : 0, ac.currentTime, 0.1);
}

export function suspend(yes) {
  if (!ac) return;
  if (yes) ac.suspend(); else ac.resume();
}

function tone({ f, f2, dur = 0.1, type = 'sine', vol = 0.2, when = 0, attack = 0.005, bus = sfxBus }) {
  if (!ac || !soundOn && bus === sfxBus) return;
  const t = ac.currentTime + when;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise({ dur = 0.1, vol = 0.2, freq = 1500, when = 0, bus = sfxBus }) {
  if (!ac || !soundOn && bus === sfxBus) return;
  const t = ac.currentTime + when;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(bus);
  s.start(t);
  s.stop(t + dur + 0.05);
}

let lastPop = 0;
export const sfx = {
  pop() {
    if (!ac) return;
    const now = performance.now();
    if (now - lastPop < 45) return;
    lastPop = now;
    const b = 520 + Math.random() * 380;
    tone({ f: b, f2: b * 1.8, dur: 0.07, vol: 0.12 });
  },
  chomp() {
    noise({ dur: 0.12, vol: 0.35, freq: 900 });
    tone({ f: 260, f2: 90, dur: 0.14, type: 'square', vol: 0.08 });
  },
  gulp() {
    tone({ f: 320, f2: 70, dur: 0.28, type: 'triangle', vol: 0.3 });
    tone({ f: 660, f2: 1320, dur: 0.12, vol: 0.12, when: 0.18 });
  },
  ouch() {
    tone({ f: 500, f2: 160, dur: 0.25, type: 'sawtooth', vol: 0.12 });
  },
  power() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: 0.12, type: 'square', vol: 0.07, when: i * 0.06 }));
  },
  die() {
    tone({ f: 440, f2: 55, dur: 0.7, type: 'sawtooth', vol: 0.16 });
    noise({ dur: 0.4, vol: 0.25, freq: 600, when: 0.05 });
  },
  coin() {
    tone({ f: 988, dur: 0.07, type: 'square', vol: 0.06 });
    tone({ f: 1319, dur: 0.16, type: 'square', vol: 0.06, when: 0.07 });
  },
  click() {
    tone({ f: 700, f2: 900, dur: 0.05, vol: 0.12 });
  },
  win() {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone({ f, dur: 0.16, type: 'triangle', vol: 0.18, when: i * 0.1 }));
  },
  beep() {
    tone({ f: 660, dur: 0.14, type: 'square', vol: 0.09 });
  },
  go() {
    tone({ f: 880, dur: 0.1, type: 'square', vol: 0.09 });
    tone({ f: 1320, dur: 0.3, type: 'square', vol: 0.09, when: 0.08 });
  },
  levelup() {
    [523, 784, 1047, 1568].forEach((f, i) => tone({ f, dur: 0.18, type: 'triangle', vol: 0.2, when: i * 0.07 }));
  },
  streak(n) {
    const base = 440 * Math.pow(1.12, Math.min(n, 6));
    [1, 1.25, 1.5, 2].forEach((m, i) => tone({ f: base * m, dur: 0.12, type: 'square', vol: 0.07, when: i * 0.05 }));
  },
  freeze() {
    [2093, 1760, 1568, 1319, 1047].forEach((f, i) => tone({ f, dur: 0.15, type: 'sine', vol: 0.12, when: i * 0.05 }));
    noise({ dur: 0.4, vol: 0.08, freq: 6000 });
  },
  feast() {
    for (let i = 0; i < 8; i++) tone({ f: 600 + Math.random() * 900, dur: 0.06, vol: 0.08, when: i * 0.05 });
  },
  giant() {
    tone({ f: 110, f2: 330, dur: 0.45, type: 'sawtooth', vol: 0.12 });
    tone({ f: 220, f2: 660, dur: 0.45, type: 'triangle', vol: 0.15 });
  },
  life() {
    [392, 523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: 0.2, type: 'triangle', vol: 0.18, when: i * 0.08 }));
  },
  gift() {
    [784, 988, 1175, 1568, 1976].forEach((f, i) => tone({ f, dur: 0.18, type: 'triangle', vol: 0.16, when: i * 0.09 }));
    noise({ dur: 0.3, vol: 0.1, freq: 7000, when: 0.4 });
  },
  whoosh() {
    noise({ dur: 0.25, vol: 0.12, freq: 1200 });
  },
  error() {
    tone({ f: 200, f2: 150, dur: 0.18, type: 'square', vol: 0.08 });
  },
};

// ------------------------------------------------------------- music ----
// A tiny, cheerful 4-bar loop: bass + pentatonic melody + soft hats.
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const ROOTS = [48, 43, 45, 41]; // C G Am F
const MELODY = [
  12, null, 16, 19, 16, null, 12, null,
  14, null, 19, null, 14, 11, null, null,
  12, null, 16, null, 19, 21, 19, null,
  17, null, 16, null, 14, null, 12, null,
];
const BPM = 116;

function startMusic() {
  if (musicTimer) return;
  nextNote = ac.currentTime + 0.1;
  musicTimer = setInterval(schedule, 60);
}

function schedule() {
  if (!ac || ac.state !== 'running') return;
  const stepDur = 60 / BPM / 2;
  while (nextNote < ac.currentTime + 0.2) {
    const s = step % 32;
    const bar = Math.floor(s / 8);
    const root = ROOTS[bar];
    const when = nextNote - ac.currentTime;
    if (s % 2 === 0) tone({ f: midi(root - 12), dur: stepDur * 1.6, type: 'triangle', vol: 0.5, when, bus: musicBus });
    const m = MELODY[s];
    if (m !== null) tone({ f: midi(60 + m), dur: stepDur * 1.4, type: 'square', vol: 0.13, when, bus: musicBus });
    if (s % 2 === 1) noise({ dur: 0.04, vol: 0.12, freq: 8000, when, bus: musicBus });
    nextNote += stepDur;
    step++;
  }
}
