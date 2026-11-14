// Grown-up settings: PIN gate, skin editor, game rules, progress tools,
// backup/restore. Everything here is kept separate from the player's own
// progress unless you use the "Player progress" tab on purpose.
import {
  getSettings, saveSettings, resetSettings,
  getSkins, saveSkins, resetSkins, getHeads, saveHeads, resetHeads,
  checkPin, setPin, isDefaultPin, exportConfig, importConfig,
} from './config.js';
import { progress, saveProgress, resetProgress, isHeadUnlocked } from './storage.js';
import { PATTERNS, EYES, HATS, sanitizeSkin, slugify } from './skins.js';
import { drawSnakePreview } from './render.js';
import { sfx } from './audio.js';
import { BOOSTERS } from './boosters.js';
import { esc, pick, randInt, hslHex } from './util.js';

const $ = (s, root = document) => root.querySelector(s);
let ctx = null;          // { show, onClose }
let tab = 'skins';
let editing = null;      // skin draft being edited
let editingIndex = -1;
let previewRaf = 0;

// ---------------------------------------------------------------- PIN ----
export function openPin(c) {
  ctx = c;
  const root = $('#screen-pin');
  let entered = '';
  root.innerHTML = `
    <div class="card pin-card">
      <h2>Grown-ups only</h2>
      <p class="muted">Enter the PIN to open settings</p>
      <div class="pin-dots"></div>
      <div class="pin-pad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}
        <button data-k="back" aria-label="Delete">⌫</button><button data-k="0">0</button><button data-k="ok" class="ok">OK</button>
      </div>
      ${isDefaultPin() ? '<p class="hint">First time? The PIN is <b>1234</b> — change it inside.</p>' : ''}
      <button class="btn btn-small btn-ghost" data-k="cancel">Cancel</button>
    </div>`;
  const dots = $('.pin-dots', root);
  const draw = () => { dots.innerHTML = Array.from({ length: Math.max(4, entered.length) }, (_, i) => `<span class="${i < entered.length ? 'on' : ''}"></span>`).join(''); };
  draw();
  const submit = () => {
    if (checkPin(entered)) {
      sfx.click();
      document.removeEventListener('keydown', onKey);
      openAdmin();
    } else {
      sfx.error();
      entered = '';
      draw();
      const card = $('.pin-card', root);
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
    }
  };
  const press = (k) => {
    if (k === 'cancel') { document.removeEventListener('keydown', onKey); ctx.onClose(); return; }
    if (k === 'back') entered = entered.slice(0, -1);
    else if (k === 'ok') return submit();
    else if (entered.length < 8) entered += k;
    draw();
  };
  const onKey = (e) => {
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('back');
    else if (e.key === 'Enter') press('ok');
    else if (e.key === 'Escape') press('cancel');
  };
  document.addEventListener('keydown', onKey);
  root.querySelectorAll('button[data-k]').forEach((b) => b.addEventListener('click', () => press(b.dataset.k)));
  ctx.show('pin');
}

// -------------------------------------------------------------- shell ----
function openAdmin() {
  const root = $('#screen-admin');
  root.innerHTML = `
    <div class="admin-wrap">
      <header class="admin-head">
        <h2>⚙️ Grown-up Settings</h2>
        <button class="btn btn-small btn-green" id="adm-close">Done</button>
      </header>
      <nav class="admin-tabs">
        <button data-tab="skins">🎨 Skins</button>
        <button data-tab="heads">🐶 Heads</button>
        <button data-tab="game">🎮 Game rules</button>
        <button data-tab="progress">🪙 Player progress</button>
        <button data-tab="backup">💾 Backup</button>
        <button data-tab="pin">🔑 PIN</button>
      </nav>
      <div class="admin-body" id="adm-body"></div>
    </div>`;
  $('#adm-close', root).addEventListener('click', closeAdmin);
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; editing = null; render(); }));
  ctx.show('admin');
  render();
}

function closeAdmin() {
  cancelAnimationFrame(previewRaf);
  editing = null;
  if (location.hash === '#admin') history.replaceState(null, '', location.pathname + location.search);
  ctx.onClose();
}

