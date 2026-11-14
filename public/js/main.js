// App shell: screens, HUD, shop, results, and wiring everything together.
import { loadConfig, getSettings, getSkins } from './config.js';
import { progress, saveProgress, isUnlocked, ensureSelected } from './storage.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { initAudio, sfx, setSound, setMusic, suspend } from './audio.js';
import { drawSnakePreview, POWERUPS } from './render.js';
import { openPin } from './admin.js';
import { esc } from './util.js';

const $ = (s) => document.querySelector(s);
const SCREENS = ['home', 'shop', 'help', 'pause', 'over', 'pin', 'admin'];

let game, input;
let state = 'home';
let wakeLock = null;
let installEvt = null;

export function show(name) {
  state = name;
  for (const s of SCREENS) $('#screen-' + s).classList.toggle('hidden', s !== name);
  $('#hud').classList.toggle('hidden', !(name === 'play' || name === 'pause'));
  if (name === 'home') refreshHome();
}

// ------------------------------------------------------------- home ----
function refreshHome() {
  for (const el of document.querySelectorAll('.coin-count')) el.textContent = progress.coins.toLocaleString();
  $('#best-score').textContent = progress.best;
  $('#name-input').value = progress.name;
  $('#btn-sound').textContent = progress.sound ? '🔊' : '🔇';
  $('#btn-music').classList.toggle('off', !progress.music);
  $('#btn-install').classList.toggle('hidden', !installEvt);
}

function previewLoop(ts) {
  requestAnimationFrame(previewLoop);
  const t = ts / 1000;
  if (state === 'home') {
    const c = $('#home-preview');
    const w = c.clientWidth, h = c.clientHeight;
    if (!w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const skins = getSkins();
    drawSnakePreview(g, ensureSelected(skins), w, h, t, { segments: 18 });
  }
}

// ------------------------------------------------------------- shop ----
function openShop() {
  show('shop');
  renderShop();
}

function renderShop() {
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
    card.innerHTML = `<div class="skin-name">${esc(skin.name)}</div>`;
    card.prepend(cv);
    card.append(status);
    grid.append(card);
    requestAnimationFrame(() => {
      const w = cv.clientWidth || 140, h = cv.clientHeight || 80, dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = w * dpr; cv.height = h * dpr;
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSnakePreview(g, skin, w, h, 0.6, { segments: 12 });
    });
    card.addEventListener('click', () => {
      initAudio();
      if (isUnlocked(skin)) {
        progress.selected = skin.id;
        saveProgress();
        sfx.click();
        renderShop();
        return;
      }
      if (progress.coins < skin.price) {
        sfx.error();
        status.textContent = `Need 🪙 ${(skin.price - progress.coins).toLocaleString()} more`;
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
        setTimeout(() => (status.textContent = label()), 1600);
        return;
      }
      if (!card.dataset.confirm) {
        card.dataset.confirm = '1';
        status.textContent = 'Tap again to buy!';
        card.classList.add('confirm');
        setTimeout(() => { delete card.dataset.confirm; card.classList.remove('confirm'); status.textContent = label(); }, 2500);
        return;
      }
      progress.coins -= skin.price;
      progress.unlocked.push(skin.id);
      progress.selected = skin.id;
      saveProgress();
      sfx.win();
      renderShop();
      for (const el of document.querySelectorAll('.coin-count')) el.textContent = progress.coins.toLocaleString();
    });
  }
  for (const el of document.querySelectorAll('.coin-count')) el.textContent = progress.coins.toLocaleString();
}

// ------------------------------------------------------------- play ----
function startDemo() {
  input.enabled = false;
  game.setup('demo', { settings: { ...getSettings(), arenaSize: 'small', showNames: true }, skins: getSkins() });
}

async function startGame() {
  initAudio();
  sfx.click();
  const skins = getSkins();
  const settings = getSettings();
  const skin = ensureSelected(skins);
  game.setup('play', { settings, skins, skin, name: progress.name.trim() || 'You' });
  input.reset();
  input.enabled = true;
  $('#btn-boost').classList.toggle('hidden', !settings.boostEnabled);
  $('#hud-timer').classList.toggle('hidden', settings.matchSeconds <= 0);
  $('#toasts').innerHTML = '';
  show('play');
  if (progress.tipsShown < 3) {
    progress.tipsShown++;
    saveProgress();
    const touch = matchMedia('(pointer: coarse)').matches;
    toast(touch ? '👆 Drag anywhere to steer' : '🖱️ Point the mouse to steer', 3000);
    setTimeout(() => toast('🟢 Green numbers: you can eat them!', 3000), 3200);
    setTimeout(() => toast('🔴 Red numbers: bigger — run away!', 3000), 6400);
  }
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
}

function pauseGame() {
  if (state !== 'play') return;
  game.paused = true;
  input.reset();
  show('pause');
}

function resumeGame() {
  game.paused = false;
  show('play');
}

function quitGame() {
  game.paused = false;
  show('play');
  game.endMatch('quit');
}

