// Character heads (shiba, panda, robot…), drawn from reusable parts.
//
// Each head is built from: a base shape + colour, ears, things drawn behind
// the head (mane, antlers, spikes…), markings clipped onto the face, a nose,
// a mouth and optional extras. Colours can be '$1' / '$2' to borrow the
// body skin's first/second colour (e.g. the dragon matches its body).
//
// Heads are drawn upright, sticker style, and their eyes look where the snake
// is heading. The static parts are cached as a sprite per head + colours.
import { TAU, shade } from './util.js';

export const HEAD_DEFS = {
  snake: { name: 'Classic Snek', classic: true, price: 0 },
  shiba: { name: 'Shiba Inu', base: '#f0a04b', ears: ['pointy', '#f0a04b', '#fff1dc'], marks: [['cheeks', '#fff4e3'], ['brows', '#fff4e3']], nose: 'dog', mouth: 'w', blush: 1, price: 0 },
  puppy: { name: 'Puppy', base: '#d39a62', ears: ['floppy', '#8a5530'], marks: [['muzzle', '#f6dfc2']], nose: 'dog', mouth: 'tongue', price: 0 },
  cat: { name: 'Ginger Cat', base: '#ffb347', ears: ['pointy', '#ffb347', '#ffc9d6'], marks: [['stripes', '#e07b1a'], ['muzzle', '#fff1dc']], nose: 'cat', mouth: 'w', whiskers: 1, price: 0 },
  frog: { name: 'Froggy', base: '#5fd35f', shape: 'wide', behind: [['frogeyes', '#5fd35f']], eye: { ey: -0.62, ex: 0.48, er: 0.24 }, mouth: 'wide', blush: 1, price: 60 },
  chick: { name: 'Chick', base: '#ffe14d', behind: [['tuft', '#ffc400']], nose: 'beak', noseColor: '#ff8c1a', blush: 1, price: 60 },
  mouse: { name: 'Mouse', base: '#b9bec8', ears: ['big', '#b9bec8', '#ffb6c9'], nose: 'cat', mouth: 'w', whiskers: 1, price: 60 },
  bear: { name: 'Teddy Bear', base: '#9a6438', ears: ['round', '#9a6438', '#d29a68'], marks: [['muzzle', '#e7c49c']], nose: 'dog', mouth: 'smile', price: 60 },
  pig: { name: 'Piggy', base: '#ffaec0', ears: ['pig', '#ffaec0', '#ff86a3'], nose: 'pig', mouth: 'smile', blush: 1, price: 60 },
  hamster: { name: 'Hamster', base: '#f7b267', shape: 'wide', ears: ['small', '#f7b267', '#ffc9d6'], marks: [['cheeks', '#fff4e3']], nose: 'cat', mouth: 'w', blush: 1, price: 60 },
  panda: { name: 'Panda', base: '#ffffff', ears: ['round', '#232323', '#232323'], marks: [['eyepatches', '#232323']], nose: 'dog', mouth: 'w', price: 100 },
  bunny: { name: 'Bunny', base: '#ffffff', ears: ['long', '#ffffff', '#ffb6c9'], nose: 'cat', mouth: 'buck', blush: 1, whiskers: 1, price: 100 },
  dalmatian: { name: 'Dalmatian', base: '#ffffff', ears: ['floppy', '#2b2b2b'], marks: [['spots', '#2b2b2b']], nose: 'dog', mouth: 'tongue', price: 100 },
  fox: { name: 'Fox', base: '#f26b1d', shape: 'wide', ears: ['pointy', '#f26b1d', '#3a2418'], marks: [['foxcheeks', '#ffffff']], nose: 'dog', mouth: 'w', price: 100 },
  penguin: { name: 'Penguin', base: '#262b3d', marks: [['whiteface', '#ffffff']], nose: 'beak', noseColor: '#ffb020', blush: 1, price: 100 },
  koala: { name: 'Koala', base: '#9aa3ad', shape: 'wide', ears: ['big', '#9aa3ad', '#f2e8f0'], nose: 'koala', mouth: 'smile', price: 100 },
  sheep: { name: 'Sheep', base: '#4a3b36', behind: [['wool', '#ffffff']], ears: ['side', '#4a3b36', '#ffb6c9'], front: [['topwool', '#ffffff']], mouth: 'smile', eye: { ey: 0.02 }, price: 100 },
  monkey: { name: 'Monkey', base: '#8a5a3b', ears: ['side', '#8a5a3b', '#f0c9a0'], marks: [['facepatch', '#f0c9a0']], nose: 'nostrils', mouth: 'smile', price: 150 },
  raccoon: { name: 'Raccoon', base: '#8c8f99', ears: ['pointy', '#8c8f99', '#e6e6ea'], marks: [['mask', '#2f3038'], ['muzzle', '#f1f1f4']], nose: 'dog', mouth: 'w', price: 150 },
  cow: { name: 'Cow', base: '#ffffff', behind: [['horns', '#fff1c9']], ears: ['cow', '#ffffff', '#ffb6c9'], marks: [['spots', '#2b2b2b']], nose: 'snout', noseColor: '#ffb6c9', price: 150 },
  owl: { name: 'Owl', base: '#9b6b43', ears: ['tufts', '#9b6b43'], marks: [['owlface', '#f3dcb8']], eyes: 'owl', nose: 'beak', noseColor: '#ffb020', price: 150 },
  husky: { name: 'Husky', base: '#6d7a8c', ears: ['pointy', '#6d7a8c', '#f2f2f2'], marks: [['huskyface', '#f4f6fa']], iris: '#4fb3ff', nose: 'dog', mouth: 'w', price: 150 },
  blackcat: { name: 'Black Cat', base: '#2d2a3a', ears: ['pointy', '#2d2a3a', '#ff8fb0'], iris: '#9cff57', nose: 'cat', mouth: 'w', whiskers: 1, price: 150 },
  polar: { name: 'Polar Bear', base: '#f4f7fb', shape: 'wide', ears: ['round', '#f4f7fb', '#d9e2ee'], marks: [['muzzle', '#ffffff']], nose: 'dog', mouth: 'smile', price: 150 },
  hedgehog: { name: 'Hedgehog', base: '#f3d9b8', behind: [['spikes', '#6b4a32']], ears: ['small', '#c99c6c', '#f3d9b8'], nose: 'button', mouth: 'smile', blush: 1, price: 150 },
  tiger: { name: 'Tiger', base: '#ff9a2e', ears: ['round', '#ff9a2e', '#fff1dc'], marks: [['stripes', '#2b2b2b'], ['muzzle', '#ffffff']], nose: 'cat', mouth: 'w', whiskers: 1, price: 200 },
  lion: { name: 'Lion', base: '#f6c453', behind: [['mane', '#d9822b']], ears: ['small', '#f6c453', '#e8a33a'], marks: [['muzzle', '#fff1cf']], nose: 'cat', noseColor: '#7a3e1d', mouth: 'w', whiskers: 1, price: 200 },
  axolotl: { name: 'Axolotl', base: '#ffb3c8', shape: 'wide', behind: [['gills', '#ff5c9a']], mouth: 'smile', blush: 1, price: 200 },
  sloth: { name: 'Sloth', base: '#b08d6e', marks: [['slothface', '#e8d6bf']], eyes: 'sleepy', nose: 'koala', mouth: 'smile', price: 200 },
  bat: { name: 'Bat', base: '#5b3f8c', shape: 'wide', ears: ['bat', '#5b3f8c', '#ff8fb0'], nose: 'cat', noseColor: '#2b1d45', mouth: 'fangs', price: 200 },
  reindeer: { name: 'Reindeer', base: '#a0683f', behind: [['antlers', '#6b4226']], ears: ['pointy', '#a0683f', '#e2b98f'], marks: [['muzzle', '#e2b98f']], nose: 'red', mouth: 'smile', price: 200 },
  shark: { name: 'Shark', base: '#7f93a8', behind: [['fin', '#6b7f94']], marks: [['belly', '#f4f7fb']], eyes: 'round', mouth: 'sharp', price: 300 },
  dino: { name: 'Dino', base: '$1', shape: 'wide', marks: [['spots', '$2']], behind: [['dspikes', '$2']], nose: 'nostrils', mouth: 'sharp', price: 300 },
  ghost: { name: 'Ghost', base: '#f4f6ff', shape: 'ghost', eyes: 'ghost', mouth: 'o', blush: 1, price: 300 },
  pumpkin: { name: 'Pumpkin', base: '#ff8c1a', shape: 'pumpkin', behind: [['stem', '#6b4a2a']], marks: [['ribs', '#d9650a']], eyes: 'carved', mouth: 'carved', price: 300 },
  robot: { name: 'Robot', base: '#b8c4d4', shape: 'square', behind: [['antenna', '#ff4f6d']], marks: [['panel', '#94a3b8']], front: [['bolts', '#7b8794']], eyes: 'led', mouth: 'grill', price: 300 },
  alien: { name: 'Alien', base: '#7cf05a', shape: 'tall', behind: [['alienant', '#7cf05a']], eyes: 'alien', mouth: 'smile', price: 300 },
  ninja: { name: 'Ninja', base: '#23232f', marks: [['band', '#f4d3b0']], front: [['knot', '#e8122a']], mouth: 'none', price: 400 },
  astronaut: { name: 'Astronaut', base: '#f4f6fb', behind: [['antenna', '#ffd23f']], marks: [['visor', '#20264a']], mouth: 'smile', eye: { er: 0.18 }, price: 400 },
  monster: { name: 'Monster', base: '$1', behind: [['horn1', '#fff1c9']], eyes: 'cyclops', mouth: 'fangs', blush: 1, price: 400 },
  dragon: { name: 'Dragon', base: '$1', behind: [['horns', '#fff1c9'], ['dspikes', '$2']], marks: [['muzzle', '$2']], nose: 'nostrils', mouth: 'fangs', eyes: 'angry', price: 500 },
  unicorn: { name: 'Unicorn', base: '#ffffff', behind: [['unimane', '#ff9ff3']], ears: ['pointy', '#ffffff', '#ffc9e8'], front: [['horn', '#ffd86b']], mouth: 'smile', blush: 1, eyes: 'cute', price: 500 },
};