function render() {
  cancelAnimationFrame(previewRaf);
  document.querySelectorAll('.admin-tabs [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  const body = $('#adm-body');
  body.scrollTop = 0;
  if (tab === 'skins') editing ? renderEditor(body) : renderSkinList(body);
  else if (tab === 'heads') renderHeads(body);
  else if (tab === 'game') renderGame(body);
  else if (tab === 'progress') renderProgress(body);
  else if (tab === 'backup') renderBackup(body);
  else if (tab === 'pin') renderPin(body);
}

function flash(msg, bad) {
  const el = document.createElement('div');
  el.className = 'admin-flash' + (bad ? ' bad' : '');
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 2200);
}

function drawStatic(cv, skin) {
  const w = cv.clientWidth || 140, h = cv.clientHeight || 56, dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = w * dpr;
  cv.height = h * dpr;
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawSnakePreview(g, skin, w, h, 0.6, { segments: 12 });
}

// -------------------------------------------------------------- skins ----
function renderSkinList(body) {
  const skins = getSkins();
  body.innerHTML = `
    <p class="muted">These are the skins in the shop. Changes are saved on this device straight away and don't touch your child's coins.
    Skins marked <b>Free</b> are unlocked for everyone; others cost coins earned in matches.</p>
    <div class="admin-actions">
      <button class="btn btn-small btn-green" id="sk-new">+ New skin</button>
      <button class="btn btn-small btn-ghost" id="sk-restore">Restore default skins</button>
    </div>
    <ul class="skin-rows">${skins.map((s, i) => `
      <li data-i="${i}">
        <canvas></canvas>
        <div class="meta">
          <b>${esc(s.name)}</b>
          <span>${s.free || s.price <= 0 ? 'Free' : '🪙 ' + s.price.toLocaleString()} · ${PATTERNS[s.pattern].split(' (')[0]}
          ${s.hidden ? '<em class="tag">Hidden</em>' : ''}${progress.unlocked.includes(s.id) ? '<em class="tag ok">Owned</em>' : ''}${progress.selected === s.id ? '<em class="tag ok">Wearing</em>' : ''}</span>
        </div>
        <div class="row-btns">
          <button data-act="up" title="Move up" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button data-act="down" title="Move down" ${i === skins.length - 1 ? 'disabled' : ''}>▼</button>
          <button data-act="edit" title="Edit">✏️</button>
          <button data-act="dup" title="Duplicate">⧉</button>
          <button data-act="del" title="Delete">🗑</button>
        </div>
      </li>`).join('')}
    </ul>`;
  body.querySelectorAll('.skin-rows li').forEach((li) => {
    const i = +li.dataset.i;
    requestAnimationFrame(() => drawStatic($('canvas', li), skins[i]));
    li.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      const list = getSkins();
      const act = b.dataset.act;
      if (act === 'edit') { editing = { ...list[i], colors: [...list[i].colors] }; editingIndex = i; render(); return; }
      if (act === 'dup') {
        const copy = { ...list[i], colors: [...list[i].colors], id: slugify(list[i].name), name: (list[i].name + ' 2').slice(0, 24) };
        list.splice(i + 1, 0, copy);
      } else if (act === 'del') {
        if (list.length <= 1) return flash('You need at least one skin', true);
        if (!confirm(`Delete "${list[i].name}"?`)) return;
        list.splice(i, 1);
      } else if (act === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
      else if (act === 'down' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
      saveSkins(list);
      render();
    }));
  });
  $('#sk-new').addEventListener('click', () => {
    const h = randInt(0, 359);
    editing = sanitizeSkin({ id: '', name: 'New Snake', colors: [hslHex(h, 85, 60), hslHex((h + 40) % 360, 85, 50)], pattern: 'stripes', stripe: 2, eyes: 'cute', hat: 'none', price: 100 });
    editing.id = '';
    editingIndex = -1;
    render();
  });
  $('#sk-restore').addEventListener('click', () => {
    if (!confirm('Replace the skin list with the default skins? Custom skins will be removed.')) return;
    resetSkins();
    render();
    flash('Default skins restored');
  });
}

function options(obj, cur) {
  return Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');
}

