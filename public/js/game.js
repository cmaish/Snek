// The arena simulation + renderer.
import { TAU, clamp, rand, pick, FONT } from './util.js';
import { Snake } from './snake.js';
import { updateBot, newBrain, DIFFICULTY } from './bots.js';
import { pelletSprite, starSprite, powerupSprite, POWERUPS, RAINBOW_COLORS, skinColor, ballSprite, glowSprite } from './render.js';
import { sfx } from './audio.js';

const ARENA = { small: 1300, medium: 1800, large: 2500 };
const DENSITY = { low: 0.55, normal: 1, high: 1.7 };
const PELLET_COLORS = ['#ff4f6d', '#ffd23f', '#3ddc97', '#4cc9f0', '#b388ff', '#ff9f1c', '#f72585', '#7cff6b', '#ffffff', '#00f5d4'];
const MAX_PELLETS = 2400;
const MILESTONES = [25, 50, 100, 150, 200, 300, 400, 500, 750, 1000, 1500];
const STREAK_WORDS = ['', '', 'DOUBLE GULP!', 'TRIPLE GULP!', 'MEGA GULP!', 'UNSTOPPABLE!', 'SNAKE KING!'];
const BOT_NAMES = [
  'Noodle', 'Wiggles', 'Sir Hiss', 'Zippy', 'Slinky', 'Bubbles', 'Pickle', 'Captain Coil', 'Mr. Fangs', 'Sneaky Pete',
  'Doodle', 'Sprinkles', 'Biscuit', 'Taco', 'Ziggy', 'Marshmallow', 'Turbo', 'Squiggles', 'Banana', 'Gizmo',
  'Noodlini', 'Jellybean', 'Rocket', 'Pretzel', 'Waffles', 'Spaghetti', 'Twister', 'Muffin', 'Zigzag', 'Nugget',
  'Lady Slither', 'Bonbon', 'Kiwi', 'Professor Coil', 'Tater Tot',
];

export class Game {
  constructor(canvas, hooks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    this.input = null;
    this.paused = false;
    this.snakes = null;
    this.t = 0;
    this.last = 0;
    this.frameAvg = 16;
    this.slowFor = 0;
    this.quality = Math.min(window.devicePixelRatio || 1, 2);
    this.minimap = document.getElementById('minimap');
    this.mmCtx = this.minimap.getContext('2d');
    this.frameNo = 0;
    this.makePatterns();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  haptic(p) { if (this.mode === 'play' && this.hooks.haptic) this.hooks.haptic(p); }

  resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.dpr = this.quality;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    // phones see ~460 world px across, desktops a bit more
    this.baseScale = clamp(Math.max(Math.min(this.w, this.h) / 560, Math.max(this.w, this.h) / 1000), 0.6, 2.2);
    const md = Math.min(2, window.devicePixelRatio || 1);
    this.minimap.width = this.minimap.height = Math.round(110 * md);
    this.mmScale = md;
    // edge vignettes (danger = red, frozen = icy, plus a soft dark edge)
    const g = this.ctx, w = this.w, h = this.h, rr = Math.hypot(w, h) / 2;
    const mkV = (col, inner) => {
      const v = g.createRadialGradient(w / 2, h / 2, rr * inner, w / 2, h / 2, rr);
      v.addColorStop(0, col + '00');
      v.addColorStop(1, col + 'ff');
      return v;
    };
    this.vDanger = mkV('#ff1744', 0.45);
    this.vFrost = mkV('#9be7ff', 0.45);
    this.vDark = mkV('#0a0425', 0.6);
  }

  makePatterns() {
    // hexagon floor tile
    const s = 34, H = 58, W = s * 3;
    const tile = document.createElement('canvas');
    tile.width = W;
    tile.height = H;
    const g = tile.getContext('2d');
    const k = H / (Math.sqrt(3) * s);
    const hex = (cx, cy) => {
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        g.lineTo(cx + Math.cos(a) * (s - 3), cy + Math.sin(a) * (s - 3) * k);
      }
      g.closePath();
    };
    const centers = [[0, 0], [W, 0], [0, H], [W, H], [s * 1.5, H / 2], [s * 1.5, -H / 2], [s * 1.5, H * 1.5]];
    for (const [cx, cy] of centers) {
      hex(cx, cy);
      g.fillStyle = 'rgba(255,255,255,0.045)';
      g.fill();
      g.lineWidth = 2.5;
      g.strokeStyle = 'rgba(20,6,70,0.22)';
      g.stroke();
      hex(cx, cy - 1.5);
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(255,255,255,0.07)';
      g.stroke();
    }
    this.floorPattern = this.ctx.createPattern(tile, 'repeat');

