// Admin-controlled configuration (skins catalogue + game rules).
//
// Layers, lowest priority first:
//   1. Built-in defaults (this file + skins.js)
//   2. config.json next to index.html (optional, edit it on your server to
//      change the defaults for every device)
//   3. Local admin overrides saved on this device (Grown-up Settings menu)
//
// This is deliberately kept apart from the player's progress (coins,
// unlocked skins, best score), which lives in storage.js.
import { DEFAULT_SKINS, sanitizeSkinList } from './skins.js';
import { HEAD_DEFS } from './heads.js';
import { clamp } from './util.js';

const ADMIN_KEY = 'snek.admin.v1';
const DEFAULT_PIN = '1234';

export const DEFAULT_SETTINGS = {
  botCount: 10,
  difficulty: 'normal',
  botsChasePlayer: true,
  gentle: false,
  matchSeconds: 180,
  arenaSize: 'medium',
  startLength: 10,
  pelletDensity: 'normal',
  playerSpeed: 1,
  boostEnabled: true,
  spawnShield: 3,
  coinMultiplier: 1,
  showNames: true,
  powerups: { magnet: true, speed: true, shield: true, double: true, freeze: true, feast: true, giant: true },
  boostersEnabled: true,
  boosterPrices: { size: 40, shield: 25, magnet: 35, turbo: 35, life: 60, coins: 50 },
  dailyGift: 50,
};

let server = {}; // contents of config.json
let local = {};  // admin overrides on this device

function readLocal() {
  try { return JSON.parse(localStorage.getItem(ADMIN_KEY)) || {}; } catch { return {}; }
}
function writeLocal() {
  try { localStorage.setItem(ADMIN_KEY, JSON.stringify(local)); } catch { /* storage full / blocked */ }
}

export async function loadConfig() {
  local = readLocal();
  try {
    const res = await fetch('config.json', { cache: 'no-store' });
    if (res.ok) server = (await res.json()) || {};
  } catch { server = {}; }
}

function sanitizeSettings(s) {
  const d = DEFAULT_SETTINGS;
  s = s && typeof s === 'object' ? s : {};
  const pick = (v, allowed, def) => (allowed.includes(v) ? v : def);
  const num = (v, lo, hi, def) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? clamp(Number(v), lo, hi) : def);
  const bool = (v, def) => (typeof v === 'boolean' ? v : def);
  const pu = s.powerups && typeof s.powerups === 'object' ? s.powerups : {};
  const bp = s.boosterPrices && typeof s.boosterPrices === 'object' ? s.boosterPrices : {};
  return {
    botCount: Math.round(num(s.botCount, 0, 30, d.botCount)),
    difficulty: pick(s.difficulty, ['easy', 'normal', 'hard'], d.difficulty),
    botsChasePlayer: bool(s.botsChasePlayer, d.botsChasePlayer),
    gentle: bool(s.gentle, d.gentle),
    matchSeconds: Math.round(num(s.matchSeconds, 0, 3600, d.matchSeconds)),
    arenaSize: pick(s.arenaSize, ['small', 'medium', 'large'], d.arenaSize),
    startLength: Math.round(num(s.startLength, 5, 100, d.startLength)),
    pelletDensity: pick(s.pelletDensity, ['low', 'normal', 'high'], d.pelletDensity),
    playerSpeed: num(s.playerSpeed, 0.5, 1.5, d.playerSpeed),
    boostEnabled: bool(s.boostEnabled, d.boostEnabled),
    spawnShield: num(s.spawnShield, 0, 15, d.spawnShield),
    coinMultiplier: num(s.coinMultiplier, 0, 10, d.coinMultiplier),
    showNames: bool(s.showNames, d.showNames),
    powerups: Object.fromEntries(Object.keys(d.powerups).map((k) => [k, bool(pu[k], d.powerups[k])])),
    boostersEnabled: bool(s.boostersEnabled, d.boostersEnabled),
    boosterPrices: Object.fromEntries(Object.keys(d.boosterPrices).map((k) => [k, Math.round(num(bp[k], 0, 100000, d.boosterPrices[k]))])),
    dailyGift: Math.round(num(s.dailyGift, 0, 10000, d.dailyGift)),
  };
}

/** Settings from defaults + config.json, without this device's overrides. */
function baseSettings() {
  const s = server.settings || {};
  return sanitizeSettings({
    ...DEFAULT_SETTINGS, ...s,
    powerups: { ...DEFAULT_SETTINGS.powerups, ...(s.powerups || {}) },
    boosterPrices: { ...DEFAULT_SETTINGS.boosterPrices, ...(s.boosterPrices || {}) },
  });
}