function renderEditor(body) {
  const d = editing;
  body.innerHTML = `
    <button class="btn btn-small btn-ghost" id="ed-back">← Back to skins</button>
    <div class="editor">
      <canvas class="editor-preview" id="ed-prev"></canvas>
      <div class="form">
        <label>Name<input id="ed-name" maxlength="24" value="${esc(d.name)}"></label>
        <label>Price (coins)<input id="ed-price" type="number" min="0" step="10" value="${d.price}"></label>
        <div class="field"><span>Colours</span><div class="colors" id="ed-colors"></div></div>
        <label>Pattern<select id="ed-pattern">${options(PATTERNS, d.pattern)}</select></label>
        <label>Stripe width <output id="ed-stripe-out">${d.stripe}</output><input id="ed-stripe" type="range" min="1" max="8" value="${d.stripe}"></label>
        <label>Eyes<select id="ed-eyes">${options(EYES, d.eyes)}</select></label>
        <label>Hat<select id="ed-hat">${options(HATS, d.hat)}</select></label>
        <label class="check"><input type="checkbox" id="ed-free" ${d.free ? 'checked' : ''}> Free for everyone (always unlocked)</label>
        <label class="check"><input type="checkbox" id="ed-hidden" ${d.hidden ? 'checked' : ''}> Hide from the shop</label>
        <label class="check"><input type="checkbox" id="ed-bots" ${d.bots ? 'checked' : ''}> Bots can wear this skin</label>
        <div class="admin-actions">
          <button class="btn btn-small btn-green" id="ed-save">Save skin</button>
          <button class="btn btn-small btn-purple" id="ed-random">🎲 Surprise me</button>
          <button class="btn btn-small btn-ghost" id="ed-cancel">Cancel</button>
        </div>
      </div>
    </div>`;

  const drawColors = () => {
    const wrap = $('#ed-colors');
    wrap.innerHTML = d.colors.map((c, i) => `
      <span class="color-chip"><input type="color" value="${c}" data-i="${i}">${d.colors.length > 1 ? `<button data-rm="${i}" aria-label="Remove colour">×</button>` : ''}</span>`).join('') +
      (d.colors.length < 8 ? '<button class="add-color" id="ed-add">+</button>' : '');
    wrap.querySelectorAll('input[type=color]').forEach((inp) => inp.addEventListener('input', () => { d.colors[+inp.dataset.i] = inp.value; }));
    wrap.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { d.colors.splice(+b.dataset.rm, 1); drawColors(); }));
    $('#ed-add')?.addEventListener('click', () => { d.colors.push(hslHex(randInt(0, 359), 85, 60)); drawColors(); });
  };
  drawColors();

  const bind = (id, key, fn = (v) => v, ev = 'input') => $(id).addEventListener(ev, (e) => {
    d[key] = fn(e.target.type === 'checkbox' ? e.target.checked : e.target.value);
  });
  bind('#ed-name', 'name');
  bind('#ed-price', 'price', (v) => Math.max(0, Math.round(+v || 0)));
  bind('#ed-pattern', 'pattern', (v) => v, 'change');
  bind('#ed-stripe', 'stripe', (v) => { $('#ed-stripe-out').textContent = v; return +v; });
  bind('#ed-eyes', 'eyes', (v) => v, 'change');
  bind('#ed-hat', 'hat', (v) => v, 'change');
  bind('#ed-free', 'free', (v) => v, 'change');
  bind('#ed-hidden', 'hidden', (v) => v, 'change');
  bind('#ed-bots', 'bots', (v) => v, 'change');

  $('#ed-back').addEventListener('click', () => { editing = null; render(); });
  $('#ed-cancel').addEventListener('click', () => { editing = null; render(); });
  $('#ed-random').addEventListener('click', () => {
    const h = randInt(0, 359);
    const n = randInt(2, 4);
    d.colors = Array.from({ length: n }, (_, i) => hslHex((h + i * randInt(25, 70)) % 360, randInt(70, 95), randInt(45, 70)));
    d.pattern = pick(['stripes', 'gradient', 'cycle', 'spots', 'stripes']);
    d.stripe = randInt(1, 3);
    d.eyes = pick(Object.keys(EYES));
    d.hat = pick(Object.keys(HATS));
    renderEditor(body);
  });
  $('#ed-save').addEventListener('click', () => {
    const list = getSkins();
    const s = sanitizeSkin(d);
    if (!d.id) s.id = slugify(s.name);
    if (editingIndex >= 0 && list[editingIndex]?.id === d.id) list[editingIndex] = s;
    else list.push(s);
    saveSkins(list);
    editing = null;
    sfx.click();
    flash('Skin saved');
    render();
  });

  const cv = $('#ed-prev');
  const loop = (ts) => {
    previewRaf = requestAnimationFrame(loop);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    drawSnakePreview(g, sanitizeSkin(d), w, h, ts / 1000, { segments: 18 });
  };
  previewRaf = requestAnimationFrame(loop);
}