export const HEAD_IDS = Object.keys(HEAD_DEFS);

// ------------------------------------------------------------ helpers ----
function resolve(c, skin) {
  if (c === '$1') return skin.colors[0] || '#5be37d';
  if (c === '$2') return skin.colors[1] || shade(skin.colors[0] || '#5be37d', -0.3);
  return c;
}

const OUT = 0.14; // outline stroke width (half of it shows outside the fill)

/** Fill a path with a dark outline behind it. */
function solid(g, path, color, outline = true) {
  g.beginPath();
  path();
  if (outline) {
    g.lineWidth = OUT;
    g.lineJoin = 'round';
    g.strokeStyle = shade(color, -0.5);
    g.stroke();
  }
  g.fillStyle = color;
  g.fill();
}

function poly(pts) {
  return () => { g_.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g_.lineTo(pts[i][0], pts[i][1]); g_.closePath(); };
}
let g_ = null; // current context for poly()

function ell(x, y, rx, ry, rot = 0) {
  return () => { g_.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx); g_.ellipse(x, y, rx, ry, rot, 0, TAU); };
}

function shapePath(g, shape) {
  switch (shape) {
    case 'wide': g.ellipse(0, 0.02, 1.1, 0.94, 0, 0, TAU); break;
    case 'tall': g.ellipse(0, -0.04, 0.9, 1.08, 0, 0, TAU); break;
    case 'square': g.roundRect(-0.94, -0.9, 1.88, 1.8, 0.38); break;
    case 'ghost': {
      g.moveTo(-0.92, 0.05);
      g.arc(0, 0.05, 0.92, Math.PI, 0);
      g.lineTo(0.92, 0.85);
      for (let i = 0; i < 4; i++) {
        const x0 = 0.92 - i * 0.46;
        g.quadraticCurveTo(x0 - 0.115, 1.08, x0 - 0.23, 0.85);
        g.quadraticCurveTo(x0 - 0.345, 0.66, x0 - 0.46, 0.85);
      }
      g.closePath();
      break;
    }
    case 'pumpkin':
      g.moveTo(0.05, 0.05); g.ellipse(-0.45, 0.06, 0.62, 0.86, 0, 0, TAU);
      g.moveTo(1.07, 0.06); g.ellipse(0.45, 0.06, 0.62, 0.86, 0, 0, TAU);
      g.moveTo(0.62, 0.02); g.ellipse(0, 0.02, 0.62, 0.92, 0, 0, TAU);
      break;
    default: g.arc(0, 0, 1, 0, TAU);
  }
}

