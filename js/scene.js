// The swarm. Deterministic: a fixed-step sim driven only by the time passed to update(t),
// so the live page and the frame-by-frame reel render produce the same motion.

const TAU = Math.PI * 2;
const DT = 1 / 60;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const ease = (k) => k * k * (3 - 2 * k);

export const ROLE_COLORS = {
  research: '#2463D1',
  design: '#7A3FD1',
  write: '#D97F00',
  code: '#0B8F65',
  review: '#D62E78',
  deploy: '#1C1A17',
};
const ROLE_SHARE = [['research', 0.18], ['design', 0.12], ['write', 0.2], ['code', 0.32], ['review', 0.12], ['deploy', 0.06]];

export const WEB_BEATS = {
  spawn: 0.9, research: 1.1, design: 2.8, build: 4.2, buildEnd: 9.6, review: 8.8, bug: 10.0,
  fix: 13.6, deploy: 14.2, done: 15.6, end: 24,
};

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let z = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Paper dart sprites -------------------------------------------------------------------

export function dartSprite(color, size, dpr) {
  const px = Math.ceil(size * 2.4 * dpr);
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const x = c.getContext('2d');
  x.translate(px / 2, px / 2);
  x.scale((size * dpr) / 10, (size * dpr) / 10);
  // Points along +x: top wing, then a darker fold underneath.
  x.fillStyle = color;
  x.beginPath(); x.moveTo(10, 0); x.lineTo(-8, -7); x.lineTo(-3.5, 0); x.closePath(); x.fill();
  x.globalAlpha = 0.72;
  x.beginPath(); x.moveTo(10, 0); x.lineTo(-8, 7); x.lineTo(-3.5, 0); x.closePath(); x.fill();
  return c;
}

// ---- The little website the swarm builds ----------------------------------------------------

const PAGE_W = 800, CHROME_H = 34, PAGE_H = 666;
const SERIF = 'Fraunces, Georgia, serif', SANS = '"Instrument Sans", system-ui, sans-serif';
const CORAL = '#F0603F', NAVY = '#14213D', SUN = '#FFC145', TEAL = '#1FA6A0';

function kite(c, x, y, w, h, a, b, tail = true, rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot);
  if (tail) {
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(0, h * 0.62);
    c.bezierCurveTo(w * 0.5, h * 1.0, -w * 0.5, h * 1.25, w * 0.15, h * 1.6); c.stroke();
    [[0.2, 0.9], [-0.05, 1.18], [0.05, 1.42]].forEach(([u, v], i) => {
      c.fillStyle = i % 2 ? b : a;
      c.beginPath(); c.ellipse(w * u, h * v, w * 0.09, h * 0.035, 0.5, 0, TAU); c.fill();
    });
  }
  c.fillStyle = a;
  c.beginPath(); c.moveTo(0, -h * 0.5); c.lineTo(w * 0.5, -h * 0.1); c.lineTo(0, h * 0.62); c.closePath(); c.fill();
  c.fillStyle = b;
  c.beginPath(); c.moveTo(0, -h * 0.5); c.lineTo(-w * 0.5, -h * 0.1); c.lineTo(0, h * 0.62); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(-w * 0.5, -h * 0.1); c.lineTo(w * 0.5, -h * 0.1); c.moveTo(0, -h * 0.5); c.lineTo(0, h * 0.62); c.stroke();
  c.restore();
}

function round(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }

function card(c, x, title, price, a, b, bg) {
  c.fillStyle = '#FFFFFF'; round(c, x, 336, 228, 176, 12); c.fill();
  c.strokeStyle = '#E9E2D2'; c.lineWidth = 1; c.stroke();
  c.fillStyle = bg; round(c, x + 8, 344, 212, 112, 8); c.fill();
  kite(c, x + 114, 388, 56, 66, a, b, false, 0.25);
  c.fillStyle = NAVY; c.font = `600 15px ${SANS}`; c.textBaseline = 'alphabetic'; c.fillText(title, x + 14, 481);
  c.fillStyle = '#6B6457'; c.font = `400 13px ${SANS}`; c.fillText(price, x + 14, 500);
}

