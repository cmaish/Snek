// Drawing helpers: cached sprites, snake faces, hats and skin previews.
import { TAU, shade, mix, hslHex, FONT } from './util.js';
import { drawCharHead, headTop } from './heads.js';

const SPR = 96; // sprite resolution for body balls

function mk(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function circle(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

// ---------------------------------------------------------- body balls ----
const ballCache = new Map();
export function ballSprite(color, spot) {
  const key = color + '|' + (spot || '');
  let c = ballCache.get(key);
  if (c) return c;
  if (ballCache.size > 800) ballCache.clear();
  c = mk(SPR);
  const g = c.getContext('2d');
  const m = SPR / 2, r = m - 2;
  g.fillStyle = shade(color, -0.42);
  circle(g, m, m, r);
  const gr = g.createRadialGradient(m - r * 0.35, m - r * 0.4, r * 0.05, m, m, r * 0.9);
  gr.addColorStop(0, shade(color, 0.5));
  gr.addColorStop(0.4, shade(color, 0.1));
  gr.addColorStop(1, shade(color, -0.16));
  g.fillStyle = gr;
  circle(g, m, m, r * 0.86);
  if (spot) {
    g.fillStyle = spot;
    circle(g, m + r * 0.18, m + r * 0.12, r * 0.3);
    circle(g, m - r * 0.38, m + r * 0.36, r * 0.15);
  }
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath();
  g.ellipse(m - r * 0.36, m - r * 0.42, r * 0.24, r * 0.14, -0.6, 0, TAU);
  g.fill();
  ballCache.set(key, c);
  return c;
}

const RAINBOW = Array.from({ length: 24 }, (_, i) => hslHex(i * 15, 90, 58));
export const RAINBOW_COLORS = RAINBOW;

function gradientColors(cols, n) {
  if (cols.length === 1) return Array(n).fill(cols[0]);
  return Array.from({ length: n }, (_, k) => {
    const f = (k / (n - 1)) * (cols.length - 1);
    const i = Math.min(cols.length - 2, Math.floor(f));
    return mix(cols[i], cols[i + 1], f - i);
  });
}

const prepCache = new Map();
/** Pre-computes the sprites a skin needs. Cheap to call repeatedly. */
export function prepSkin(skin) {
  const key = skin.pattern + '|' + skin.colors.join(',') + '|' + skin.stripe;
  let p = prepCache.get(key);
  if (p) return p;
  if (prepCache.size > 300) prepCache.clear();
  const cols = skin.colors.length ? skin.colors : ['#5be37d'];
  let sprites, palette;
  switch (skin.pattern) {
    case 'solid':
      palette = [cols[0], shade(cols[0], -0.07)];
      sprites = palette.map((c) => ballSprite(c));
      break;
    case 'gradient':
      palette = gradientColors(cols, 20);
      sprites = palette.map((c) => ballSprite(c));
      break;
    case 'rainbow':
      palette = RAINBOW;
      sprites = palette.map((c) => ballSprite(c));
      break;
    case 'spots':
      palette = [cols[0], cols[1] || '#222222'];
      sprites = [ballSprite(cols[0]), ballSprite(cols[0], cols[1] || '#222222')];
      break;
    default: // stripes, cycle
      palette = cols;
      sprites = cols.map((c) => ballSprite(c));
  }
  p = { mode: skin.pattern, sprites, palette, stripe: skin.stripe || 2, main: cols[0], cols };
  prepCache.set(key, p);
  return p;
}

export function segSprite(p, i, n, t) {
  const s = p.sprites;
  switch (p.mode) {
    case 'solid': return s[i & 1];
    case 'gradient': return s[Math.round((i / Math.max(1, n - 1)) * (s.length - 1))];
    case 'rainbow': return s[(((Math.floor(i * 0.7 - t * 14)) % 24) + 24) % 24];
    case 'spots': return s[i % 2 === 1 ? 1 : 0];
    case 'cycle': {
      const k = Math.floor((i - t * 9) / p.stripe);
      return s[((k % s.length) + s.length) % s.length];
    }
    default: return s[Math.floor(i / p.stripe) % s.length];
  }
}

/** Main colour of a skin at a given moment (used for minimap etc.) */
export function skinColor(p, t = 0) {
  return p.mode === 'rainbow' ? RAINBOW[Math.floor(t * 6) % 24] : p.main;
}

// ------------------------------------------------------- glow / pellets ----
const glowCache = new Map();
export function glowSprite(color) {
  let c = glowCache.get(color);
  if (c) return c;
  c = mk(64);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, color + 'aa');
  gr.addColorStop(1, color + '00');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  glowCache.set(color, c);
  return c;
}

const pelletCache = new Map();
export function pelletSprite(color) {
  let c = pelletCache.get(color);
  if (c) return c;
  c = mk(64);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  gr.addColorStop(0, color + 'cc');
  gr.addColorStop(0.45, color + '55');
  gr.addColorStop(1, color + '00');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const core = g.createRadialGradient(28, 27, 1, 32, 32, 13);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.35, shade(color, 0.35));
  core.addColorStop(1, color);
  g.fillStyle = core;
  circle(g, 32, 32, 12);
  pelletCache.set(color, c);
  return c;
}