// ---------------------------------------------------------------- ears ----
function drawEar(g, type, s, c, inner) {
  switch (type) {
    case 'pointy':
      solid(g, poly([[s * 0.16, -0.76], [s * 0.96, -0.38], [s * 0.82, -1.26]]), c);
      if (inner) solid(g, poly([[s * 0.36, -0.7], [s * 0.82, -0.48], [s * 0.75, -1.02]]), inner, false);
      break;
    case 'round':
      solid(g, ell(s * 0.7, -0.72, 0.34, 0.34), c);
      if (inner) solid(g, ell(s * 0.7, -0.7, 0.19, 0.19), inner, false);
      break;
    case 'small':
      solid(g, ell(s * 0.62, -0.8, 0.23, 0.23), c);
      if (inner) solid(g, ell(s * 0.62, -0.78, 0.12, 0.12), inner, false);
      break;
    case 'big':
      solid(g, ell(s * 0.88, -0.55, 0.52, 0.52), c);
      if (inner) solid(g, ell(s * 0.85, -0.52, 0.32, 0.32), inner, false);
      break;
    case 'long':
      solid(g, ell(s * 0.36, -1.32, 0.23, 0.7, s * 0.18), c);
      if (inner) solid(g, ell(s * 0.37, -1.26, 0.11, 0.5, s * 0.18), inner, false);
      break;
    case 'tufts':
      solid(g, poly([[s * 0.35, -0.8], [s * 0.92, -0.5], [s * 0.9, -1.2]]), c);
      break;
    case 'bat':
      solid(g, poly([[s * 0.1, -0.75], [s * 1.0, -0.28], [s * 1.1, -1.42]]), c);
      if (inner) solid(g, poly([[s * 0.32, -0.68], [s * 0.9, -0.42], [s * 0.96, -1.14]]), inner, false);
      break;
    case 'side':
      solid(g, ell(s * 1.0, -0.02, 0.32, 0.32), c);
      if (inner) solid(g, ell(s * 1.0, -0.02, 0.18, 0.18), inner, false);
      break;
    case 'pig':
      solid(g, poly([[s * 0.28, -0.82], [s * 0.92, -0.6], [s * 0.86, -1.14]]), c);
      if (inner) solid(g, poly([[s * 0.42, -0.78], [s * 0.82, -0.64], [s * 0.78, -0.98]]), inner, false);
      break;
    case 'cow':
      solid(g, ell(s * 1.05, -0.38, 0.34, 0.17, s * 0.35), c);
      if (inner) solid(g, ell(s * 1.07, -0.38, 0.2, 0.09, s * 0.35), inner, false);
      break;
    case 'floppy': // drawn in front of the face
      solid(g, ell(s * 0.86, -0.1, 0.3, 0.64, s * -0.32), c);
      break;
  }
}

