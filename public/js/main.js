// App shell: screens, HUD, shop, adventure, missions, trophies, results.
import { loadConfig, getSettings, getSkins, getHeads } from './config.js';
import {
  progress, saveProgress, isUnlocked, ensureSelected, isHeadUnlocked, ensureHead, customSkin,
  itemState, ownItem, selectedItem, selectItem,
} from './storage.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { initAudio, sfx, setSound, setMusic, suspend } from './audio.js';
import { drawSnakePreview, POWERUPS } from './render.js';
import { BOOSTERS } from './boosters.js';
import { openPin } from './admin.js';
import { esc, rand, pick, TAU } from './util.js';
import { PATTERNS, EYES } from './skins.js';
import { HAT_ITEMS, TRAIL_ITEMS, THEME_ITEMS, MAKER_LEVEL, drawThemePreview, drawTrailPreview } from './cosmetics.js';
import { WORLDS, LEVELS, levelLabel, goalText, goalIcon, levelStars, totalAdventureStars, isLevelOpen, starsFor } from './adventure.js';
import {
  xpForLevel, addXp, dailyMissions, missionText, missionDef, missionReward, recordMissionStats, claimMission,
  missionsClaimable, TROPHIES, TROPHY_REWARDS, MEDALS, trophyState, claimTrophy, trophiesClaimable, matchXp,
} from './progression.js';

const $ = (s) => document.querySelector(s);
const SCREENS = ['home', 'ready', 'adventure', 'missions', 'trophies', 'shop', 'maker', 'help', 'settings', 'gift', 'pause', 'over', 'pin', 'admin'];
const POWER_ICONS = { ...Object.fromEntries(Object.entries(POWERUPS).map(([k, v]) => [k, [v.icon, v.color]])), turbo: ['🚀', '#ff9f1c'] };
const DIFF_ORDER = ['easy', 'normal', 'hard'];

let game, input;
let state = 'home';
let settingsReturn = 'home';
let wakeLock = null;
let installEvt = null;
let picked = new Set();
let shopTab = 'bodies';
let currentLevel = null; // adventure level being played (or null for quick play)

export function show(name) {
  state = name;
  for (const s of SCREENS) $('#screen-' + s).classList.toggle('hidden', s !== name);
  $('#hud').classList.toggle('hidden', !(name === 'play' || name === 'pause'));
  if (name === 'home') refreshHome();
  updateCoins();
}

function updateCoins() {
  for (const el of document.querySelectorAll('.coin-count')) el.textContent = progress.coins.toLocaleString();
}

function haptic(p) {
  if (!progress.haptics || !navigator.vibrate) return;
  try { navigator.vibrate(p); } catch { /* ignore */ }
}

function tap() { sfx.click(); haptic(8); }

function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

/** Body classes for layout preferences (boost side, extended UI). */
function applyPrefs() {
  document.body.classList.toggle('boost-left', progress.boostLeft);
  document.body.classList.toggle('ext-ui', progress.extendedUi);
  if (game) game.showRadar = progress.extendedUi;
}

/** The player's body skin with their chosen hat applied. */
function playerSkin() {
  const base = ensureSelected(getSkins());
  const hat = selectedItem('hat', HAT_ITEMS).id;
  return hat === 'auto' ? base : { ...base, hat };
}

function playerHead() {
  return ensureHead(getHeads()).id;
}

// ------------------------------------------------------------- home ----
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function giftReady() {
  return getSettings().dailyGift > 0 && progress.lastGift !== today();
}

function setBadge(id, n) {
  const el = $(id);
  el.textContent = n;
  el.classList.toggle('hidden', !n);
}

function refreshHome() {
  $('#home-level').textContent = progress.level;
  $('#home-xp').style.width = Math.min(100, (progress.xp / xpForLevel(progress.level)) * 100) + '%';
  $('#btn-install').classList.toggle('hidden', !installEvt);
  $('#btn-gift').classList.toggle('hidden', !giftReady());
  setBadge('#badge-missions', missionsClaimable());
  setBadge('#badge-trophies', trophiesClaimable());
  applyPrefs();
}

function previewLoop(ts) {
  requestAnimationFrame(previewLoop);
  const t = ts / 1000;
  let c = null, opts = null, skin = null;
  if (state === 'home') { c = $('#home-preview'); opts = { segments: 18, head: playerHead() }; skin = playerSkin(); }
  else if (state === 'maker') { c = $('#maker-preview'); opts = { segments: 16, head: playerHead() }; skin = makerSkin(); }
  if (!c) return;
  const w = c.clientWidth, h = c.clientHeight;
  if (!w) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  drawSnakePreview(g, skin, w, h, t, opts);
}

// ---------------------------------------------------------- settings ----
function openSettings(from) {
  settingsReturn = from;
  $('#name-input').value = progress.name;
  renderToggles();
  show('settings');
}

function renderToggles() {
  for (const b of document.querySelectorAll('.toggle')) b.classList.toggle('on', !!progress[b.dataset.pref]);
}

// -------------------------------------------------------------- gift ----
function openGift() {
  if (!giftReady()) return;
  tap();
  const box = $('#gift-box');
  box.classList.remove('opened');
  box.textContent = '🎁';
  box.disabled = false;
  $('#gift-msg').textContent = 'Tap the present!';
  $('#btn-gift-close').classList.add('hidden');
  show('gift');
}