// -------------------------------------------------------------- heads ----
function renderHeads(body) {
  const heads = getHeads();
  const skin = getSkins()[0];
  body.innerHTML = `
    <p class="muted">Character heads your child can buy in the shop and wear with any body. Set a price (0 = free) or hide a head.</p>
    <div class="admin-actions">
      <button class="btn btn-small btn-green" id="h-free">Make every head free</button>
      <button class="btn btn-small btn-ghost" id="h-reset">Restore default prices</button>
    </div>
    <ul class="skin-rows head-rows">${heads.map((h, i) => `
      <li data-i="${i}">
        <canvas></canvas>
        <div class="meta"><b>${esc(h.name)}</b>
          <span>${isHeadUnlocked(h) ? '<em class="tag ok">Owned</em>' : ''}${progress.selectedHead === h.id ? '<em class="tag ok">Wearing</em>' : ''}</span>
        </div>
        ${h.id === 'snake' ? '<span class="muted">always free</span>' : `
        <label class="mini">🪙<input type="number" min="0" step="10" value="${h.price}" data-k="price"></label>
        <label class="mini check"><input type="checkbox" data-k="hidden" ${h.hidden ? 'checked' : ''}> Hide</label>`}
      </li>`).join('')}
    </ul>`;
  body.querySelectorAll('.head-rows li').forEach((li) => {
    const h = heads[+li.dataset.i];
    requestAnimationFrame(() => {
      const cv = $('canvas', li), dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = 56 * dpr; cv.height = 56 * dpr;
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSnakePreview(g, skin, 56, 56, 0.6, { head: h.id, portrait: true });
    });
    li.querySelectorAll('[data-k]').forEach((el) => el.addEventListener('change', () => {
      const list = getHeads();
      const item = list.find((x) => x.id === h.id);
      if (el.dataset.k === 'price') item.price = Math.max(0, Math.round(+el.value || 0));
      else item.hidden = el.checked;
      saveHeads(list);
    }));
  });
  $('#h-free').addEventListener('click', () => {
    if (!confirm('Make every head free?')) return;
    saveHeads(getHeads().map((h) => ({ ...h, price: 0 })));
    render();
    flash('All heads are free');
  });
  $('#h-reset').addEventListener('click', () => {
    if (!confirm('Restore the default head prices and show every head?')) return;
    resetHeads();
    render();
    flash('Head prices restored');
  });
}

// --------------------------------------------------------------- game ----
const FIELDS = [
  { h: 'Opponents' },
  { key: 'botCount', label: 'Number of bot snakes', type: 'range', min: 0, max: 25, step: 1 },
  { key: 'difficulty', label: 'Bot difficulty', type: 'select', options: { easy: 'Easy', normal: 'Normal', hard: 'Hard' } },
  { key: 'botsChasePlayer', label: 'Bots hunt the player', type: 'check' },
  { h: 'Match' },
  { key: 'matchSeconds', label: 'Match length', type: 'select', num: true, options: { 60: '1 minute', 120: '2 minutes', 180: '3 minutes', 300: '5 minutes', 600: '10 minutes', 0: 'Endless (until eaten)' } },
  { key: 'arenaSize', label: 'Arena size', type: 'select', options: { small: 'Small', medium: 'Medium', large: 'Large' } },
  { key: 'pelletDensity', label: 'Amount of food', type: 'select', options: { low: 'Less', normal: 'Normal', high: 'Lots' } },
  { key: 'gentle', label: 'Gentle mode — player loses length instead of being eaten (except when tiny)', type: 'check' },
  { h: 'Player' },
  { key: 'startLength', label: 'Starting size', type: 'range', min: 5, max: 60, step: 1 },
  { key: 'playerSpeed', label: 'Player speed', type: 'range', min: 0.7, max: 1.3, step: 0.05, fmt: (v) => '×' + (+v).toFixed(2) },
  { key: 'spawnShield', label: 'Spawn protection (seconds)', type: 'range', min: 0, max: 10, step: 1 },
  { key: 'boostEnabled', label: 'Allow boost', type: 'check' },
  { key: 'showNames', label: 'Show snake names', type: 'check' },
  { h: 'Rewards' },
  { key: 'coinMultiplier', label: 'Coin multiplier', type: 'range', min: 0.5, max: 5, step: 0.5, fmt: (v) => '×' + v },
  { h: 'Power-ups' },
  { key: 'powerups.magnet', label: '🧲 Magnet', type: 'check' },
  { key: 'powerups.speed', label: '⚡ Speed', type: 'check' },
  { key: 'powerups.shield', label: '⭐ Super Star (invincible)', type: 'check' },
  { key: 'powerups.double', label: '2× Double growth', type: 'check' },
  { key: 'powerups.freeze', label: '❄️ Freeze (slows everyone else)', type: 'check' },
  { key: 'powerups.feast', label: '🍰 Candy rain (instant food)', type: 'check' },
  { key: 'powerups.giant', label: '🍄 Giant (fights as if 50% bigger)', type: 'check' },
  { h: 'Boosters (bought before a match)' },
  { key: 'boostersEnabled', label: 'Show the booster screen before matches', type: 'check' },
  ...Object.entries(BOOSTERS).map(([k, b]) => ({
    key: 'boosterPrices.' + k, label: `${b.icon} ${b.name} price`, type: 'range', min: 0, max: 300, step: 5,
    fmt: (v) => (+v ? '🪙 ' + v : 'free'),
  })),
  { h: 'Daily gift' },
  { key: 'dailyGift', label: 'Coins in the daily gift (grows with a daily streak)', type: 'range', min: 0, max: 300, step: 10, fmt: (v) => (+v ? '🪙 ' + v : 'off') },
];