export const POWERUPS = {
  magnet: { icon: '🧲', color: '#ff4f6d', label: 'Magnet!', time: 10, desc: 'Pulls food to you' },
  speed: { icon: '⚡', color: '#ffb703', label: 'Zoom!', time: 6, desc: 'Super speed' },
  shield: { icon: '⭐', color: '#ffd23f', label: 'Super Star!', time: 6, desc: 'Eat anyone!' },
  double: { icon: '2×', color: '#3ddc97', label: 'Double Growth!', time: 12, desc: 'Grow twice as fast' },
  freeze: { icon: '❄️', color: '#5fd3ff', label: 'Freeze!', time: 5, desc: 'Slows everyone else' },
  feast: { icon: '🍰', color: '#ff7eb6', label: 'Candy Rain!', time: 0, desc: 'A shower of food' },
  giant: { icon: '🍄', color: '#ff7b54', label: 'GIANT!', time: 8, desc: 'Fight like you\'re 50% bigger' },
};

const starCache = new Map();
/** A glowing star — used for bonus pellets. */
export function starSprite(color) {
  let c = starCache.get(color);
  if (c) return c;
  c = mk(64);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  gr.addColorStop(0, color + 'bb');
  gr.addColorStop(1, color + '00');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 7 : 16;
    g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  g.closePath();
  const core = g.createLinearGradient(20, 18, 44, 46);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.4, shade(color, 0.3));
  core.addColorStop(1, color);
  g.fillStyle = core;
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = shade(color, -0.3);
  g.stroke();
  starCache.set(color, c);
  return c;
}

