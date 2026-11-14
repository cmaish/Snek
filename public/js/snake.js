import { TAU, clamp, angleDiff, rand, hslHex } from './util.js';
import { prepSkin, segSprite, drawFace, drawHat, glowSprite, ballSprite, taper } from './render.js';
import { drawCharHead, headTop } from './heads.js';

let NEXT_ID = 1;
export const BASE_SPEED = 170;
const SPACING = 0.5;     // segment spacing as a fraction of radius
const MIN_BOOST = 8;     // can't boost below this length
const BOOST_DRAIN = 2.2; // length lost per second while boosting
const ICE = '#cdf3ff';

export class Snake {
  constructor(o) {
    this.id = NEXT_ID++;
    this.name = o.name || 'Snek';
    this.setSkin(o.skin);
    this.headId = o.headId && o.headId !== 'snake' ? o.headId : null;
    this.isPlayer = !!o.isPlayer;
    this.mass = o.length;
    this.maxMass = this.mass;
    this.angle = o.angle || 0;
    this.targetAngle = this.angle;
    this.alive = true;
    this.boosting = false;
    this.boostNow = false;
    this.frozen = false;
    this.kills = 0;
    this.power = { magnet: 0, speed: 0, shield: 0, double: 0, giant: 0, freeze: 0, turbo: 0 };
    this.ghost = o.ghost || 0; // spawn protection: can't hurt or be hurt
    this.mouth = 0;
    this.biteCd = 0;
    this.blink = 0;
    this.blinkIn = rand(1, 4);
    this.tongue = 0;
    this.tongueIn = rand(2, 6);
    this.hurt = 0;
    this.dropAcc = 0;
    this.trailAcc = 0;
    this.speedMul = o.speedMul || 1;
    this.ai = null;
    this.bbox = { x0: 0, y0: 0, x1: 0, y1: 0 };
    this.placeAt(o.x, o.y, this.angle);
  }

  /** (Re)builds the body as a straight line ending at (x,y). */
  placeAt(x, y, angle) {
    this.angle = this.targetAngle = angle;
    const sp = this.radius() * SPACING, n = this.segTarget();
    this.segs = [];
    for (let i = 0; i < n; i++) this.segs.push({ x: x - Math.cos(angle) * i * sp, y: y - Math.sin(angle) * i * sp });
    this.calcBBox();
  }

  setSkin(skin) {
    this.skin = skin;
    this.prep = prepSkin(skin);
  }

  get head() { return this.segs[0]; }

  radius() {
    const r = 10 + Math.min(20, Math.sqrt(Math.max(0, this.mass - 8)) * 0.9);
    return this.power.giant > 0 ? r * 1.3 : r;
  }

  /** Size used when two snakes clash (the giant power-up counts extra). */
  clashMass() { return this.power.giant > 0 ? this.mass * 1.5 : this.mass; }

  segTarget() { return clamp(Math.round(6 + this.mass * 0.55), 6, 220); }

  get size() { return Math.floor(this.mass); }

  /** How far above the head centre the label should sit, in radii. */
  labelLift() { return this.headId ? 1.55 * headTop(this.headId) : 1.24 * (this.skin.hat !== 'none' ? 2.1 : 1); }

  grow(v) {
    const g = v * (this.power.double > 0 ? 2 : 1);
    this.mass += g;
    if (this.mass > this.maxMass) this.maxMass = this.mass;
    this.mouth = 1;
    return g;
  }