function claimGift() {
  if (!giftReady()) return;
  const y = new Date(Date.now() - 864e5);
  const yesterday = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
  progress.giftStreak = progress.lastGift === yesterday ? progress.giftStreak + 1 : 1;
  progress.lastGift = today();
  const base = getSettings().dailyGift;
  const amount = base + Math.min(progress.giftStreak - 1, 6) * Math.round(base / 5);
  progress.coins += amount;
  saveProgress();
  const box = $('#gift-box');
  box.disabled = true;
  box.classList.add('opened');
  box.textContent = '🪙';
  $('#gift-msg').innerHTML = `<b class="big-coins">+${amount}</b> coins!` + (progress.giftStreak > 1 ? `<br>🔥 ${progress.giftStreak} days in a row!` : '<br>Come back tomorrow for more!');
  $('#btn-gift-close').classList.remove('hidden');
  updateCoins();
  sfx.gift();
  haptic([30, 50, 30]);
  confetti(90);
}

// ------------------------------------------------------------- shop ----
function openShop(tab) {
  if (tab) shopTab = tab;
  show('shop');
  renderShop();
}

/**
 * One shop card. `state` is 'owned' | 'buy' | 'level'.
 * Owned cards wear on tap; 'buy' asks for a second tap; 'level' explains the lock.
 */
function shopCard({ name, price, level = 1, state: st, selected, draw, onWear, onBuy, cls = '' }) {
  const card = document.createElement('button');
  card.className = `skin-card ${cls}` + (st === 'owned' ? '' : ' locked') + (st === 'level' ? ' level-lock' : '') + (selected ? ' selected' : '');
  const cv = document.createElement('canvas');
  const status = document.createElement('div');
  status.className = 'skin-status';
  const label = () => (selected ? '✅ Wearing' : st === 'owned' ? 'Tap to use' : st === 'level' ? `🔒 Level ${level}` : `🪙 ${price.toLocaleString()}`);
  status.textContent = label();
  card.innerHTML = `<div class="skin-name">${esc(name)}</div>${st === 'owned' ? '' : `<span class="lock">${st === 'level' ? '🆙' : '🔒'}</span>`}`;
  card.prepend(cv);
  card.append(status);
  requestAnimationFrame(() => {
    const w = cv.clientWidth || 140, h = cv.clientHeight || 90, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(g, w, h);
  });
  card.addEventListener('click', () => {
    initAudio();
    if (st === 'owned') { tap(); onWear(); return; }
    if (st === 'level') {
      sfx.error();
      haptic(40);
      status.textContent = `Reach level ${level}!`;
      shake(card);
      setTimeout(() => (status.textContent = label()), 1600);
      return;
    }
    if (progress.coins < price) {
      sfx.error();
      haptic(40);
      status.textContent = `Need 🪙 ${(price - progress.coins).toLocaleString()} more`;
      shake(card);
      setTimeout(() => (status.textContent = label()), 1600);
      return;
    }
    if (!card.dataset.confirm) {
      card.dataset.confirm = '1';
      status.textContent = 'Tap again to buy!';
      card.classList.add('confirm');
      tap();
      setTimeout(() => { delete card.dataset.confirm; card.classList.remove('confirm'); status.textContent = label(); }, 2500);
      return;
    }
    progress.coins -= price;
    sfx.win();
    haptic([20, 40, 20]);
    const r = card.getBoundingClientRect();
    confetti(60, r.left + r.width / 2, r.top + r.height / 2);
    onBuy();
    saveProgress();
    updateCoins();
  });
  return card;
}

function renderShop() {
  for (const b of document.querySelectorAll('.shop-tab')) b.classList.toggle('active', b.dataset.tab === shopTab);
  const grid = $('#shop-grid');
  grid.innerHTML = '';
  const head = playerHead();
  const skin = playerSkin();
  const add = (o) => grid.append(shopCard(o));

  if (shopTab === 'bodies') {
    // Snake Maker first
    const makerOpen = progress.level >= MAKER_LEVEL;
    const mk = document.createElement('button');
    mk.className = 'skin-card maker-tile' + (makerOpen ? '' : ' locked level-lock');
    mk.innerHTML = `<div class="maker-tile-ico">🎨</div><div class="skin-name">Snake Maker</div><div class="skin-status">${makerOpen ? (progress.customMade ? 'Edit my snake' : 'Design your own!') : `🔒 Level ${MAKER_LEVEL}`}</div>`;
    mk.addEventListener('click', () => {
      if (!makerOpen) { sfx.error(); shake(mk); return; }
      tap();
      openMaker();
    });
    grid.append(mk);
    const list = getSkins().filter((s) => !s.hidden);
    if (progress.customMade) list.unshift(customSkin());
    const sel = ensureSelected(getSkins());
    for (const s of list) {
      add({
        name: s.name, price: s.price, state: isUnlocked(s) ? 'owned' : 'buy', selected: s.id === sel.id,
        draw: (g, w, h) => drawSnakePreview(g, s, w, h, 0.6, { segments: 12, head }),
        onWear: () => { progress.selected = s.id; saveProgress(); renderShop(); },
        onBuy: () => { progress.unlocked.push(s.id); progress.selected = s.id; renderShop(); },
      });
    }
  } else if (shopTab === 'heads') {
    const sel = playerHead();
    for (const h of getHeads().filter((x) => !x.hidden)) {
      add({
        name: h.name, price: h.price, state: isHeadUnlocked(h) ? 'owned' : 'buy', selected: h.id === sel, cls: 'head-card',
        draw: (g, w, hh) => drawSnakePreview(g, skin, w, hh, 0.6, { head: h.id, portrait: true }),
        onWear: () => { progress.selectedHead = h.id; saveProgress(); renderShop(); },
        onBuy: () => { progress.unlockedHeads.push(h.id); progress.selectedHead = h.id; renderShop(); },
      });
    }
  } else {
    const kind = { hats: 'hat', trails: 'trail', arenas: 'theme' }[shopTab];
    const items = { hat: HAT_ITEMS, trail: TRAIL_ITEMS, theme: THEME_ITEMS }[kind];
    const sel = selectedItem(kind, items).id;
    const base = ensureSelected(getSkins());
    for (const it of items) {
      const draw = kind === 'hat'
        ? (g, w, h) => drawSnakePreview(g, base, w, h, 0.6, { head, portrait: true, hat: it.id === 'auto' ? base.hat : it.id })
        : kind === 'trail'
          ? (g, w, h) => drawTrailPreview(g, it.id, w, h)
          : (g, w, h) => drawThemePreview(g, it.id, w, h);
      add({
        name: it.name, price: it.price, level: it.level, state: itemState(kind, it), selected: it.id === sel, cls: kind + '-card',
        draw,
        onWear: () => { selectItem(kind, it.id); renderShop(); },
        onBuy: () => { ownItem(kind, it.id); selectItem(kind, it.id); renderShop(); },
      });
    }
  }
  updateCoins();
}