function onHud(d) {
  if (state !== 'play' && state !== 'pause') return;
  $('#hud-len').textContent = d.length;
  $('#hud-rank').textContent = `#${d.rank}/${d.total}`;
  $('#hud-kills').textContent = d.kills;
  if (d.timeLeft !== Infinity) {
    const s = Math.ceil(d.timeLeft);
    $('#hud-timer').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    $('#hud-timer').classList.toggle('urgent', s <= 10);
  }
  $('#hud-board').innerHTML = d.top
    .map((s, i) => `<li class="${s.me ? 'me' : ''}"><span class="dot" style="background:${s.color}"></span><span class="n">${i + 1}. ${esc(s.name)}</span><b>${s.length}</b></li>`)
    .join('') + (d.top.some((s) => s.me) || d.rank > d.total ? '' : `<li class="me"><span class="dot"></span><span class="n">${d.rank}. You</span><b>${d.length}</b></li>`);
  const pw = d.powers.map((p) => `<span class="pw" style="--c:${POWERUPS[p.type].color}">${POWERUPS[p.type].icon}<small>${Math.ceil(p.left)}</small></span>`);
  if (d.ghost > 0 && d.ghost < 100) pw.unshift(`<span class="pw" style="--c:#8ecbff">🛡️<small>${Math.ceil(d.ghost)}</small></span>`);
  $('#hud-powers').innerHTML = pw.join('');
}

function toast(msg, ms = 2200) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toasts').append(el);
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
  if (rankBonus) parts.push([`Finished #${r.rank}`, rankBonus]);
  const coins = Math.round(parts.reduce((a, [, v]) => a + v, 0) * S.coinMultiplier);
  const newBest = r.maxLength > progress.best;
  progress.coins += coins;
  progress.games++;
  progress.kills += r.kills;
  if (newBest) progress.best = r.maxLength;
  saveProgress();

  let title, sub;
  if (r.reason === 'eaten') {
    title = r.killer ? 'Chomped!' : 'Oh no!';
    sub = r.killer ? `${esc(r.killer)} was bigger this time` : 'Better luck next time';
  } else if (r.reason === 'time') {
    title = r.rank === 1 ? '👑 You WON! 👑' : r.rank <= 3 ? `#${r.rank} — Awesome!` : "Time's up!";
    sub = r.rank === 1 ? 'Biggest snake in the arena!' : `You finished #${r.rank} of ${r.total}`;
  } else {
    title = 'Game over';
    sub = 'See you next time!';
  }
  $('#over-title').innerHTML = title;
  $('#over-sub').innerHTML = sub;
  $('#over-stats').innerHTML = `
    <div><b>${r.maxLength}</b><span>biggest size</span></div>
    <div><b>${r.kills}</b><span>snakes eaten</span></div>
    <div><b>#${r.rank}</b><span>rank</span></div>`;
  $('#over-breakdown').innerHTML = parts.map(([k, v]) => `<li><span>${k}</span><b>+${v}</b></li>`).join('') +
    (S.coinMultiplier !== 1 ? `<li><span>Bonus ×${S.coinMultiplier}</span><b></b></li>` : '');
  $('#over-best').classList.toggle('hidden', !newBest);
  show('over');
  // count-up animation
  const el = $('#over-coins');
  const t0 = performance.now(), dur = Math.min(1500, 300 + coins * 15);
  let lastTick = 0;
  const tick = (now) => {
    const f = Math.min(1, (now - t0) / dur);
    const v = Math.round(coins * f);
    el.textContent = v;
    if (v !== lastTick && now - (tick.last || 0) > 70) { sfx.coin(); tick.last = now; }
    lastTick = v;
    if (f < 1 && state === 'over') requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ------------------------------------------------------------- boot ----
async function boot() {
  await loadConfig();
  ensureSelected(getSkins());
  setSound(progress.sound);
  setMusic(progress.music);
  game = new Game($('#game'), { onHud, onEnd, toast });
  input = new Input($('#game'));
  game.input = input;
  window.snek = { game }; // handy for debugging from the console
  startDemo();
  show('home');
  requestAnimationFrame(previewLoop);

  // first interaction unlocks audio on mobile
  window.addEventListener('pointerdown', initAudio, { once: true });

  $('#btn-play').addEventListener('click', startGame);
  $('#btn-skins').addEventListener('click', () => { sfx.click(); openShop(); });
  $('#btn-help').addEventListener('click', () => { sfx.click(); show('help'); });
  $('#btn-help-close').addEventListener('click', () => { sfx.click(); show('home'); });
  $('#btn-shop-back').addEventListener('click', () => { sfx.click(); show('home'); });
  $('#btn-pause').addEventListener('click', pauseGame);
  $('#btn-resume').addEventListener('click', resumeGame);
  $('#btn-quit').addEventListener('click', quitGame);
  $('#btn-again').addEventListener('click', startGame);
  $('#btn-home').addEventListener('click', () => { sfx.click(); startDemo(); show('home'); });
  $('#btn-over-skins').addEventListener('click', () => { sfx.click(); startDemo(); openShop(); });
  $('#btn-sound').addEventListener('click', () => {
    progress.sound = !progress.sound;
    setSound(progress.sound);
    saveProgress();
    refreshHome();
    sfx.click();
  });
  $('#btn-music').addEventListener('click', () => {
    initAudio();
    progress.music = !progress.music;
    setMusic(progress.music);
    saveProgress();
    refreshHome();
  });
  $('#name-input').addEventListener('input', (e) => {
    progress.name = e.target.value.slice(0, 14);
    saveProgress();
  });
  const adminDone = () => { startDemo(); show('home'); };
  $('#btn-admin').addEventListener('click', () => openPin({ show, onClose: adminDone }));
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
    refreshHome();
  });
  $('#btn-install').addEventListener('click', async () => {
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
