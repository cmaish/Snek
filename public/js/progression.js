// Long-term progression: player XP + levels, daily missions and trophies.
import { progress, saveProgress } from './storage.js';
import { totalAdventureStars } from './adventure.js';
import { HAT_ITEMS, TRAIL_ITEMS, THEME_ITEMS, MAKER_LEVEL } from './cosmetics.js';

// --------------------------------------------------------- player level ----
export const xpForLevel = (lv) => 80 + lv * 40; // xp needed to go from lv to lv+1
export const levelReward = (lv) => 20 + lv * 5;

/** Items that become free at exactly this level (shown on level-up). */
export function unlocksAtLevel(lv) {
  const out = [];
  for (const [list, kind] of [[HAT_ITEMS, '🎩'], [TRAIL_ITEMS, '✨'], [THEME_ITEMS, '🏟️']]) {
    for (const it of list) if (it.level === lv && it.price <= 0) out.push(`${kind} ${it.name}`);
  }
  if (lv === MAKER_LEVEL) out.push('🎨 Snake Maker');
  return out;
}

/** Adds XP; returns the levels gained with their coin rewards and unlocks. */
export function addXp(n) {
  const gained = [];
  progress.xp += Math.max(0, Math.round(n));
  while (progress.xp >= xpForLevel(progress.level)) {
    progress.xp -= xpForLevel(progress.level);
    progress.level++;
    const coins = levelReward(progress.level);
    progress.coins += coins;
    gained.push({ level: progress.level, coins, unlocks: unlocksAtLevel(progress.level) });
  }
  saveProgress();
  return gained;
}

// --------------------------------------------------------- daily missions ----
const POOL = [
  { id: 'eat', icon: '😋', text: (n) => `Eat ${n} snakes`, stat: 'kills', targets: [3, 5, 8] },
  { id: 'size', icon: '🐍', text: (n) => `Reach size ${n} in one match`, stat: 'maxSize', max: true, targets: [60, 120, 200] },
  { id: 'stars', icon: '⭐', text: (n) => `Collect ${n} bonus stars`, stat: 'stars', targets: [5, 10, 20] },
  { id: 'play', icon: '🎮', text: (n) => `Play ${n} matches`, stat: 'games', targets: [2, 3, 5] },
  { id: 'power', icon: '🎁', text: (n) => `Grab ${n} power-ups`, stat: 'powerups', targets: [3, 6, 10] },
  { id: 'combo', icon: '🔥', text: (n) => `Get a ×${n} combo`, stat: 'streak', max: true, targets: [2, 2, 3] },
  { id: 'win', icon: '👑', text: (n) => (n === 1 ? 'Finish #1 in a match' : `Finish #1 in ${n} matches`), stat: 'wins', targets: [1, 1, 2] },
  { id: 'adv', icon: '🗺️', text: (n) => `Earn ${n} Adventure stars`, stat: 'advStars', targets: [2, 3, 5] },
];

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

const tier = () => (progress.level < 5 ? 0 : progress.level < 12 ? 1 : 2);
export const missionReward = (m) => ({ coins: 40 + m.tier * 20, xp: 40 + m.tier * 20 });

/** Today's three missions (made fresh each day). */
export function dailyMissions() {
  const day = today();
  if (!progress.missions || progress.missions.day !== day) {
    const rnd = seeded(day);
    const pool = POOL.slice();
    const list = [];
    while (list.length < 3) {
      const def = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      const t = tier();
      list.push({ id: def.id, tier: t, target: def.targets[t], progress: 0, claimed: false });
    }
    progress.missions = { day, list };
    saveProgress();
  }
  return progress.missions.list;
}

export function missionDef(m) {
  return POOL.find((d) => d.id === m.id);
}

export function missionText(m) {
  return missionDef(m).text(m.target);
}

