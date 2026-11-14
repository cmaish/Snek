// Touch (floating joystick + boost button), mouse and keyboard controls.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.enabled = false;
    this.mode = matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
    this.touchId = null;
    this.origin = null;
    this.touchAngle = null;
    this.extraTouches = new Set();
    this.boostBtn = false;
    this.mouse = null;
    this.mouseDown = false;
    this.keys = new Set();
    this.keyAngle = null;
    this.joy = document.getElementById('joystick');
    this.knob = this.joy.querySelector('.knob');

    canvas.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('blur', () => this.reset());

    const bb = document.getElementById('btn-boost');
    const on = (e) => { e.preventDefault(); this.boostBtn = true; bb.classList.add('on'); };
    const off = () => { this.boostBtn = false; bb.classList.remove('on'); };
    bb.addEventListener('pointerdown', on);
    bb.addEventListener('pointerup', off);
    bb.addEventListener('pointercancel', off);
    bb.addEventListener('pointerleave', off);
  }

  reset() {
    this.touchId = null;
    this.origin = null;
    this.touchAngle = null;
    this.extraTouches.clear();
    this.boostBtn = false;
    this.mouseDown = false;
    this.keys.clear();
    this.keyAngle = null;
    this.joy.classList.add('hidden');
    document.getElementById('btn-boost').classList.remove('on');
  }

  down(e) {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse') {
      this.mode = 'mouse';
      this.mouse = { x: e.clientX, y: e.clientY };
      if (e.button === 0 || e.button === 2) this.mouseDown = true;
      return;
    }
    e.preventDefault();
    this.mode = 'touch';
    document.body.classList.add('touch');
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (this.touchId === null) {
      this.touchId = e.pointerId;
      this.origin = { x: e.clientX, y: e.clientY };
      this.joy.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      this.knob.style.transform = 'translate(-50%, -50%)';
      this.joy.classList.remove('hidden');
    } else {
      // a second finger anywhere = boost
      this.extraTouches.add(e.pointerId);
    }
  }

  move(e) {
    if (e.pointerType === 'mouse') {
      this.mouse = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.pointerId !== this.touchId || !this.origin) return;
    let dx = e.clientX - this.origin.x, dy = e.clientY - this.origin.y;
    const d = Math.hypot(dx, dy);
    if (d > 8) this.touchAngle = Math.atan2(dy, dx);
    const max = 55;
    if (d > max) {
      // floating joystick: drag the base along so reversing is instant
      this.origin.x = e.clientX - (dx / d) * max;
      this.origin.y = e.clientY - (dy / d) * max;
      this.joy.style.transform = `translate(${this.origin.x}px, ${this.origin.y}px)`;
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  up(e) {
    if (e.pointerType === 'mouse') {
      this.mouseDown = false;
      return;
    }
    if (e.pointerId === this.touchId) {
      this.touchId = null;
      this.origin = null;
      this.joy.classList.add('hidden');
    }
    this.extraTouches.delete(e.pointerId);
  }

  key(e, down) {
    const k = e.key.toLowerCase();
    const map = { arrowup: 'u', w: 'u', arrowdown: 'd', s: 'd', arrowleft: 'l', a: 'l', arrowright: 'r', d: 'r', ' ': 'b', shift: 'b' };
    const m = map[k];
    if (!m) return;
    if (this.enabled) e.preventDefault();
    if (down) this.keys.add(m); else this.keys.delete(m);
    const x = (this.keys.has('r') ? 1 : 0) - (this.keys.has('l') ? 1 : 0);
    const y = (this.keys.has('d') ? 1 : 0) - (this.keys.has('u') ? 1 : 0);
    if (x || y) {
      this.keyAngle = Math.atan2(y, x);
      this.mode = 'keys';
    }
  }

  /** Desired heading for the player, or null to keep going straight. */
  angleFor(screenHead) {
    if (this.mode === 'keys') return this.keyAngle;
    if (this.mode === 'touch') return this.touchAngle;
    if (this.mouse && screenHead) {
      const dx = this.mouse.x - screenHead.x, dy = this.mouse.y - screenHead.y;
      if (dx * dx + dy * dy > 100) return Math.atan2(dy, dx);
    }
    return null;
  }

  get boost() {
    return this.boostBtn || this.extraTouches.size > 0 || this.mouseDown || this.keys.has('b');
  }
}
