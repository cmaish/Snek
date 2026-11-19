// Player progression (coins, unlocks, levels, missions, preferences).
// Stored separately from the admin configuration in config.js.
import { sanitizeSkin } from './skins.js';

const KEY = 'snek.progress.v1';

const DEFAULTS = {
  name: '',
  coins: 0,
  unlocked: [],
  selected: 'mint',
  best: 0,
  games: 0,
  kills: 0,
  wins: 0,
  totalStars: 0,
  totalPowerups: 0,
  sound: true,
  music: true,
  tipsShown: 0,
  haptics: true,
  boostLeft: false,
  extendedUi: false,
  lastGift: '',
  giftStreak: 0,
  bestStreak: 0,
  unlockedHeads: [],
  selectedHead: 'snake',
  // player level
  level: 1,
  xp: 0,
  // extra customisation
  ownedHats: [],
  ownedTrails: [],
  ownedThemes: [],
  selectedHat: 'auto',
  selectedTrail: 'none',
  selectedTheme: 'classic',
  custom: { colors: ['#5be37d', '#ffd23f'], pattern: 'stripes', eyes: 'cute' },
  customMade: false,
  // adventure: { levelIndex: stars }
  adv: {},
  advUnlockAll: false,
  // daily missions + trophies
  missions: null,
  trophies: {},
};

const LISTS = ['unlocked', 'unlockedHeads', 'ownedHats', 'ownedTrails', 'ownedThemes'];

function load() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { p = {}; }
  const out = { ...DEFAULTS, ...p };
  for (const k of LISTS) if (!Array.isArray(out[k])) out[k] = [];
  for (const k of ['adv', 'trophies']) if (!out[k] || typeof out[k] !== 'object') out[k] = {};
  if (!out.custom || typeof out.custom !== 'object') out.custom = { ...DEFAULTS.custom };
  out.coins = Math.max(0, Math.floor(Number(out.coins) || 0));
  out.level = Math.max(1, Math.floor(Number(out.level) || 1));
  out.xp = Math.max(0, Math.floor(Number(out.xp) || 0));
  return out;
}

export const progress = load();

export function saveProgress() {
  try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch { /* ignore */ }
}

export function resetProgress() {
  const keep = { sound: progress.sound, music: progress.music, name: progress.name, haptics: progress.haptics, boostLeft: progress.boostLeft, extendedUi: progress.extendedUi };
  Object.assign(progress, JSON.parse(JSON.stringify(DEFAULTS)), keep);
  saveProgress();
}

export function isUnlocked(skin) {
  return !!skin && (skin.id === 'custom' || skin.free || skin.price <= 0 || progress.unlocked.includes(skin.id));
}

/** The body the player designed in the Snake Maker. */
export function customSkin() {
  return sanitizeSkin({ ...progress.custom, id: 'custom', name: 'My Snake', price: 0, free: true, hat: 'none' });
}

/** Make sure the selected skin exists, is visible and unlocked. */
export function ensureSelected(skins) {
  if (progress.selected === 'custom' && progress.customMade) return customSkin();
  const cur = skins.find((s) => s.id === progress.selected);
  if (cur && !cur.hidden && isUnlocked(cur)) return cur;
  const fallback = skins.find((s) => !s.hidden && isUnlocked(s)) || skins[0];
  progress.selected = fallback.id;
  saveProgress();
  return fallback;
}

export function isHeadUnlocked(head) {
  return !!head && (head.price <= 0 || progress.unlockedHeads.includes(head.id));
}

/** Make sure the selected head exists, is visible and unlocked. */
export function ensureHead(heads) {
  const cur = heads.find((h) => h.id === progress.selectedHead);
  if (cur && !cur.hidden && isHeadUnlocked(cur)) return cur;
  progress.selectedHead = 'snake';
  saveProgress();
  return heads.find((h) => h.id === 'snake');
}

// ------------------------------------------- hats / trails / arena themes ----
const OWN = { hat: 'ownedHats', trail: 'ownedTrails', theme: 'ownedThemes' };
const SEL = { hat: 'selectedHat', trail: 'selectedTrail', theme: 'selectedTheme' };

/** 'owned' | 'level' (needs a higher player level) | 'buy' (costs coins). */
export function itemState(kind, item) {
  if (progress[OWN[kind]].includes(item.id)) return 'owned';
  if (item.level > progress.level) return 'level';
  return item.price <= 0 ? 'owned' : 'buy';
}

export function ownItem(kind, id) {
  if (!progress[OWN[kind]].includes(id)) progress[OWN[kind]].push(id);
}

export function selectedItem(kind, items) {
  const id = progress[SEL[kind]];
  const it = items.find((x) => x.id === id);
  if (it && itemState(kind, it) === 'owned') return it;
  progress[SEL[kind]] = items[0].id;
  return items[0];
}

export function selectItem(kind, id) {
  progress[SEL[kind]] = id;
  saveProgress();
}
