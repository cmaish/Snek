// Simple, readable bot brains: avoid bigger snakes, chase smaller ones,
// otherwise hoover up pellets and power-ups.
import { rand, TAU } from './util.js';

export const DIFFICULTY = {
  easy: { react: 0.36, aggr: 0.2, avoid: 0.8, boost: 0.15, speed: 0.9 },
  normal: { react: 0.22, aggr: 0.5, avoid: 1.0, boost: 0.4, speed: 1.0 },
  hard: { react: 0.12, aggr: 0.85, avoid: 1.25, boost: 0.7, speed: 1.05 },
};

export function newBrain() {
  return { t: rand(0.3), prey: null, huntUntil: 0, restUntil: 0, food: null, foodUntil: 0, wander: rand(TAU) };
}

function canBeat(b, o) {
  if (o.ghost > 0) return false;
  if (b.power.shield > 0) return o.power.shield <= 0;
  return o.power.shield <= 0 && o.mass < b.mass * 0.92;
}

export function updateBot(b, game, dt) {
  const ai = b.ai;
  ai.t -= dt;
  if (ai.t > 0) return;
  const D = game.diff;
  ai.t = D.react * (0.7 + Math.random() * 0.6);

  const h = b.segs[0];
  const r = b.radius();
  const now = game.time;
  const shielded = b.power.shield > 0;

  // ---- 1. threats: push away from bodies we can't beat
  let ax = 0, ay = 0;
  const danger = (90 + r * 4) * D.avoid;
  const lx = h.x + Math.cos(b.angle) * r * 2, ly = h.y + Math.sin(b.angle) * r * 2;
  let prey = null, preyD = Infinity;
  const huntR = 320 + r * 10;
  for (const o of game.snakes) {
    if (o === b || !o.alive || o.ghost > 0) continue;
    if (canBeat(b, o)) {
      // give a fresh player a grace period, and hunt them a bit less eagerly
      if (o.isPlayer && (!game.settings.botsChasePlayer || game.time < 15 || Math.random() > 0.7)) continue;
      const oh = o.segs[0];
      const d = Math.hypot(oh.x - h.x, oh.y - h.y);
      if (d < huntR && d < preyD) { preyD = d; prey = o; }
      continue;
    }
    if (shielded) continue;
    const bb = o.bbox;
    if (lx < bb.x0 - danger || lx > bb.x1 + danger || ly < bb.y0 - danger || ly > bb.y1 + danger) continue;
    const segs = o.segs, step = segs.length > 60 ? 2 : 1, dg2 = danger * danger;
    for (let j = 0; j < segs.length; j += step) {
      const s = segs[j];
      const dx = lx - s.x, dy = ly - s.y, d2 = dx * dx + dy * dy;
      if (d2 < dg2) {
        const d = Math.sqrt(d2) || 1;
        let w = 1 - d / danger;
        w *= w * (j < 3 ? 2.5 : 1);
        ax += (dx / d) * w;
        ay += (dy / d) * w;
      }
    }
  }

  // ---- 2. hunting (with breaks so the player gets breathing room)
  if (ai.prey && (!ai.prey.alive || now > ai.huntUntil || !canBeat(b, ai.prey))) {
    ai.prey = null;
    ai.restUntil = now + rand(2, 5) / Math.max(0.3, D.aggr);
  }
  if (!ai.prey && prey && now > ai.restUntil && Math.random() < D.aggr) {
    ai.prey = prey;
    ai.huntUntil = now + rand(2.5, 5);
  }

  let gx = 0, gy = 0, hunting = false, huntDist = Infinity;
  if (ai.prey) {
    const ph = ai.prey.segs[0];
    const d = Math.hypot(ph.x - h.x, ph.y - h.y);
    const lead = Math.min(d * 0.6, 220);
    gx = ph.x + Math.cos(ai.prey.angle) * lead - h.x;
    gy = ph.y + Math.sin(ai.prey.angle) * lead - h.y;
    hunting = true;
    huntDist = d;
  } else {
    // ---- 3. food & power-ups
    let f = ai.food;
    if (!f || f.dead || f.eatenBy || now > ai.foodUntil) {
      f = null;
      let best = 0;
      for (const pu of game.powerups) {
        const d = Math.hypot(pu.x - h.x, pu.y - h.y);
        if (d < 700) { const sc = 8 / (d + 60); if (sc > best) { best = sc; f = pu; } }
      }
      for (const p of game.pellets) {
        if (p.eatenBy) continue;
        const dx = p.x - h.x, dy = p.y - h.y;
        if (dx > 600 || dx < -600 || dy > 600 || dy < -600) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        // prefer things roughly in front of us
        const ahead = (dx * Math.cos(b.angle) + dy * Math.sin(b.angle)) / (d || 1);
        const sc = (p.v / (d + 60)) * (1.2 + ahead);
        if (sc > best) { best = sc; f = p; }
      }
      ai.food = f;
      ai.foodUntil = now + rand(1.5, 3);
    }
    if (f) {
      gx = f.x - h.x;
      gy = f.y - h.y;
    } else {
      ai.wander += rand(-0.6, 0.6);
      gx = Math.cos(ai.wander);
      gy = Math.sin(ai.wander);
    }
  }
  const gl = Math.hypot(gx, gy) || 1;
  gx /= gl; gy /= gl;

  // ---- 4. stay away from the wall
  const dc = Math.hypot(h.x, h.y);
  const edge = game.R * 0.8;
  if (dc > edge) {
    const w = ((dc - edge) / (game.R - edge)) * 3;
    gx -= (h.x / dc) * w;
    gy -= (h.y / dc) * w;
  }

  b.targetAngle = Math.atan2(gy + ay * 2.6, gx + ax * 2.6);

  const threat = ax * ax + ay * ay > 0.3;
  b.boosting = b.mass > 18 && (
    (hunting && huntDist < 280 && Math.random() < D.boost) ||
    (threat && Math.random() < D.boost * 0.6)
  );
}