// -------------------------------------------------- behind / front bits ----
function drawBehind(g, type, c) {
  switch (type) {
    case 'mane': {
      const pts = Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * TAU; return [Math.cos(a) * 1.1, Math.sin(a) * 1.08 + 0.04]; });
      solid(g, () => { for (const [x, y] of pts) { g.moveTo(x + 0.4, y); g.arc(x, y, 0.4, 0, TAU); } }, c);
      break;
    }
    case 'wool': {
      const pts = Array.from({ length: 11 }, (_, i) => { const a = Math.PI * 0.85 + (i / 10) * Math.PI * 1.3; return [Math.cos(a) * 0.98, Math.sin(a) * 0.95]; });
      solid(g, () => { for (const [x, y] of pts) { g.moveTo(x + 0.36, y); g.arc(x, y, 0.36, 0, TAU); } }, c);
      break;
    }
    case 'spikes': {
      solid(g, () => {
        for (let i = 0; i <= 12; i++) {
          const a = Math.PI * 0.8 + (i / 12) * Math.PI * 1.4, b = 0.17;
          g.moveTo(Math.cos(a - b) * 0.85, Math.sin(a - b) * 0.85);
          g.lineTo(Math.cos(a) * 1.42, Math.sin(a) * 1.42);
          g.lineTo(Math.cos(a + b) * 0.85, Math.sin(a + b) * 0.85);
          g.closePath();
        }
      }, c);
      break;
    }
    case 'dspikes':
      solid(g, () => {
        for (const [x, h] of [[-0.42, 0.28], [0, 0.4], [0.42, 0.28]]) {
          const y = -Math.sqrt(1 - x * x) + 0.05;
          g.moveTo(x - 0.17, y + 0.05); g.lineTo(x, y - h); g.lineTo(x + 0.17, y + 0.05); g.closePath();
        }
      }, c);
      break;
    case 'horns':
      for (const s of [-1, 1]) {
        solid(g, () => {
          g.moveTo(s * 0.36, -0.72);
          g.quadraticCurveTo(s * 0.98, -0.82, s * 0.98, -1.38);
          g.quadraticCurveTo(s * 0.72, -0.92, s * 0.62, -0.56);
          g.closePath();
        }, c);
      }
      break;
    case 'horn1':
      solid(g, poly([[-0.24, -0.82], [0.24, -0.82], [0.02, -1.5]]), c);
      break;
    case 'fin':
      solid(g, () => { g.moveTo(-0.38, -0.8); g.quadraticCurveTo(-0.05, -1.25, 0.18, -1.6); g.quadraticCurveTo(0.18, -1.1, 0.42, -0.82); g.closePath(); }, c);
      break;
    case 'gills':
      for (const s of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const y0 = -0.42 + k * 0.32, x1 = s * (1.42 - Math.abs(k - 1) * 0.12), y1 = -0.85 + k * 0.42;
          g.lineCap = 'round';
          g.strokeStyle = shade(c, -0.45);
          g.lineWidth = 0.26;
          g.beginPath(); g.moveTo(s * 0.7, y0); g.lineTo(x1, y1); g.stroke();
          g.strokeStyle = c;
          g.lineWidth = 0.15;
          g.stroke();
          solid(g, ell(x1, y1, 0.12, 0.12), shade(c, 0.2));
        }
      }
      break;
    case 'tuft':
      g.lineCap = 'round';
      g.lineWidth = 0.1;
      g.strokeStyle = c;
      for (const [x, k] of [[-0.15, -1], [0.05, 1], [0.22, 1]]) {
        g.beginPath(); g.moveTo(x, -0.9); g.quadraticCurveTo(x + k * 0.05, -1.3, x + k * 0.22, -1.24); g.stroke();
      }
      break;
    case 'antlers':
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (const s of [-1, 1]) {
        for (const [w, col] of [[0.24, shade(c, -0.45)], [0.14, c]]) {
          g.lineWidth = w;
          g.strokeStyle = col;
          g.beginPath();
          g.moveTo(s * 0.35, -0.8); g.lineTo(s * 0.72, -1.58);
          g.moveTo(s * 0.52, -1.18); g.lineTo(s * 0.98, -1.26);
          g.moveTo(s * 0.64, -1.42); g.lineTo(s * 0.46, -1.78);
          g.stroke();
        }
      }
      break;
    case 'antenna':
      g.lineCap = 'round';
      g.lineWidth = 0.1;
      g.strokeStyle = '#5c6b7a';
      g.beginPath(); g.moveTo(0, -0.88); g.lineTo(0, -1.38); g.stroke();
      solid(g, ell(0, -1.44, 0.16, 0.16), c);
      break;
    case 'alienant':
      g.lineCap = 'round';
      for (const s of [-1, 1]) {
        g.lineWidth = 0.1;
        g.strokeStyle = shade(c, -0.35);
        g.beginPath(); g.moveTo(s * 0.3, -0.98); g.quadraticCurveTo(s * 0.35, -1.35, s * 0.6, -1.48); g.stroke();
        solid(g, ell(s * 0.6, -1.5, 0.14, 0.14), '#ffe14d');
      }
      break;
    case 'stem':
      solid(g, () => { g.moveTo(-0.1, -0.82); g.quadraticCurveTo(-0.05, -1.2, 0.18, -1.32); g.lineTo(0.24, -1.2); g.quadraticCurveTo(0.08, -1.1, 0.1, -0.82); g.closePath(); }, c);
      solid(g, ell(-0.32, -1.02, 0.24, 0.1, -0.4), '#5cc95c');
      break;
    case 'frogeyes':
      for (const s of [-1, 1]) solid(g, ell(s * 0.48, -0.62, 0.38, 0.36), c);
      break;
    case 'unimane':
      for (const [x, y, col] of [[-0.6, -0.86, '#ffd1f0'], [-0.92, -0.45, '#ff9ff3'], [-1.0, 0.02, '#c8a8ff'], [-0.88, 0.46, '#9be7ff']]) {
        solid(g, ell(x, y, 0.36, 0.36), col);
      }
      break;
  }
}

function drawFront(g, type, c, def) {
  switch (type) {
    case 'horn': {
      g.save();
      g.beginPath();
      g.moveTo(-0.18, -0.78); g.lineTo(0.18, -0.78); g.lineTo(0.02, -1.62); g.closePath();
      g.lineWidth = OUT;
      g.strokeStyle = '#c99a2e';
      g.stroke();
      const gr = g.createLinearGradient(0, -0.8, 0, -1.6);
      gr.addColorStop(0, c); gr.addColorStop(1, '#fff6c4');
      g.fillStyle = gr;
      g.fill();
      g.clip();
      g.strokeStyle = 'rgba(201,154,46,0.8)';
      g.lineWidth = 0.06;
      for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-0.3, -0.85 - k * 0.2); g.lineTo(0.3, -1.0 - k * 0.2); g.stroke(); }
      g.restore();
      break;
    }
    case 'topwool':
      solid(g, () => { for (const [x, y] of [[-0.38, -0.72], [0, -0.86], [0.38, -0.72], [-0.18, -0.62], [0.2, -0.62]]) { g.moveTo(x + 0.27, y); g.arc(x, y, 0.27, 0, TAU); } }, c);
      break;
    case 'bolts':
      for (const s of [-1, 1]) solid(g, ell(s * 1.0, 0.05, 0.13, 0.2), c);
      break;
    case 'knot':
      solid(g, poly([[0.82, -0.12], [1.32, -0.38], [1.25, -0.02]]), c);
      solid(g, poly([[0.82, -0.08], [1.28, 0.12], [1.1, 0.32]]), c);
      break;
    case 'floppy':
      break;
  }
  void def;
}

