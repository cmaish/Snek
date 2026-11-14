// App shell: screens, HUD, shop, boosters, results, and wiring everything together.
import { loadConfig, getSettings, getSkins, getHeads } from './config.js';
import { progress, saveProgress, isUnlocked, ensureSelected, isHeadUnlocked, ensureHead } from './storage.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { initAudio, sfx, setSound, setMusic, suspend } from './audio.js';
import { drawSnakePreview, POWERUPS } from './render.js';
import { BOOSTERS } from './boosters.js';
import { openPin } from './admin.js';
import { esc, rand, pick, TAU } from './util.js';

const $ = (s) => document.querySelector(s);
const SCREENS = ['home', 'ready', 'shop', 'help', 'settings', 'gift', 'pause', 'over', 'pin', 'admin'];
const POWER_ICONS = { ...Object.fromEntries(Object.entries(POWERUPS).map(([k, v]) => [k, [v.icon, v.color]])), turbo: ['🚀', '#ff9f1c'] };

let game, input;
let state = 'home';
let settingsReturn = 'home';
let wakeLock = null;
let installEvt = null;
let picked = new Set();
let shopTab = 'bodies';

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

/** Body classes for layout preferences (boost side, extended UI). */
function applyPrefs() {
  document.body.classList.toggle('boost-left', progress.boostLeft);
  document.body.classList.toggle('ext-ui', progress.extendedUi);
  if (game) game.showRadar = progress.extendedUi;
}

// ------------------------------------------------------------- home ----
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function giftReady() {
  return getSettings().dailyGift > 0 && progress.lastGift !== today();
}

function refreshHome() {
  $('#best-score').textContent = progress.best;
  $('#name-input').value = progress.name;
  $('#btn-install').classList.toggle('hidden', !installEvt);
  $('#btn-gift').classList.toggle('hidden', !giftReady());
  applyPrefs();
}

function previewLoop(ts) {
  requestAnimationFrame(previewLoop);
  const t = ts / 1000;
  if (state !== 'home') return;
  const c = $('#home-preview');
  const w = c.clientWidth, h = c.clientHeight;
  if (!w) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  drawSnakePreview(g, ensureSelected(getSkins()), w, h, t, { segments: 18, head: ensureHead(getHeads()).id });
}