const BLOCKS = [
  { id: 'nav', role: 'code', rect: [0, 0, 800, 52], at: [0, 0.2], paint(c) {
    kite(c, 50, 25, 20, 26, CORAL, NAVY, false);
    c.fillStyle = NAVY; c.font = `600 17px ${SERIF}`; c.textBaseline = 'middle'; c.fillText('Paper Kite Co.', 68, 27);
    c.font = `500 13px ${SANS}`; c.fillStyle = '#524C41';
    ['Kites', 'Workshop', 'Journal'].forEach((s, i) => c.fillText(s, 490 + i * 72, 27));
    c.fillStyle = NAVY; round(c, 702, 13, 62, 28, 14); c.fill();
    c.fillStyle = '#fff'; c.font = `600 12px ${SANS}`; c.fillText('Shop', 719, 27);
  } },
  { id: 'art', role: 'design', rect: [424, 66, 344, 252], at: [0.08, 0.55], dir: 'y', paint(c) {
    const g = c.createLinearGradient(0, 66, 0, 318);
    g.addColorStop(0, '#1D3C8F'); g.addColorStop(0.62, '#E8739A'); g.addColorStop(1, '#FFC88A');
    c.fillStyle = g; round(c, 424, 66, 344, 252, 16); c.fill();
    c.save(); round(c, 424, 66, 344, 252, 16); c.clip();
    c.fillStyle = SUN; c.beginPath(); c.arc(662, 262, 46, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.28)';
    [[470, 268, 70], [530, 284, 52], [720, 296, 72]].forEach(([x, y, r]) => { c.beginPath(); c.ellipse(x, y, r, r * 0.26, 0, 0, TAU); c.fill(); });
    c.restore();
    kite(c, 530, 138, 84, 104, CORAL, '#FFD9A0', true, -0.18);
    kite(c, 668, 112, 54, 66, SUN, TEAL, true, 0.22);
    kite(c, 626, 206, 36, 44, '#FFFFFF', '#9CC7FF', true, 0.1);
  } },
  { id: 'headline', role: 'write', rect: [36, 74, 380, 112], at: [0.05, 0.35], lines: [[36, 78, 236, 52], [36, 130, 356, 52]], paint(c) {
    c.fillStyle = NAVY; c.font = `600 45px ${SERIF}`; c.textBaseline = 'alphabetic';
    c.fillText('Kites that', 36, 120); c.fillText('fly themselves.', 36, 172);
  } },
  { id: 'sub', role: 'write', rect: [36, 190, 370, 50], at: [0.25, 0.45], lines: [[36, 194, 324, 22], [36, 216, 240, 22]], paint(c) {
    c.fillStyle = '#524C41'; c.font = `400 15px ${SANS}`; c.textBaseline = 'alphabetic';
    c.fillText('Hand-folded, wind-tested, and ready', 36, 210); c.fillText('the moment you step outside.', 36, 232);
  } },
  { id: 'cta', role: 'code', rect: [36, 254, 170, 46], at: [0.35, 0.5], paint(c) {
    c.fillStyle = CORAL; round(c, 36, 254, 170, 46, 23); c.fill();
    c.fillStyle = '#fff'; c.font = `600 15px ${SANS}`; c.textBaseline = 'middle'; c.textAlign = 'center';
    c.fillText('Find your wind', 121, 278); c.textAlign = 'left';
  } },
  { id: 'card1', role: 'code', rect: [36, 336, 228, 176], at: [0.4, 0.62], dir: 'y', paint(c) { card(c, 36, 'The Dawn Diamond', '$48', CORAL, SUN, '#FDE8DC'); } },
  { id: 'card2', role: 'code', rect: [286, 336, 228, 176], at: [0.48, 0.7], dir: 'y', paint(c) { card(c, 286, 'Little Delta', '$32', TEAL, NAVY, '#DDF3F0'); } },
  { id: 'card3', role: 'code', rect: [536, 336, 228, 176], at: [0.56, 0.78], dir: 'y', paint(c) { card(c, 536, 'Long Tail', '$64', '#7A3FD1', '#E8739A', '#EEE5FA'); } },
  { id: 'band', role: 'code', rect: [0, 528, 800, 70], at: [0.68, 0.82], paint(c) { c.fillStyle = NAVY; c.fillRect(0, 528, 800, 70); } },
  { id: 'bandText', role: 'write', rect: [36, 540, 728, 46], at: [0.76, 0.9], lines: [[36, 544, 340, 38], [540, 544, 224, 38]], paint(c) {
    c.fillStyle = '#fff'; c.font = `italic 500 25px ${SERIF}`; c.textBaseline = 'middle'; c.fillText('12 knots is all you need.', 36, 563);
    c.fillStyle = SUN; c.font = `500 14px ${SANS}`; c.textAlign = 'right'; c.fillText('Free repairs for life', 764, 563); c.textAlign = 'left';
  } },
  { id: 'footer', role: 'code', rect: [0, 598, 800, 68], at: [0.85, 1], paint(c) {
    c.fillStyle = '#F4EEE1'; c.fillRect(0, 598, 800, 68);
    c.fillStyle = '#6B6457'; c.font = `400 12px ${SANS}`; c.textBaseline = 'middle';
    c.fillText('Paper Kite Co. is made up. The swarm built it for fun.', 36, 632);
    ['Shipping', 'Repairs', 'Contact'].forEach((s, i) => c.fillText(s, 590 + i * 62, 632));
  } },
];