  update(dt, game) {
    const r = this.radius();
    this.frozen = game.freezeT > 0 && game.freezer !== this && this.power.shield <= 0;
    // Steering: bigger snakes turn a little slower.
    const turn = (5.4 / (1 + (r - 10) * 0.035)) * (this.frozen ? 0.6 : 1) * dt;
    const d = angleDiff(this.targetAngle, this.angle);
    this.angle += d > turn ? turn : d < -turn ? -turn : d;

    let sp = BASE_SPEED * this.speedMul;
    this.boostNow = false;
    if (this.power.speed > 0) {
      sp *= 1.65;
      this.boostNow = true;
    } else if (this.boosting && (this.mass > MIN_BOOST || this.power.turbo > 0)) {
      sp *= 1.75;
      this.boostNow = true;
      if (this.power.turbo <= 0) {
        const drain = BOOST_DRAIN * dt;
        this.mass -= drain;
        this.dropAcc += drain;
        if (this.dropAcc > 0.9) {
          const tail = this.segs[this.segs.length - 1];
          game.dropPellet(tail.x, tail.y, this.dropAcc * 0.7, this);
          this.dropAcc = 0;
        }
      }
    }
    if (this.frozen) sp *= 0.45;

    const h = this.segs[0];
    h.x += Math.cos(this.angle) * sp * dt;
    h.y += Math.sin(this.angle) * sp * dt;

    // Soft arena wall: slide along it and get nudged back inside.
    const dist = Math.hypot(h.x, h.y), lim = game.R - r;
    this.atWall = dist > lim;
    if (this.atWall) {
      h.x *= lim / dist;
      h.y *= lim / dist;
      const inward = Math.atan2(-h.y, -h.x);
      const dd = angleDiff(inward, this.angle);
      if (Math.abs(dd) > Math.PI / 2 - 0.3) this.angle += Math.sign(dd) * Math.min(Math.abs(dd), 3 * dt);
    }

    // Body follows the head like a rope.
    const segs = this.segs, spc = r * SPACING, spc2 = spc * spc;
    for (let i = 1; i < segs.length; i++) {
      const a = segs[i - 1], b = segs[i];
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 > spc2) {
        const k = spc / Math.sqrt(d2);
        b.x = a.x + dx * k;
        b.y = a.y + dy * k;
      }
    }
    const tgt = this.segTarget();
    while (segs.length < tgt) {
      const l = segs[segs.length - 1];
      segs.push({ x: l.x, y: l.y });
    }
    if (segs.length > tgt) segs.length = tgt;

    // sparkly trail while zooming
    if (this.boostNow) {
      this.trailAcc += dt;
      if (this.trailAcc > 0.05) {
        this.trailAcc = 0;
        const tail = segs[segs.length - 1];
        game.trail(tail.x, tail.y, this.power.shield > 0 ? hslHex(rand(360), 100, 70) : this.prep.main, r);
      }
    }