// ------------------------------------------------------------ markings ----
const SPOTS = [[-0.5, -0.52, 0.24], [0.56, -0.24, 0.17], [-0.22, 0.62, 0.15], [0.3, -0.78, 0.13], [0.72, 0.45, 0.2], [-0.82, 0.12, 0.16]];

function drawMark(g, type, c, def) {
  const f = (path) => { g.beginPath(); path(); g.fillStyle = c; g.fill(); };
  switch (type) {
    case 'cheeks':
      f(() => { g.ellipse(0, 0.62, 0.9, 0.55, 0, 0, TAU); g.moveTo(1, 0.32); g.ellipse(0.55, 0.32, 0.42, 0.32, 0, 0, TAU); g.moveTo(-0.13, 0.32); g.ellipse(-0.55, 0.32, 0.42, 0.32, 0, 0, TAU); });
      break;
    case 'brows':
      f(() => { g.ellipse(-0.33, -0.42, 0.1, 0.07, 0, 0, TAU); g.moveTo(0.43, -0.42); g.ellipse(0.33, -0.42, 0.1, 0.07, 0, 0, TAU); });
      break;
    case 'muzzle':
      f(() => g.ellipse(0, 0.4, 0.5, 0.36, 0, 0, TAU));
      break;
    case 'spots':
      f(() => { for (const [x, y, r] of SPOTS) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); } });
      break;
    case 'stripes':
      f(() => {
        for (const s of [-1, 1]) {
          g.moveTo(s * 0.1, -1.05); g.lineTo(s * 0.02, -0.62); g.lineTo(s * 0.2, -1.0);
          g.moveTo(s * 0.48, -0.95); g.lineTo(s * 0.36, -0.58); g.lineTo(s * 0.62, -0.85);
          g.moveTo(s * 1.05, -0.2); g.lineTo(s * 0.7, -0.08); g.lineTo(s * 1.05, 0.0);
          g.moveTo(s * 1.05, 0.15); g.lineTo(s * 0.75, 0.25); g.lineTo(s * 1.0, 0.33);
        }
      });
      break;
    case 'eyepatches':
      f(() => { for (const s of [-1, 1]) { g.moveTo(s * 0.36 + 0.26, -0.02); g.ellipse(s * 0.36, -0.02, 0.26, 0.33, s * -0.55, 0, TAU); } });
      break;
    case 'mask':
      f(() => { g.ellipse(-0.42, -0.06, 0.48, 0.27, -0.15, 0, TAU); g.moveTo(0.9, -0.06); g.ellipse(0.42, -0.06, 0.48, 0.27, 0.15, 0, TAU); });
      break;
    case 'huskyface':
      f(() => { g.ellipse(0, 0.4, 0.72, 0.6, 0, 0, TAU); g.moveTo(-0.16, 0); g.lineTo(0, -0.78); g.lineTo(0.16, 0); g.closePath(); });
      f(() => { g.ellipse(-0.33, -0.4, 0.11, 0.08, 0, 0, TAU); g.moveTo(0.44, -0.4); g.ellipse(0.33, -0.4, 0.11, 0.08, 0, 0, TAU); });
      break;
    case 'foxcheeks':
      f(() => { g.ellipse(-0.55, 0.45, 0.55, 0.42, 0.2, 0, TAU); g.moveTo(1.1, 0.45); g.ellipse(0.55, 0.45, 0.55, 0.42, -0.2, 0, TAU); });
      break;
    case 'facepatch':
      f(() => { g.arc(-0.3, -0.06, 0.37, 0, TAU); g.moveTo(0.67, -0.06); g.arc(0.3, -0.06, 0.37, 0, TAU); g.moveTo(0.56, 0.36); g.ellipse(0, 0.36, 0.56, 0.42, 0, 0, TAU); });
      break;
    case 'whiteface':
      f(() => { g.arc(-0.33, -0.08, 0.44, 0, TAU); g.moveTo(0.77, -0.08); g.arc(0.33, -0.08, 0.44, 0, TAU); g.moveTo(0.66, 0.35); g.ellipse(0, 0.35, 0.66, 0.52, 0, 0, TAU); });
      break;
    case 'owlface':
      f(() => { g.arc(-0.37, -0.05, 0.42, 0, TAU); g.moveTo(0.79, -0.05); g.arc(0.37, -0.05, 0.42, 0, TAU); });
      break;
    case 'belly':
      f(() => g.ellipse(0, 0.82, 1.0, 0.6, 0, 0, TAU));
      break;
    case 'slothface':
      f(() => g.ellipse(0, 0.12, 0.82, 0.62, 0, 0, TAU));
      g.beginPath();
      for (const s of [-1, 1]) { g.moveTo(s * 0.38 + 0.32, 0.02); g.ellipse(s * 0.38, 0.02, 0.32, 0.15, s * 0.38, 0, TAU); }
      g.fillStyle = '#5a3d27';
      g.fill();
      break;
    case 'panel':
      g.strokeStyle = c;
      g.lineWidth = 0.06;
      g.beginPath(); g.roundRect(-0.7, -0.62, 1.4, 1.22, 0.24); g.stroke();
      break;
    case 'visor': {
      g.beginPath();
      g.ellipse(0, 0.04, 0.74, 0.6, 0, 0, TAU);
      g.fillStyle = c;
      g.fill();
      g.lineWidth = 0.1;
      g.strokeStyle = '#c9d2e6';
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = 0.08;
      g.lineCap = 'round';
      g.beginPath(); g.arc(0, 0.04, 0.6, -2.6, -1.9); g.stroke();
      break;
    }
    case 'band':
      f(() => g.rect(-1.2, -0.34, 2.4, 0.46));
      break;
    case 'ribs':
      g.strokeStyle = c;
      g.lineWidth = 0.06;
      for (const x of [-0.45, 0.45]) { g.beginPath(); g.ellipse(x * 0.5, 0.04, Math.abs(x) * 0.5 + 0.05, 0.86, 0, 0, TAU); g.stroke(); }
      break;
  }
  void def;
}

