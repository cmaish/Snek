// Extra customisation: hats, trails and arena themes.
//
// Every item has a coin `price` and a player `level` it unlocks at.
// Items with price 0 are free rewards once that level is reached.
import { TAU, rand, pick, hslHex } from './util.js';

export const HAT_ITEMS = [
  { id: 'auto', name: 'Body default', price: 0, level: 1 },
  { id: 'none', name: 'No hat', price: 0, level: 1 },
  { id: 'bow', name: 'Bow', price: 0, level: 1 },
  { id: 'cap', name: 'Cap', price: 60, level: 1 },
  { id: 'party', name: 'Party hat', price: 60, level: 1 },
  { id: 'flower', name: 'Flower crown', price: 0, level: 2 },
  { id: 'beanie', name: 'Beanie', price: 80, level: 1 },
  { id: 'antenna', name: 'Antennae', price: 100, level: 1 },
  { id: 'chef', name: 'Chef hat', price: 120, level: 1 },
  { id: 'headphones', name: 'Headphones', price: 0, level: 6 },
  { id: 'horns', name: 'Horns', price: 150, level: 1 },
  { id: 'pirate', name: 'Pirate hat', price: 150, level: 1 },
  { id: 'cowboy', name: 'Cowboy hat', price: 150, level: 1 },
  { id: 'santa', name: 'Santa hat', price: 150, level: 1 },
  { id: 'tophat', name: 'Top hat', price: 200, level: 1 },
  { id: 'wizard', name: 'Wizard hat', price: 0, level: 10 },
  { id: 'viking', name: 'Viking helmet', price: 250, level: 1 },
  { id: 'halo', name: 'Halo', price: 300, level: 1 },
  { id: 'unicorn', name: 'Unicorn horn', price: 300, level: 1 },
  { id: 'crown', name: 'Crown', price: 0, level: 20 },
];

export const TRAIL_ITEMS = [
  { id: 'none', name: 'No trail', price: 0, level: 1 },
  { id: 'sparkle', name: 'Sparkles', price: 0, level: 2 },
  { id: 'bubbles', name: 'Bubbles', price: 60, level: 1 },
  { id: 'hearts', name: 'Hearts', price: 100, level: 1 },
  { id: 'stars', name: 'Stars', price: 120, level: 1 },
  { id: 'notes', name: 'Music', price: 120, level: 1 },
  { id: 'leaves', name: 'Leaves', price: 0, level: 8 },
  { id: 'snow', name: 'Snowflakes', price: 150, level: 1 },
  { id: 'fire', name: 'Fire', price: 200, level: 1 },
  { id: 'rainbow', name: 'Rainbow', price: 300, level: 1 },
  { id: 'confetti', name: 'Confetti', price: 0, level: 12 },
];

export const THEMES = {
  classic: { name: 'Purple Hex', floor: ['#6152e0', '#4a3cc4', '#3a2ca6', '#271b80'], border: '#ff4fa3', rim: '#ffd23f', outside: '#160f3e' },
  meadow: { name: 'Meadow', floor: ['#86dc5c', '#5cbf3a', '#46a02a', '#2f7a1c'], border: '#ffd23f', rim: '#ff7eb6', outside: '#16300f' },
  ocean: { name: 'Ocean', floor: ['#4fc3f7', '#2b9bd8', '#1f7bb8', '#145a8c'], border: '#ffffff', rim: '#ffd23f', outside: '#0b2540' },
  candy: { name: 'Candy', floor: ['#ffa6da', '#f77fc4', '#e061ad', '#b84290'], border: '#7ee8fa', rim: '#ffffff', outside: '#3a0f2e' },
  snow: { name: 'Snowfield', floor: ['#eef7ff', '#d3e8fb', '#b6d5f2', '#8fb6dc'], border: '#4fc3f7', rim: '#ff4f6d', outside: '#1b2a44' },
  desert: { name: 'Desert', floor: ['#f8da92', '#ebc06a', '#d6a24c', '#b07f30'], border: '#ff6b6b', rim: '#3ddc97', outside: '#3a2410' },
  lava: { name: 'Lava', floor: ['#ff9447', '#e8542a', '#b8361e', '#7a1f12'], border: '#ffd23f', rim: '#2b2b2b', outside: '#200805' },
  space: { name: 'Deep Space', floor: ['#33336e', '#25255a', '#1b1b45', '#10102c'], border: '#00f5d4', rim: '#b388ff', outside: '#05050f' },
};