// ---------------------------------------------------------- settings ----
function openSettings(from) {
  settingsReturn = from;
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
function openShop() {
  show('shop');
  renderShop();
}

function renderShop() {
  for (const b of document.querySelectorAll('.shop-tab')) b.classList.toggle('active', b.dataset.tab === shopTab);
  if (shopTab === 'heads') return renderHeadShop();
  const grid = $('#shop-grid');
  grid.innerHTML = '';
  const skins = getSkins().filter((s) => !s.hidden);
  const sel = ensureSelected(getSkins());
  for (const skin of skins) {
    const owned = isUnlocked(skin);
    const card = document.createElement('button');
    card.className = 'skin-card' + (owned ? '' : ' locked') + (skin.id === sel.id ? ' selected' : '');
    const cv = document.createElement('canvas');
    const status = document.createElement('div');
    status.className = 'skin-status';
    const label = () => {
      if (skin.id === ensureSelected(getSkins()).id) return '✅ Wearing';
      if (owned) return 'Tap to wear';
      return `🪙 ${skin.price.toLocaleString()}`;
    };
    status.textContent = label();
    card.innerHTML = `<div class="skin-name">${esc(skin.name)}</div>${owned ? '' : '<span class="lock">🔒</span>'}`;
    card.prepend(cv);
    card.append(status);
    grid.append(card);
    requestAnimationFrame(() => {
      const w = cv.clientWidth || 140, h = cv.clientHeight || 80, dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = w * dpr; cv.height = h * dpr;
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSnakePreview(g, skin, w, h, 0.6, { segments: 12, head: ensureHead(getHeads()).id });
    });
    card.addEventListener('click', () => {
      initAudio();
      if (isUnlocked(skin)) {
        progress.selected = skin.id;
        saveProgress();
        tap();
        renderShop();
        return;
      }
      if (progress.coins < skin.price) {
        sfx.error();
        haptic(40);
        status.textContent = `Need 🪙 ${(skin.price - progress.coins).toLocaleString()} more`;
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
      progress.coins -= skin.price;
      progress.unlocked.push(skin.id);
      progress.selected = skin.id;
      saveProgress();
      sfx.win();
      haptic([20, 40, 20]);
      const r = card.getBoundingClientRect();
      confetti(60, r.left + r.width / 2, r.top + r.height / 2);
      renderShop();
      updateCoins();
    });
  }
  updateCoins();
}

/** One buy/wear card for the shop (used for heads). */
function shopCard({ name, price, owned, selected, draw, onWear, onBuy }) {
  const card = document.createElement('button');
  card.className = 'skin-card head-card' + (owned ? '' : ' locked') + (selected ? ' selected' : '');
  const cv = document.createElement('canvas');
  const status = document.createElement('div');
  status.className = 'skin-status';
  const label = () => (selected ? '✅ Wearing' : owned ? 'Tap to wear' : `🪙 ${price.toLocaleString()}`);
  status.textContent = label();
  card.innerHTML = `<div class="skin-name">${esc(name)}</div>${owned ? '' : '<span class="lock">🔒</span>'}`;
  card.prepend(cv);
  card.append(status);
  requestAnimationFrame(() => {
    const w = cv.clientWidth || 140, h = cv.clientHeight || 96, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(g, w, h);
  });
  card.addEventListener('click', () => {
    initAudio();
    if (owned) { tap(); onWear(); return; }
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
  });
  return card;
}

function renderHeadShop() {
  const grid = $('#shop-grid');
  grid.innerHTML = '';
  const skin = ensureSelected(getSkins());
  const sel = ensureHead(getHeads());
  for (const head of getHeads().filter((h) => !h.hidden)) {
    const wear = () => { progress.selectedHead = head.id; saveProgress(); renderShop(); };
    grid.append(shopCard({
      name: head.name, price: head.price, owned: isHeadUnlocked(head), selected: head.id === sel.id,
      draw: (g, w, h) => drawSnakePreview(g, skin, w, h, 0.6, { head: head.id, portrait: true }),
      onWear: wear,
      onBuy: () => { progress.unlockedHeads.push(head.id); wear(); updateCoins(); },
    }));
  }
  updateCoins();
}

function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

// ---------------------------------------------------------- boosters ----
function openReady() {
  initAudio();
  tap();
  const S = getSettings();
  if (!S.boostersEnabled) { startGame([]); return; }
  picked = new Set([...picked].filter((k) => S.boosterPrices[k] <= progress.coins && !(k === 'life' && S.gentle)));
  renderBoosters();
  show('ready');
}

function boosterCost() {
  const P = getSettings().boosterPrices;
  return [...picked].reduce((a, k) => a + P[k], 0);
}

function renderBoosters() {
  const P = getSettings().boosterPrices;
  const grid = $('#booster-grid');
  // Extra Life is pointless when you can't be eaten anyway
  const list = Object.entries(BOOSTERS).filter(([k]) => !(k === 'life' && getSettings().gentle));
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
  game.setup('demo', { settings: { ...getSettings(), arenaSize: 'small', showNames: true }, skins: getSkins(), heads: visibleHeads() });
}

async function startGame(boosters) {
  initAudio();
  const skins = getSkins();
  const settings = getSettings();
  const skin = ensureSelected(skins);
  const P = settings.boosterPrices;
  const list = boosters.filter((k) => BOOSTERS[k]);
  const cost = list.reduce((a, k) => a + P[k], 0);
  if (cost > progress.coins) return;
  progress.coins -= cost;
  saveProgress();
  game.setup('play', { settings, skins, skin, name: progress.name.trim() || 'You', boosters: list, head: ensureHead(getHeads()).id, heads: visibleHeads() });
  input.reset();
  input.enabled = true;
  $('#btn-boost').classList.toggle('hidden', !settings.boostEnabled);
  $('#hud-timer').classList.toggle('hidden', settings.matchSeconds <= 0);
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
  if (standalone || !matchMedia('(pointer: coarse)').matches || document.fullscreenElement) return;
  const el = document.documentElement;
  try { el.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {}); } catch { /* ignore */ }
}

function pauseGame() {
  if (state !== 'play' || game.over) return;
  game.paused = true;
  input.reset();
  tap();
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
  $('#hud-board').innerHTML = d.top
    .map((s, i) => `<li class="${s.me ? 'me' : ''}"><span class="dot" style="background:${s.color}"></span><span class="n">${i === 0 ? '👑' : i + 1 + '.'} ${esc(s.name)}</span><b>${s.length}</b></li>`)
    .join('') + (d.top.some((s) => s.me) || d.rank > d.total ? '' : `<li class="me"><span class="dot"></span><span class="n">${d.rank}. You</span><b>${d.length}</b></li>`);
  const pw = d.powers.filter((p) => POWER_ICONS[p.type]).map((p) => {
    const [icon, color] = POWER_ICONS[p.type];
    return `<span class="pw" style="--c:${color}">${icon}<small>${Math.ceil(p.left)}</small></span>`;
  });
  if (d.ghost > 0 && d.ghost < 100) pw.unshift(`<span class="pw" style="--c:#8ecbff">🫧<small>${Math.ceil(d.ghost)}</small></span>`);
  $('#hud-powers').innerHTML = pw.join('');
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

function onEnd(r) {
  input.enabled = false;
  input.reset();
  try { wakeLock?.release(); } catch { /* ignore */ }
  wakeLock = null;
  const S = getSettings();
  const rankBonus = r.reason === 'time' ? ([50, 30, 20][r.rank - 1] ?? 5) : 0;
  const parts = [
    ['Size', Math.floor(r.maxLength / 4)],
    ['Snakes eaten', r.kills * 8],
  ];
  if (r.bestStreak >= 2) parts.push([`Best combo ×${r.bestStreak}`, r.bestStreak * 5]);
  if (rankBonus) parts.push([`Finished #${r.rank}`, rankBonus]);
  let coins = parts.reduce((a, [, v]) => a + v, 0) * S.coinMultiplier;
  if (r.coinRush) coins *= 2;
  coins = Math.round(coins);
  const newBest = r.maxLength > progress.best;
  progress.coins += coins;
  progress.games++;
  progress.kills += r.kills;
  progress.bestStreak = Math.max(progress.bestStreak || 0, r.bestStreak);
  if (newBest) progress.best = r.maxLength;
  saveProgress();

  let title, sub, stars;
  if (r.reason === 'eaten') {
    title = r.killer ? 'Chomped!' : 'Oh no!';
    sub = r.killer ? `${esc(r.killer)} was bigger this time` : 'Better luck next time';
    stars = r.maxLength >= 100 || r.kills >= 3 ? 2 : r.maxLength >= 30 || r.kills > 0 ? 1 : 0;
  } else if (r.reason === 'time') {
    title = r.rank === 1 ? '👑 You WON! 👑' : r.rank <= 3 ? `#${r.rank} — Awesome!` : "Time's up!";
    sub = r.rank === 1 ? 'Biggest snake in the arena!' : `You finished #${r.rank} of ${r.total}`;
    stars = r.rank === 1 ? 3 : r.rank <= 3 ? 2 : 1;
  } else {
    title = 'Game over';
    sub = 'See you next time!';
    stars = r.maxLength >= 30 ? 1 : 0;
  }
  stars = Math.max(1, stars); // everyone gets at least one star
  $('#over-title').innerHTML = title;
  $('#over-sub').innerHTML = sub;
  $('#over-stats').innerHTML = `
    <div><b>${r.maxLength}</b><span>biggest</span></div>
    <div><b>${r.kills}</b><span>eaten</span></div>
    <div><b>#${r.rank}</b><span>rank</span></div>`;
  $('#over-breakdown').innerHTML = parts.map(([k, v]) => `<li><span>${k}</span><b>+${v}</b></li>`).join('') +
    (S.coinMultiplier !== 1 ? `<li><span>Bonus</span><b>×${S.coinMultiplier}</b></li>` : '') +
    (r.coinRush ? '<li><span>💰 Coin Rush</span><b>×2</b></li>' : '');
  $('#over-best').classList.toggle('hidden', !newBest);
  const starEls = [...document.querySelectorAll('#over-stars span')];
  starEls.forEach((el) => el.classList.remove('on'));
  show('over');
  starEls.forEach((el, i) => {
    if (i < stars) setTimeout(() => { el.classList.add('on'); sfx.coin(); haptic(15); }, 350 + i * 300);
  });
  if (stars === 3 || newBest) setTimeout(() => confetti(140), 300);
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
  game = new Game($('#game'), { onHud, onEnd, toast, haptic });
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
  on('#btn-play', openReady);
  on('#btn-go', () => startGame([...picked]));
  on('#btn-ready-back', () => { tap(); show('home'); });
  on('#btn-skins', () => { tap(); openShop(); });
  on('#btn-help', () => { tap(); show('help'); });
  on('#btn-help-close', () => { tap(); show('home'); });
  on('#btn-shop-back', () => { tap(); show('home'); });
  for (const b of document.querySelectorAll('.shop-tab')) b.addEventListener('click', () => { tap(); shopTab = b.dataset.tab; renderShop(); $('#shop-grid').scrollTop = 0; });
  on('#btn-pause', pauseGame);
  on('#btn-resume', resumeGame);
  on('#btn-quit', () => { tap(); quitGame(); });
  on('#btn-again', openReady);
  on('#btn-home', () => { tap(); startDemo(); show('home'); });
  on('#btn-over-skins', () => { tap(); startDemo(); openShop(); });
  on('#btn-settings', () => { tap(); openSettings('home'); });
  on('#btn-pause-settings', () => { tap(); openSettings('pause'); });
  on('#btn-settings-close', () => { tap(); show(settingsReturn); });
  on('#btn-gift', openGift);
  on('#gift-box', claimGift);
  on('#btn-gift-close', () => { tap(); show('home'); });
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