    for (const k in this.power) if (this.power[k] > 0) this.power[k] -= dt;
    if (this.ghost > 0) this.ghost -= dt;
    this.mouth = Math.max(0, this.mouth - dt * 4);
    this.biteCd -= dt;
    this.hurt -= dt;
    this.blinkIn -= dt;
    if (this.blinkIn < 0) { this.blink = 1; this.blinkIn = rand(2, 5); }
    this.blink = Math.max(0, this.blink - dt * 7);
    this.tongueIn -= dt;
    if (this.tongueIn < 0) { this.tongue = 0.35; this.tongueIn = rand(2.5, 6); }
    this.tongue -= dt;
    this.calcBBox();
  }

  calcBBox() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of this.segs) {
      if (s.x < x0) x0 = s.x;
      if (s.x > x1) x1 = s.x;
      if (s.y < y0) y0 = s.y;
      if (s.y > y1) y1 = s.y;
    }
    const r = this.radius() * 1.25;
    const b = this.bbox;
    b.x0 = x0 - r; b.y0 = y0 - r; b.x1 = x1 + r; b.y1 = y1 + r;
  }

  draw(g, t, view) {
    const bb = this.bbox;
    if (bb.x1 < view.x0 || bb.x0 > view.x1 || bb.y1 < view.y0 || bb.y0 > view.y1) return;
    const r = this.radius(), hr = r * 1.24, segs = this.segs, n = segs.length, p = this.prep;
    const vx0 = view.x0 - r, vx1 = view.x1 + r, vy0 = view.y0 - r, vy1 = view.y1 + r;
    g.save();
    if (this.ghost > 0) g.globalAlpha = 0.5 + 0.25 * Math.sin(t * 18);
    else if (this.hurt > 0) g.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(t * 30));

    // soft shadow (one path, cheap)
    const off = r * 0.45;
    g.fillStyle = 'rgba(8,4,40,0.3)';
    g.beginPath();
    for (let i = n - 1; i >= 0; i -= 2) {
      const s = segs[i];
      if (s.x < vx0 || s.x > vx1 || s.y < vy0 || s.y > vy1) continue;
      const ri = (i === 0 ? hr : r * taper(i, n));
      g.moveTo(s.x + off * 0.3 + ri, s.y + off);
      g.arc(s.x + off * 0.3, s.y + off, ri, 0, TAU);
    }
    g.fill();

    // glow for zoom / super star / giant
    if (this.boostNow || this.power.shield > 0 || this.power.giant > 0) {
      const col = this.power.shield > 0 ? hslHex((t * 300) % 360, 100, 65) : this.power.giant > 0 ? '#ff7b54' : p.main;
      const gl = glowSprite(col);
      const prev = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i += 3) {
        const s = segs[i], ri = r * taper(i, n) * 2.2;
        g.drawImage(gl, s.x - ri, s.y - ri, ri * 2, ri * 2);
      }
      g.globalCompositeOperation = prev;
    }

    for (let i = n - 1; i >= 1; i--) {
      const s = segs[i];
      if (s.x < vx0 || s.x > vx1 || s.y < vy0 || s.y > vy1) continue;
      const ri = r * taper(i, n);
      g.drawImage(segSprite(p, i, n, t), s.x - ri, s.y - ri, ri * 2, ri * 2);
    }
    if (this.frozen) {
      g.globalAlpha *= 0.55;
      const ice = ballSprite(ICE);
      for (let i = n - 1; i >= 1; i -= 2) {
        const s = segs[i], ri = r * taper(i, n);
        g.drawImage(ice, s.x - ri, s.y - ri, ri * 2, ri * 2);
      }
      g.globalAlpha /= 0.55;
    }

    const h = segs[0];
    if (this.power.shield > 0) {
      g.strokeStyle = hslHex((t * 400) % 360, 100, 70);
      g.lineWidth = 5;
      g.beginPath();
      g.arc(h.x, h.y, hr * 1.55 + Math.sin(t * 12) * 3, 0, TAU);
      g.stroke();
    }
    if (this.power.magnet > 0) {
      g.strokeStyle = 'rgba(255,79,109,0.5)';
      g.lineWidth = 3;
      g.setLineDash([8, 10]);
      g.lineDashOffset = -t * 40;
      g.beginPath();
      g.arc(h.x, h.y, hr * 3 + Math.sin(t * 6) * 4, 0, TAU);
      g.stroke();
      g.setLineDash([]);
    }
    if (this.ghost > 0 && this.ghost < 100) {
      // bubble shield
      g.fillStyle = 'rgba(160,220,255,0.18)';
      g.strokeStyle = 'rgba(200,240,255,0.8)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(h.x, h.y, hr * 1.9, 0, TAU);
      g.fill();
      g.stroke();
    }
    if (this.headId) {
      // character head: upright sticker that looks where it's going
      const cr = r * 1.55;
      drawCharHead(g, h.x, h.y, cr, this.headId, this.skin, { t, mouth: this.mouth, blink: this.blink, look: this.targetAngle });
      if (this.skin.hat && this.skin.hat !== 'none') drawHat(g, this.skin.hat, h.x, h.y - cr * Math.min(1.25, headTop(this.headId) * 0.8), cr * 0.85, t);
      g.restore();
      return;
    }
    g.drawImage(segSprite(p, 0, n, t), h.x - hr, h.y - hr, hr * 2, hr * 2);
    if (this.frozen) {
      g.globalAlpha *= 0.55;
      g.drawImage(ballSprite(ICE), h.x - hr, h.y - hr, hr * 2, hr * 2);
      g.globalAlpha /= 0.55;
    }
    drawFace(g, h.x, h.y, hr, this.angle, this.skin, {
      t, mouth: this.mouth, blink: this.blink, tongue: this.tongue > 0 && this.mouth < 0.1, look: this.targetAngle,
    });
    g.restore();
  }
}