// ----------------------------------------------------------- nose/mouth ----
function drawNose(g, type, base, def) {
  const dark = '#2a1a1f';
  switch (type) {
    case 'dog':
      g.beginPath();
      g.moveTo(-0.16, 0.12); g.quadraticCurveTo(0, 0.06, 0.16, 0.12); g.quadraticCurveTo(0.14, 0.26, 0, 0.3); g.quadraticCurveTo(-0.14, 0.26, -0.16, 0.12);
      g.fillStyle = dark; g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.beginPath(); g.ellipse(-0.05, 0.14, 0.05, 0.03, 0, 0, TAU); g.fill();
      break;
    case 'cat':
      g.beginPath(); g.moveTo(-0.1, 0.16); g.lineTo(0.1, 0.16); g.lineTo(0, 0.27); g.closePath();
      g.fillStyle = def.noseColor || '#ff7aa2'; g.fill();
      break;
    case 'pig':
      solid(g, ell(0, 0.32, 0.32, 0.22), shade(base, -0.12));
      g.fillStyle = shade(base, -0.55);
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 0.1, 0.32, 0.05, 0.08, 0, 0, TAU); g.fill(); }
      break;
    case 'snout':
      solid(g, ell(0, 0.46, 0.52, 0.32), def.noseColor || '#ffb6c9');
      g.fillStyle = shade(def.noseColor || '#ffb6c9', -0.5);
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 0.2, 0.44, 0.06, 0.09, 0, 0, TAU); g.fill(); }
      break;
    case 'beak':
      solid(g, poly([[-0.17, 0.1], [0.17, 0.1], [0, 0.42]]), def.noseColor || '#ffb020');
      break;
    case 'button':
      g.fillStyle = dark; g.beginPath(); g.arc(0, 0.22, 0.08, 0, TAU); g.fill();
      break;
    case 'koala':
      g.fillStyle = '#2a2a33'; g.beginPath(); g.ellipse(0, 0.22, 0.18, 0.24, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(-0.05, 0.12, 0.05, 0.07, 0, 0, TAU); g.fill();
      break;
    case 'red':
      solid(g, ell(0, 0.26, 0.15, 0.15), '#ff2e4d');
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(-0.05, 0.21, 0.045, 0, TAU); g.fill();
      break;
    case 'nostrils':
      g.fillStyle = shade(base, -0.55);
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 0.13, 0.22, 0.045, 0.06, 0, 0, TAU); g.fill(); }
      break;
  }
}

/** Static (closed) mouth. Returns the y where an open mouth should go. */
function drawMouth(g, type, base) {
  const dark = '#3a1424';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = dark;
  g.lineWidth = 0.06;
  switch (type) {
    case 'w':
      g.beginPath(); g.arc(-0.08, 0.3, 0.08, 0.1, Math.PI - 0.1); g.moveTo(0.16, 0.31); g.arc(0.08, 0.3, 0.08, 0.1, Math.PI - 0.1); g.stroke();
      return 0.42;
    case 'smile':
      g.beginPath(); g.arc(0, 0.26, 0.2, 0.35, Math.PI - 0.35); g.stroke();
      return 0.42;
    case 'tongue':
      g.beginPath(); g.arc(0, 0.26, 0.22, 0.3, Math.PI - 0.3); g.stroke();
      solid(g, () => { g.moveTo(-0.11, 0.45); g.lineTo(0.11, 0.45); g.quadraticCurveTo(0.12, 0.68, 0, 0.68); g.quadraticCurveTo(-0.12, 0.68, -0.11, 0.45); }, '#ff6f91');
      return 0.45;
    case 'buck':
      g.fillStyle = '#ffffff';
      g.beginPath(); g.roundRect(-0.085, 0.32, 0.08, 0.12, 0.02); g.roundRect(0.005, 0.32, 0.08, 0.12, 0.02); g.fill();
      g.lineWidth = 0.03; g.stroke();
      g.lineWidth = 0.06;
      g.beginPath(); g.arc(-0.08, 0.28, 0.08, 0.1, Math.PI - 0.1); g.moveTo(0.16, 0.29); g.arc(0.08, 0.28, 0.08, 0.1, Math.PI - 0.1); g.stroke();
      return 0.42;
    case 'fangs':
      g.beginPath(); g.arc(0, 0.2, 0.3, 0.4, Math.PI - 0.4); g.stroke();
      g.fillStyle = '#ffffff';
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.17, 0.43); g.lineTo(s * 0.07, 0.46); g.lineTo(s * 0.13, 0.6); g.closePath(); g.fill(); g.lineWidth = 0.03; g.stroke(); }
      return 0.44;
    case 'sharp': {
      g.beginPath(); g.moveTo(-0.55, 0.36); g.quadraticCurveTo(0, 0.62, 0.55, 0.36); g.lineWidth = 0.07; g.stroke();
      g.fillStyle = '#ffffff';
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const x = -0.42 + i * 0.17, y = 0.36 + 0.26 * (1 - Math.pow(x / 0.55, 2)) * 0.5;
        g.moveTo(x - 0.07, y - 0.02); g.lineTo(x, y + 0.11); g.lineTo(x + 0.07, y - 0.02);
      }
      g.fill();
      return 0.48;
    }
    case 'wide':
      g.lineWidth = 0.07;
      g.beginPath(); g.arc(0, -0.05, 0.62, 0.45, Math.PI - 0.45); g.stroke();
      return 0.5;
    case 'grill':
      g.fillStyle = '#3b4656';
      g.beginPath(); g.roundRect(-0.36, 0.34, 0.72, 0.2, 0.06); g.fill();
      g.strokeStyle = '#94a3b8'; g.lineWidth = 0.04;
      for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(-0.36 + i * 0.144, 0.36); g.lineTo(-0.36 + i * 0.144, 0.52); g.stroke(); }
      return 0.44;
    case 'o':
      g.fillStyle = dark; g.beginPath(); g.ellipse(0, 0.4, 0.1, 0.13, 0, 0, TAU); g.fill();
      return 0.4;
    case 'carved':
      g.beginPath();
      g.moveTo(-0.5, 0.28); g.lineTo(-0.32, 0.38); g.lineTo(-0.2, 0.28); g.lineTo(-0.06, 0.4); g.lineTo(0.08, 0.28); g.lineTo(0.22, 0.4);
      g.lineTo(0.34, 0.28); g.lineTo(0.5, 0.3); g.quadraticCurveTo(0.2, 0.72, -0.5, 0.28);
      g.fillStyle = '#4a1d00'; g.fill();
      g.fillStyle = 'rgba(255,214,90,0.6)';
      g.fill();
      return 0.46;
    default:
      return 0.4;
  }
  void base;
}