function getPath(o, k) { return k.split('.').reduce((a, p) => a?.[p], o); }
function setPath(o, k, v) { const ps = k.split('.'); const last = ps.pop(); ps.reduce((a, p) => a[p], o)[last] = v; }

function renderGame(body) {
  const s = getSettings();
  body.innerHTML = `<p class="muted">Rules for new matches on this device. Saved automatically.</p><div class="form" id="g-form"></div>
    <div class="admin-actions"><button class="btn btn-small btn-ghost" id="g-reset">Restore default rules</button></div>`;
  const form = $('#g-form');
  for (const f of FIELDS) {
    if (f.h) { form.insertAdjacentHTML('beforeend', `<h3>${f.h}</h3>`); continue; }
    const v = getPath(s, f.key);
    let html;
    if (f.type === 'check') html = `<label class="check"><input type="checkbox" data-k="${f.key}" ${v ? 'checked' : ''}> ${esc(f.label)}</label>`;
    else if (f.type === 'select') html = `<label>${esc(f.label)}<select data-k="${f.key}">${Object.entries(f.options).map(([k, l]) => `<option value="${k}" ${String(k) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
    else html = `<label>${esc(f.label)} <output>${f.fmt ? f.fmt(v) : v}</output><input type="range" data-k="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${v}"></label>`;
    form.insertAdjacentHTML('beforeend', html);
  }
  form.querySelectorAll('[data-k]').forEach((el) => {
    const f = FIELDS.find((x) => x.key === el.dataset.k);
    el.addEventListener(el.type === 'range' ? 'input' : 'change', () => {
      const cur = getSettings();
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (f.type === 'range' || f.num) v = Number(v);
      if (f.type === 'range') el.previousElementSibling.textContent = f.fmt ? f.fmt(v) : v;
      setPath(cur, f.key, v);
      saveSettings(cur);
    });
  });
  $('#g-reset').addEventListener('click', () => {
    if (!confirm('Restore the default game rules?')) return;
    resetSettings();
    render();
    flash('Default rules restored');
  });
}

// ----------------------------------------------------------- progress ----
function renderProgress(body) {
  body.innerHTML = `
    <p class="muted">Your child's own progress on this device.</p>
    <div class="stats-grid">
      <div><b>${progress.coins.toLocaleString()}</b><span>coins</span></div>
      <div><b>${progress.best}</b><span>best size</span></div>
      <div><b>${progress.games}</b><span>games played</span></div>
      <div><b>${progress.kills}</b><span>snakes eaten</span></div>
    </div>
    <div class="form">
      <label>Set coins<input type="number" id="p-coins" min="0" step="10" value="${progress.coins}"></label>
      <div class="admin-actions">
        <button class="btn btn-small btn-green" id="p-set">Save coins</button>
        <button class="btn btn-small btn-purple" data-add="100">+100</button>
        <button class="btn btn-small btn-purple" data-add="1000">+1000</button>
      </div>
      <h3>Skins</h3>
      <div class="admin-actions">
        <button class="btn btn-small btn-blue" id="p-unlock">Unlock every skin &amp; head</button>
        <button class="btn btn-small btn-ghost" id="p-lock">Re-lock bought skins &amp; heads</button>
      </div>
      <h3>Reset</h3>
      <div class="admin-actions">
        <button class="btn btn-small btn-ghost" id="p-best">Reset best score</button>
        <button class="btn btn-small btn-red" id="p-reset">Reset ALL progress</button>
      </div>
    </div>`;
  const done = (msg) => { saveProgress(); flash(msg); render(); };
  $('#p-set').addEventListener('click', () => { progress.coins = Math.max(0, Math.floor(+$('#p-coins').value || 0)); done('Coins saved'); });
  body.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => { progress.coins += +b.dataset.add; done(`Added ${b.dataset.add} coins`); }));
  $('#p-unlock').addEventListener('click', () => {
    progress.unlocked = [...new Set([...progress.unlocked, ...getSkins().map((s) => s.id)])];
    progress.unlockedHeads = getHeads().map((h) => h.id);
    done('Everything unlocked');
  });
  $('#p-lock').addEventListener('click', () => {
    if (!confirm('Lock all bought skins and heads again? (Free ones stay unlocked.)')) return;
    progress.unlocked = [];
    progress.unlockedHeads = [];
    done('Bought items locked');
  });
  $('#p-best').addEventListener('click', () => { if (confirm('Reset the best score?')) { progress.best = 0; done('Best score reset'); } });
  $('#p-reset').addEventListener('click', () => {
    if (!confirm('Reset coins, unlocked skins, best score and stats? This cannot be undone.')) return;
    resetProgress();
    flash('Progress reset');
    render();
  });
}