const puCache = new Map();
export function powerupSprite(type) {
  let c = puCache.get(type);
  if (c) return c;
  const d = POWERUPS[type];
  c = mk(128);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 20, 64, 64, 64);
  gr.addColorStop(0, d.color + 'aa');
  gr.addColorStop(1, d.color + '00');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const b = g.createRadialGradient(52, 48, 4, 64, 64, 40);
  b.addColorStop(0, '#ffffff');
  b.addColorStop(0.4, shade(d.color, 0.3));
  b.addColorStop(1, shade(d.color, -0.2));
  g.fillStyle = b;
  circle(g, 64, 64, 38);
  g.lineWidth = 5;
  g.strokeStyle = '#ffffff';
  g.stroke();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (type === 'double') {
    g.font = `900 34px ${FONT}`;
    g.lineWidth = 6;
    g.strokeStyle = '#0d5c3a';
    g.strokeText(d.icon, 64, 67);
    g.fillStyle = '#fff';
    g.fillText(d.icon, 64, 67);
  } else {
    g.font = `40px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    g.fillText(d.icon, 64, 68);
  }
  puCache.set(type, c);
  return c;
}

// --------------------------------------------------------------- faces ----
/**
 * Draws eyes, mouth, tongue and hat for a head at (x,y) with radius r,
 * facing angle `ang`.
 */
export function drawFace(g, x, y, r, ang, skin, st = {}) {
  const t = st.t || 0;
  const eyes = skin.eyes || 'round';
  g.save();
  g.translate(x, y);
  g.rotate(ang);

  if (st.tongue) {
    g.strokeStyle = '#ff3b6b';
    g.lineWidth = r * 0.13;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(r * 0.85, 0);
    g.lineTo(r * 1.45, 0);
    g.lineTo(r * 1.7, -r * 0.2);
    g.moveTo(r * 1.45, 0);
    g.lineTo(r * 1.7, r * 0.2);
    g.stroke();
  }
  if (st.mouth > 0.05) {
    g.fillStyle = '#3a0b1e';
    g.beginPath();
    g.ellipse(r * 0.66, 0, r * 0.12 + r * 0.24 * st.mouth, r * 0.48 * st.mouth, 0, 0, TAU);
    g.fill();
  }

  if (eyes === 'cute') {
    g.fillStyle = 'rgba(255,90,140,0.45)';
    for (const side of [-1, 1]) {
      g.beginPath();
      g.ellipse(r * 0.05, side * r * 0.8, r * 0.2, r * 0.13, 0, 0, TAU);
      g.fill();
    }
  }
  const er = r * (eyes === 'cute' ? 0.4 : eyes === 'silly' ? 0.37 : 0.34);
  const ex = r * 0.22, ey = r * 0.47;
  const look = (st.look ?? ang) - ang;
  const lx = Math.cos(look) * er * 0.38, ly = Math.sin(look) * er * 0.38;
  const blink = st.blink || 0;

  if (eyes === 'cool') {
    g.fillStyle = '#111122';
    for (const side of [-1, 1]) {
      g.beginPath();
      g.ellipse(ex + r * 0.05, side * ey, er * 1.05, er * 1.2, 0, 0, TAU);
      g.fill();
    }
    g.strokeStyle = '#111122';
    g.lineWidth = r * 0.12;
    g.beginPath();
    g.moveTo(ex + r * 0.2, -ey * 0.5);
    g.lineTo(ex + r * 0.2, ey * 0.5);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = r * 0.07;
    g.lineCap = 'round';
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(ex + er * 0.5, side * ey - er * 0.5);
      g.lineTo(ex + er * 0.1, side * ey - er * 0.1);
      g.stroke();
    }
  } else {
    for (const side of [-1, 1]) {
      const r2 = er * (eyes === 'silly' ? (side < 0 ? 1.2 : 0.8) : 1);
      g.save();
      g.translate(ex, side * ey);
      g.scale(Math.max(0.12, 1 - blink), 1);
      g.fillStyle = '#ffffff';
      circle(g, 0, 0, r2);
      g.lineWidth = r * 0.05;
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.stroke();
      if (blink < 0.6) {
        const pr = r2 * (eyes === 'cute' ? 0.66 : 0.5);
        let px = lx, py = ly;
        if (eyes === 'silly') { px = er * 0.2; py = -side * r2 * 0.35; }
        g.fillStyle = '#16121f';
        circle(g, px, py, pr);
        if (eyes === 'cute' || eyes === 'round') {
          g.fillStyle = '#ffffff';
          circle(g, px + pr * 0.3, py - pr * 0.35, pr * (eyes === 'cute' ? 0.38 : 0.28));
        }
        if (eyes === 'sleepy') {
          g.fillStyle = shade(skin.colors[0] || '#888888', -0.1);
          g.beginPath();
          g.arc(0, 0, r2 * 1.06, Math.PI / 2, Math.PI * 1.5);
          g.closePath();
          g.fill();
          g.strokeStyle = 'rgba(0,0,0,0.45)';
          g.lineWidth = r * 0.05;
          g.beginPath();
          g.moveTo(0, -r2);
          g.lineTo(0, r2);
          g.stroke();
        }
      }
      g.restore();
      if (eyes === 'angry') {
        g.strokeStyle = '#16121f';
        g.lineWidth = r * 0.13;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(ex + er * 1.0, side * (ey - er * 0.55));
        g.lineTo(ex - er * 0.35, side * (ey + er * 1.05));
        g.stroke();
      }
    }
  }
  g.restore();

  if (skin.hat && skin.hat !== 'none') {
    drawHat(g, skin.hat, x - Math.cos(ang) * r * 0.3, y - Math.sin(ang) * r * 0.3 - r * 0.25, r, t);
  }
}

/** Hats are drawn upright (sticker style) with their base at (x,y). */
export function drawHat(g, type, x, y, s, t = 0) {
  g.save();
  g.translate(x, y);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.lineWidth = s * 0.08;
  switch (type) {
    case 'crown': {
      g.fillStyle = '#ffd23f';
      g.strokeStyle = '#a86b00';
      g.beginPath();
      g.moveTo(-0.62 * s, 0);
      g.lineTo(0.62 * s, 0);
      g.lineTo(0.66 * s, -0.78 * s);
      g.lineTo(0.32 * s, -0.42 * s);
      g.lineTo(0, -0.92 * s);
      g.lineTo(-0.32 * s, -0.42 * s);
      g.lineTo(-0.66 * s, -0.78 * s);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#ff2e4d'; circle(g, 0, -0.22 * s, 0.11 * s);
      g.fillStyle = '#4cc9f0'; circle(g, -0.36 * s, -0.18 * s, 0.08 * s); circle(g, 0.36 * s, -0.18 * s, 0.08 * s);
      break;
    }
    case 'party': {
      g.rotate(0.18);
      g.fillStyle = '#ff4fa3';
      g.strokeStyle = '#a3125a';
      g.beginPath();
      g.moveTo(-0.45 * s, 0);
      g.lineTo(0.45 * s, 0);
      g.lineTo(0, -1.25 * s);
      g.closePath();
      g.fill();
      g.save();
      g.clip();
      g.strokeStyle = '#ffe14d';
      g.lineWidth = s * 0.14;
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.moveTo(-s, -k * 0.34 * s - 0.05 * s);
        g.lineTo(s, -k * 0.34 * s - 0.4 * s);
        g.stroke();
      }
      g.restore();
      g.strokeStyle = '#a3125a';
      g.lineWidth = s * 0.08;
      g.beginPath();
      g.moveTo(-0.45 * s, 0); g.lineTo(0.45 * s, 0); g.lineTo(0, -1.25 * s); g.closePath();
      g.stroke();
      g.fillStyle = '#ffffff';
      circle(g, 0, -1.28 * s, 0.17 * s);
      break;
    }
    case 'cap': {
      g.fillStyle = '#e8122a';
      g.strokeStyle = '#7d0010';
      g.beginPath();
      g.ellipse(0.42 * s, -0.04 * s, 0.5 * s, 0.15 * s, 0, 0, TAU);
      g.fill(); g.stroke();
      g.beginPath();
      g.arc(0, 0, 0.58 * s, Math.PI, 0);
      g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = '#ffffff';
      circle(g, 0, -0.58 * s, 0.09 * s);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.ellipse(-0.2 * s, -0.32 * s, 0.14 * s, 0.08 * s, -0.5, 0, TAU); g.fill();
      break;
    }
    case 'horns': {
      g.fillStyle = '#fff4d6';
      g.strokeStyle = '#a8916a';
      for (const sd of [-1, 1]) {
        g.beginPath();
        g.moveTo(sd * 0.22 * s, 0);
        g.quadraticCurveTo(sd * 0.55 * s, -0.25 * s, sd * 0.62 * s, -0.95 * s);
        g.quadraticCurveTo(sd * 0.35 * s, -0.4 * s, sd * 0.56 * s, 0.02 * s);
        g.closePath();
        g.fill(); g.stroke();
      }
      break;
    }
    case 'bow': {
      g.translate(0.35 * s, -0.05 * s);
      g.rotate(-0.25);
      g.fillStyle = '#ff5fa2';
      g.strokeStyle = '#b0175a';
      for (const sd of [-1, 1]) {
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(sd * 0.55 * s, -0.32 * s);
        g.lineTo(sd * 0.55 * s, 0.32 * s);
        g.closePath();
        g.fill(); g.stroke();
      }
      g.fillStyle = '#ff8cc0';
      circle(g, 0, 0, 0.16 * s);
      g.stroke();
      break;
    }
    case 'tophat': {
      g.fillStyle = '#1b1b2f';
      g.strokeStyle = '#000000';
      g.beginPath(); g.ellipse(0, 0, 0.66 * s, 0.14 * s, 0, 0, TAU); g.fill(); g.stroke();
      g.fillRect(-0.4 * s, -1.0 * s, 0.8 * s, 1.0 * s);
      g.strokeRect(-0.4 * s, -1.0 * s, 0.8 * s, 1.0 * s);
      g.fillStyle = '#e8122a';
      g.fillRect(-0.4 * s, -0.32 * s, 0.8 * s, 0.17 * s);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(-0.3 * s, -0.92 * s, 0.12 * s, 0.55 * s);
      break;
    }
    case 'antenna': {
      const bob = Math.sin(t * 5) * 0.08 * s;
      g.strokeStyle = '#2b2b2b';
      g.lineWidth = s * 0.09;
      for (const sd of [-1, 1]) {
        g.beginPath();
        g.moveTo(sd * 0.2 * s, 0);
        g.quadraticCurveTo(sd * 0.25 * s, -0.6 * s, sd * 0.5 * s, -0.85 * s + bob * sd);
        g.stroke();
        g.fillStyle = '#ff4fa3';
        circle(g, sd * 0.5 * s, -0.85 * s + bob * sd, 0.15 * s);
      }
      break;
    }
    case 'halo': {
      const bob = Math.sin(t * 3) * 0.08 * s;
      g.strokeStyle = '#ffe14d';
      g.lineWidth = s * 0.14;
      g.shadowColor = '#fff3a0';
      g.shadowBlur = 8;
      g.beginPath();
      g.ellipse(0, -0.75 * s + bob, 0.5 * s, 0.16 * s, 0, 0, TAU);
      g.stroke();
      break;
    }
    case 'unicorn': {
      const gr = g.createLinearGradient(0, 0, 0, -1.2 * s);
      gr.addColorStop(0, '#ffd1f0');
      gr.addColorStop(0.5, '#fff3a0');
      gr.addColorStop(1, '#b5f5ff');
      g.fillStyle = gr;
      g.strokeStyle = '#c86fb0';
      g.beginPath();
      g.moveTo(-0.2 * s, 0);
      g.lineTo(0.2 * s, 0);
      g.lineTo(0.02 * s, -1.2 * s);
      g.closePath();
      g.fill(); g.stroke();
      g.lineWidth = s * 0.05;
      for (let k = 1; k <= 3; k++) {
        const yy = -k * 0.28 * s, w = 0.2 * s * (1 - k * 0.25);
        g.beginPath(); g.moveTo(-w, yy + 0.06 * s); g.lineTo(w, yy - 0.04 * s); g.stroke();
      }
      break;
    }
  }
  g.restore();
}

/** Body thickness multiplier for segment i of n (tail tapers to a point). */
export function taper(i, n) {
  const start = n * 0.55;
  if (n < 8 || i < start) return 1;
  return 1 - 0.55 * ((i - start) / (n - start));
}

// ------------------------------------------------------------- preview ----
/** Draws a wiggling snake wearing `skin` into a canvas context. */
export function drawSnakePreview(g, skin, w, h, t = 0, opts = {}) {
  const p = prepSkin(skin);
  if (opts.portrait) {
    // just the head, big and centred (shop cards for heads)
    const r = h * 0.3, x = w / 2, y = h * 0.56;
    g.fillStyle = 'rgba(10,8,40,0.18)';
    g.beginPath(); g.ellipse(x, h * 0.92, r * 0.9, r * 0.18, 0, 0, TAU); g.fill();
    if (opts.head && opts.head !== 'snake') {
      drawCharHead(g, x, y, r, opts.head, skin, { t, look: 0.4 });
    } else {
      g.drawImage(segSprite(p, 0, 1, t), x - r, y - r, r * 2, r * 2);
      drawFace(g, x, y, r, -Math.PI / 2, { ...skin, hat: 'none' }, { t });
    }
    return;
  }
  const n = opts.segments || 16;
  const r = Math.min(h * 0.15, w * 0.07);
  const x0 = w * 0.1, x1 = w * 0.8;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1); // 0 = head (right) .. 1 = tail (left)
    const x = x1 - (x1 - x0) * f;
    const y = h * 0.58 + Math.sin(f * 5.5 - t * 3) * h * 0.14 * (0.4 + f);
    pts.push([x, y]);
  }
  g.fillStyle = 'rgba(10,8,40,0.25)';
  g.beginPath();
  pts.forEach(([x, y], i) => { const ri = r * taper(i, n); g.moveTo(x + ri, y + r * 0.35); g.arc(x, y + r * 0.35, ri, 0, TAU); });
  g.fill();
  for (let i = n - 1; i >= 1; i--) {
    const [x, y] = pts[i];
    const ri = r * taper(i, n);
    g.drawImage(segSprite(p, i, n, t), x - ri, y - ri, ri * 2, ri * 2);
  }
  const [hx, hy] = pts[0];
  const ang = Math.atan2(hy - pts[1][1], hx - pts[1][0]);
  if (opts.head && opts.head !== 'snake') {
    const cr = r * 1.55;
    drawCharHead(g, hx, hy, cr, opts.head, skin, { t, blink: (t % 3.2) < 0.12 ? 1 : 0, look: 0 });
    if (skin.hat && skin.hat !== 'none') drawHat(g, skin.hat, hx, hy - cr * Math.min(1.25, headTop(opts.head) * 0.8), cr * 0.85, t);
    return;
  }
  const hr = r * 1.25;
  g.drawImage(segSprite(p, 0, n, t), hx - hr, hy - hr, hr * 2, hr * 2);
  const blink = (t % 3.2) < 0.12 ? 1 : 0;
  drawFace(g, hx, hy, hr, ang, skin, { t, blink, tongue: (t % 2.6) > 2.2, look: ang });
}
