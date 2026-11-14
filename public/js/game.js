// The arena simulation + renderer.
import { TAU, clamp, rand, pick, FONT } from './util.js';
import { Snake } from './snake.js';
import { updateBot, newBrain, DIFFICULTY } from './bots.js';
import { pelletSprite, powerupSprite, POWERUPS, RAINBOW_COLORS, skinColor } from './render.js';
import { sfx } from './audio.js';

const ARENA = { small: 1300, medium: 1800, large: 2500 };
const DENSITY = { low: 0.55, normal: 1, high: 1.7 };
const PELLET_COLORS = ['#ff4f6d', '#ffd23f', '#3ddc97', '#4cc9f0', '#b388ff', '#ff9f1c', '#f72585', '#7cff6b', '#ffffff', '#00f5d4'];
const MAX_PELLETS = 2400;
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
  }

  makePatterns() {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 120;
    const g = tile.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (const [x, y, r] of [[30, 30, 9], [90, 90, 9], [90, 30, 4], [30, 90, 4]]) {
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    this.floorPattern = this.ctx.createPattern(tile, 'repeat');
    const stars = document.createElement('canvas');
    stars.width = stars.height = 300;
    const s = stars.getContext('2d');
    for (let i = 0; i < 40; i++) {
      s.fillStyle = `rgba(255,255,255,${rand(0.15, 0.6)})`;
      s.beginPath(); s.arc(rand(300), rand(300), rand(0.8, 2.2), 0, TAU); s.fill();
    }
    this.starPattern = this.ctx.createPattern(stars, 'repeat');
  }

  // ------------------------------------------------------------ setup ----
  setup(mode, { settings, skins, skin, name }) {
    this.mode = mode;
    this.settings = settings;
    this.skins = skins;
    this.botSkins = skins.filter((s) => s.bots);
    if (!this.botSkins.length) this.botSkins = skins;
    this.R = ARENA[settings.arenaSize] || ARENA.medium;
    this.diff = DIFFICULTY[settings.difficulty] || DIFFICULTY.normal;
    this.snakes = [];
    this.pellets = [];
    this.powerups = [];
    this.particles = [];
    this.texts = [];
    this.respawns = [];
    this.time = 0;
    this.timeLeft = mode === 'play' && settings.matchSeconds > 0 ? settings.matchSeconds : Infinity;
    this.over = false;
    this.endIn = -1;
    this.result = null;
    this.hudIn = 0;
    this.shake = 0;
    this.powerIn = 3;
    this.natural = 0;
    this.paused = false;
    this.pelletTarget = Math.round(((Math.PI * this.R * this.R) / 12000) * (DENSITY[settings.pelletDensity] || 1));
    for (let i = 0; i < this.pelletTarget; i++) this.spawnNatural();

    this.floorGrad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, this.R);
    this.floorGrad.addColorStop(0, '#5a4bd6');
    this.floorGrad.addColorStop(0.75, '#4335b8');
    this.floorGrad.addColorStop(1, '#30248f');

    this.player = null;
    if (mode === 'play') {
      this.player = new Snake({
        name, skin, isPlayer: true, x: 0, y: 0, angle: rand(TAU),
        length: settings.startLength, ghost: settings.spawnShield, speedMul: settings.playerSpeed,
      });
      this.snakes.push(this.player);
    }
    const bots = mode === 'demo' ? 12 : settings.botCount;
    for (let i = 0; i < bots; i++) this.spawnBot(true);
    const p = this.player;
    this.cam = { x: p ? p.head.x : 0, y: p ? p.head.y : 0, zoom: p ? 1 : 0.75 };
    this.demoAngle = rand(TAU);
    this.updateHud(true);
  }

  // --------------------------------------------------------- spawning ----
  makePellet(x, y, v, c, nat) {
    return { x, y, v, c, r: clamp(4 + Math.sqrt(v) * 3.4, 5, 16), ph: rand(TAU), vx: 0, vy: 0, eatenBy: null, t: 0, dead: false, nat, ign: null, ignT: 0 };
  }

  spawnNatural() {
    const a = rand(TAU), d = Math.sqrt(Math.random()) * (this.R - 40);
    const big = Math.random() < 0.08;
    this.pellets.push(this.makePellet(Math.cos(a) * d, Math.sin(a) * d, big ? 3 : 1, pick(PELLET_COLORS), true));
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
      const a = rand(TAU), sp = rand(30, 140);
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      if (attractor && attractor.alive && Math.random() < frac) p.eatenBy = attractor;
      this.pellets.push(p);
    }
  }

  usedNames() {
    return new Set(this.snakes.filter((s) => s.alive).map((s) => s.name));
  }

  spawnBot(initial) {
    const S = this.settings, P = this.player;
    const used = this.usedNames();
    const names = BOT_NAMES.filter((n) => !used.has(n));
    const name = names.length ? pick(names) : pick(BOT_NAMES) + ' ' + Math.floor(rand(2, 99));
    let x = 0, y = 0;
    const minFromPlayer = initial ? 550 : 900;
    for (let tries = 0; tries < 40; tries++) {
      const a = rand(TAU), d = Math.sqrt(Math.random()) * this.R * 0.85;
      x = Math.cos(a) * d; y = Math.sin(a) * d;
      let ok = true;
      for (const s of this.snakes) {
        if (!s.alive) continue;
        const h = s.head, dd = Math.hypot(h.x - x, h.y - y);
        if (dd < (s === P ? minFromPlayer : 250)) { ok = false; break; }
      }
      if (ok) break;
    }
    const base = S.startLength;
    let len;
    if (P && !initial) {
      len = Math.random() < 0.6 ? rand(base, Math.max(base + 6, P.mass * 0.8)) : rand(P.mass * 0.9, P.mass * 1.5 + 10);
    } else {
      len = base + Math.pow(Math.random(), 2) * (S.difficulty === 'hard' ? 90 : S.difficulty === 'easy' ? 35 : 60);
    }
    const b = new Snake({
      name, skin: pick(this.botSkins), x, y, angle: rand(TAU),
      length: clamp(len, 5, 400), ghost: initial ? 0 : 1.2, speedMul: this.diff.speed,
    });
    b.ai = newBrain();
    this.snakes.push(b);
  }

  spawnPowerup() {
    const types = Object.keys(POWERUPS).filter((k) => this.settings.powerups[k]);
    if (!types.length || this.powerups.length >= 4) return;
    const a = rand(TAU), d = Math.sqrt(Math.random()) * this.R * 0.85;
    this.powerups.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, type: pick(types), ph: rand(TAU), dead: false });
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
    this.time += dt;
    const P = this.player;
    if (this.mode === 'play' && !this.over && this.timeLeft !== Infinity) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.endMatch('time'); }
    }

    if (P && P.alive && this.input && !this.over) {
      const a = this.input.angleFor(this.worldToScreen(P.head));
      if (a !== null) P.targetAngle = a;
      P.boosting = this.settings.boostEnabled && this.input.boost;
    } else if (P) {
      P.boosting = false;
    }

    for (const s of this.snakes) if (s.alive && s.ai) updateBot(s, this, dt);
    for (const s of this.snakes) if (s.alive) s.update(dt, this);

    this.updatePellets(dt);
    this.collide();
    this.updatePowerups(dt);

    // remove dead bots, queue respawns
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

  updatePellets(dt) {
    const snakes = this.snakes.filter((s) => s.alive);
    for (const s of snakes) {
      const r = s.radius();
      s._r = r;
      s._eat = s.power.magnet > 0 ? 260 + r * 4 : r * 2.3 + 16;
    }
    const pellets = this.pellets;
    const fr = Math.pow(0.04, dt);
    for (const p of pellets) {
      if (p.dead) continue;
      if (p.eatenBy) {
        const s = p.eatenBy;
        if (!s.alive) { p.eatenBy = null; continue; }
        const h = s.segs[0];
        const dx = h.x - p.x, dy = h.y - p.y, d = Math.hypot(dx, dy) || 1;
        p.t += dt;
        const step = (300 + p.t * 2200) * dt;
        if (d < s._r * 0.8 || step >= d || p.t > 1.1) {
          p.dead = true;
          const gained = s.grow(p.v);
          if (s.isPlayer) {
            sfx.pop();
            if (p.v >= 2) this.floatText(h.x, h.y - s._r * 2, '+' + Math.round(gained), '#fff6a0', 16);
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
    // compact
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
      this.powerIn = rand(6, 11);
      this.spawnPowerup();
    }
    for (const pu of this.powerups) {
      pu.ph += dt;
      for (const s of this.snakes) {
        if (!s.alive) continue;
        const h = s.head, r = s.radius();
        if (Math.hypot(h.x - pu.x, h.y - pu.y) < r * 1.2 + 26) {
          pu.dead = true;
          const def = POWERUPS[pu.type];
          s.power[pu.type] = def.time;
          if (s.isPlayer) {
            sfx.power();
            this.floatText(h.x, h.y - r * 2.5, def.label + '!', def.color, 22);
            this.burst(pu.x, pu.y, [def.color, '#ffffff'], 16);
          }
          break;
        }
      }
    }
    this.powerups = this.powerups.filter((p) => !p.dead);
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
        const rr = (hr + B.radius()) * 0.85, rr2 = rr * rr, segs = B.segs;
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
    if (j <= 2) {
      // head to head
      if (A.biteCd > 0 && B.biteCd > 0) return;
      let winner = null;
      if (aS && !bS) winner = A;
      else if (bS && !aS) winner = B;
      else if (!(aS && bS) && Math.abs(A.mass - B.mass) >= 2) winner = A.mass > B.mass ? A : B;
      if (!winner) {
        this.bounce(A, B.head);
        this.bounce(B, A.head);
        A.biteCd = B.biteCd = 0.4;
        return;
      }
      this.defeat(winner === A ? B : A, winner);
      return;
    }
    // A's head hit B's body
    if (aS && bS) { this.bounce(A, pt); A.biteCd = 0.3; return; }
    if (bS) { this.defeat(A, B); return; }
    if (aS || A.mass > B.mass) {
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
      this.shake = 10;
      this.floatText(loser.head.x, loser.head.y - 40, 'Ouch!', '#ff6b6b', 24);
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
    if (A.isPlayer) {
      sfx.chomp();
      this.shake = Math.max(this.shake, 5);
      this.floatText(at.x, at.y - 20, pick(['CHOMP!', 'NOM!', 'MUNCH!', 'YUM!']), '#ffe14d', 24);
    } else if (B.isPlayer) {
      sfx.ouch();
      this.shake = Math.max(this.shake, 9);
      this.floatText(at.x, at.y - 20, 'Ouch!', '#ff6b6b', 22);
    }
  }

  kill(victim, killer) {
    if (!victim.alive) return;
    victim.alive = false;
    const h = victim.head;
    this.spawnRemains(victim.segs, victim, victim.mass * 0.85, killer, killer ? 0.45 : 0);
    this.burst(h.x, h.y, victim.prep.cols, 26);
    if (killer) {
      killer.kills++;
      killer.mouth = 1;
    }
    if (victim.isPlayer) {
      sfx.die();
      this.shake = 16;
      this.deathPos = { x: h.x, y: h.y };
      this.endMatch('eaten', killer);
    } else {
      this.respawns.push(this.time + rand(1.5, 3.5));
      if (killer && killer.isPlayer) {
        sfx.gulp();
        this.shake = Math.max(this.shake, 8);
        this.floatText(h.x, h.y - 30, 'GULP! 😋', '#7cff6b', 30);
        if (this.hooks.toast) this.hooks.toast(`You ate ${victim.name}!`);
      }
    }
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
      time: this.time,
    };
    if (reason !== 'eaten') {
      P.ghost = 999; // stay safe behind the results screen
      if (reason === 'time' && this.result.rank === 1) sfx.win();
    }
    this.endIn = reason === 'eaten' ? 1.6 : reason === 'quit' ? 0.01 : 0.9;
  }

  // ------------------------------------------------------------ effects ----
  burst(x, y, cols, n) {
    for (let i = 0; i < n && this.particles.length < 500; i++) {
      const a = rand(TAU), sp = rand(60, 320);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.4, 0.9), max: 0.9, c: cols[i % cols.length], s: rand(3, 8) });
    }
  }

  floatText(x, y, text, color, size = 20) {
    if (this.texts.length > 30) this.texts.shift();
    this.texts.push({ x, y, text, color, size, life: 1.1 });
  }

  updateFx(dt) {
    const fr = Math.pow(0.1, dt);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= fr;
      p.vy *= fr;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) {
      t.y -= 50 * dt;
      t.life -= dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
  }

  updateCamera(dt) {
    const P = this.player, c = this.cam;
    let tx, ty, tz;
    if (P && P.alive) {
      tx = P.head.x; ty = P.head.y;
      tz = 1 / (1 + Math.max(0, P.radius() - 10) * 0.045);
      if (P.boostNow) tz *= 0.94;
    } else if (P && this.deathPos) {
      tx = this.deathPos.x; ty = this.deathPos.y; tz = 0.9;
    } else {
      // demo: drift around following the biggest snake
      const top = this.snakes.reduce((a, b) => (b.alive && (!a || b.mass > a.mass) ? b : a), null);
      if (top) { tx = top.head.x; ty = top.head.y; } else { tx = 0; ty = 0; }
      tz = 0.8;
    }
    const k = Math.min(1, dt * (P ? 7 : 1.2));
    c.x += (tx - c.x) * k;
    c.y += (ty - c.y) * k;
    c.zoom += (tz - c.zoom) * Math.min(1, dt * 2);
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
    this.hooks.onHud({
      length: P ? Math.floor(P.mass) : 0,
      rank: P && P.alive ? rank.indexOf(P) + 1 : rank.length + 1,
      total: rank.length + (P && !P.alive ? 1 : 0),
      kills: P ? P.kills : 0,
      timeLeft: this.timeLeft,
      top: rank.slice(0, 5).map((s) => ({ name: s.name, length: Math.floor(s.mass), me: s === P, color: skinColor(s.prep, this.t) })),
      powers: P ? Object.entries(P.power).filter(([, v]) => v > 0).map(([k, v]) => ({ type: k, left: v })) : [],
      ghost: P ? Math.max(0, P.ghost) : 0,
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
    g.fillStyle = '#1a1446';
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

    // candy-stripe border
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

    // pellets
    for (const p of this.pellets) {
      if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
      const s = p.r * 3.2 * (1 + 0.12 * Math.sin(t * 4 + p.ph));
      g.drawImage(pelletSprite(p.c), p.x - s / 2, p.y - s / 2, s, s);
    }

    // power-ups
    for (const pu of this.powerups) {
      if (pu.x < view.x0 - 60 || pu.x > view.x1 + 60 || pu.y < view.y0 - 60 || pu.y > view.y1 + 60) continue;
      const s = 76 + Math.sin(pu.ph * 4) * 6;
      g.drawImage(powerupSprite(pu.type), pu.x - s / 2, pu.y - s / 2 + Math.sin(pu.ph * 2.5) * 5, s, s);
    }

    // snakes (player on top)
    const P = this.player;
    for (const s of this.snakes) if (s.alive && s !== P) s.draw(g, t, view);
    if (P && P.alive) P.draw(g, t, view);

    // particles
    for (const p of this.particles) {
      g.globalAlpha = Math.max(0, p.life / p.max);
      g.fillStyle = p.c;
      g.beginPath();
      g.arc(p.x, p.y, p.s, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;

    // ---- screen-space overlays
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    for (const tx of this.texts) {
      const p = this.worldToScreen(tx);
      g.globalAlpha = Math.min(1, tx.life * 2);
      const size = tx.size * (1 + Math.max(0, tx.life - 0.9) * 2);
      g.font = `900 ${size}px ${FONT}`;
      g.lineWidth = 5;
      g.strokeStyle = 'rgba(30,10,60,0.9)';
      g.strokeText(tx.text, p.x, p.y);
      g.fillStyle = tx.color;
      g.fillText(tx.text, p.x, p.y);
    }
    g.globalAlpha = 1;
    this.drawLabels(g, sc, view);
    if (++this.frameNo % 6 === 0) this.drawMinimap();
  }

  drawLabels(g, sc, view) {
    const P = this.player;
    const leader = this.snakes.reduce((a, b) => (b.alive && (!a || b.mass > a.mass) ? b : a), null);
    const showNames = this.settings.showNames;
    for (const s of this.snakes) {
      if (!s.alive) continue;
      const h = s.head;
      if (h.x < view.x0 || h.x > view.x1 || h.y < view.y0 || h.y > view.y1) continue;
      const p = this.worldToScreen(h);
      const hr = s.radius() * 1.18 * sc;
      const hatH = s.skin.hat !== 'none' ? hr * 1.1 : 0;
      let y = p.y - hr - hatH - 14;
      const size = clamp(15 + hr * 0.3, 15, 24);
      let color = '#ffffff';
      if (P && P.alive && s !== P) color = s.mass > P.mass ? '#ff6b6b' : '#7cff8a';
      if (s.power.shield > 0) color = '#ffe14d';
      const label = (s === leader ? '👑 ' : '') + Math.floor(s.mass);
      g.font = `900 ${size}px ${FONT}`;
      g.lineWidth = 5;
      g.strokeStyle = 'rgba(20,8,50,0.85)';
      g.strokeText(label, p.x, y);
      g.fillStyle = color;
      g.fillText(label, p.x, y);
      if (showNames || s === P) {
        y -= size * 0.95;
        g.font = `800 12px ${FONT}`;
        g.lineWidth = 4;
        g.strokeText(s.name, p.x, y);
        g.fillStyle = s === P ? '#fff6a0' : 'rgba(255,255,255,0.9)';
        g.fillText(s.name, p.x, y);
      }
    }
  }

  drawMinimap() {
    if (this.mode !== 'play') return;
    const g = this.mmCtx, S = this.minimap.width, m = S / 2, k = (m - 4) / this.R;
    g.clearRect(0, 0, S, S);
    g.fillStyle = 'rgba(30,20,90,0.65)';
    g.beginPath(); g.arc(m, m, m - 2, 0, TAU); g.fill();
    g.strokeStyle = '#ff4fa3';
    g.lineWidth = 2 * this.mmScale;
    g.stroke();
    for (const pu of this.powerups) {
      g.fillStyle = POWERUPS[pu.type].color;
      g.fillRect(m + pu.x * k - 2, m + pu.y * k - 2, 4, 4);
    }
    const P = this.player;
    for (const s of this.snakes) {
      if (!s.alive || s === P) continue;
      g.fillStyle = skinColor(s.prep, this.t);
      g.beginPath();
      g.arc(m + s.head.x * k, m + s.head.y * k, (1.5 + s.radius() * 0.12) * this.mmScale, 0, TAU);
      g.fill();
    }
    if (P && P.alive) {
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#000000';
      g.lineWidth = 1.5 * this.mmScale;
      g.beginPath();
      g.arc(m + P.head.x * k, m + P.head.y * k, 4 * this.mmScale, 0, TAU);
      g.fill();
      g.stroke();
    }
  }
}