// ------------------------------------------------------- sprite cache ----
const RES = 256, UNIT = 54, SCALE = RES / UNIT;
const cache = new Map();

function needsSkin(def) {
  return JSON.stringify(def).includes('$');
}

function headSprite(def, id, skin) {
  const key = id + (needsSkin(def) ? '|' + skin.colors.slice(0, 2).join(',') : '');
  let c = cache.get(key);
  if (c) return c;
  if (cache.size > 300) cache.clear();
  c = document.createElement('canvas');
  c.width = c.height = RES;
  const g = c.getContext('2d');
  g_ = g;
  g.translate(RES / 2, RES / 2);
  g.scale(UNIT, UNIT);
  const base = resolve(def.base, skin);
  const R = (x) => resolve(x, skin);

  for (const [t, col] of def.behind || []) drawBehind(g, t, R(col));
  if (def.ears && def.ears[0] !== 'floppy') for (const s of [-1, 1]) drawEar(g, def.ears[0], s, R(def.ears[1]), def.ears[2] && R(def.ears[2]));

  // head shape with outline
  g.beginPath();
  shapePath(g, def.shape);
  g.lineWidth = OUT;
  g.lineJoin = 'round';
  g.strokeStyle = shade(base, -0.5);
  g.stroke();
  g.fillStyle = base;
  g.fill();

  // markings + soft shading, clipped to the head
  g.save();
  g.beginPath();
  shapePath(g, def.shape);
  g.clip();
  for (const [t, col] of def.marks || []) drawMark(g, t, R(col), def);
  const gr = g.createRadialGradient(-0.35, -0.45, 0.05, 0, 0, 1.35);
  gr.addColorStop(0, 'rgba(255,255,255,0.4)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0)');
  gr.addColorStop(1, 'rgba(20,0,40,0.25)');
  g.fillStyle = gr;
  g.fillRect(-1.6, -1.6, 3.2, 3.2);
  g.restore();

  if (def.ears && def.ears[0] === 'floppy') for (const s of [-1, 1]) drawEar(g, 'floppy', s, R(def.ears[1]));
  for (const [t, col] of def.front || []) drawFront(g, t, R(col), def);

  if (def.blush) {
    g.fillStyle = 'rgba(255,90,140,0.4)';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 0.6, 0.24, 0.17, 0.11, 0, 0, TAU); g.fill(); }
  }
  if (def.whiskers) {
    g.strokeStyle = def.base === '#2d2a3a' ? 'rgba(255,255,255,0.7)' : 'rgba(60,30,30,0.55)';
    g.lineWidth = 0.035;
    g.lineCap = 'round';
    for (const s of [-1, 1]) for (const k of [-1, 0, 1]) {
      g.beginPath(); g.moveTo(s * 0.32, 0.26 + k * 0.06); g.lineTo(s * 0.88, 0.2 + k * 0.14); g.stroke();
    }
  }
  if (def.nose) drawNose(g, def.nose, base, def);
  def._mouthY = drawMouth(g, def.mouth || 'none', base);
  g_ = null;
  cache.set(key, c);
  return c;
}