// ---- Scene ---------------------------------------------------------------------------------

export class Scene {
  // opts: { pageCanvas, agentCanvas, width, height, dpr, pageRect:{x,y,w}, N, beats, glyphs, restRect, scale }
  constructor(opts) {
    Object.assign(this, opts);
    this.glyphs = (opts.glyphs || []).map((g) => ({ ...g }));
    this.pc = this.pageCanvas.getContext('2d');
    this.ac = this.agentCanvas.getContext('2d');
    for (const cv of [this.pageCanvas, this.agentCanvas]) {
      cv.width = Math.round(this.width * this.dpr);
      cv.height = Math.round(this.height * this.dpr);
    }
    this.s = this.pageRect.w / PAGE_W;
    this.pageRect.h = (PAGE_H + CHROME_H) * this.s;
    this.buildBlocks();
    this.buildActivity();
    this.buildAgents();
    this.reset();
  }

  // Page coords -> canvas coords.
  px(x) { return this.pageRect.x + x * this.s; }
  py(y) { return this.pageRect.y + (CHROME_H + y) * this.s; }

  buildBlocks() {
    this.blocks = BLOCKS.map((b, i) => {
      const [x, y, w, h] = b.rect;
      const k = this.s * this.dpr;
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(w * k); cv.height = Math.ceil(h * k);
      const c = cv.getContext('2d');
      c.scale(k, k); c.translate(-x, -y);
      b.paint(c);
      const wireA = (i / BLOCKS.length) * 0.75;
      return { ...b, cv, k, wire: [wireA, wireA + 0.25], lines: b.lines || [b.rect], dir: b.dir || 'x' };
    });
    this.ctaC = { x: this.px(121), y: this.py(277) };
    this.roleBlocks = {};
    for (const b of this.blocks) (this.roleBlocks[b.role] ||= []).push(b);
  }

  blockP(b, t) {
    const B = this.beats;
    return ease(prog(t, lerp(B.build, B.buildEnd, b.at[0]), lerp(B.build, B.buildEnd, b.at[1])));
  }
  wireP(b, t) {
    const B = this.beats;
    return ease(prog(t, lerp(B.design, B.build, b.wire[0]), lerp(B.design, B.build, b.wire[1])));
  }

  // Where the "write head" of a block is at progress p, in page coords.
  frontier(b, p) {
    const n = b.lines.length;
    const q = clamp(p) * n;
    const li = Math.min(n - 1, Math.floor(q));
    const [x, y, w, h] = b.lines[li];
    const u = q - li;
    return b.dir === 'y' ? [x + w * 0.5, y + h * u] : [x + w * u, y + h * 0.5];
  }

  // Share of the swarm burning tokens at time t. Integrated into the cost curve so the
  // meter visibly races when every agent piles onto the bug.
  activity(t) {
    const B = this.beats;
    if (t < B.spawn) return 0;
    if (t < B.design) return 0.3;
    if (t < B.build) return 0.5;
    if (t < B.review) return 0.86;
    if (t < B.bug) return 0.6;
    if (t < B.bug + 0.25) return 0.2;
    if (t < B.fix) return 1;
    if (t < B.deploy) return 0.28;
    if (t < B.done) return 0.12;
    return 0;
  }

  buildActivity() {
    const B = this.beats, dt = 0.02;
    const table = [0];
    let sum = 0;
    for (let t = 0; t < B.done + dt; t += dt) { sum += this.activity(t) * dt; table.push(sum); }
    this.fTable = table.map((v) => v / sum);
    this.fDt = dt;
  }

  // Fraction of the total bill spent by time t.
  spent(t) {
    const q = clamp(t / this.fDt, 0, this.fTable.length - 1);
    const i = Math.floor(q);
    return lerp(this.fTable[i], this.fTable[Math.min(i + 1, this.fTable.length - 1)], q - i);
  }

