// Player progression (coins, unlocked skins, best score, preferences).
// Stored separately from the admin configuration in config.js.
const KEY = 'snek.progress.v1';

const DEFAULTS = {
  name: '',
  coins: 0,
  unlocked: [],
  selected: 'mint',
  best: 0,
  games: 0,
  kills: 0,
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
};

function load() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { p = {}; }
  const out = { ...DEFAULTS, ...p };
  if (!Array.isArray(out.unlocked)) out.unlocked = [];
  if (!Array.isArray(out.unlockedHeads)) out.unlockedHeads = [];
  out.coins = Math.max(0, Math.floor(Number(out.coins) || 0));
  return out;
}

export const progress = load();

export function saveProgress() {
  try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch { /* ignore */ }
}

export function resetProgress() {
  const keep = { sound: progress.sound, music: progress.music, name: progress.name };
  Object.assign(progress, { ...DEFAULTS, ...keep, unlocked: [], unlockedHeads: [] });
  saveProgress();
}

export function isUnlocked(skin) {
  return !!skin && (skin.free || skin.price <= 0 || progress.unlocked.includes(skin.id));
}

/** Make sure the selected skin exists, is visible and unlocked. */
export function ensureSelected(skins) {
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