export function getSettings() {
  const b = baseSettings();
  const l = local.settings || {};
  return sanitizeSettings({
    ...b, ...l,
    powerups: { ...b.powerups, ...(l.powerups || {}) },
    boosterPrices: { ...b.boosterPrices, ...(l.boosterPrices || {}) },
  });
}

export function saveSettings(settings) {
  local.settings = sanitizeSettings(settings);
  writeLocal();
}

export function resetSettings() {
  delete local.settings;
  writeLocal();
}

function baseSkins() {
  return sanitizeSkinList(server.skins) || sanitizeSkinList(DEFAULT_SKINS);
}

export function getSkins() {
  return sanitizeSkinList(local.skins) || baseSkins();
}

export function saveSkins(list) {
  local.skins = sanitizeSkinList(list) || [];
  writeLocal();
}

export function resetSkins() {
  delete local.skins;
  writeLocal();
}

// -------------------------------------------------------------- heads ----
// Heads are built in; config.json / the admin menu can override each head's
// price and hide it: { heads: { shiba: { price: 0, hidden: false }, ... } }
function sanitizeHeadMap(m) {
  const out = {};
  if (!m || typeof m !== 'object') return out;
  for (const [id, v] of Object.entries(m)) {
    if (!HEAD_DEFS[id] || !v || typeof v !== 'object') continue;
    const o = {};
    if (v.price !== undefined && Number.isFinite(Number(v.price))) o.price = Math.max(0, Math.round(Number(v.price)));
    if (typeof v.hidden === 'boolean') o.hidden = v.hidden;
    out[id] = o;
  }
  return out;
}

export function getHeads() {
  const srv = sanitizeHeadMap(server.heads), loc = sanitizeHeadMap(local.heads);
  return Object.entries(HEAD_DEFS).map(([id, d]) => {
    const o = { id, name: d.name, price: d.price, hidden: false, ...srv[id], ...loc[id] };
    if (id === 'snake') { o.price = 0; o.hidden = false; }
    return o;
  });
}

export function saveHeads(list) {
  local.heads = sanitizeHeadMap(Object.fromEntries(list.map((h) => [h.id, { price: h.price, hidden: h.hidden }])));
  writeLocal();
}

export function resetHeads() {
  delete local.heads;
  writeLocal();
}

// ---------------------------------------------------------------- PIN ----
// Not real security (it's all client-side) — just enough to keep small
// fingers out of the grown-up menu.
function hashPin(pin) {
  let h = 0x811c9dc5;
  const s = 'snek-pin:' + pin;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function currentPinHash() {
  return local.pinHash || server.adminPinHash || hashPin(DEFAULT_PIN);
}

export function isDefaultPin() {
  return currentPinHash() === hashPin(DEFAULT_PIN);
}

export function checkPin(pin) {
  return hashPin(String(pin)) === currentPinHash();
}

export function setPin(pin) {
  local.pinHash = hashPin(String(pin));
  writeLocal();
}

// ------------------------------------------------------- import/export ----
export function exportConfig(includePin) {
  const out = {
    _about: 'Snek Arena config. Upload as config.json next to index.html to make these the defaults on every device.',
    settings: getSettings(),
    skins: getSkins(),
    heads: Object.fromEntries(getHeads().map((h) => [h.id, { price: h.price, hidden: h.hidden }])),
  };
  if (includePin) out.adminPinHash = currentPinHash();
  return JSON.stringify(out, null, 2);
}

export function importConfig(text) {
  const data = JSON.parse(text); // throws on bad JSON, caller shows the error
  if (!data || typeof data !== 'object') throw new Error('Not a config object');
  let changed = 0;
  if (data.settings) { saveSettings({ ...getSettings(), ...data.settings }); changed++; }
  if (Array.isArray(data.skins)) {
    const list = sanitizeSkinList(data.skins);
    if (!list) throw new Error('Skin list is empty');
    saveSkins(list);
    changed++;
  }
  if (data.heads && typeof data.heads === 'object') {
    local.heads = sanitizeHeadMap(data.heads);
    writeLocal();
    changed++;
  }
  if (typeof data.adminPinHash === 'string' && /^[0-9a-f]{8}$/.test(data.adminPinHash)) {
    local.pinHash = data.adminPinHash;
    writeLocal();
  }
  if (!changed) throw new Error('No "settings", "skins" or "heads" found in that file');
}