    const stars = document.createElement('canvas');
    stars.width = stars.height = 300;
    const st = stars.getContext('2d');
    for (let i = 0; i < 40; i++) {
      st.fillStyle = `rgba(255,255,255,${rand(0.15, 0.6)})`;
      st.beginPath(); st.arc(rand(300), rand(300), rand(0.8, 2.2), 0, TAU); st.fill();
    }
    this.starPattern = this.ctx.createPattern(stars, 'repeat');
    this.motes = Array.from({ length: 30 }, () => ({
      x: rand(2000), y: rand(2000), z: rand(0.25, 0.7), s: rand(1.5, 3.5), ph: rand(TAU),
      c: pick(['#ffffff', '#ffe14d', '#9be7ff', '#ff9ff3']),
    }));
  }

  // ------------------------------------------------------------ setup ----
  setup(mode, { settings, skins, skin, name, boosters = [], head = 'snake', heads = [] }) {
    this.mode = mode;
    this.settings = settings;
    this.skins = skins;
    this.botHeads = heads.filter((h) => h !== 'snake');
    this.botSkins = skins.filter((s) => s.bots);
    if (!this.botSkins.length) this.botSkins = skins;
    this.R = ARENA[settings.arenaSize] || ARENA.medium;
    this.diff = DIFFICULTY[settings.difficulty] || DIFFICULTY.normal;
    this.snakes = [];
    this.pellets = [];
    this.powerups = [];
    this.particles = [];
    this.chunks = [];
    this.trails = [];
    this.rings = [];
    this.lines = [];
    this.texts = [];
    this.respawns = [];
    this.banner = null;
    this.time = 0;
    this.timeLeft = mode === 'play' && settings.matchSeconds > 0 ? settings.matchSeconds : Infinity;
    this.over = false;
    this.endIn = -1;
    this.result = null;
    this.hudIn = 0;
    this.shake = 0;
    this.flash = 0;
    this.danger = 0;
    this.frost = 0;
    this.powerIn = 2.5;
    this.freezeT = 0;
    this.freezer = null;
    this.natural = 0;
    this.paused = false;
    this.deathPos = null;
    this.boosters = new Set(boosters);
    this.lives = this.boosters.has('life') ? 1 : 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.lastKill = -99;
    this.milestone = -1;
    this.wasLeader = false;
    this.countdown = mode === 'play' ? 3.5 : 0;
    this.lastCount = 4;
    this.pelletTarget = Math.round(((Math.PI * this.R * this.R) / 12000) * (DENSITY[settings.pelletDensity] || 1));
    for (let i = 0; i < this.pelletTarget; i++) this.spawnNatural();

    this.floorGrad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, this.R);
    this.floorGrad.addColorStop(0, '#6152e0');
    this.floorGrad.addColorStop(0.6, '#4a3cc4');
    this.floorGrad.addColorStop(0.92, '#3a2ca6');
    this.floorGrad.addColorStop(1, '#271b80');

    this.player = null;
    if (mode === 'play') {
      const B = this.boosters;
      this.player = new Snake({
        name, skin, headId: head, isPlayer: true, x: 0, y: 0, angle: rand(TAU),
        length: settings.startLength + (B.has('size') ? 25 : 0),
        ghost: Math.max(settings.spawnShield, B.has('shield') ? 12 : 0),
        speedMul: settings.playerSpeed,
      });
      if (B.has('magnet')) this.player.power.magnet = 40;
      if (B.has('turbo')) this.player.power.turbo = 60;
      this.snakes.push(this.player);
      this.milestone = MILESTONES.findIndex((m) => m > this.player.mass);
    }
    const bots = mode === 'demo' ? 12 : settings.botCount;
    for (let i = 0; i < bots; i++) this.spawnBot(true);
    for (let i = 0; i < 2; i++) this.spawnPowerup();
    const p = this.player;
    this.cam = { x: p ? p.head.x : 0, y: p ? p.head.y : 0, zoom: p ? 1.6 : 0.75, lx: 0, ly: 0 };
    this.updateHud(true);
  }

  // --------------------------------------------------------- spawning ----
  makePellet(x, y, v, c, nat) {
    return { x, y, v, c, r: clamp(4 + Math.sqrt(v) * 3.4, 5, 16), ph: rand(TAU), vx: 0, vy: 0, eatenBy: null, t: 0, dead: false, nat, ign: null, ignT: 0, star: false };
  }

  spawnNatural() {
    const a = rand(TAU), d = Math.sqrt(Math.random()) * (this.R - 40);
    const big = Math.random() < 0.06;
    const p = this.makePellet(Math.cos(a) * d, Math.sin(a) * d, big ? 4 : 1, pick(PELLET_COLORS), true);
    if (big) { p.star = true; p.r = 13; p.c = pick(['#ffd23f', '#ff9ff3', '#7cff6b', '#5fd3ff']); }
    this.pellets.push(p);
    this.natural++;
  }

  dropPellet(x, y, v, owner) {
    const p = this.makePellet(x + rand(-6, 6), y + rand(-6, 6), v, skinColor(owner.prep, this.t), false);
    p.ign = owner;
    p.ignT = 0.8;
    this.pellets.push(p);
  }

  spawnRemains(segs, victim, mass, attractor, frac) {
    if (!segs.length || mass <= 0) return;
    const count = clamp(Math.round(segs.length * 0.6), 2, 60);
    const v = mass / count;
    const cols = victim.prep.mode === 'rainbow' || victim.prep.mode === 'gradient' ? victim.prep.palette : victim.prep.cols;
    for (let k = 0; k < count; k++) {
      const s = segs[Math.floor((k * segs.length) / count)];
      const p = this.makePellet(s.x + rand(-10, 10), s.y + rand(-10, 10), v, cols[k % cols.length], false);
      const a = rand(TAU), sp = rand(30, 160);
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      if (attractor && attractor.alive && Math.random() < frac) { p.eatenBy = attractor; p.t = -rand(0.1, 0.35); }
      this.pellets.push(p);
    }
  }

  usedNames() {
    return new Set(this.snakes.filter((s) => s.alive).map((s) => s.name));
  }

  /** A random spot that's not too close to other snakes. */
  safeSpot(minFromPlayer) {
    const P = this.player;
    let x = 0, y = 0;
    for (let tries = 0; tries < 50; tries++) {
      const a = rand(TAU), d = Math.sqrt(Math.random()) * this.R * 0.85;
      x = Math.cos(a) * d; y = Math.sin(a) * d;
      let ok = true;
      for (const s of this.snakes) {
        if (!s.alive) continue;
        const near = s === P ? Math.max(minFromPlayer, 150) : 250;
        const b = s.bbox;
        if (x < b.x0 - near || x > b.x1 + near || y < b.y0 - near || y > b.y1 + near) continue;
        if (Math.hypot(s.head.x - x, s.head.y - y) < near) { ok = false; break; }
        for (let i = 0; i < s.segs.length; i += 4) {
          const q = s.segs[i];
          if (Math.hypot(q.x - x, q.y - y) < 150) { ok = false; break; }
        }
        if (!ok) break;
      }
      if (ok) break;
    }
    return { x, y };
  }

  spawnBot(initial) {
    const S = this.settings, P = this.player;
    const used = this.usedNames();
    const names = BOT_NAMES.filter((n) => !used.has(n));
    const name = names.length ? pick(names) : pick(BOT_NAMES) + ' ' + Math.floor(rand(2, 99));
    const { x, y } = this.safeSpot(initial ? 550 : 900);
    const base = S.startLength;
    let len;
    if (P && !initial) {
      len = Math.random() < 0.72 ? rand(base, Math.max(base + 6, P.mass * 0.75)) : rand(P.mass * 0.85, P.mass * 1.25 + 8);
    } else {
      len = base + Math.pow(Math.random(), 2.5) * (S.difficulty === 'hard' ? 70 : S.difficulty === 'easy' ? 25 : 40);
    }
    const b = new Snake({
      name, skin: pick(this.botSkins), x, y, angle: rand(TAU),
      headId: this.botHeads.length && Math.random() < 0.6 ? pick(this.botHeads) : null,
      length: clamp(len, 5, 400), ghost: initial ? 0 : 1.2, speedMul: this.diff.speed,
    });
    b.ai = newBrain();
    this.snakes.push(b);
  }

  spawnPowerup() {
    const types = Object.keys(POWERUPS).filter((k) => this.settings.powerups[k]);
    if (!types.length || this.powerups.length >= 5) return;
    const a = rand(TAU), d = Math.sqrt(Math.random()) * this.R * 0.85;
    this.powerups.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, type: pick(types), ph: rand(TAU), dead: false, born: this.t });
  }

  // ------------------------------------------------------------- loop ----
  frame(ts) {
    requestAnimationFrame(this.frame);
    const raw = (ts - this.last) / 1000 || 0.016;
    this.last = ts;
    const dt = Math.min(0.05, raw);
    if (!this.snakes) return;
    if (!this.paused) this.update(dt);
    this.render();
    this.adaptQuality(raw);
  }

  adaptQuality(raw) {
    this.frameAvg = this.frameAvg * 0.95 + raw * 1000 * 0.05;
    if (this.frameAvg > 26 && !this.paused && raw < 0.25) {
      this.slowFor += raw;
      if (this.slowFor > 2 && this.quality > 1) {
        this.quality = Math.max(1, this.quality - 0.5);
        this.slowFor = 0;
        this.frameAvg = 16;
        this.resize();
      }
    } else {
      this.slowFor = 0;
    }
  }

  update(dt) {
    this.t += dt;
    const P = this.player;

    // player steering (works during the countdown too, so you can aim)
    if (P && P.alive && this.input && !this.over) {
      const a = this.input.angleFor(this.worldToScreen(P.head));
      if (a !== null) P.targetAngle = a;
      P.boosting = this.settings.boostEnabled && this.input.boost;
    } else if (P) {
      P.boosting = false;
    }

    if (this.countdown > 0) {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown - 0.5);
      if (n !== this.lastCount) {
        this.lastCount = n;
        if (n >= 1 && n <= 3) { sfx.beep(); this.haptic(12); }
        if (n <= 0) { sfx.go(); this.haptic(30); }
      }
      if (P) P.placeAt(P.head.x, P.head.y, P.targetAngle);
      this.updateFx(dt);
      this.updateCamera(dt);
      this.hudIn -= dt;
      if (this.hudIn <= 0) this.updateHud();
      return;
    }

    this.time += dt;
    if (this.mode === 'play' && !this.over && this.timeLeft !== Infinity) {
      const before = Math.ceil(this.timeLeft);
      this.timeLeft -= dt;
      const now = Math.ceil(this.timeLeft);
      if (now !== before && now <= 5 && now > 0) { sfx.beep(); this.haptic(10); }
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.endMatch('time'); }
    }
    if (this.freezeT > 0) this.freezeT -= dt;

    for (const s of this.snakes) if (s.alive && s.ai) updateBot(s, this, dt);
    for (const s of this.snakes) if (s.alive) s.update(dt, this);

    this.updatePellets(dt);
    this.collide();
    this.updatePowerups(dt);
    if (P && P.alive && !this.over) this.checkMilestones();

    if (this.snakes.some((s) => !s.alive && !s.isPlayer)) {
      this.snakes = this.snakes.filter((s) => s.alive || s.isPlayer);
    }
    for (let i = this.respawns.length - 1; i >= 0; i--) {
      if (this.time >= this.respawns[i]) {
        this.respawns.splice(i, 1);
        this.spawnBot(false);
      }
    }

    this.updateFx(dt);
    this.updateCamera(dt);

    if (this.endIn > 0) {
      this.endIn -= dt;
      if (this.endIn <= 0 && this.hooks.onEnd) this.hooks.onEnd(this.result);
    }
    this.hudIn -= dt;
    if (this.hudIn <= 0) this.updateHud();
  }

  checkMilestones() {
    const P = this.player;
    while (this.milestone >= 0 && this.milestone < MILESTONES.length && P.mass >= MILESTONES[this.milestone]) {
      const m = MILESTONES[this.milestone++];
      this.showBanner(`SIZE ${m}!`, '#7cff8a');
      this.ring(P.head.x, P.head.y, '#7cff8a', P.radius() * 6);
      sfx.levelup();
      this.haptic(25);
    }
  }

  updatePellets(dt) {
    const snakes = this.snakes.filter((s) => s.alive);
    for (const s of snakes) {
      const r = s.radius();
      s._r = r;
      s._eat = s.power.magnet > 0 ? 260 + r * 4 : r * 2.3 + 16;
    }
    const pellets = this.pellets;
    const fr = Math.pow(0.04, dt);
    const P = this.player;
    for (const p of pellets) {
      if (p.dead) continue;
      if (p.eatenBy) {
        const s = p.eatenBy;
        if (!s.alive) { p.eatenBy = null; continue; }
        p.t += dt;
        if (p.t < 0) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= fr; p.vy *= fr; continue; }
        const h = s.segs[0];
        const dx = h.x - p.x, dy = h.y - p.y, d = Math.hypot(dx, dy) || 1;
        const step = (300 + p.t * 2200) * dt;
        if (d < s._r * 0.8 || step >= d || p.t > 1.1) {
          p.dead = true;
          const gained = s.grow(p.v);
          if (s === P) {
            sfx.pop();
            if (p.v >= 2) this.floatText(h.x, h.y - s._r * 2, '+' + Math.round(gained), '#fff6a0', 16);
            if (p.star) this.ring(h.x, h.y, p.c, s._r * 3);
          }
        } else {
          p.x += (dx / d) * step;
          p.y += (dy / d) * step;
        }
        continue;
      }
      if (p.vx || p.vy) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= fr;
        p.vy *= fr;
        if (Math.abs(p.vx) + Math.abs(p.vy) < 2) p.vx = p.vy = 0;
      }
      if (p.ignT > 0) p.ignT -= dt;
      for (const s of snakes) {
        const h = s.segs[0], e = s._eat;
        const dx = h.x - p.x;
        if (dx > e || dx < -e) continue;
        const dy = h.y - p.y;
        if (dy > e || dy < -e) continue;
        if (dx * dx + dy * dy < e * e && !(p.ign === s && p.ignT > 0)) {
          p.eatenBy = s;
          p.t = 0;
          break;
        }
      }
    }
    let j = 0, nat = 0;
    for (let i = 0; i < pellets.length; i++) {
      const p = pellets[i];
      if (!p.dead) { pellets[j++] = p; if (p.nat) nat++; }
    }
    pellets.length = j;
    this.natural = nat;
    for (let k = 0; k < 6 && this.natural < this.pelletTarget; k++) this.spawnNatural();
    if (pellets.length > MAX_PELLETS) {
      const extra = pellets.length - MAX_PELLETS;
      let removed = 0;
      for (let i = 0; i < pellets.length && removed < extra; i++) {
        if (!pellets[i].nat && !pellets[i].eatenBy) { pellets[i].dead = true; removed++; }
      }
    }
  }

  updatePowerups(dt) {
    this.powerIn -= dt;
    if (this.powerIn <= 0) {
      this.powerIn = rand(5, 9);
      this.spawnPowerup();
    }
    for (const pu of this.powerups) {
      pu.ph += dt;
      for (const s of this.snakes) {
        if (!s.alive) continue;
        const h = s.head, r = s.radius();
        if (Math.hypot(h.x - pu.x, h.y - pu.y) < r * 1.2 + 30) {
          pu.dead = true;
          this.applyPowerup(s, pu.type, pu);
          break;
        }
      }
    }
    this.powerups = this.powerups.filter((p) => !p.dead);
  }

  applyPowerup(s, type, at) {
    const def = POWERUPS[type];
    const h = s.head;
    const me = s === this.player;
    if (def.time) s.power[type] = def.time;
    if (type === 'freeze') {
      this.freezeT = def.time;
      this.freezer = s;
      sfx.freeze();
    } else if (type === 'feast') {
      for (let i = 0; i < 28; i++) {
        const a = rand(TAU), d = rand(90, 260);
        const p = this.makePellet(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, 1.4, RAINBOW_COLORS[(i * 5) % 24], false);
        p.vx = Math.cos(a) * 60;
        p.vy = Math.sin(a) * 60;
        p.eatenBy = s;
        p.t = -rand(0.25, 0.8);
        this.pellets.push(p);
      }
      if (me) sfx.feast();
    } else if (type === 'giant' && me) sfx.giant();
    else if (me) sfx.power();
    this.ring(at.x, at.y, def.color, 140);
    if (me) {
      this.showBanner(def.label, def.color, def.desc);
      this.burst(at.x, at.y, [def.color, '#ffffff'], 22);
      this.haptic(25);
    }
  }

  // -------------------------------------------------------- collisions ----
  collide() {
    const S = this.snakes;
    for (const A of S) {
      if (!A.alive || A.ghost > 0) continue;
      const h = A.segs[0], hr = A.radius();
      for (const B of S) {
        if (B === A || !B.alive || B.ghost > 0) continue;
        const bb = B.bbox;
        if (h.x < bb.x0 - hr || h.x > bb.x1 + hr || h.y < bb.y0 - hr || h.y > bb.y1 + hr) continue;
        // the player gets a smaller hitbox so near-misses don't count
        const rr = (hr + B.radius()) * (A.isPlayer || B.isPlayer ? 0.7 : 0.85), rr2 = rr * rr, segs = B.segs;
        for (let j = 0; j < segs.length; j++) {
          const s = segs[j], dx = h.x - s.x, dy = h.y - s.y;
          if (dx * dx + dy * dy < rr2) {
            this.clash(A, B, j, s);
            break;
          }
        }
        if (!A.alive || A.ghost > 0) break;
      }
    }
  }

  clash(A, B, j, pt) {
    const aS = A.power.shield > 0, bS = B.power.shield > 0;
    const am = A.clashMass(), bm = B.clashMass();
    if (j <= 2) {
      if (A.biteCd > 0 && B.biteCd > 0) return;
      let winner = null;
      if (aS && !bS) winner = A;
      else if (bS && !aS) winner = B;
      else if (!(aS && bS) && Math.abs(am - bm) >= 2) winner = am > bm ? A : B;
      if (!winner) {
        this.bounce(A, B.head);
        this.bounce(B, A.head);
        A.biteCd = B.biteCd = 0.4;
        this.ring((A.head.x + B.head.x) / 2, (A.head.y + B.head.y) / 2, '#ffffff', 60);
        if (A.isPlayer || B.isPlayer) { sfx.ouch(); this.haptic(20); this.shake = Math.max(this.shake, 6); }
        return;
      }
      this.defeat(winner === A ? B : A, winner);
      return;
    }
    if (aS && bS) { this.bounce(A, pt); A.biteCd = 0.3; return; }
    if (bS) { this.defeat(A, B); return; }
    if (aS || am > bm) {
      if (A.biteCd <= 0) this.bite(A, B, j);
      return;
    }
    this.defeat(A, B);
  }

  bounce(A, pt) {
    const h = A.head;
    const a = Math.atan2(h.y - pt.y, h.x - pt.x);
    A.angle = a;
    A.targetAngle = a;
    h.x += Math.cos(a) * 6;
    h.y += Math.sin(a) * 6;
  }

  /** Loser lost a clash. In gentle mode the player only loses length. */
  defeat(loser, winner) {
    if (loser.isPlayer && this.settings.gentle && loser.mass > 14) {
      const keep = Math.max(3, Math.floor(loser.segs.length * 0.6));
      const lost = loser.mass * 0.35;
      loser.mass -= lost;
      const removed = loser.segs.splice(keep);
      this.spawnRemains(removed, loser, lost * 0.85, winner, 0.5);
      this.bounce(loser, winner.head);
      loser.ghost = 2;
      loser.hurt = 0.5;
      sfx.ouch();
      this.haptic([30, 30, 30]);
      this.shake = 10;
      this.floatText(loser.head.x, loser.head.y - 40, 'Ouch!', '#ff6b6b', 26);
      return;
    }
    this.kill(loser, winner);
  }

  bite(A, B, j) {
    const n = B.segs.length;
    const cut = Math.max(3, j);
    const keepMass = B.mass * (cut / n);
    if (keepMass < 5 || (B.isPlayer && this.settings.gentle ? false : cut <= 3)) {
      this.kill(B, A);
      return;
    }
    const lost = B.mass - keepMass;
    B.mass = keepMass;
    const removed = B.segs.splice(cut);
    const at = removed[0];
    this.spawnRemains(removed, B, lost * 0.85, A, 0.6);
    A.biteCd = 0.35;
    A.mouth = 1;
    B.hurt = 0.4;
    this.burst(at.x, at.y, B.prep.cols, 10);
    this.chunkBurst(at.x, at.y, B, 5, B.radius());
    this.ring(at.x, at.y, '#ffffff', B.radius() * 3);
    if (A.isPlayer) {
      sfx.chomp();
      this.haptic(18);
      this.shake = Math.max(this.shake, 5);
      this.floatText(at.x, at.y - 20, pick(['CHOMP!', 'NOM!', 'MUNCH!', 'YUM!']), '#ffe14d', 26);
    } else if (B.isPlayer) {
      sfx.ouch();
      this.haptic([25, 30, 25]);
      this.shake = Math.max(this.shake, 9);
      this.floatText(at.x, at.y - 20, 'Ouch!', '#ff6b6b', 24);
    }
  }

  kill(victim, killer) {
    if (!victim.alive) return;
    const h = victim.head;
    const r = victim.radius();
    this.burst(h.x, h.y, victim.prep.cols, 30);
    this.chunkBurst(h.x, h.y, victim, 14, r);
    this.ring(h.x, h.y, skinColor(victim.prep, this.t), r * 8);
    this.ring(h.x, h.y, '#ffffff', r * 5);
    if (killer) {
      killer.kills++;
      killer.mouth = 1;
    }
    if (victim.isPlayer && this.lives > 0 && !this.over) {
      this.revivePlayer(killer);
      return;
    }
    victim.alive = false;
    this.spawnRemains(victim.segs, victim, victim.mass * 0.85, killer, killer ? 0.45 : 0);
    if (victim.isPlayer) {
      sfx.die();
      this.haptic([60, 40, 120]);
      this.shake = 18;
      this.flash = 0.5;
      this.deathPos = { x: h.x, y: h.y };
      this.endMatch('eaten', killer);
    } else {
      this.respawns.push(this.time + rand(1.5, 3.5));
      if (killer && killer.isPlayer) {
        sfx.gulp();
        this.haptic(40);
        this.shake = Math.max(this.shake, 8);
        this.streak = this.time - this.lastKill < 6 ? this.streak + 1 : 1;
        this.lastKill = this.time;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        if (this.streak >= 2) {
          this.showBanner(STREAK_WORDS[Math.min(this.streak, STREAK_WORDS.length - 1)], '#ffe14d', `${this.streak} in a row!`);
          sfx.streak(this.streak);
        }
        this.floatText(h.x, h.y - 30, 'GULP! 😋', '#7cff6b', 32);
      }
    }
  }

  /** Extra Life booster: come back somewhere safe with half your size. */
  revivePlayer(killer) {
    const P = this.player;
    this.lives--;
    const lost = P.mass * 0.5;
    this.spawnRemains(P.segs, P, lost * 0.85, killer, killer ? 0.45 : 0);
    P.mass = Math.max(this.settings.startLength, P.mass - lost);
    for (const k in P.power) P.power[k] = 0;
    const spot = this.safeSpot(0);
    P.placeAt(spot.x, spot.y, Math.atan2(-spot.y, -spot.x));
    P.ghost = 4;
    this.cam.lx = this.cam.ly = 0;
    sfx.life();
    this.haptic([40, 40, 40]);
    this.flash = 0.4;
    this.shake = 12;
    this.showBanner('❤️ EXTRA LIFE!', '#ff6b9a', 'Back in the game!');
  }

  endMatch(reason, killer) {
    if (this.over || this.mode !== 'play') return;
    this.over = true;
    const P = this.player;
    const ranked = this.snakes.filter((s) => s.alive || s === P).sort((a, b) => b.mass - a.mass);
    this.result = {
      reason,
      killer: killer ? killer.name : null,
      rank: ranked.indexOf(P) + 1,
      total: ranked.length,
      length: Math.floor(P.mass),
      maxLength: Math.floor(P.maxMass),
      kills: P.kills,
      bestStreak: this.bestStreak,
      coinRush: this.boosters.has('coins'),
      time: this.time,
    };
    if (reason !== 'eaten') {
      P.ghost = 999;
      if (reason === 'time') {
        this.showBanner(this.result.rank === 1 ? '👑 WINNER! 👑' : "TIME'S UP!", '#ffe14d');
        if (this.result.rank === 1) sfx.win(); else sfx.go();
      }
    }
    this.endIn = reason === 'eaten' ? 1.8 : reason === 'quit' ? 0.01 : 1.6;
  }

  // ------------------------------------------------------------ effects ----
  burst(x, y, cols, n) {
    for (let i = 0; i < n && this.particles.length < 500; i++) {
      const a = rand(TAU), sp = rand(60, 340);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.4, 0.9), max: 0.9, c: cols[i % cols.length], s: rand(3, 8) });
    }
  }

  /** Flying body bits (real segment sprites) for bites and deaths. */
  chunkBurst(x, y, snake, n, r) {
    for (let i = 0; i < n && this.chunks.length < 120; i++) {
      const a = rand(TAU), sp = rand(80, 300);
      const spr = ballSprite(pick(snake.prep.mode === 'rainbow' ? RAINBOW_COLORS : snake.prep.cols));
      this.chunks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.5, 0.9), max: 0.9, spr, r: r * rand(0.5, 0.9) });
    }
  }

  ring(x, y, color, max) {
    if (this.rings.length > 30) this.rings.shift();
    this.rings.push({ x, y, color, max, life: 0.5 });
  }

  trail(x, y, color, r) {
    if (this.trails.length > 160) this.trails.shift();
    this.trails.push({ x: x + rand(-r, r) * 0.5, y: y + rand(-r, r) * 0.5, c: color, r: r * rand(0.35, 0.7), life: 0.6 });
  }

  floatText(x, y, text, color, size = 20) {
    if (this.texts.length > 30) this.texts.shift();
    this.texts.push({ x, y, text, color, size, life: 1.1 });
  }

  showBanner(text, color, sub) {
    this.banner = { text, color, sub, life: 1.6 };
  }

  updateFx(dt) {
    const fr = Math.pow(0.1, dt);
    for (const p of this.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= fr; p.vy *= fr; p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const c of this.chunks) {
      c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= fr; c.vy *= fr; c.life -= dt;
    }
    this.chunks = this.chunks.filter((c) => c.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const t of this.trails) t.life -= dt;
    this.trails = this.trails.filter((t) => t.life > 0);
    for (const t of this.texts) { t.y -= 50 * dt; t.life -= dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    if (this.banner) { this.banner.life -= dt; if (this.banner.life <= 0) this.banner = null; }
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt);

    // speed lines (screen space) while the player zooms
    const P = this.player;
    if (P && P.alive && P.boostNow && this.countdown <= 0) {
      for (let k = 0; k < 2; k++) {
        const edge = Math.random() < 0.5;
        this.lines.push({
          x: edge ? rand(this.w) : (Math.random() < 0.5 ? rand(this.w * 0.15) : this.w - rand(this.w * 0.15)),
          y: edge ? (Math.random() < 0.5 ? rand(this.h * 0.15) : this.h - rand(this.h * 0.15)) : rand(this.h),
          a: P.angle, life: 0.3,
        });
      }
    }
    for (const l of this.lines) {
      l.x -= Math.cos(l.a) * 1400 * dt; l.y -= Math.sin(l.a) * 1400 * dt; l.life -= dt;
    }
    this.lines = this.lines.filter((l) => l.life > 0);

    // danger / frost meters for the screen-edge vignettes
    let danger = 0;
    if (P && P.alive && P.ghost <= 0 && P.power.shield <= 0 && !this.over) {
      const pm = P.clashMass(), h = P.head;
      for (const s of this.snakes) {
        if (s === P || !s.alive || s.ghost > 0) continue;
        if (s.clashMass() <= pm && s.power.shield <= 0) continue;
        const d = Math.hypot(s.head.x - h.x, s.head.y - h.y) - s.radius() - P.radius();
        danger = Math.max(danger, clamp(1 - (d - 60) / 260, 0, 1));
      }
    }
    this.danger += (danger - this.danger) * Math.min(1, dt * 5);
    const frost = P && P.alive && P.frozen ? 1 : 0;
    this.frost += (frost - this.frost) * Math.min(1, dt * 4);
  }

  updateCamera(dt) {
    const P = this.player, c = this.cam;
    let tx, ty, tz;
    if (P && P.alive) {
      // look a little ahead of where you're going — helps on small screens
      const look = 70 * (P.boostNow ? 1.5 : 1);
      c.lx += (Math.cos(P.angle) * look - c.lx) * Math.min(1, dt * 2.5);
      c.ly += (Math.sin(P.angle) * look - c.ly) * Math.min(1, dt * 2.5);
      tx = P.head.x + c.lx; ty = P.head.y + c.ly;
      tz = 1 / (1 + Math.max(0, P.radius() - 10) * 0.045);
      if (P.boostNow) tz *= 0.93;
      if (this.countdown > 0) tz *= 1 + this.countdown * 0.12;
    } else if (P && this.deathPos) {
      tx = this.deathPos.x; ty = this.deathPos.y; tz = 1.1;
    } else {
      const top = this.snakes.reduce((a, b) => (b.alive && (!a || b.mass > a.mass) ? b : a), null);
      if (top) { tx = top.head.x; ty = top.head.y; } else { tx = 0; ty = 0; }
      tz = 0.8;
    }
    const k = Math.min(1, dt * (P ? 7 : 1.2));
    c.x += (tx - c.x) * k;
    c.y += (ty - c.y) * k;
    c.zoom += (tz - c.zoom) * Math.min(1, dt * 2.5);
  }

  worldToScreen(p) {
    const sc = this.baseScale * this.cam.zoom;
    return { x: (p.x - this.cam.x) * sc + this.w / 2, y: (p.y - this.cam.y) * sc + this.h / 2 };
  }

  ranking() {
    return this.snakes.filter((s) => s.alive).sort((a, b) => b.mass - a.mass);
  }

  updateHud(force) {
    this.hudIn = 0.2;
    if (!this.hooks.onHud || (this.mode !== 'play' && !force)) return;
    const P = this.player;
    const rank = this.ranking();
    const powers = P ? Object.entries(P.power).filter(([, v]) => v > 0).map(([k, v]) => ({ type: k, left: v })) : [];
    this.hooks.onHud({
      length: P ? Math.floor(P.mass) : 0,
      rank: P && P.alive ? rank.indexOf(P) + 1 : rank.length + 1,
      total: rank.length + (P && !P.alive ? 1 : 0),
      kills: P ? P.kills : 0,
      timeLeft: this.timeLeft,
      top: rank.slice(0, 5).map((s) => ({ name: s.name, length: Math.floor(s.mass), me: s === P, color: skinColor(s.prep, this.t) })),
      powers,
      ghost: P ? Math.max(0, P.ghost) : 0,
      lives: this.lives,
    });
  }

  // ------------------------------------------------------------- render ----
  render() {
    const g = this.ctx, w = this.w, h = this.h, dpr = this.dpr, t = this.t;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sc = this.baseScale * this.cam.zoom;
    let cx = this.cam.x, cy = this.cam.y;
    if (this.shake > 0) { cx += rand(-this.shake, this.shake) / sc; cy += rand(-this.shake, this.shake) / sc; }
    const vw = w / sc, vh = h / sc;
    const view = { x0: cx - vw / 2 - 30, y0: cy - vh / 2 - 30, x1: cx + vw / 2 + 30, y1: cy + vh / 2 + 30 };
    g.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (w / 2 - cx * sc), dpr * (h / 2 - cy * sc));

    // space outside the arena
    g.fillStyle = '#160f3e';
    g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    g.fillStyle = this.starPattern;
    g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);

    // floor
    const R = this.R;
    g.beginPath();
    g.arc(0, 0, R, 0, TAU);
    g.fillStyle = this.floorGrad;
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = this.floorPattern;
    g.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    g.restore();

    // candy-stripe border with glow
    g.lineWidth = 64;
    g.strokeStyle = 'rgba(255,79,163,0.16)';
    g.beginPath();
    g.arc(0, 0, R + 20, 0, TAU);
    g.stroke();
    g.lineWidth = 34;
    g.strokeStyle = '#ff4fa3';
    g.beginPath();
    g.arc(0, 0, R + 17, 0, TAU);
    g.stroke();
    g.setLineDash([50, 50]);
    g.lineDashOffset = -t * 30;
    g.strokeStyle = '#ffffff';
    g.stroke();
    g.setLineDash([]);
    g.lineWidth = 8;
    g.strokeStyle = '#ffd23f';
    g.beginPath();
    g.arc(0, 0, R + 38, 0, TAU);
    g.stroke();

    // zoom trails
    for (const tr of this.trails) {
      const f = tr.life / 0.6, s = tr.r * 2 * f;
      g.globalAlpha = f * 0.8;
      g.drawImage(glowSprite(tr.c), tr.x - s, tr.y - s, s * 2, s * 2);
    }
    g.globalAlpha = 1;

    // pellets
    for (const p of this.pellets) {
      if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
      const pulse = 1 + 0.14 * Math.sin(t * 4 + p.ph);
      if (p.star) {
        const s = p.r * 3.4 * pulse;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(t * 1.5 + p.ph);
        g.drawImage(starSprite(p.c), -s / 2, -s / 2, s, s);
        g.restore();
      } else {
        const s = p.r * 3.2 * pulse;
        g.drawImage(pelletSprite(p.c), p.x - s / 2, p.y - s / 2, s, s);
      }
    }

    // power-ups (bob, with a pop-in when they appear)
    for (const pu of this.powerups) {
      if (pu.x < view.x0 - 60 || pu.x > view.x1 + 60 || pu.y < view.y0 - 60 || pu.y > view.y1 + 60) continue;
      const appear = clamp((t - pu.born) * 3, 0, 1);
      const s = (84 + Math.sin(pu.ph * 4) * 6) * (appear < 1 ? appear * (1.3 - 0.3 * appear) : 1);
      const y = pu.y + Math.sin(pu.ph * 2.5) * 6;
      g.globalAlpha = 0.35;
      g.fillStyle = '#0a0425';
      g.beginPath(); g.ellipse(pu.x, pu.y + 34, 22, 7, 0, 0, TAU); g.fill();
      g.globalAlpha = 1;
      g.drawImage(powerupSprite(pu.type), pu.x - s / 2, y - s / 2, s, s);
    }

    // snakes (player on top)
    const P = this.player;
    for (const s of this.snakes) if (s.alive && s !== P) s.draw(g, t, view);
    if (P && P.alive) P.draw(g, t, view);

    // chunks, particles, rings
    for (const c of this.chunks) {
      const f = c.life / c.max, r = c.r * (0.4 + 0.6 * f);
      g.globalAlpha = Math.min(1, f * 2);
      g.drawImage(c.spr, c.x - r, c.y - r, r * 2, r * 2);
    }
    for (const p of this.particles) {
      g.globalAlpha = Math.max(0, p.life / p.max);
      g.fillStyle = p.c;
      g.beginPath();
      g.arc(p.x, p.y, p.s, 0, TAU);
      g.fill();
    }
    for (const r of this.rings) {
      const f = 1 - r.life / 0.5;
      g.globalAlpha = (1 - f) * 0.9;
      g.strokeStyle = r.color;
      g.lineWidth = 8 * (1 - f) + 1;
      g.beginPath();
      g.arc(r.x, r.y, r.max * (0.2 + 0.8 * Math.sqrt(f)), 0, TAU);
      g.stroke();
    }
    g.globalAlpha = 1;

    // ---- screen-space overlays
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawMotes(g, sc);
    if (this.lines.length) {
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 2;
      g.beginPath();
      for (const l of this.lines) {
        g.moveTo(l.x, l.y);
        g.lineTo(l.x + Math.cos(l.a) * 60, l.y + Math.sin(l.a) * 60);
      }
      g.stroke();
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    for (const tx of this.texts) {
      const p = this.worldToScreen(tx);
      g.globalAlpha = Math.min(1, tx.life * 2);
      const size = tx.size * (1 + Math.max(0, tx.life - 0.9) * 2);
      g.font = `900 ${size}px ${FONT}`;
      g.lineWidth = 6;
      g.strokeStyle = 'rgba(30,10,60,0.9)';
      g.strokeText(tx.text, p.x, p.y);
      g.fillStyle = tx.color;
      g.fillText(tx.text, p.x, p.y);
    }
    g.globalAlpha = 1;
    this.drawLabels(g, sc, view);
    this.drawPowerupArrows(g, view);

    // vignettes: a soft dark edge always; red when danger is near; icy when frozen
    g.globalAlpha = 0.4;
    g.fillStyle = this.vDark;
    g.fillRect(0, 0, w, h);
    if (this.danger > 0.02) {
      g.globalAlpha = this.danger * (0.45 + 0.15 * Math.sin(t * 10));
      g.fillStyle = this.vDanger;
      g.fillRect(0, 0, w, h);
    }
    if (this.frost > 0.02) {
      g.globalAlpha = this.frost * 0.35;
      g.fillStyle = this.vFrost;
      g.fillRect(0, 0, w, h);
    }
    if (this.flash > 0) {
      g.globalAlpha = this.flash;
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
    }
    g.globalAlpha = 1;

    this.drawBanner(g);
    if (++this.frameNo % 6 === 0) this.drawMinimap();
  }

  /** Twinkling sparkles floating above the arena with a little parallax. */
  drawMotes(g, sc) {
    const w = this.w, h = this.h, t = this.t;
    for (const m of this.motes) {
      const x = (((m.x - this.cam.x * m.z * sc) % w) + w) % w;
      const y = (((m.y - this.cam.y * m.z * sc) % h) + h) % h;
      g.globalAlpha = 0.25 + 0.25 * Math.sin(t * 2 + m.ph);
      g.fillStyle = m.c;
      const s = m.s;
      g.beginPath();
      g.moveTo(x, y - s * 2); g.lineTo(x + s * 0.5, y - s * 0.5); g.lineTo(x + s * 2, y); g.lineTo(x + s * 0.5, y + s * 0.5);
      g.lineTo(x, y + s * 2); g.lineTo(x - s * 0.5, y + s * 0.5); g.lineTo(x - s * 2, y); g.lineTo(x - s * 0.5, y - s * 0.5);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
  }

  /** Big centre-screen text: countdown, streaks, power-up names, milestones. */
  drawBanner(g) {
    const w = this.w, h = this.h;
    let text = null, color = '#ffffff', sub = null, scale = 1, alpha = 1;
    if (this.mode === 'play' && this.countdown > 0) {
      const n = Math.ceil(this.countdown - 0.5);
      if (n >= 1) {
        const frac = this.countdown - 0.5 - (n - 1); // 1 -> 0 during each number
        text = String(n);
        color = ['#7cff8a', '#ffd23f', '#ff6b6b'][n - 1] || '#fff';
        scale = 0.8 + frac * 0.6;
        alpha = Math.min(1, frac * 4);
        sub = 'Get ready!';
      } else {
        const f = this.countdown * 2; // 1 -> 0
        text = 'GO!';
        color = '#7cff8a';
        scale = 1 + (1 - f) * 0.5;
        alpha = Math.min(1, f * 3);
      }
    } else if (this.banner) {
      const b = this.banner, age = 1.6 - b.life;
      text = b.text; color = b.color; sub = b.sub;
      scale = age < 0.15 ? 0.5 + (age / 0.15) * 0.7 : age < 0.3 ? 1.2 - ((age - 0.15) / 0.15) * 0.2 : 1;
      alpha = Math.min(1, b.life * 3);
    }
    if (!text) return;
    const big = Math.min(w * 0.9 / Math.max(3, text.length * 0.62), Math.min(w, h) * (text.length <= 3 ? 0.3 : 0.13));
    g.save();
    g.translate(w / 2, h * 0.24);
    g.scale(scale, scale);
    g.globalAlpha = alpha;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.font = `900 ${big}px ${FONT}`;
    g.lineWidth = Math.max(6, big * 0.16);
    g.strokeStyle = '#2a1d6e';
    g.strokeText(text, 0, 0);
    g.fillStyle = color;
    g.fillText(text, 0, 0);
    if (sub) {
      const sm = Math.min(30, Math.max(18, big * 0.3));
      g.font = `900 ${sm}px ${FONT}`;
      g.lineWidth = 6;
      g.strokeText(sub, 0, big * 0.5 + sm);
      g.fillStyle = '#ffffff';
      g.fillText(sub, 0, big * 0.5 + sm);
    }
    g.restore();
  }

  drawLabels(g, sc, view) {
    if (this.mode !== 'play') return; // keep the home screen clean
    const P = this.player;
    const leader = this.snakes.reduce((a, b) => (b.alive && (!a || b.mass > a.mass) ? b : a), null);
    const showNames = this.settings.showNames;
    const pm = P && P.alive ? P.clashMass() : 0;
    for (const s of this.snakes) {
      if (!s.alive) continue;
      const h = s.head;
      if (h.x < view.x0 || h.x > view.x1 || h.y < view.y0 || h.y > view.y1) continue;
      const p = this.worldToScreen(h);
      const hr = s.radius() * sc;
      let y = p.y - hr * s.labelLift() - 14;
      const size = clamp(13 + hr * 0.22, 13, 20);
      // badge colour: green = you can eat it, red = it can eat you
      let bg = 'rgba(30,15,80,0.8)';
      if (s === P) bg = '#7b4dff';
      else if (P && P.alive) bg = s.clashMass() > pm ? '#ff4757' : '#22c55e';
      if (s.power.shield > 0) bg = '#f5a300';
      const label = (s === leader ? '👑' : '') + Math.floor(s.mass) + (s.power.giant > 0 ? '🍄' : '');
      g.font = `900 ${size}px ${FONT}`;
      const tw = g.measureText(label).width + size * 0.9, th = size * 1.4;
      g.fillStyle = 'rgba(10,4,40,0.35)';
      g.beginPath(); g.roundRect(p.x - tw / 2, y - th / 2 + 3, tw, th, th / 2); g.fill();
      g.fillStyle = bg;
      g.beginPath(); g.roundRect(p.x - tw / 2, y - th / 2, tw, th, th / 2); g.fill();
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.stroke();
      g.fillStyle = '#ffffff';
      g.fillText(label, p.x, y + 1);
      if (showNames || s === P) {
        y -= th * 0.98;
        g.font = `800 12px ${FONT}`;
        g.lineWidth = 4;
        g.strokeStyle = 'rgba(20,8,50,0.85)';
        g.strokeText(s.name, p.x, y);
        g.fillStyle = s === P ? '#fff6a0' : 'rgba(255,255,255,0.92)';
        g.fillText(s.name, p.x, y);
      }
    }
  }

  /** Bubbles at the screen edge pointing to nearby power-ups. */
  drawPowerupArrows(g, view) {
    if (this.mode !== 'play' || !this.player || !this.player.alive || this.countdown > 0) return;
    const w = this.w, h = this.h, m = 40;
    const P = this.player.head;
    for (const pu of this.powerups) {
      if (pu.x > view.x0 + 30 && pu.x < view.x1 - 30 && pu.y > view.y0 + 30 && pu.y < view.y1 - 30) continue;
      if (Math.hypot(pu.x - P.x, pu.y - P.y) > 1300) continue;
      const s = this.worldToScreen(pu);
      const cx = w / 2, cy = h / 2, dx = s.x - cx, dy = s.y - cy;
      const k = Math.min((w / 2 - m) / Math.abs(dx || 1e-6), (h / 2 - m - 50) / Math.abs(dy || 1e-6));
      const x = cx + dx * k, y = cy + dy * k, a = Math.atan2(dy, dx);
      g.save();
      g.translate(x, y);
      g.globalAlpha = 0.8 + 0.2 * Math.sin(this.t * 6);
      g.fillStyle = POWERUPS[pu.type].color;
      g.beginPath();
      g.moveTo(Math.cos(a) * 32, Math.sin(a) * 32);
      g.lineTo(Math.cos(a + 2.3) * 18, Math.sin(a + 2.3) * 18);
      g.lineTo(Math.cos(a - 2.3) * 18, Math.sin(a - 2.3) * 18);
      g.closePath();
      g.fill();
      g.drawImage(powerupSprite(pu.type), -24, -24, 48, 48);
      g.restore();
    }
  }

  drawMinimap() {
    if (this.mode !== 'play') return;
    const g = this.mmCtx, S = this.minimap.width, m = S / 2, k = (m - 4) / this.R;
    g.clearRect(0, 0, S, S);
    g.fillStyle = 'rgba(30,20,90,0.6)';
    g.beginPath(); g.arc(m, m, m - 2, 0, TAU); g.fill();
    g.strokeStyle = '#ff4fa3';
    g.lineWidth = 2 * this.mmScale;
    g.stroke();
    for (const pu of this.powerups) {
      g.fillStyle = POWERUPS[pu.type].color;
      g.beginPath();
      g.arc(m + pu.x * k, m + pu.y * k, 2.5 * this.mmScale, 0, TAU);
      g.fill();
    }
    const P = this.player;
    const pm = P && P.alive ? P.clashMass() : 0;
    for (const s of this.snakes) {
      if (!s.alive || s === P) continue;
      g.fillStyle = pm ? (s.clashMass() > pm ? '#ff6b6b' : '#7cff8a') : skinColor(s.prep, this.t);
      g.beginPath();
      g.arc(m + s.head.x * k, m + s.head.y * k, (1.5 + s.radius() * 0.1) * this.mmScale, 0, TAU);
      g.fill();
    }
    if (P && P.alive) {
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#2a1d6e';
      g.lineWidth = 2 * this.mmScale;
      g.beginPath();
      g.arc(m + P.head.x * k, m + P.head.y * k, 4 * this.mmScale, 0, TAU);
      g.fill();
      g.stroke();
    }
  }
}
