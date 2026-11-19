// Skin catalogue: default skins plus validation for skins coming from
// config.json, the admin editor or an imported backup.
import { clamp, normHex } from './util.js';

export const PATTERNS = {
  stripes: 'Stripes',
  solid: 'Solid',
  gradient: 'Gradient (head to tail)',
  cycle: 'Moving stripes',
  rainbow: 'Rainbow (ignores colours)',
  spots: 'Spots (colour 1 body, colour 2 spots)',
};

export const EYES = {
  round: 'Round',
  cute: 'Cute',
  angry: 'Fierce',
  sleepy: 'Sleepy',
  cool: 'Sunglasses',
  silly: 'Silly',
};

export const HATS = {
  none: 'No hat',
  crown: 'Crown',
  party: 'Party hat',
  cap: 'Cap',
  horns: 'Horns',
  bow: 'Bow',
  tophat: 'Top hat',
  antenna: 'Antennae',
  halo: 'Halo',
  unicorn: 'Unicorn horn',
  pirate: 'Pirate hat',
  chef: 'Chef hat',
  cowboy: 'Cowboy hat',
  wizard: 'Wizard hat',
  flower: 'Flower crown',
  headphones: 'Headphones',
  beanie: 'Beanie',
  viking: 'Viking helmet',
  santa: 'Santa hat',
};

export const DEFAULT_SKINS = [
  { id: 'mint', name: 'Minty', colors: ['#5be37d', '#2fbf5b'], pattern: 'stripes', stripe: 2, eyes: 'round', hat: 'none', price: 0, free: true },
  { id: 'bubblegum', name: 'Bubblegum', colors: ['#ff7eb6', '#ffc2dc'], pattern: 'stripes', stripe: 2, eyes: 'cute', hat: 'bow', price: 0, free: true },
  { id: 'ocean', name: 'Ocean Wave', colors: ['#1e90ff', '#5fd3ff', '#e6fbff'], pattern: 'stripes', stripe: 2, eyes: 'round', hat: 'none', price: 60 },
  { id: 'choco', name: 'Choco Chip', colors: ['#8a5532', '#3b2314'], pattern: 'spots', stripe: 1, eyes: 'cute', hat: 'cap', price: 80 },
  { id: 'bee', name: 'Buzzy Bee', colors: ['#ffd60a', '#2b2b2b'], pattern: 'stripes', stripe: 2, eyes: 'cute', hat: 'antenna', price: 100 },
  { id: 'lava', name: 'Lava Lizard', colors: ['#ffe14d', '#ff7b00', '#e8122a'], pattern: 'gradient', stripe: 2, eyes: 'angry', hat: 'none', price: 150 },
  { id: 'watermelon', name: 'Watermelon', colors: ['#ff4f6d', '#ff4f6d', '#ff4f6d', '#2ecc71'], pattern: 'stripes', stripe: 1, eyes: 'silly', hat: 'none', price: 150 },
  { id: 'tiger', name: 'Tiger Stripe', colors: ['#ff9a1f', '#ff9a1f', '#262626'], pattern: 'stripes', stripe: 1, eyes: 'angry', hat: 'none', price: 200 },
  { id: 'ladybug', name: 'Ladybug', colors: ['#e8172c', '#1b1b1b'], pattern: 'spots', stripe: 1, eyes: 'cute', hat: 'antenna', price: 200 },
  { id: 'candy', name: 'Candy Cane', colors: ['#ffffff', '#ff2e4d'], pattern: 'cycle', stripe: 2, eyes: 'round', hat: 'party', price: 250 },
  { id: 'ghost', name: 'Ghosty', colors: ['#f1f6ff', '#b9c8ff'], pattern: 'gradient', stripe: 2, eyes: 'sleepy', hat: 'halo', price: 300 },
  { id: 'robot', name: 'Robo-Snek', colors: ['#9aa5b1', '#d5dde6', '#5c6b7a'], pattern: 'stripes', stripe: 1, eyes: 'cool', hat: 'antenna', price: 350 },
  { id: 'zap', name: 'Lime Zap', colors: ['#c6ff00', '#00e5ff'], pattern: 'cycle', stripe: 3, eyes: 'cool', hat: 'cap', price: 400 },
  { id: 'dragon', name: 'Dragon', colors: ['#1fd17a', '#0b7a43', '#ffd23f'], pattern: 'gradient', stripe: 2, eyes: 'angry', hat: 'horns', price: 500 },
  { id: 'magician', name: 'Magician', colors: ['#3a0ca3', '#7209b7', '#f72585'], pattern: 'stripes', stripe: 2, eyes: 'round', hat: 'tophat', price: 600 },
  { id: 'rainbow', name: 'Rainbow', colors: ['#ff0000'], pattern: 'rainbow', stripe: 2, eyes: 'cute', hat: 'none', price: 750 },
  { id: 'unicorn', name: 'Unicorn', colors: ['#fbc2eb', '#a6c1ee', '#c2ffd8'], pattern: 'gradient', stripe: 2, eyes: 'cute', hat: 'unicorn', price: 900 },
  { id: 'galaxy', name: 'Galaxy', colors: ['#2a0a5e', '#7b2ff7', '#f107a3', '#00d4ff'], pattern: 'cycle', stripe: 2, eyes: 'cool', hat: 'none', price: 1200 },
  { id: 'king', name: 'King Cobra', colors: ['#ffd700', '#ffb300', '#8a5a00'], pattern: 'stripes', stripe: 1, eyes: 'angry', hat: 'crown', price: 2000 },
];

export function slugify(name) {
  const base = String(name || 'skin').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'skin';
  return base + '-' + Math.random().toString(36).slice(2, 6);
}

/** Coerce anything into a valid skin object (never throws). */
export function sanitizeSkin(s, i = 0) {
  s = s && typeof s === 'object' ? s : {};
  let colors = Array.isArray(s.colors) ? s.colors.map(normHex).filter(Boolean).slice(0, 8) : [];
  if (!colors.length) colors = ['#5be37d'];
  return {
    id: typeof s.id === 'string' && s.id.trim() ? s.id.trim().slice(0, 40) : 'skin-' + i + '-' + Math.random().toString(36).slice(2, 6),
    name: String(s.name || 'Snake').slice(0, 24),
    colors,
    pattern: PATTERNS[s.pattern] ? s.pattern : 'stripes',
    stripe: clamp(Math.round(Number(s.stripe) || 2), 1, 8),
    eyes: EYES[s.eyes] ? s.eyes : 'round',
    hat: HATS[s.hat] ? s.hat : 'none',
    price: Math.max(0, Math.round(Number(s.price) || 0)),
    free: !!s.free,
    hidden: !!s.hidden,
    bots: s.bots !== false,
  };
}

export function sanitizeSkinList(list) {
  if (!Array.isArray(list)) return null;
  const seen = new Set();
  const out = [];
  list.forEach((s, i) => {
    const k = sanitizeSkin(s, i);
    if (seen.has(k.id)) k.id = k.id + '-' + i;
    seen.add(k.id);
    out.push(k);
  });
  return out.length ? out : null;
}