// ------------------------------------------------------------- backup ----
function renderBackup(body) {
  body.innerHTML = `
    <h3>Export</h3>
    <p class="muted">Copies the skins and game rules (not your child's progress). To make these the defaults on <b>every</b> device,
      upload the file as <code>config.json</code> next to <code>index.html</code> on your web host.</p>
    <label class="check"><input type="checkbox" id="b-pin"> Include the PIN (so other devices use the same PIN)</label>
    <textarea id="b-out" rows="8" readonly></textarea>
    <div class="admin-actions">
      <button class="btn btn-small btn-green" id="b-dl">⬇ Download config.json</button>
      <button class="btn btn-small btn-ghost" id="b-copy">Copy</button>
    </div>
    <h3>Import</h3>
    <p class="muted">Load a config file (or paste one below) to replace this device's skins and rules.</p>
    <input type="file" id="b-file" accept=".json,application/json">
    <textarea id="b-in" rows="6" placeholder='{"settings": {...}, "skins": [...]}'></textarea>
    <div class="admin-actions"><button class="btn btn-small btn-blue" id="b-import">Import</button></div>`;
  const out = $('#b-out');
  const fill = () => { out.value = exportConfig($('#b-pin').checked); };
  fill();
  $('#b-pin').addEventListener('change', fill);
  $('#b-dl').addEventListener('click', () => {
    const blob = new Blob([out.value], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'config.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#b-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(out.value); flash('Copied'); } catch { out.select(); flash('Select-all done — copy it manually'); }
  });
  $('#b-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (f) $('#b-in').value = await f.text();
  });
  $('#b-import').addEventListener('click', () => {
    try {
      importConfig($('#b-in').value);
      flash('Imported!');
      render();
    } catch (err) {
      flash('Import failed: ' + err.message, true);
    }
  });
}

// ---------------------------------------------------------------- PIN ----
function renderPin(body) {
  body.innerHTML = `
    <p class="muted">The PIN keeps little hands out of this menu. It's stored on this device only.</p>
    ${isDefaultPin() ? '<p class="warn">You are still using the default PIN (1234).</p>' : ''}
    <div class="form">
      <label>New PIN (4–8 digits)<input id="pin1" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password"></label>
      <label>Repeat new PIN<input id="pin2" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password"></label>
      <div class="admin-actions"><button class="btn btn-small btn-green" id="pin-save">Change PIN</button></div>
    </div>`;
  $('#pin-save').addEventListener('click', () => {
    const a = $('#pin1').value, b = $('#pin2').value;
    if (!/^[0-9]{4,8}$/.test(a)) return flash('PIN must be 4–8 digits', true);
    if (a !== b) return flash("The PINs don't match", true);
    setPin(a);
    flash('PIN changed');
    render();
  });
}