export const THEME_ITEMS = [
  { id: 'classic', price: 0, level: 1 },
  { id: 'meadow', price: 0, level: 3 },
  { id: 'ocean', price: 100, level: 1 },
  { id: 'candy', price: 150, level: 1 },
  { id: 'desert', price: 200, level: 1 },
  { id: 'snow', price: 0, level: 9 },
  { id: 'lava', price: 300, level: 1 },
  { id: 'space', price: 0, level: 15 },
].map((t) => ({ ...t, name: THEMES[t.id].name }));

/** Snake Maker unlocks at this player level. */
export const MAKER_LEVEL = 2;

// --------------------------------------------------------- trail sprites ----
const cache = new Map();
function emojiSprite(ch) {
  let c = cache.get(ch);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '48px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.fillText(ch, 32, 36);
  cache.set(ch, c);
  return c;
}

function sparkleSprite(color) {
  const key = 'sp' + color;
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, color + 'aa');
  gr.addColorStop(1, color + '00');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(32, 6); g.lineTo(36, 28); g.lineTo(58, 32); g.lineTo(36, 36); g.lineTo(32, 58); g.lineTo(28, 36); g.lineTo(6, 32); g.lineTo(28, 28);
  g.closePath();
  g.fill();
  cache.set(key, c);
  return c;
}

function bubbleSprite() {
  let c = cache.get('bubble');
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(160,220,255,0.18)';
  g.strokeStyle = 'rgba(220,245,255,0.9)';
  g.lineWidth = 4;
  g.beginPath(); g.arc(32, 32, 26, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath(); g.ellipse(23, 22, 7, 4, -0.7, 0, TAU); g.fill();
  cache.set('bubble', c);
  return c;
}

function blobSprite(color) {
  const key = 'blob' + color;
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(0.3, color);
  gr.addColorStop(1, color + '00');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  cache.set(key, c);
  return c;
}

/** Create one trail particle of the given kind at (x,y). */
export function makeTrailParticle(kind, x, y, t) {
  const p = { x: x + rand(-6, 6), y: y + rand(-6, 6), vx: rand(-20, 20), vy: rand(-20, 20), rot: rand(TAU), vr: rand(-2, 2), life: 1, max: 1, size: rand(14, 22), spr: null, add: false, rect: null };
  switch (kind) {
    case 'sparkle': p.spr = sparkleSprite(pick(['#ffe14d', '#9be7ff', '#ff9ff3'])); p.size = rand(12, 22); p.max = p.life = 0.7; break;
    case 'bubbles': p.spr = bubbleSprite(); p.vy = rand(-50, -20); p.size = rand(10, 20); p.max = p.life = 1.2; p.vr = 0; break;
    case 'hearts': p.spr = emojiSprite(pick(['❤️', '💖', '💜'])); p.vy = rand(-40, -15); p.vr = 0; p.rot = rand(-0.3, 0.3); break;
    case 'stars': p.spr = emojiSprite(pick(['⭐', '🌟'])); break;
    case 'notes': p.spr = emojiSprite(pick(['🎵', '🎶'])); p.vy = rand(-50, -20); p.vr = 0; p.rot = rand(-0.3, 0.3); break;
    case 'leaves': p.spr = emojiSprite(pick(['🍃', '🍂', '🍁'])); p.vr = rand(-3, 3); p.max = p.life = 1.3; break;
    case 'snow': p.spr = emojiSprite('❄️'); p.size = rand(10, 18); p.vy = rand(10, 35); p.max = p.life = 1.3; break;
    case 'fire': p.spr = blobSprite(pick(['#ff9f1c', '#ff4f2d', '#ffd23f'])); p.add = true; p.size = rand(16, 28); p.vy = rand(-50, -20); p.max = p.life = 0.6; break;
    case 'rainbow': p.spr = blobSprite(hslHex((t * 200) % 360, 95, 60)); p.add = true; p.size = rand(16, 24); p.vx = p.vy = 0; p.max = p.life = 0.9; break;
    case 'confetti': p.rect = pick(['#ff4f6d', '#ffd23f', '#3ddc97', '#4cc9f0', '#b388ff', '#ffffff']); p.size = rand(6, 11); p.vr = rand(-8, 8); p.vy = rand(-30, 30); break;
    default: return null;
  }
  return p;
}

export function drawTrailParticle(g, p) {
  const f = p.life / p.max;
  g.globalAlpha = Math.min(1, f * 1.6);
  if (p.rect) {
    g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
    g.fillStyle = p.rect;
    g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * Math.abs(Math.cos(p.rot * 2)) + 1);
    g.restore();
    return;
  }
  const s = p.size * (0.6 + 0.4 * f);
  if (p.add) g.globalCompositeOperation = 'lighter';
  if (p.rot) {
    g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
    g.drawImage(p.spr, -s / 2, -s / 2, s, s);
    g.restore();
  } else g.drawImage(p.spr, p.x - s / 2, p.y - s / 2, s, s);
  if (p.add) g.globalCompositeOperation = 'source-over';
}

