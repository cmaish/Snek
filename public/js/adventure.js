// Adventure mode: 4 worlds × 8 levels, each with a goal and 1–3 stars.
import { progress } from './storage.js';

export const WORLDS = [
  { id: 'meadow', name: 'Meadow Valley', icon: '🌿', theme: 'meadow', difficulty: 'easy', bots: 6, arena: 'small', seconds: 120, boss: { name: 'Big Bertha', head: 'bear', skin: 'choco' } },
  { id: 'candy', name: 'Candy Land', icon: '🍭', theme: 'candy', difficulty: 'easy', bots: 8, arena: 'small', seconds: 150, boss: { name: 'Sir Sugarfang', head: 'monster', skin: 'candy' } },
  { id: 'ocean', name: 'Ocean Deep', icon: '🌊', theme: 'ocean', difficulty: 'normal', bots: 10, arena: 'medium', seconds: 150, boss: { name: 'Captain Kraken', head: 'shark', skin: 'ocean' } },
  { id: 'space', name: 'Space Station', icon: '🚀', theme: 'space', difficulty: 'normal', bots: 12, arena: 'medium', seconds: 180, boss: { name: 'Galactic Gus', head: 'alien', skin: 'galaxy' } },
];

// [goal, target] per level; the 8th level of every world is a boss
const PLAN = [
  [['size', 30], ['eat', 1], ['stars', 3], ['size', 60], ['eat', 3], ['top', 1], ['stars', 6], ['boss', 45]],
  [['size', 80], ['eat', 4], ['stars', 8], ['combo', 2], ['size', 120], ['eat', 6], ['top', 1], ['boss', 90]],
  [['size', 150], ['stars', 10], ['eat', 8], ['top', 1], ['combo', 3], ['size', 200], ['eat', 10], ['boss', 150]],
  [['size', 250], ['eat', 12], ['stars', 15], ['combo', 3], ['top', 1], ['size', 350], ['eat', 15], ['boss', 240]],
];

export const LEVELS = PLAN.flatMap((list, w) => list.map(([goal, target], i) => ({
  index: w * PLAN[0].length + i,
  world: WORLDS[w],
  worldIndex: w,
  num: i + 1,
  goal,
  target,
  boss: goal === 'boss' ? WORLDS[w].boss : null,
})));

export function levelLabel(lv) {
  return `${lv.worldIndex + 1}-${lv.num}`;
}

export function goalText(lv) {
  const n = lv.target;
  switch (lv.goal) {
    case 'size': return `Grow to size ${n}`;
    case 'eat': return n === 1 ? 'Eat a snake' : `Eat ${n} snakes`;
    case 'stars': return `Collect ${n} ⭐ stars`;
    case 'top': return 'Be the biggest snake when time runs out';
    case 'combo': return `Eat ${n} snakes in a row (×${n} combo)`;
    case 'boss': return `Beat the boss: ${lv.boss.name}!`;
    default: return '';
  }
}

export function goalIcon(lv) {
  return { size: '🐍', eat: '😋', stars: '⭐', top: '👑', combo: '🔥', boss: '💀' }[lv.goal] || '🎯';
}

export function levelStars(i) {
  return (progress.adv && progress.adv[i]) || 0;
}

export function totalAdventureStars() {
  return Object.values(progress.adv || {}).reduce((a, b) => a + b, 0);
}

export function isLevelOpen(i) {
  return i === 0 || progress.advUnlockAll || levelStars(i - 1) > 0;
}

/** Stars earned for a finished level (0 = failed). */
export function starsFor(lv, r) {
  if (!r.goalDone) return 0;
  if (lv.goal === 'top') {
    const m = r.secondSize ? r.length / r.secondSize : 3;
    return m >= 2.5 ? 3 : m >= 1.5 ? 2 : 1;
  }
  const left = r.timeTotal ? r.timeLeft / r.timeTotal : 0;
  return left >= 0.5 ? 3 : left >= 0.25 ? 2 : 1;
}