  phase(t) {
    const B = this.beats;
    for (const g of this.glyphs) if (t >= g.t0 && t < g.t1) return { label: 'running', tone: 'ok' };
    if (t < B.spawn) return { label: 'waiting for a task', tone: 'idle' };
    if (t < B.design) return { label: 'research', tone: 'ok' };
    if (t < B.build) return { label: 'design', tone: 'ok' };
    if (t < B.review) return { label: 'write + code', tone: 'ok' };
    if (t < B.bug) return { label: 'review', tone: 'ok' };
    if (t < B.fix) return { label: 'build failed: all agents on one bug', tone: 'bad' };
    if (t < B.deploy) return { label: 'bug fixed', tone: 'ok' };
    if (t < B.done) return { label: 'deploy', tone: 'ok' };
    return { label: 'live', tone: 'ok' };
  }

  buildAgents() {
    const N = this.N;
    const r = rng(7);
    this.X = new Float32Array(N); this.Y = new Float32Array(N);
    this.VX = new Float32Array(N); this.VY = new Float32Array(N);
    this.H = new Float32Array(N); this.A = new Float32Array(N);
    this.spawnT = new Float32Array(N);
    this.u = new Float32Array(N); this.v = new Float32Array(N);
    this.gx = new Float32Array(N); this.gy = new Float32Array(N);
    this.p1 = new Float32Array(N); this.p2 = new Float32Array(N);
    this.spd = new Float32Array(N); this.roleOf = new Array(N);

    // Fixed role quotas, shuffled so a role never spawns as one contiguous clump.
    const roles = [];
    ROLE_SHARE.forEach(([name, share]) => { for (let i = 0; i < Math.max(1, Math.round(N * share)); i++) roles.push(name); });
    while (roles.length < N) roles.push('code');
    roles.length = N;
    for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [roles[i], roles[j]] = [roles[j], roles[i]]; }

    for (let i = 0; i < N; i++) {
      this.roleOf[i] = roles[i];
      this.spawnT[i] = Math.pow(r(), 0.6) * 0.7;
      this.u[i] = r(); this.v[i] = r();
      const a = r() * TAU, m = Math.sqrt(-2 * Math.log(r() + 1e-6));
      this.gx[i] = Math.cos(a) * m; this.gy[i] = Math.sin(a) * m;
      this.p1[i] = r() * TAU; this.p2[i] = r() * TAU;
      this.spd[i] = 0.72 + r() * 0.56;
    }

    this.dartSize = clamp(42 / Math.pow(N, 0.25), 5, 20) * (this.scale || 1);
    this.sprites = {};
    for (const [name, col] of Object.entries(ROLE_COLORS)) this.sprites[name] = dartSprite(col, this.dartSize, this.dpr);
    this.orchSprite = dartSprite(ROLE_COLORS.deploy, 20 * (this.scale || 1), this.dpr);

    // A few named agents wear tags, like cursors in a shared doc.
    this.tagged = [];
    for (const [name] of ROLE_SHARE) {
      const i = roles.indexOf(name);
      if (i >= 0) this.tagged.push({ i, label: `${name}-${String((i * 37) % Math.max(N, 1000)).padStart(3, '0')}` });
    }