// --------------------------------------------------------------- eyes ----
function drawEyes(g, def, skin, base, look, blink, t) {
  const style = def.eyes || skin.eyes || 'round';
  const e = def.eye || {};
  const ex = e.ex ?? 0.36, ey = e.ey ?? -0.08, er = e.er ?? 0.21;
  const lx = Math.cos(look), ly = Math.sin(look);
  const dark = '#16121f';
  const circle = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };

  if (style === 'cool') {
    g.fillStyle = '#111122';
    g.beginPath();
    for (const s of [-1, 1]) { g.moveTo(s * ex + er * 1.25, ey); g.ellipse(s * ex, ey, er * 1.25, er * 1.0, 0, 0, TAU); }
    g.fill();
    g.fillRect(-ex, ey - er * 0.6, ex * 2, er * 0.35);
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 0.05;
    g.lineCap = 'round';
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * ex - er * 0.6, ey - er * 0.3); g.lineTo(s * ex - er * 0.2, ey - er * 0.6); g.stroke(); }
    return;
  }
  if (style === 'cyclops') {
    const r = er * 1.9;
    g.save(); g.translate(0, ey - 0.05); g.scale(1, Math.max(0.1, 1 - blink));
    g.fillStyle = '#fff'; circle(0, 0, r);
    g.lineWidth = 0.05; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.stroke();
    g.fillStyle = '#7cff6b'; circle(lx * r * 0.3, ly * r * 0.3, r * 0.55);
    g.fillStyle = dark; circle(lx * r * 0.35, ly * r * 0.35, r * 0.3);
    g.fillStyle = '#fff'; circle(lx * r * 0.35 + r * 0.12, ly * r * 0.35 - r * 0.15, r * 0.12);
    g.restore();
    return;
  }
  for (const s of [-1, 1]) {
    g.save();
    g.translate(s * ex, ey);
    g.scale(1, Math.max(0.1, 1 - blink));
    switch (style) {
      case 'led': {
        g.fillStyle = '#1b2433';
        g.beginPath(); g.roundRect(-er * 1.1, -er * 0.8, er * 2.2, er * 1.6, er * 0.4); g.fill();
        g.fillStyle = '#5ff7ff';
        g.shadowColor = '#5ff7ff';
        g.shadowBlur = 6;
        g.beginPath(); g.roundRect(-er * 0.7 + lx * er * 0.3, -er * 0.45 + ly * er * 0.25, er * 1.4, er * 0.9, er * 0.25); g.fill();
        g.shadowBlur = 0;
        break;
      }
      case 'owl': {
        const r = er * 1.35;
        g.fillStyle = '#fff'; circle(0, 0, r);
        g.fillStyle = '#ffb020'; circle(lx * r * 0.2, ly * r * 0.2, r * 0.72);
        g.fillStyle = dark; circle(lx * r * 0.25, ly * r * 0.25, r * 0.42);
        g.fillStyle = '#fff'; circle(lx * r * 0.25 + r * 0.15, ly * r * 0.25 - r * 0.18, r * 0.14);
        break;
      }
      case 'alien':
        g.fillStyle = '#111122';
        g.beginPath(); g.ellipse(0, 0, er * 1.15, er * 1.55, s * 0.45, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.85)';
        circle(-s * er * 0.3 + lx * er * 0.2, -er * 0.5 + ly * er * 0.2, er * 0.28);
        break;
      case 'ghost':
        g.fillStyle = dark;
        g.beginPath(); g.ellipse(lx * er * 0.15, ly * er * 0.15, er * 0.75, er * 1.0, 0, 0, TAU); g.fill();
        g.fillStyle = '#fff'; circle(lx * er * 0.15 + er * 0.25, ly * er * 0.15 - er * 0.4, er * 0.22);
        break;
      case 'carved':
        g.fillStyle = '#4a1d00';
        g.beginPath(); g.moveTo(-er * 1.1, er * 0.7); g.lineTo(er * 1.1, er * 0.7); g.lineTo(s * er * 0.3, -er * 1.0); g.closePath(); g.fill();
        g.fillStyle = `rgba(255,214,90,${0.5 + 0.2 * Math.sin(t * 6)})`;
        g.fill();
        break;
      default: {
        const r = er * (style === 'cute' ? 1.15 : style === 'silly' ? (s < 0 ? 1.2 : 0.85) : 1);
        g.fillStyle = '#fff'; circle(0, 0, r);
        g.lineWidth = 0.05; g.strokeStyle = 'rgba(0,0,0,0.3)'; g.stroke();
        if (blink < 0.6) {
          const pr = r * (style === 'cute' ? 0.7 : 0.55);
          let px = lx * r * 0.32, py = ly * r * 0.32;
          if (style === 'silly') { px = -s * r * 0.3; py = r * 0.1; }
          if (def.iris) { g.fillStyle = def.iris; circle(px, py, pr * 1.35); }
          g.fillStyle = dark; circle(px, py, pr * (def.iris ? 0.75 : 1));
          g.fillStyle = '#fff';
          circle(px + pr * 0.35, py - pr * 0.4, pr * (style === 'cute' ? 0.38 : 0.3));
          if (style === 'cute') circle(px - pr * 0.3, py + pr * 0.35, pr * 0.15);
        }
        if (style === 'sleepy') {
          g.fillStyle = shade(base, -0.1);
          g.beginPath(); g.arc(0, 0, r * 1.06, Math.PI, 0); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 0.05;
          g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0); g.stroke();
        }
      }
    }
    g.restore();
    if (style === 'angry') {
      g.strokeStyle = dark;
      g.lineWidth = 0.09;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(s * (ex + er * 1.05), ey - er * 1.55); g.lineTo(s * (ex - er * 0.95), ey - er * 0.85); g.stroke();
    }
  }
}

// ------------------------------------------------------------- public ----
/**
 * Draw character head `id` (not 'snake') centred at (x,y) with radius r.
 * `look` is the screen-space direction the eyes should look.
 */
export function drawCharHead(g, x, y, r, id, skin, st = {}) {
  const def = HEAD_DEFS[id];
  if (!def || def.classic) return false;
  const spr = headSprite(def, id, skin);
  const S = r * SCALE;
  g.drawImage(spr, x - S / 2, y - S / 2, S, S);
  const base = resolve(def.base, skin);
  g.save();
  g.translate(x, y);
  g.scale(r, r);
  drawEyes(g, def, skin, base, st.look ?? 0, st.blink || 0, st.t || 0);
  const m = st.mouth || 0;
  if (m > 0.08 && def.mouth !== 'none') {
    const my = def._mouthY ?? 0.4;
    g.fillStyle = '#3a0b1e';
    g.beginPath(); g.ellipse(0, my, 0.12 + 0.12 * m, 0.04 + 0.16 * m, 0, 0, TAU); g.fill();
    g.fillStyle = '#ff6f91';
    g.beginPath(); g.ellipse(0, my + 0.08 * m, 0.09 * m, 0.06 * m, 0, 0, TAU); g.fill();
  }
  g.restore();
  return true;
}

/** Top of a character head (for placing hats and labels), in radii. */
export function headTop(id) {
  const def = HEAD_DEFS[id];
  if (!def || def.classic) return 1;
  if (def.ears && ['long', 'bat'].includes(def.ears[0])) return 1.9;
  if ((def.behind || []).some(([t]) => ['antlers', 'fin', 'horn1', 'antenna', 'alienant', 'horns'].includes(t))) return 1.6;
  if ((def.front || []).some(([t]) => t === 'horn')) return 1.6;
  return def.ears ? 1.3 : 1.05;
}