/** Apply one match's stats to today's missions; returns the ones just completed. */
export function recordMissionStats(stats) {
  const done = [];
  for (const m of dailyMissions()) {
    if (m.claimed || m.progress >= m.target) continue;
    const d = missionDef(m);
    const v = stats[d.stat] || 0;
    m.progress = Math.min(m.target, d.max ? Math.max(m.progress, v) : m.progress + v);
    if (m.progress >= m.target) done.push(m);
  }
  saveProgress();
  return done;
}

export function claimMission(i) {
  const m = dailyMissions()[i];
  if (!m || m.claimed || m.progress < m.target) return null;
  m.claimed = true;
  const r = missionReward(m);
  progress.coins += r.coins;
  const levels = addXp(r.xp);
  saveProgress();
  return { ...r, levels };
}

export function missionsClaimable() {
  return dailyMissions().filter((m) => !m.claimed && m.progress >= m.target).length;
}

// -------------------------------------------------------------- trophies ----
const owned = () => progress.unlocked.length + progress.unlockedHeads.length + progress.ownedHats.length + progress.ownedTrails.length + progress.ownedThemes.length;

export const TROPHIES = [
  { id: 'eater', icon: '😋', name: 'Snake Eater', desc: 'Snakes eaten', get: () => progress.kills, tiers: [10, 100, 500] },
  { id: 'big', icon: '🐍', name: 'Big Snek', desc: 'Biggest size', get: () => progress.best, tiers: [100, 250, 500] },
  { id: 'stars', icon: '⭐', name: 'Star Catcher', desc: 'Bonus stars collected', get: () => progress.totalStars, tiers: [25, 150, 500] },
  { id: 'games', icon: '🎮', name: 'Arena Regular', desc: 'Matches played', get: () => progress.games, tiers: [10, 50, 200] },
  { id: 'wins', icon: '👑', name: 'Champion', desc: 'Matches finished #1', get: () => progress.wins, tiers: [1, 10, 50] },
  { id: 'power', icon: '🎁', name: 'Power Player', desc: 'Power-ups grabbed', get: () => progress.totalPowerups, tiers: [10, 75, 300] },
  { id: 'adv', icon: '🗺️', name: 'Adventurer', desc: 'Adventure stars', get: () => totalAdventureStars(), tiers: [10, 48, 96] },
  { id: 'combo', icon: '🔥', name: 'Combo King', desc: 'Best combo', get: () => progress.bestStreak, tiers: [2, 4, 6] },
  { id: 'level', icon: '🆙', name: 'Level Up', desc: 'Player level', get: () => progress.level, tiers: [5, 15, 30] },
  { id: 'collector', icon: '🎨', name: 'Collector', desc: 'Things bought or unlocked', get: () => owned(), tiers: [10, 30, 60] },
];
export const TROPHY_REWARDS = [50, 150, 400];
export const MEDALS = ['🥉', '🥈', '🥇'];

/** How many tiers of this trophy have been reached / claimed. */
export function trophyState(t) {
  const v = t.get();
  const reached = t.tiers.filter((x) => v >= x).length;
  const claimed = progress.trophies[t.id] || 0;
  return { value: v, reached, claimed, next: t.tiers[Math.min(claimed, 2)] };
}

export function claimTrophy(id) {
  const t = TROPHIES.find((x) => x.id === id);
  const s = trophyState(t);
  if (s.claimed >= s.reached) return null;
  const coins = TROPHY_REWARDS[s.claimed];
  progress.trophies[id] = s.claimed + 1;
  progress.coins += coins;
  saveProgress();
  return { coins, medal: MEDALS[s.claimed] };
}

export function trophiesClaimable() {
  return TROPHIES.reduce((a, t) => { const s = trophyState(t); return a + Math.max(0, s.reached - s.claimed); }, 0);
}

// --------------------------------------------------- after every match ----
/** XP earned by a match result. */
export function matchXp(r, adventureStars = 0) {
  return Math.floor(r.maxLength / 3) + r.kills * 15 + (r.starsEaten || 0) * 3 + (r.rank === 1 && r.reason === 'time' ? 50 : 0) + adventureStars * 25 + 10;
}