// --------------------------------------------------------------- previews ----
/** A little arena disc in the given theme (shop cards, adventure map). */
export function drawThemePreview(g, id, w, h) {
  const th = THEMES[id] || THEMES.classic;
  g.fillStyle = th.outside;
  g.beginPath(); g.roundRect(0, 0, w, h, 14); g.fill();
  const r = Math.min(w, h) * 0.42, cx = w / 2, cy = h / 2;
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
  gr.addColorStop(0, th.floor[0]); gr.addColorStop(0.6, th.floor[1]); gr.addColorStop(0.92, th.floor[2]); gr.addColorStop(1, th.floor[3]);
  g.fillStyle = gr;
  g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
  g.lineWidth = Math.max(4, r * 0.12);
  g.strokeStyle = th.border;
  g.stroke();
  g.setLineDash([r * 0.18, r * 0.18]);
  g.strokeStyle = '#ffffff';
  g.stroke();
  g.setLineDash([]);
  g.lineWidth = 2;
  g.strokeStyle = th.rim;
  g.beginPath(); g.arc(cx, cy, r + Math.max(4, r * 0.12) * 0.9, 0, TAU); g.stroke();
  // a few dots of food
  const cols = ['#ff4f6d', '#ffd23f', '#3ddc97', '#4cc9f0', '#ffffff'];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, d = r * (0.25 + (i % 3) * 0.22);
    g.fillStyle = cols[i % cols.length];
    g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2.5, 0, TAU); g.fill();
  }
}

/** A wavy line of trail particles (shop cards). */
export function drawTrailPreview(g, kind, w, h, t = 0.6) {
  if (kind === 'none') {
    g.fillStyle = 'rgba(42,29,110,0.35)';
    g.font = `800 ${Math.round(h * 0.4)}px sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('—', w / 2, h / 2);
    return;
  }
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const keep = Math.random;
  Math.random = rnd; // deterministic previews
  try {
    for (let i = 0; i < 9; i++) {
      const f = i / 8;
      const x = w * 0.12 + f * w * 0.76, y = h * 0.5 + Math.sin(f * 5) * h * 0.18;
      const p = makeTrailParticle(kind, x, y, t + i * 0.15);
      if (!p) break;
      p.life = p.max * (0.35 + 0.65 * f);
      p.size *= Math.min(1.6, h / 50);
      drawTrailParticle(g, p);
    }
  } finally {
    Math.random = keep;
    g.globalAlpha = 1;
  }
}