    for (const g of this.glyphs) g.pts = this.sampleGlyph(g);
  }

  sampleGlyph(g) {
    const down = 2, w = Math.ceil(g.box.w / down), h = Math.ceil(g.box.h / down);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d', { willReadFrequently: true });
    let size = h;
    c.font = `700 ${size}px ${SANS}`;
    while (c.measureText(g.text).width > w * 0.98 && size > 8) { size -= 2; c.font = `700 ${size}px ${SANS}`; }
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#000';
    c.fillText(g.text, w / 2, h * 0.54);
    const d = c.getImageData(0, 0, w, h).data;
    const pts = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 128) pts.push(x, y);
    const count = pts.length / 2, r = rng(11), out = new Float32Array(this.N * 2);
    for (let i = 0; i < this.N; i++) {
      const k = Math.floor(r() * count);
      out[i * 2] = g.box.x + pts[k * 2] * down;
      out[i * 2 + 1] = g.box.y + pts[k * 2 + 1] * down;
    }
    return out;
  }

  reset() {
    this.simT = 0;
    this.orch = { x: this.px(400), y: this.py(250) };
    for (let i = 0; i < this.N; i++) {
      this.X[i] = this.orch.x; this.Y[i] = this.orch.y;
      this.VX[i] = this.VY[i] = 0; this.A[i] = 0; this.H[i] = this.p1[i];
      this.launched = this.launched || new Uint8Array(this.N);
      this.launched[i] = 0;
    }
    this.firedFix = false;
  }

  update(t) {
    if (t < this.simT - 1e-6) this.reset();
    while (this.simT + DT <= t + 1e-6) this.step(this.simT), (this.simT += DT);
    this.t = t;
  }

  step(T) {
    const B = this.beats, s = this.s;
    const glyph = this.glyphs.find((g) => T >= g.t0 && T < g.t1);
    const ring = T >= B.bug + 0.25 && T < B.fix;
    const deploy = T >= B.deploy && T < B.done;
    const rest = T >= B.done;
    const maxS = (ring ? 1500 : glyph ? 1300 : 760) * s;
    const steer = ring || glyph ? 9 : 5;

    if (!this.firedFix && T >= B.fix) {
      this.firedFix = true;
      for (let i = 0; i < this.N; i++) {
        const dx = this.X[i] - this.ctaC.x, dy = this.Y[i] - this.ctaC.y, d = Math.hypot(dx, dy) + 1;
        const kick = (500 + 1400 * this.u[i]) * s;
        this.VX[i] += (dx / d) * kick; this.VY[i] += (dy / d) * kick;
      }
    }

    // Which blocks need hands right now, per role.
    const active = {};
    for (const b of this.blocks) {
      const p = this.blockP(b, T);
      if (p > 0 && p < 1) (active[b.role] ||= []).push({ b, p });
    }
    const wires = [];
    for (const b of this.blocks) { const p = this.wireP(b, T); if (p > 0 && p < 1) wires.push({ b, p }); }

    const R = this.pageRect;
    for (let i = 0; i < this.N; i++) {
      const born = B.spawn + this.spawnT[i];
      if (T < born) continue;
      if (!this.launched[i]) {
        this.launched[i] = 1;
        const a = this.p1[i], k = (300 + 900 * this.v[i]) * s;
        this.VX[i] = Math.cos(a) * k; this.VY[i] = Math.sin(a) * k;
      }
      this.A[i] = Math.min(1, this.A[i] + DT * 5);

      let tx, ty;
      const role = this.roleOf[i], u = this.u[i], v = this.v[i];
      if (glyph) {
        tx = glyph.pts[i * 2]; ty = glyph.pts[i * 2 + 1];
      } else if (ring) {
        const q = ease(prog(T, B.bug + 0.25, B.bug + 0.25 + (B.fix - B.bug) * 0.7));
        const rad = (lerp(250, 58, q) + (i % 9) * 6 + this.gx[i] * lerp(26, 8, q)) * s;
        const ang = this.p1[i] + T * (2.2 + u * 1.3) * (1 + q * 0.6);
        tx = this.ctaC.x + Math.cos(ang) * rad * lerp(1, 2.05, q); ty = this.ctaC.y + Math.sin(ang) * rad * lerp(1, 1.05, q);
      } else if (deploy) {
        // Everyone streams up into the address bar.
        tx = R.x + R.w * (0.3 + 0.4 * u) + this.gx[i] * 10 * s; ty = R.y + 17 * s + this.gy[i] * 5 * s;
      } else if (rest) {
        const a = this.p2[i] + T * 0.18 * this.spd[i];
        const rx = R.w * (0.53 + 0.08 * u), ry = R.h * (0.5 + 0.06 * v);
        tx = R.x + R.w / 2 + Math.cos(a) * rx; ty = R.y + R.h / 2 + Math.sin(a) * ry;
      } else {
        let task = null;
        if (role === 'research' && T < B.design + 0.7) {
          // Roam the whole page, reading.
          tx = R.x + R.w * (0.5 + 0.48 * Math.sin(T * (0.7 + u) + this.p1[i]));
          ty = R.y + R.h * (0.5 + 0.48 * Math.sin(T * (0.9 + v) + this.p2[i]));
        } else if (role === 'design' && wires.length && T < B.build) {
          task = wires[i % wires.length];
        } else if (role === 'review' && T >= B.review) {
          const q = prog(T, B.review, B.bug);
          tx = R.x + R.w * u; ty = this.py(lerp(0, PAGE_H, q)) + this.gy[i] * 8 * s;
        } else {
          // Spare hands from research and design help out with whatever is running.
          const help = role === 'research' ? 'write' : role === 'design' ? 'design' : role;
          const list = active[help] || active.code || active.write;
          if (list && T >= B.build) task = list[i % list.length];
        }
        if (task && u < 0.34) {
          tx = R.x + R.w * (0.5 + 0.47 * Math.sin(T * 0.5 * this.spd[i] + this.p1[i]));
          ty = R.y + R.h * (0.5 + 0.47 * Math.sin(T * 0.6 * this.spd[i] + this.p2[i]));
        } else if (task) {
          const [fx, fy] = this.frontier(task.b, task.p);
          const spread = 18 + Math.min(task.b.rect[2], task.b.rect[3]) * 0.3;
          tx = this.px(fx + this.gx[i] * spread); ty = this.py(fy + this.gy[i] * spread * 0.55);
        } else if (tx === undefined) {
          // Waiting: a loose cloud around the browser window.
          const a = this.p2[i] + T * 0.25 * this.spd[i];
          tx = R.x + R.w / 2 + Math.cos(a) * R.w * (0.52 + 0.08 * u);
          ty = R.y + R.h / 2 + Math.sin(a) * R.h * (0.53 + 0.08 * v);
        }
      }

      // Wander keeps the flock alive even when a target is still.
      const w = (glyph ? 2.5 : ring ? 3 : 26) * s;
      tx += Math.sin(T * 1.9 + this.p1[i]) * w;
      ty += Math.cos(T * 2.3 + this.p2[i]) * w;

      const dx = tx - this.X[i], dy = ty - this.Y[i], d = Math.hypot(dx, dy) + 1e-3;
      const sp = Math.min(maxS * this.spd[i], d * 5.5);
      const k = Math.min(1, steer * DT);
      this.VX[i] += ((dx / d) * sp - this.VX[i]) * k;
      this.VY[i] += ((dy / d) * sp - this.VY[i]) * k;
      this.X[i] += this.VX[i] * DT;
      this.Y[i] += this.VY[i] * DT;

      const speed = Math.hypot(this.VX[i], this.VY[i]);
      const want = speed > 34 * s ? Math.atan2(this.VY[i], this.VX[i]) : -2.2;
      let diff = ((want - this.H[i] + Math.PI) % TAU + TAU) % TAU - Math.PI;
      this.H[i] += diff * Math.min(1, (speed > 34 * s ? 12 : 7) * DT);
    }
  }

  drawPage() {
    const c = this.pc, t = this.t, B = this.beats, R = this.pageRect, s = this.s;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.width, this.height);

    c.save();
    c.translate(R.x, R.y); c.scale(s, s);
    const W = PAGE_W, H = PAGE_H + CHROME_H;
    c.shadowColor = 'rgba(40,30,10,.18)'; c.shadowBlur = 28 * s * this.dpr; c.shadowOffsetY = 10 * s * this.dpr;
    c.fillStyle = '#FFFDF8'; round(c, 0, 0, W, H, 14); c.fill();
    c.shadowColor = 'transparent';
    c.save(); round(c, 0, 0, W, H, 14); c.clip();

    // Chrome
    c.fillStyle = '#EDE6D6'; c.fillRect(0, 0, W, CHROME_H);
    ['#D9CFBA', '#D9CFBA', '#D9CFBA'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(18 + i * 16, 17, 4.5, 0, TAU); c.fill(); });
    const live = t >= B.done;
    c.fillStyle = '#FFFDF8'; round(c, 180, 7, 440, 20, 10); c.fill();
    c.fillStyle = live ? '#0B8F65' : '#6B6457'; c.font = '500 11px "IBM Plex Mono", monospace'; c.textBaseline = 'middle'; c.textAlign = 'center';
    c.fillText(live ? '● paperkite.example' : 'localhost:3000', 400, 17.5); c.textAlign = 'left';

    // Blueprint dots under the empty page
    c.translate(0, CHROME_H);
    const dotA = 1 - this.blockP(this.blocks[this.blocks.length - 1], t);
    if (dotA > 0.02) {
      c.fillStyle = `rgba(90,80,60,${0.16 * dotA})`;
      for (let y = 12; y < PAGE_H; y += 24) for (let x = 12; x < W; x += 24) c.fillRect(x, y, 1.5, 1.5);
    }

    // Wireframes, skeleton bars, then real content wiping on.
    for (const b of this.blocks) {
      const wp = this.wireP(b, t), p = this.blockP(b, t);
      const [x, y, w, h] = b.rect;
      if (wp > 0 && p < 1) {
        c.globalAlpha = wp * (1 - p);
        c.strokeStyle = ROLE_COLORS.design; c.lineWidth = 1.2; c.setLineDash([5, 4]);
        c.strokeRect(x + 1, y + 1, (w - 2) * wp, h - 2); c.setLineDash([]);
        c.fillStyle = '#EAE3D3';
        for (const [lx, ly, lw, lh] of b.lines) { round(c, lx, ly + lh * 0.18, lw * wp, lh * 0.64, 4); c.fill(); }
        c.globalAlpha = 1;
      }
      if (p > 0) {
        const k = b.k, n = b.lines.length, q = p * n;
        for (let li = 0; li < n; li++) {
          const lp = clamp(q - li);
          if (lp <= 0) break;
          const [lx, ly, lw, lh] = b.lines[li];
          const cw = b.dir === 'y' ? lw : lw * lp, ch = b.dir === 'y' ? lh * lp : lh;
          // lines[] may be the whole rect; copy just the revealed part out of the block's bitmap.
          c.drawImage(b.cv, (lx - x) * k, (ly - y) * k, cw * k, ch * k, lx, ly, cw, ch);
        }
      }
      // Tick from the review sweep.
      if (p >= 1 && t >= B.review && t < B.fix) {
        const sweep = prog(t, B.review, B.bug) * PAGE_H;
        if (sweep > y) {
          c.fillStyle = ROLE_COLORS.code; c.font = '700 13px "Instrument Sans", sans-serif'; c.textBaseline = 'middle';
          if (b.id !== 'cta') c.fillText('✓', x + w - 16, y + 12);
        }
      }
    }

    // The bug
    const cta = this.blocks.find((b) => b.id === 'cta');
    const [bx, by, bw, bh] = cta.rect;
    if (t >= B.bug && t < B.fix) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 9);
      c.fillStyle = `rgba(217,45,32,${0.86 + 0.14 * pulse})`; round(c, bx, by, bw, bh, 23); c.fill();
      c.fillStyle = '#fff'; c.font = `700 15px ${SANS}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('wind is undefined', bx + bw / 2, by + bh / 2); c.textAlign = 'left';
      c.fillStyle = '#D92D20'; c.fillRect(0, 0, W, 26);
      c.fillStyle = '#fff'; c.font = '600 12px "IBM Plex Mono", monospace'; c.fillText('BUILD FAILED  TypeError: wind is undefined', 14, 13.5);
    }
    const fixK = prog(t, B.fix, B.fix + 0.7);
    if (fixK > 0 && fixK < 1) {
      c.globalAlpha = 1 - fixK;
      c.fillStyle = '#0B8F65'; round(c, bx, by, bw, bh, 23); c.fill();
      c.fillStyle = '#fff'; c.font = `700 15px ${SANS}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('✓ fixed', bx + bw / 2, by + bh / 2); c.textAlign = 'left';
      c.globalAlpha = 1;
    }

    // LIVE stamp
    const st = prog(t, B.done - 0.05, B.done + 0.2);
    if (st > 0) {
      c.save();
      c.translate(610, 190); c.rotate(-0.16); const z = lerp(1.7, 1, ease(st)); c.scale(z, z);
      c.globalAlpha = 0.92 * st;
      c.strokeStyle = '#D92D20'; c.lineWidth = 5; round(c, -92, -40, 184, 80, 10); c.stroke();
      c.fillStyle = '#D92D20'; c.font = `800 54px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('LIVE', 0, 3);
      c.restore();
    }
    c.restore();
    c.strokeStyle = 'rgba(70,60,40,.22)'; c.lineWidth = 1; round(c, 0.5, 0.5, W - 1, H - 1, 14); c.stroke();
    c.restore();

    // Dim the page while the swarm spells something.
    let dim = 0;
    for (const g of this.glyphs) dim = Math.max(dim, ease(prog(t, g.t0 - 0.1, g.t0 + 0.35)) * (1 - ease(prog(t, g.t1 - 0.05, g.t1 + 0.3))));
    for (const [a, b] of this.dims || []) dim = Math.max(dim, ease(prog(t, a, a + 0.4)) * (1 - ease(prog(t, b - 0.2, b + 0.1))));
    if (dim > 0) { c.fillStyle = `rgba(244,239,228,${0.96 * dim})`; c.fillRect(R.x - 12, R.y - 12, R.w + 24, R.h + 24); }
  }

  drawAgents() {
    const c = this.ac, t = this.t, B = this.beats;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.width, this.height);
    const scale = this.scale || 1;

    // Shockwaves on launch and on the fix.
    for (const [t0, x, y, col] of [[B.spawn, this.orch.x, this.orch.y, '#1C1A17'], [B.fix, this.ctaC.x, this.ctaC.y, '#0B8F65']]) {
      const k = prog(t, t0, t0 + 0.8);
      if (k > 0 && k < 1) {
        c.strokeStyle = col; c.globalAlpha = (1 - k) * 0.5; c.lineWidth = 3 * scale;
        c.beginPath(); c.arc(x, y, ease(k) * 620 * this.s, 0, TAU); c.stroke(); c.globalAlpha = 1;
      }
    }

    // Speed lines, batched per role.
    for (const [role, col] of Object.entries(ROLE_COLORS)) {
      c.strokeStyle = col; c.globalAlpha = 0.2; c.lineWidth = Math.max(1, this.dartSize * 0.12);
      c.beginPath();
      for (let i = 0; i < this.N; i++) {
        if (this.roleOf[i] !== role || this.A[i] === 0) continue;
        const vx = this.VX[i], vy = this.VY[i];
        if (vx * vx + vy * vy < 14000) continue;
        c.moveTo(this.X[i], this.Y[i]); c.lineTo(this.X[i] - vx * 0.035, this.Y[i] - vy * 0.035);
      }
      c.stroke();
    }
    c.globalAlpha = 1;

    const half = (this.sprites.code.width / this.dpr) / 2;
    for (let i = 0; i < this.N; i++) {
      if (this.A[i] === 0) continue;
      const h = this.H[i], co = Math.cos(h) * this.dpr, si = Math.sin(h) * this.dpr;
      c.globalAlpha = this.A[i];
      c.setTransform(co, si, -si, co, this.X[i] * this.dpr, this.Y[i] * this.dpr);
      c.drawImage(this.sprites[this.roleOf[i]], -half, -half, half * 2, half * 2);
    }
    c.globalAlpha = 1;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Orchestrator: fades once the swarm has taken over.
    const oa = 1 - prog(t, B.spawn + 1.2, B.spawn + 2);
    if (oa > 0) {
      const ox = this.orch.x + Math.sin(t * 1.4) * 8 * this.s, oy = this.orch.y + Math.cos(t * 1.1) * 6 * this.s;
      c.globalAlpha = oa;
      c.save(); c.translate(ox, oy); c.rotate(-2.2 + Math.sin(t) * 0.1);
      const h2 = this.orchSprite.width / this.dpr / 2;
      c.drawImage(this.orchSprite, -h2, -h2, h2 * 2, h2 * 2); c.restore();
      this.tag(c, ox + 16 * scale, oy + 12 * scale, 'orchestrator', '#1C1A17', scale * 1.15);
      c.globalAlpha = 1;
    }

    // Name tags, hidden when the swarm is a tight shape.
    const ring = t >= B.bug && t < B.fix + 0.2;
    const glyph = this.glyphs.some((g) => t >= g.t0 - 0.2 && t < g.t1 + 0.2);
    if (!ring && !glyph && t > B.spawn + 0.8 && t < B.done && this.N >= 6) {
      for (const { i, label } of this.tagged) {
        const role = this.roleOf[i];
        this.tag(c, this.X[i] + 12 * scale, this.Y[i] + 8 * scale, label, ROLE_COLORS[role], scale);
      }
    }
  }

  tag(c, x, y, text, color, scale) {
    c.font = `500 ${10.5 * scale}px "IBM Plex Mono", monospace`;
    c.textBaseline = 'middle';
    const w = c.measureText(text).width + 19 * scale, h = 18 * scale;
    c.fillStyle = 'rgba(255,253,248,.96)'; c.strokeStyle = 'rgba(70,60,40,.25)'; c.lineWidth = 1;
    c.beginPath(); c.roundRect(x, y, w, h, 5 * scale); c.fill(); c.stroke();
    c.fillStyle = color; c.beginPath(); c.arc(x + 8 * scale, y + h / 2, 3 * scale, 0, TAU); c.fill();
    c.fillStyle = '#1C1A17'; c.fillText(text, x + 14 * scale, y + h / 2 + 0.5);
  }

  draw() { this.drawPage(); this.drawAgents(); }
}