// -------------------------------------------------------- snake maker ----
const PALETTE = [
  '#ff4f6d', '#ff7eb6', '#ff9ff3', '#b388ff', '#7b2ff7', '#3a0ca3', '#4cc9f0', '#1e90ff',
  '#00e5ff', '#00f5d4', '#3ddc97', '#5be37d', '#2fbf5b', '#c6ff00', '#ffe14d', '#ffd60a',
  '#ff9f1c', '#ff7b00', '#e8122a', '#8a5532', '#ffffff', '#c7d4ff', '#9aa5b1', '#2b2b2b',
];
const MAKER_PATTERNS = ['stripes', 'solid', 'gradient', 'cycle', 'spots', 'rainbow'];
let draft = null;
let draftSlot = 0;

function makerSkin() {
  return draft ? { id: 'draft', name: 'Draft', colors: draft.colors, pattern: draft.pattern, stripe: 2, eyes: draft.eyes, hat: 'none', price: 0 } : customSkin();
}

function openMaker() {
  draft = JSON.parse(JSON.stringify(progress.custom));
  draftSlot = 0;
  renderMaker();
  show('maker');
}

function renderMaker() {
  const slots = $('#maker-slots');
  slots.innerHTML = draft.colors.map((c, i) => `<button class="slot ${i === draftSlot ? 'on' : ''}" data-i="${i}" style="background:${c}" aria-label="Colour ${i + 1}"></button>`).join('') +
    (draft.colors.length < 3 ? '<button class="slot add" data-add="1" aria-label="Add a colour">+</button>' : '') +
    (draft.colors.length > 1 ? '<button class="slot rm" data-rm="1" aria-label="Remove a colour">−</button>' : '');
  slots.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => { draftSlot = +b.dataset.i; tap(); renderMaker(); }));
  slots.querySelector('[data-add]')?.addEventListener('click', () => { draft.colors.push(pick(PALETTE)); draftSlot = draft.colors.length - 1; tap(); renderMaker(); });
  slots.querySelector('[data-rm]')?.addEventListener('click', () => { draft.colors.splice(draftSlot, 1); draftSlot = Math.max(0, draftSlot - 1); tap(); renderMaker(); });
  const pal = $('#maker-palette');
  if (!pal.children.length) {
    pal.innerHTML = PALETTE.map((c) => `<button class="swatch" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');
    pal.querySelectorAll('.swatch').forEach((b) => b.addEventListener('click', () => { draft.colors[draftSlot] = b.dataset.c; tap(); renderMaker(); }));
  }
  $('#maker-patterns').innerHTML = MAKER_PATTERNS.map((p) => `<button class="chip ${draft.pattern === p ? 'on' : ''}" data-p="${p}">${esc(PATTERNS[p].split(' (')[0])}</button>`).join('');
  $('#maker-patterns').querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => { draft.pattern = b.dataset.p; tap(); renderMaker(); }));
  $('#maker-eyes').innerHTML = Object.entries(EYES).map(([k, v]) => `<button class="chip ${draft.eyes === k ? 'on' : ''}" data-e="${k}">${esc(v)}</button>`).join('');
  $('#maker-eyes').querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => { draft.eyes = b.dataset.e; tap(); renderMaker(); }));
}

function saveMaker() {
  progress.custom = draft;
  progress.customMade = true;
  progress.selected = 'custom';
  saveProgress();
  draft = null;
  sfx.win();
  confetti(80);
  openShop('bodies');
}

// ---------------------------------------------------------- adventure ----
function openAdventure() {
  tap();
  renderAdventure();
  show('adventure');
}

function renderAdventure() {
  $('#adv-stars').textContent = `${totalAdventureStars()}/${LEVELS.length * 3}`;
  const map = $('#adv-map');
  map.innerHTML = '';
  WORLDS.forEach((w, wi) => {
    const levels = LEVELS.filter((l) => l.worldIndex === wi);
    const got = levels.reduce((a, l) => a + levelStars(l.index), 0);
    const sec = document.createElement('section');
    sec.className = `world world-${w.id}`;
    sec.innerHTML = `<header><span class="w-ico">${w.icon}</span><b>World ${wi + 1}: ${esc(w.name)}</b><span class="w-stars">⭐ ${got}/${levels.length * 3}</span></header><div class="level-grid"></div>`;
    const grid = sec.querySelector('.level-grid');
    for (const lv of levels) {
      const open = isLevelOpen(lv.index);
      const st = levelStars(lv.index);
      const b = document.createElement('button');
      b.className = 'level-node' + (open ? '' : ' locked') + (lv.boss ? ' boss' : '') + (st ? ' done' : '');
      b.innerHTML = `<span class="ln-num">${lv.boss ? '💀' : levelLabel(lv)}</span><span class="ln-goal">${open ? goalIcon(lv) : '🔒'}</span><span class="ln-stars">${[0, 1, 2].map((i) => `<i class="${i < st ? 'on' : ''}">★</i>`).join('')}</span>`;
      b.addEventListener('click', () => {
        if (!open) { sfx.error(); haptic(30); shake(b); return; }
        currentLevel = lv;
        openReady();
      });
      grid.append(b);
    }
    map.append(sec);
  });
  // scroll to the newest open level
  requestAnimationFrame(() => {
    const nodes = [...map.querySelectorAll('.level-node:not(.locked)')];
    nodes[nodes.length - 1]?.scrollIntoView({ block: 'center' });
  });
}

// --------------------------------------------------- missions/trophies ----
function openMissions() {
  tap();
  renderMissions();
  show('missions');
}

function renderMissions() {
  const list = dailyMissions();
  const now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const mins = Math.max(1, Math.round((mid - now) / 60000));
  $('#missions-reset').textContent = `New missions in ${Math.floor(mins / 60)}h ${mins % 60}m`;
  const box = $('#missions-list');
  box.innerHTML = list.map((m, i) => {
    const d = missionDef(m), r = missionReward(m), done = m.progress >= m.target;
    return `<div class="mission ${m.claimed ? 'claimed' : done ? 'ready' : ''}">
      <span class="m-ico">${d.icon}</span>
      <div class="m-body"><b>${esc(missionText(m))}</b>
        <span class="m-bar"><i style="width:${(m.progress / m.target) * 100}%"></i></span>
        <small>${m.progress} / ${m.target} · reward 🪙 ${r.coins} + ${r.xp} XP</small></div>
      ${m.claimed ? '<span class="m-done">✅</span>' : `<button class="btn btn-small ${done ? 'btn-green' : 'btn-ghost'}" data-i="${i}" ${done ? '' : 'disabled'}>${done ? 'Claim' : '…'}</button>`}
    </div>`;
  }).join('');
  box.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => {
    const r = claimMission(+b.dataset.i);
    if (!r) return;
    sfx.coin(); sfx.win(); haptic([20, 30, 20]);
    const rect = b.getBoundingClientRect();
    confetti(50, rect.left + rect.width / 2, rect.top);
    updateCoins();
    renderMissions();
  }));
}

function openTrophies() {
  tap();
  renderTrophies();
  show('trophies');
}

function renderTrophies() {
  const stats = [
    ['🆙', 'Level', progress.level], ['🎮', 'Matches', progress.games], ['🐍', 'Best size', progress.best],
    ['😋', 'Eaten', progress.kills], ['⭐', 'Stars', progress.totalStars], ['👑', 'Wins', progress.wins],
  ];
  $('#stats-strip').innerHTML = stats.map(([i, k, v]) => `<div><span>${i}</span><b>${v.toLocaleString()}</b><small>${k}</small></div>`).join('');
  const box = $('#trophy-list');
  box.innerHTML = TROPHIES.map((t) => {
    const s = trophyState(t);
    const canClaim = s.reached > s.claimed;
    const target = t.tiers[Math.min(s.claimed, 2)];
    const pct = s.claimed >= 3 ? 100 : Math.min(100, (s.value / target) * 100);
    return `<div class="trophy ${canClaim ? 'ready' : ''}">
      <span class="t-ico">${t.icon}</span>
      <div class="t-body"><b>${esc(t.name)}</b>
        <span class="t-medals">${MEDALS.map((m, i) => `<i class="${i < s.claimed ? 'on' : ''}">${m}</i>`).join('')}</span>
        <span class="m-bar"><i style="width:${pct}%"></i></span>
        <small>${esc(t.desc)}: ${s.value.toLocaleString()}${s.claimed >= 3 ? ' · all done!' : ` / ${target.toLocaleString()}`}</small></div>
      ${canClaim ? `<button class="btn btn-small btn-green" data-id="${t.id}">🪙 ${TROPHY_REWARDS[s.claimed]}</button>` : ''}
    </div>`;
  }).join('');
  box.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => {
    const r = claimTrophy(b.dataset.id);
    if (!r) return;
    sfx.win(); haptic([20, 30, 20]);
    const rect = b.getBoundingClientRect();
    confetti(60, rect.left + rect.width / 2, rect.top);
    updateCoins();
    renderTrophies();
  }));
}

// ---------------------------------------------------------- boosters ----
function openReady() {
  initAudio();
  tap();
  const S = getSettings();
  $('#ready-title').textContent = currentLevel ? `Level ${levelLabel(currentLevel)}` : 'Boosters';
  $('#ready-goal').classList.toggle('hidden', !currentLevel);
  if (currentLevel) {
    const st = levelStars(currentLevel.index);
    $('#ready-goal').innerHTML = `<span class="rg-ico">${goalIcon(currentLevel)}</span><div><b>${esc(goalText(currentLevel))}</b><small>${currentLevel.world.icon} ${esc(currentLevel.world.name)} · ⏱ ${Math.round(currentLevel.world.seconds / 60 * 10) / 10} min · best ${'★'.repeat(st)}${'☆'.repeat(3 - st)}</small></div>`;
  }
  if (!S.boostersEnabled) {
    $('#booster-grid').innerHTML = '';
    $('#screen-ready .muted').classList.add('hidden');
    picked = new Set();
    renderBoosters();
    show('ready');
    return;
  }
  $('#screen-ready .muted').classList.remove('hidden');
  picked = new Set([...picked].filter((k) => S.boosterPrices[k] <= progress.coins && !(k === 'life' && S.gentle)));
  renderBoosters();
  show('ready');
}

function boosterCost() {
  const P = getSettings().boosterPrices;
  return [...picked].reduce((a, k) => a + P[k], 0);
}

function renderBoosters() {
  const S = getSettings();
  const P = S.boosterPrices;
  const grid = $('#booster-grid');
  if (S.boostersEnabled) {
    // Extra Life is pointless when you can't be eaten anyway
    const list = Object.entries(BOOSTERS).filter(([k]) => !(k === 'life' && S.gentle));
    grid.innerHTML = list.map(([k, b]) => `
      <button class="booster ${picked.has(k) ? 'on' : ''}" data-k="${k}">
        <span class="b-ico">${b.icon}</span>
        <b>${b.name}</b>
        <small>${b.desc}</small>
        <span class="b-price">${P[k] ? '🪙 ' + P[k] : 'FREE'}</span>
        <span class="b-check">✓</span>
      </button>`).join('');
    grid.querySelectorAll('.booster').forEach((el) => el.addEventListener('click', () => {
      const k = el.dataset.k;
      if (picked.has(k)) {
        picked.delete(k);
        tap();
      } else if (boosterCost() + P[k] > progress.coins) {
        sfx.error();
        haptic(40);
        shake(el);
        el.querySelector('.b-price').textContent = 'Not enough!';
        setTimeout(() => { el.querySelector('.b-price').textContent = P[k] ? '🪙 ' + P[k] : 'FREE'; }, 1300);
        return;
      } else {
        picked.add(k);
        sfx.power();
        haptic(15);
      }
      renderBoosters();
    }));
  }
  const cost = boosterCost();
  $('#btn-go').innerHTML = cost ? `GO! <small>−🪙 ${cost}</small>` : 'GO!';
  for (const el of document.querySelectorAll('#screen-ready .coin-count')) el.textContent = (progress.coins - cost).toLocaleString();
}

// ------------------------------------------------------------- play ----
function visibleHeads() {
  return getHeads().filter((h) => !h.hidden).map((h) => h.id);
}

function startDemo() {
  input.enabled = false;
  currentLevel = null;
  game.setup('demo', {
    settings: { ...getSettings(), arenaSize: 'small', showNames: true }, skins: getSkins(), heads: visibleHeads(),
    theme: selectedItem('theme', THEME_ITEMS).id,
  });
}

/** Settings for this match: adventure levels set their own arena, bots and timer. */
function matchSettings() {
  const S = getSettings();
  if (!currentLevel) return S;
  const w = currentLevel.world;
  // use whichever difficulty is easier: the level's or the grown-up setting
  const diff = DIFF_ORDER[Math.min(DIFF_ORDER.indexOf(w.difficulty), DIFF_ORDER.indexOf(S.difficulty))];
  return { ...S, botCount: w.bots, arenaSize: w.arena, matchSeconds: w.seconds, difficulty: diff };
}

async function startGame(boosters) {
  initAudio();
  const skins = getSkins();
  const settings = matchSettings();
  const P = settings.boosterPrices;
  const list = settings.boostersEnabled ? boosters.filter((k) => BOOSTERS[k]) : [];
  const cost = list.reduce((a, k) => a + P[k], 0);
  if (cost > progress.coins) return;
  progress.coins -= cost;
  saveProgress();
  game.setup('play', {
    settings, skins, skin: playerSkin(), name: progress.name.trim() || 'You', boosters: list,
    head: playerHead(), heads: visibleHeads(),
    theme: currentLevel ? currentLevel.world.theme : selectedItem('theme', THEME_ITEMS).id,
    trail: selectedItem('trail', TRAIL_ITEMS).id,
    level: currentLevel,
  });
  input.reset();
  input.enabled = true;
  $('#btn-boost').classList.toggle('hidden', !settings.boostEnabled);
  $('#hud-timer').classList.toggle('hidden', settings.matchSeconds <= 0);
  $('#hud-goal').classList.toggle('hidden', !currentLevel);
  $('#toasts').innerHTML = '';
  applyPrefs();
  show('play');
  goFullscreen();
  if (progress.tipsShown < 3) {
    progress.tipsShown++;
    saveProgress();
    const touch = matchMedia('(pointer: coarse)').matches;
    setTimeout(() => toast(touch ? '👆 Drag anywhere to steer' : '🖱️ Point the mouse to steer', 3000), 3600);
    setTimeout(() => toast('🟢 Green badge: you can eat it!', 3000), 6800);
    setTimeout(() => toast('🔴 Red badge: bigger — run away!', 3000), 10000);
  }
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
}

/** On Android browsers (not installed), go fullscreen for a proper game feel. */
function goFullscreen() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone || !matchMedia('(pointer: coarse)').matches || fsElement()) return;
  enterFullscreen();
}

// --------------------------------------------------------- fullscreen ----
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;

/** Fullscreen works on desktops, Android and iPads — not iPhones or the installed app. */
function canFullscreen() {
  const el = document.documentElement;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return !standalone && !!(el.requestFullscreen || el.webkitRequestFullscreen) && (document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? true);
}

function enterFullscreen() {
  const el = document.documentElement;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen();
    p?.catch?.(() => {});
  } catch { /* ignore */ }
}

function toggleFullscreen() {
  tap();
  if (fsElement()) {
    try { (document.exitFullscreen || document.webkitExitFullscreen).call(document)?.catch?.(() => {}); } catch { /* ignore */ }
  } else enterFullscreen();
}

const FS_ENTER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>';
const FS_EXIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg>';

function updateFullscreenButton() {
  const b = $('#btn-fullscreen');
  b.innerHTML = fsElement() ? FS_EXIT : FS_ENTER;
  b.classList.toggle('hidden', !canFullscreen());
  b.classList.toggle('on', !!fsElement());
  b.setAttribute('aria-label', fsElement() ? 'Exit full screen' : 'Full screen');
}

function pauseGame() {
  if (state !== 'play' || game.over) return;
  game.paused = true;
  input.reset();
  tap();
  $('#pause-goal').classList.toggle('hidden', !currentLevel);
  if (currentLevel) $('#pause-goal').textContent = `🎯 ${goalText(currentLevel)}`;
  show('pause');
}

function resumeGame() {
  tap();
  game.paused = false;
  show('play');
}

function quitGame() {
  game.paused = false;
  show('play');
  game.endMatch('quit');
}

let lastLen = 0;
function onHud(d) {
  if (state !== 'play' && state !== 'pause') return;
  const len = $('#hud-len');
  if (d.length !== lastLen) {
    len.textContent = d.length;
    if (d.length > lastLen) { len.parentElement.classList.remove('bump'); void len.offsetWidth; len.parentElement.classList.add('bump'); }
    lastLen = d.length;
  }
  $('#hud-rank').textContent = `#${d.rank}`;
  $('#hud-kills').textContent = d.kills;
  $('#hud-lives').classList.toggle('hidden', !d.lives);
  if (d.timeLeft !== Infinity) {
    const s = Math.ceil(d.timeLeft);
    $('#hud-timer').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    $('#hud-timer').classList.toggle('urgent', s <= 10);
  }
  if (progress.extendedUi) {
    $('#hud-board').innerHTML = d.top
      .map((s, i) => `<li class="${s.me ? 'me' : ''}"><span class="dot" style="background:${s.color}"></span><span class="n">${i === 0 ? '👑' : i + 1 + '.'} ${esc(s.name)}</span><b>${s.length}</b></li>`)
      .join('') + (d.top.some((s) => s.me) || d.rank > d.total ? '' : `<li class="me"><span class="dot"></span><span class="n">${d.rank}. You</span><b>${d.length}</b></li>`);
  }
  const pw = d.powers.filter((p) => POWER_ICONS[p.type]).map((p) => {
    const [icon, color] = POWER_ICONS[p.type];
    return `<span class="pw" style="--c:${color}">${icon}<small>${Math.ceil(p.left)}</small></span>`;
  });
  if (d.ghost > 0 && d.ghost < 100) pw.unshift(`<span class="pw" style="--c:#8ecbff">🫧<small>${Math.ceil(d.ghost)}</small></span>`);
  $('#hud-powers').innerHTML = pw.join('');
  if (d.goal && currentLevel) {
    const G = d.goal;
    let text, frac;
    if (G.type === 'top') { text = G.value ? "You're #1 — stay there!" : 'Become the biggest snake'; frac = G.value ? 1 : 0; }
    else if (G.type === 'boss') { text = G.done ? 'Boss beaten!' : `Beat ${currentLevel.boss.name} (size ${G.bossSize})`; frac = G.done ? 1 : Math.min(0.95, d.length / Math.max(1, G.bossSize)); }
    else { text = `${goalText(currentLevel)}: ${Math.min(G.value, G.target)} / ${G.target}`; frac = G.value / G.target; }
    $('#hud-goal .g-ico').textContent = goalIcon(currentLevel);
    $('#hud-goal .g-text').textContent = text;
    $('#hud-goal .g-bar i').style.width = Math.min(100, frac * 100) + '%';
    $('#hud-goal').classList.toggle('done', !!G.done || (G.type === 'top' && !!G.value));
  }
}

function toast(msg, ms = 2200) {
  if (state !== 'play') return;
  const box = $('#toasts');
  while (box.children.length > 1) box.firstChild.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  box.append(el);
  setTimeout(() => el.classList.add('out'), ms - 300);
  setTimeout(() => el.remove(), ms);
}

// ------------------------------------------------------------ results ----
function onEnd(r) {
  input.enabled = false;
  input.reset();
  try { wakeLock?.release(); } catch { /* ignore */ }
  wakeLock = null;
  const S = getSettings();
  const lv = r.level;
  const won = r.reason === 'time' && r.rank === 1;

  // coins
  const parts = [
    ['Size', Math.floor(r.maxLength / 4)],
    ['Snakes eaten', r.kills * 8],
  ];
  if (r.bestStreak >= 2) parts.push([`Best combo ×${r.bestStreak}`, r.bestStreak * 5]);
  if (!lv && r.reason === 'time') parts.push([`Finished #${r.rank}`, [50, 30, 20][r.rank - 1] ?? 5]);

  let stars = 0, newStars = 0, prevStars = 0;
  if (lv) {
    stars = starsFor(lv, r);
    prevStars = levelStars(lv.index);
    newStars = Math.max(0, stars - prevStars);
    if (stars > prevStars) progress.adv[lv.index] = stars;
    if (stars && !prevStars) parts.push(['First clear!', 25 + lv.worldIndex * 15 + (lv.boss ? 50 : 0)]);
    if (newStars) parts.push([`New stars ×${newStars}`, newStars * 15]);
  }
  let coins = parts.reduce((a, [, v]) => a + v, 0) * S.coinMultiplier;
  if (r.coinRush) coins *= 2;
  coins = Math.round(coins);

  // lifetime stats
  const newBest = r.maxLength > progress.best;
  progress.coins += coins;
  progress.games++;
  progress.kills += r.kills;
  progress.totalStars += r.starsEaten || 0;
  progress.totalPowerups += r.powerups || 0;
  if (won) progress.wins++;
  progress.bestStreak = Math.max(progress.bestStreak || 0, r.bestStreak);
  if (newBest) progress.best = r.maxLength;
  saveProgress();

  // missions + XP
  const levelBefore = progress.level;
  recordMissionStats({ kills: r.kills, maxSize: r.maxLength, stars: r.starsEaten || 0, games: 1, powerups: r.powerups || 0, streak: r.bestStreak, wins: won ? 1 : 0, advStars: newStars });
  const xp = matchXp(r, newStars) + (lv && stars ? 30 : 0);
  const levels = addXp(xp);

  // headline
  let title, sub;
  if (lv) {
    title = stars ? (lv.boss ? '💀 Boss beaten!' : 'Level complete!') : 'So close!';
    sub = stars ? esc(goalText(lv)) : `${esc(goalText(lv))} — try again!`;
  } else if (r.reason === 'eaten') {
    title = r.killer ? 'Chomped!' : 'Oh no!';
    sub = r.killer ? `${esc(r.killer)} was bigger this time` : 'Better luck next time';
    stars = Math.max(1, r.maxLength >= 100 || r.kills >= 3 ? 2 : 1);
  } else if (r.reason === 'time') {
    title = r.rank === 1 ? '👑 You WON! 👑' : r.rank <= 3 ? `#${r.rank} — Awesome!` : "Time's up!";
    sub = r.rank === 1 ? 'Biggest snake in the arena!' : `You finished #${r.rank} of ${r.total}`;
    stars = r.rank === 1 ? 3 : r.rank <= 3 ? 2 : 1;
  } else {
    title = 'Game over';
    sub = 'See you next time!';
    stars = 1;
  }
  $('#over-title').innerHTML = title;
  $('#over-sub').innerHTML = sub;
  $('#over-stats').innerHTML = `
    <div><b>${r.maxLength}</b><span>biggest</span></div>
    <div><b>${r.kills}</b><span>eaten</span></div>
    <div><b>${lv ? (r.starsEaten || 0) : '#' + r.rank}</b><span>${lv ? 'stars grabbed' : 'rank'}</span></div>`;
  $('#over-breakdown').innerHTML = parts.map(([k, v]) => `<li><span>${k}</span><b>+${v}</b></li>`).join('') +
    (S.coinMultiplier !== 1 ? `<li><span>Bonus</span><b>×${S.coinMultiplier}</b></li>` : '') +
    (r.coinRush ? '<li><span>💰 Coin Rush</span><b>×2</b></li>' : '');
  $('#over-best').classList.toggle('hidden', !newBest);

  // XP bar + level up
  $('#over-xp').textContent = `+${xp} XP`;
  $('#over-level').textContent = levels.length ? levelBefore : progress.level;
  const bar = $('#over-xp-bar');
  bar.style.transition = 'none';
  bar.style.width = levels.length ? '0%' : Math.max(0, ((progress.xp - xp) / xpForLevel(progress.level)) * 100) + '%';
  setTimeout(() => {
    bar.style.transition = '';
    bar.style.width = (levels.length ? 100 : (progress.xp / xpForLevel(progress.level)) * 100) + '%';
  }, 400);
  const lu = $('#over-levelup');
  lu.classList.toggle('hidden', !levels.length);
  if (levels.length) {
    const top = levels[levels.length - 1];
    const unlocks = levels.flatMap((l) => l.unlocks);
    const bonus = levels.reduce((a, l) => a + l.coins, 0);
    lu.innerHTML = `<b>🎉 LEVEL UP! You're level ${top.level}</b><span>+🪙 ${bonus}${unlocks.length ? ' · Unlocked: ' + unlocks.map(esc).join(', ') : ''}</span>`;
    setTimeout(() => { $('#over-level').textContent = progress.level; bar.style.transition = 'none'; bar.style.width = (progress.xp / xpForLevel(progress.level)) * 100 + '%'; sfx.levelup(); confetti(120); }, 1400);
  }

  // today's missions
  $('#over-missions').innerHTML = dailyMissions().map((m) => {
    const done = m.progress >= m.target;
    return `<span class="om ${done ? 'done' : ''}">${missionDef(m).icon} ${Math.min(m.progress, m.target)}/${m.target}${done ? ' ✅' : ''}</span>`;
  }).join('');

  // buttons
  const next = lv && stars ? LEVELS[lv.index + 1] : null;
  $('#btn-again').innerHTML = lv ? (next ? '▶ Next level' : stars ? '🔁 Play again' : '🔁 Try again') : '▶ Play again';
  $('#btn-again').dataset.next = next ? String(next.index) : '';
  $('#btn-over-map').classList.toggle('hidden', !lv);
  $('#btn-over-skins').classList.toggle('hidden', !!lv);

  const starEls = [...document.querySelectorAll('#over-stars span')];
  starEls.forEach((el) => el.classList.remove('on'));
  show('over');
  starEls.forEach((el, i) => {
    if (i < stars) setTimeout(() => { el.classList.add('on'); sfx.coin(); haptic(15); }, 350 + i * 300);
  });
  if (stars === 3 || newBest || (lv && lv.boss && stars)) setTimeout(() => confetti(140), 300);
  // count-up animation
  const el = $('#over-coins');
  const t0 = performance.now() + 300, dur = Math.min(1500, 300 + coins * 15);
  let last = 0;
  const tick = (now) => {
    const f = Math.max(0, Math.min(1, (now - t0) / dur));
    el.textContent = Math.round(coins * f);
    if (f > 0 && f < 1 && now - last > 80) { sfx.coin(); last = now; }
    if (f < 1 && state === 'over') requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function playAgain() {
  const next = $('#btn-again').dataset.next;
  if (next) currentLevel = LEVELS[+next];
  openReady();
}

// --------------------------------------------------------- confetti ----
let confettiBits = [];
let confettiRunning = false;
function confetti(n = 100, x, y) {
  const c = $('#confetti');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  const cols = ['#ff4f6d', '#ffd23f', '#3ddc97', '#4cc9f0', '#b388ff', '#ff9f1c', '#ffffff'];
  const ox = x ?? innerWidth / 2, oy = y ?? innerHeight * 0.35;
  for (let i = 0; i < n; i++) {
    const a = rand(TAU), sp = rand(200, 700);
    confettiBits.push({ x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 300, r: rand(TAU), vr: rand(-10, 10), w: rand(6, 12), h: rand(4, 8), c: pick(cols), life: rand(1.6, 2.6) });
  }
  if (confettiRunning) return;
  confettiRunning = true;
  let last = performance.now();
  const g = c.getContext('2d');
  const step = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of confettiBits) {
      b.vy += 900 * dt; b.vx *= 0.99; b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt; b.life -= dt;
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.r);
      g.globalAlpha = Math.min(1, b.life);
      g.fillStyle = b.c;
      g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.r * 2)));
      g.restore();
    }
    confettiBits = confettiBits.filter((b) => b.life > 0 && b.y < innerHeight + 40);
    if (confettiBits.length) requestAnimationFrame(step);
    else { confettiRunning = false; g.clearRect(0, 0, innerWidth, innerHeight); }
  };
  requestAnimationFrame(step);
}

// ------------------------------------------------------------- boot ----
async function boot() {
  await loadConfig();
  ensureSelected(getSkins());
  setSound(progress.sound);
  setMusic(progress.music);
  game = new Game($('#game'), { onHud, onEnd, toast, haptic, goalText });
  input = new Input($('#game'));
  game.input = input;
  window.snek = { game }; // handy for debugging from the console
  startDemo();
  show('home');
  requestAnimationFrame(previewLoop);

  // the first touch unlocks audio on mobile
  const unlock = () => initAudio();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('touchend', unlock, { once: true });
  // no pinch-zoom / double-tap zoom on iOS
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  const on = (id, fn) => $(id).addEventListener('click', fn);
  const home = () => { tap(); show('home'); };
  on('#btn-play', () => { currentLevel = null; openReady(); });
  on('#btn-adventure', openAdventure);
  on('#btn-go', () => startGame([...picked]));
  on('#btn-ready-back', () => { tap(); if (currentLevel) { renderAdventure(); show('adventure'); } else show('home'); });
  on('#btn-adv-back', home);
  on('#btn-skins', () => { tap(); openShop(); });
  on('#btn-missions', openMissions);
  on('#btn-missions-close', home);
  on('#btn-trophies', openTrophies);
  on('#btn-level', openTrophies);
  on('#btn-trophies-back', home);
  on('#btn-help', () => { tap(); show('help'); });
  on('#btn-help-close', home);
  on('#btn-shop-back', home);
  on('#btn-maker-cancel', () => { tap(); draft = null; openShop('bodies'); });
  on('#btn-maker-save', saveMaker);
  for (const b of document.querySelectorAll('.shop-tab')) b.addEventListener('click', () => { tap(); shopTab = b.dataset.tab; renderShop(); $('#shop-grid').scrollTop = 0; });
  on('#btn-pause', pauseGame);
  on('#btn-resume', resumeGame);
  on('#btn-quit', () => { tap(); quitGame(); });
  on('#btn-again', playAgain);
  on('#btn-home', () => { tap(); startDemo(); show('home'); });
  on('#btn-over-skins', () => { tap(); startDemo(); openShop(); });
  on('#btn-over-map', () => { tap(); startDemo(); renderAdventure(); show('adventure'); });
  on('#btn-settings', () => { tap(); openSettings('home'); });
  on('#btn-pause-settings', () => { tap(); openSettings('pause'); });
  on('#btn-settings-close', () => { tap(); show(settingsReturn); });
  on('#btn-gift', openGift);
  on('#gift-box', claimGift);
  on('#btn-gift-close', home);
  for (const b of document.querySelectorAll('.toggle')) {
    b.addEventListener('click', () => {
      initAudio();
      const k = b.dataset.pref;
      progress[k] = !progress[k];
      saveProgress();
      setSound(progress.sound);
      setMusic(progress.music);
      applyPrefs();
      renderToggles();
      tap();
    });
  }
  $('#name-input').addEventListener('input', (e) => {
    progress.name = e.target.value.slice(0, 14);
    saveProgress();
  });
  $('#name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
  const adminDone = () => { startDemo(); show('home'); };
  on('#btn-admin', () => openPin({ show, onClose: adminDone }));
  if (location.hash === '#admin') openPin({ show, onClose: adminDone });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pauseGame(); suspend(true); } else suspend(false);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'p') {
      if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame();
    }
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvt = e;
    if (state === 'home') refreshHome();
  });
  on('#btn-fullscreen', toggleFullscreen);
  document.addEventListener('fullscreenchange', updateFullscreenButton);
  document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
  updateFullscreenButton();
  on('#btn-install', async () => {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice.catch(() => null);
    installEvt = null;
    refreshHome();
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  navigator.storage?.persist?.().catch(() => {});
}

boot();

