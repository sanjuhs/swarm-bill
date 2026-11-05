// Turns a team size into a full run: every cursor move and every edit, computed up front.
// A small list scheduler hands tasks to whichever agent is free, respecting dependencies,
// so a bigger team really does finish sooner, until it runs out of things to do at once.
// Nothing here reads the clock, which is what makes the page scrubbable and renderable.

export const WORLD = { w: 1300, h: 900 };
export const AB = { x: 150, y: 70, w: 1100, h: 760 };

export const NAVY = '#14213D', CORAL = '#F0603F', SUN = '#FFC145', TEAL = '#1FA6A0', PLUM = '#7A3FD1', ROSE = '#E8739A';
const PEACH = '#FDE8DC', MINT = '#DDF3F0', LILAC = '#EEE5FA', SAND = '#F4EEE1', PALE = '#F8B5A3', WHITE = '#FFFFFF';
const INK = '#524C41', MUTED = '#6B6457', GHOST = '#EDE7DA';

export const TOOLS = { frame: [470, 34], rect: [520, 34], text: [570, 34], ellipse: [620, 34] };
export const PUBLISH = { x: 1150, y: 14, w: 100, h: 40 };
export const ASSETS = [
  { a: CORAL, b: '#FFD9A0', x: 70, y: 118 },
  { a: SUN, b: TEAL, x: 70, y: 198 },
  { a: TEAL, b: NAVY, x: 70, y: 278 },
  { a: PLUM, b: ROSE, x: 70, y: 358 },
];
const SWATCH_COLORS = [NAVY, CORAL, PALE, SUN, TEAL, PEACH, MINT, LILAC, SAND, WHITE];
export const SWATCHES = SWATCH_COLORS.map((c, i) => ({ c, x: 48 + (i % 2) * 44, y: 452 + Math.floor(i / 2) * 44 }));

const SERIF = 'Fraunces, Georgia, serif', SANS = '"Instrument Sans", system-ui, sans-serif';
const fonts = {
  title: { font: `600 56px ${SERIF}`, lh: 62, color: NAVY },
  body: { font: `400 18px ${SANS}`, lh: 26, color: INK },
  brand: { font: `600 21px ${SERIF}`, lh: 26, color: NAVY },
  link: { font: `500 15px ${SANS}`, lh: 20, color: INK },
  btn: { font: `600 15px ${SANS}`, lh: 20, color: WHITE, align: 'center' },
  cta: { font: `600 18px ${SANS}`, lh: 24, color: WHITE, align: 'center' },
  name: { font: `600 19px ${SANS}`, lh: 24, color: NAVY },
  price: { font: `400 15px ${SANS}`, lh: 20, color: MUTED },
  stat: { font: `italic 500 26px ${SERIF}`, lh: 32, color: WHITE },
  label: { font: `500 14px ${SANS}`, lh: 18, color: SUN },
  foot: { font: `400 14px ${SANS}`, lh: 18, color: MUTED },
};

const NAMES = ['Ada', 'Bo', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo', 'Kai', 'Lux', 'Mo', 'Nia', 'Oz', 'Pam', 'Quin', 'Rae', 'Sol', 'Tia', 'Uma', 'Vic', 'Wes', 'Xan'];
const COLORS = ['#2F6FED', '#E5484D', '#12A594', '#F5A524', '#8E4EC6', '#E93D82', '#46A758', '#FF7A1A', '#0091FF', '#C2410C', '#6E56CF', '#00A2C7'];
const ROLE_CYCLE = ['layout', 'copy', 'visual', 'copy', 'visual', 'layout', 'review', 'copy', 'visual', 'layout', 'copy', 'visual'];
export const ROLE_LABEL = { layout: 'Layout', copy: 'Copy', visual: 'Visual', review: 'Review' };

function hash(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

// One agent's script for one task. Each method advances this agent's clock and emits events.
class Act {
  constructor(run, agent, task) {
    this.run = run; this.a = agent; this.task = task; this.t = agent.free;
    this.w = run.world;
    this.pace = 0.85 + (hash(agent.name) % 30) / 100;
  }
  ev(type, o = {}) { this.run.events.push({ type, t: this.t, a: this.a.i, ...o }); }
  say(text) { this.ev('status', { text }); }
  log(text) { this.run.logs.push({ t: this.t, a: this.a.i, text }); }
  rest(d) { this.t += d; }

  seg(x, y, d, down, curve) {
    const [x0, y0] = this.a.pos;
    const nx = -(y - y0), ny = x - x0;
    const c = curve ? ((hash(this.a.name + this.a.segs.length) % 100) / 100 - 0.5) * 0.3 : 0;
    this.a.segs.push({ t0: this.t, t1: this.t + d, x0, y0, x1: x, y1: y, cx: (x0 + x) / 2 + nx * c, cy: (y0 + y) / 2 + ny * c, down });
    this.a.pos = [x, y];
    this.t += d;
  }
  go(x, y) {
    const [x0, y0] = this.a.pos;
    const dist = Math.hypot(x - x0, y - y0);
    if (dist < 2) return;
    this.seg(x, y, Math.min(0.72, Math.max(0.14, dist / (1150 * this.pace) + 0.08)), false, true);
  }
  click(x, y, n = 1) {
    this.go(x, y);
    for (let i = 0; i < n; i++) { this.ev('ripple', { x, y }); this.t += 0.09; }
  }
  // Artboard-local helpers.
  goL(x, y) { this.go(x + AB.x, y + AB.y); }
  clickL(x, y, n) { this.click(x + AB.x, y + AB.y, n); }
  center(id) { const l = this.w[id]; return [l.x + (l.w || 0) / 2, l.y + (l.h || 10) / 2]; }

  add(id, props) {
    const l = { id, ...props, owner: this.a.i };
    this.w[id] = { ...l };
    this.ev('add', { id, props: l });
  }
  tween(id, to, d) {
    const l = this.w[id], from = {};
    for (const k of Object.keys(to)) from[k] = l[k];
    Object.assign(l, to);
    this.ev('tween', { id, from, to, d });
  }
  set(id, props) { Object.assign(this.w[id], props); this.ev('set', { id, props }); }
  del(id) { delete this.w[id]; this.ev('del', { id }); }
  sel(ids, dims = false) { this.ev('sel', { ids, dims }); }
  bubble(text, d = 0.55) { this.ev('bubble', { text, d }); }
  tool(name) {
    const [x, y] = TOOLS[name];
    this.click(x, y);
    this.ev('tool', { name });
  }
  guide(x1, y1, x2, y2, d, label) { this.ev('guide', { x1, y1, x2, y2, d, label }); }

  // Pull a box out: pick a tool, press at the corner, drag it open.
  box(id, props, tool = 'rect', d = 0.42) {
    this.tool(tool);
    this.goL(props.x, props.y);
    this.add(id, { ...props, w: 2, h: 2 });
    this.sel([id], true);
    this.tween(id, { w: props.w, h: props.h }, d);
    this.seg(props.x + props.w + AB.x, props.y + props.h + AB.y, d, true);
    this.sel([id]);
    this.rest(0.08);
  }
  // Text tool: click once, a caret appears, type.
  text(id, x, y, w, str, style, h) {
    this.tool('text');
    this.clickL(x, y + 6);
    this.add(id, { type: 'text', x, y, w, h: h || style.lh, text: '', ...style });
    this.sel([id]);
    this.type(id, str);
  }
  type(id, str) {
    const d = Math.max(0.2, str.length / (26 * this.pace));
    this.set(id, { text: str });
    this.ev('type', { id, str, d });
    this.t += d + 0.08;
  }
  // Double click to select the words, then type over them.
  rewrite(id, str) {
    const [cx, cy] = this.center(id);
    this.clickL(cx, cy, 2);
    this.sel([id]);
    this.set(id, { hl: true });
    this.rest(0.24);
    this.set(id, { hl: false });
    this.type(id, str);
  }
  // Grab from the tray and drag onto the artboard.
  asset(id, idx, x, y, w, h, tail) {
    const as = ASSETS[idx];
    this.go(as.x, as.y);
    this.ev('ripple', { x: as.x, y: as.y });
    this.rest(0.1);
    this.add(id, { type: 'kite', x: as.x - AB.x - 22, y: as.y - AB.y - 26, w: 44, h: 52, a: as.a, b: as.b, tail, lifted: true });
    this.sel([id], true);
    const d = 0.55;
    this.tween(id, { x, y, w, h }, d);
    this.seg(x + w / 2 + AB.x, y + h / 2 + AB.y, d, true);
    this.set(id, { lifted: false });
    this.sel([id]);
    this.rest(0.1);
  }
  fill(id, color, prop = 'fill') {
    const sw = SWATCHES.find((s) => s.c === color);
    this.click(sw.x, sw.y);
    const [cx, cy] = this.center(id);
    this.clickL(cx, cy);
    this.sel([id]);
    this.tween(id, { [prop]: color }, 0.22);
    this.rest(0.26);
  }
  // Drag a box (or a group) into place, snapping against guides.
  drag(ids, dx, dy, d = 0.42) {
    const [cx, cy] = this.center(ids[0]);
    this.clickL(cx, cy);
    this.sel(ids);
    for (const id of ids) this.tween(id, { x: this.w[id].x + dx, y: this.w[id].y + dy }, d);
    this.seg(cx + dx + AB.x, cy + dy + AB.y, d, true);
    this.rest(0.1);
  }
  // Select someone else's finished work, copy it, carry the clone over, paste.
  copy(srcIds, mapId, dx, dy) {
    const owner = this.run.agents[this.w[srcIds[0]].owner];
    const [cx, cy] = this.center(srcIds[0]);
    this.clickL(cx, cy);
    this.sel(srcIds);
    this.bubble('⌘C');
    const mine = owner.i === this.a.i;
    this.say(mine ? `Copying my own ${this.task.noun}` : `Copying ${owner.name}'s ${this.task.noun}`);
    this.log(mine ? `copied their own ${this.task.noun}` : `copied ${owner.name}'s ${this.task.noun}`);
    this.rest(0.32);
    const newIds = srcIds.map(mapId);
    srcIds.forEach((id, i) => {
      const { id: _i, owner: _o, ...rest } = this.w[id];
      this.add(newIds[i], { ...rest, carried: true });
    });
    this.sel(newIds);
    const d = Math.max(0.5, Math.hypot(dx, dy) / 900);
    this.ev('beam', { x: cx, y: cy, d, label: mine ? '' : `from ${owner.name}` });
    for (const id of newIds) this.tween(id, { x: this.w[id].x + dx, y: this.w[id].y + dy }, d);
    this.seg(cx + dx + AB.x, cy + dy + AB.y, d, true);
    for (const id of newIds) this.set(id, { carried: false });
    this.bubble('⌘V');
    this.rest(0.22);
    return newIds;
  }
  // Drag the bottom-right handle.
  resize(id, w, h) {
    const l = this.w[id];
    this.clickL(l.x + 6, l.y + 6);
    this.sel([id], true);
    this.goL(l.x + l.w, l.y + l.h);
    const tx = l.x + w + AB.x, ty = l.y + h + AB.y;
    this.tween(id, { w, h }, 0.45);
    this.seg(tx, ty, 0.45, true);
    this.sel([id]);
    this.rest(0.08);
  }
  comment(id, x, y, text, to) {
    this.goL(x, y);
    this.ev('ripple', { x: x + AB.x, y: y + AB.y });
    this.add(id, { type: 'comment', x, y, w: 0, h: 0, text, to });
    this.log(`left a note: "${text}"`);
    this.rest(0.95);
  }
}

// Everything the swarm does, as a task board. skill says who prefers it; deps say what must exist first.
const TASKS = [
  { id: 'plan', skill: 'layout', only: 0, label: 'Laying out the sections', deps: [], run(A) {
    A.log('split the brief into sections');
    A.tool('frame');
    [['nav', 0, 60], ['hero', 60, 320], ['products', 380, 228], ['stats', 618, 82], ['footer', 700, 60]].forEach(([name, y, h]) => {
      A.goL(6, y + 3);
      A.add(`sec-${name}`, { type: 'section', x: 6, y: y + 3, w: 2, h: 2, name });
      A.tween(`sec-${name}`, { w: 1088, h: h - 6 }, 0.26);
      A.seg(1094 + AB.x, y + h - 3 + AB.y, 0.26, true);
    });
  } },

  // Nav
  { id: 'logo', skill: 'visual', label: 'Placing the logo', deps: ['plan'], run(A) { A.asset('logo', 0, 30, 16, 22, 28); } },
  { id: 'brand', skill: 'copy', label: 'Writing the brand name', deps: ['plan'], run(A) { A.text('brand', 66, 18, 220, 'Paper Kite Co.', fonts.brand); } },
  { id: 'link1', skill: 'copy', label: 'Writing the first nav link', deps: ['plan'], run(A) { A.text('link1', 720, 21, 70, 'Kites', fonts.link); } },
  { id: 'link2', skill: 'copy', src: 'link1', noun: 'nav link', label: 'Reusing a nav link', deps: ['link1'], run(A) {
    A.copy(['link1'], () => 'link2', 78, 0); A.rewrite('link2', 'Workshop');
    A.say('Rewrote it as "Workshop"');
  } },
  { id: 'link3', skill: 'copy', src: 'link1', noun: 'nav link', label: 'Reusing a nav link', deps: ['link1'], run(A) {
    A.copy(['link1'], () => 'link3', 174, 0); A.rewrite('link3', 'Journal');
    A.say('Rewrote it as "Journal"');
  } },
  { id: 'navline', skill: 'layout', label: 'Ruling off the nav', deps: ['plan'], run(A) {
    A.box('navline', { type: 'rect', x: 0, y: 59, w: 1100, h: 2, fill: '#E9E2D2', r: 0 }, 'rect', 0.36);
  } },
  { id: 'shop', skill: 'layout', label: 'Building the Shop button', deps: ['plan'], run(A) {
    A.box('shop', { type: 'rect', x: 990, y: 13, w: 76, h: 34, fill: GHOST, r: 17 });
    A.fill('shop', NAVY);
  } },
  { id: 'shopt', skill: 'copy', label: 'Labelling the Shop button', deps: ['shop'], run(A) { A.text('shopt', 990, 20, 76, 'Shop', fonts.btn); } },

  // Hero. Text lands slightly off, and a layout agent straightens it later.
  { id: 'title', skill: 'copy', label: 'Writing the headline', deps: ['plan'], run(A) {
    A.text('title', 56, 92, 800, 'Kites that fly themselves.', fonts.title, 66);
  } },
  { id: 'sub', skill: 'copy', label: 'Writing the subhead', deps: ['plan'], run(A) {
    A.text('sub', 38, 240, 470, 'Hand-folded, wind-tested, and ready the moment you step outside, whatever the weather decides next.', fonts.body, 54);
  } },
  { id: 'cta', skill: 'visual', label: 'Drawing the main button', deps: ['plan'], run(A) {
    A.box('cta', { type: 'rect', x: 52, y: 308, w: 210, h: 54, fill: GHOST, r: 27 });
    A.fill('cta', PALE);
  } },
  { id: 'ctat', skill: 'copy', label: 'Writing the button label', deps: ['cta'], run(A) { A.text('ctat', 52, 323, 210, 'Find your wind', fonts.cta); } },
  { id: 'trust', skill: 'copy', label: 'Adding a line of proof', deps: ['plan'], run(A) { A.text('trust', 272, 311, 200, 'Flown in 40 countries', fonts.link); } },
  { id: 'panel', skill: 'visual', label: 'Drawing the sky', deps: ['plan'], run(A) {
    A.box('panel', { type: 'rect', x: 580, y: 80, w: 476, h: 280, fill: GHOST, r: 18, sky: 0 }, 'rect', 0.5);
    A.fill('panel', NAVY);
    A.say('Blending the sky gradient');
    A.tween('panel', { sky: 1 }, 0.45);
    A.rest(0.5);
  } },
  { id: 'sun', skill: 'visual', label: 'Adding the sun', deps: ['panel'], run(A) {
    A.box('sun', { type: 'ellipse', x: 880, y: 236, w: 104, h: 104, fill: GHOST }, 'ellipse');
    A.fill('sun', SUN);
  } },
  { id: 'cloud1', skill: 'visual', label: 'Drawing a cloud', deps: ['panel'], run(A) {
    A.box('cloud1', { type: 'ellipse', x: 600, y: 316, w: 150, h: 30, fill: GHOST, op: 0.34 }, 'ellipse', 0.3);
    A.fill('cloud1', WHITE);
  } },
  { id: 'cloud2', skill: 'visual', label: 'Drawing a cloud', deps: ['panel'], run(A) {
    A.box('cloud2', { type: 'ellipse', x: 950, y: 322, w: 96, h: 24, fill: GHOST, op: 0.34 }, 'ellipse', 0.3);
    A.fill('cloud2', WHITE);
  } },
  { id: 'kite1', skill: 'visual', label: 'Dragging in a big kite', deps: ['panel'], run(A) { A.asset('kite1', 0, 640, 104, 104, 128, true); } },
  { id: 'kite2', skill: 'visual', label: 'Dragging in a second kite', deps: ['panel'], run(A) { A.asset('kite2', 1, 846, 112, 70, 84, true); } },
  { id: 'kite3', skill: 'visual', label: 'Dragging in a small kite', deps: ['panel'], run(A) { A.asset('kite3', 3, 790, 190, 46, 56, true); } },
  { id: 'nudge', skill: 'layout', label: 'Moving a kite up', deps: ['kite2', 'kite3'], run(A) {
    A.drag(['kite2'], 14, -16);
    A.guide(895, 80, 895, 360, 0.8);
  } },

  // First card: built piece by piece.
  { id: 'c1', skill: 'layout', label: 'Drawing the first card', deps: ['plan'], run(A) {
    A.box('c1', { type: 'rect', x: 52, y: 386, w: 316, h: 214, fill: WHITE, r: 14, stroke: '#E9E2D2' }, 'rect', 0.46);
  } },
  { id: 'c1t', skill: 'visual', label: 'Colouring the thumbnail', deps: ['c1'], run(A) {
    A.box('c1t', { type: 'rect', x: 62, y: 396, w: 296, h: 124, fill: GHOST, r: 10 }, 'rect', 0.34);
    A.fill('c1t', PEACH);
  } },
  { id: 'c1k', skill: 'visual', label: 'Dropping a kite on the card', deps: ['c1t'], run(A) { A.asset('c1k', 1, 180, 416, 62, 76); } },
  { id: 'c1n', skill: 'copy', label: 'Naming the first product', deps: ['c1'], run(A) { A.text('c1n', 68, 532, 200, 'The Dawn Diamond', fonts.name); } },
  { id: 'c1p', skill: 'copy', label: 'Pricing the first product', deps: ['c1'], run(A) { A.text('c1p', 68, 560, 200, '$48', fonts.price); } },

  // The other two cards both start as copies of the first, at the same time.
  { id: 'c2', skill: 'layout', src: 'c1', noun: 'card', label: 'Cloning a card', deps: ['c1k', 'c1n', 'c1p'], run(A) {
    A.copy(['c1', 'c1t', 'c1k', 'c1n', 'c1p'], (s) => s.replace('c1', 'c2'), 344, 6);
    A.say('Pasted. Handing the words to the copy team');
  } },
  { id: 'c3', skill: 'layout', src: 'c1', noun: 'card', label: 'Cloning a card', deps: ['c1k', 'c1n', 'c1p'], run(A) {
    A.copy(['c1', 'c1t', 'c1k', 'c1n', 'c1p'], (s) => s.replace('c1', 'c3'), 700, 4);
    A.say('Pasted. Handing the words to the copy team');
  } },
  { id: 'c2w', skill: 'copy', label: 'Rewriting the second card', deps: ['c2'], run(A) {
    A.rewrite('c2n', 'Little Delta');
    A.say('Rewrote the name to "Little Delta"');
    A.rewrite('c2p', '$32');
  } },
  { id: 'c3w', skill: 'copy', label: 'Rewriting the third card', deps: ['c3'], run(A) {
    A.rewrite('c3n', 'Long Tail');
    A.say('Rewrote the name to "Long Tail"');
    A.rewrite('c3p', '$64');
  } },
  { id: 'c2v', skill: 'visual', label: 'Recolouring the second card', deps: ['c2'], run(A) {
    A.fill('c2t', MINT);
    A.fill('c2k', TEAL, 'a');
    A.tween('c2k', { b: NAVY }, 0.2);
    A.rest(0.2);
  } },
  { id: 'c3v', skill: 'visual', label: 'Recolouring the third card', deps: ['c3'], run(A) {
    A.fill('c3t', LILAC);
    A.fill('c3k', SUN, 'a');
    A.tween('c3k', { a: PLUM, b: ROSE }, 0.2);
    A.rest(0.2);
  } },
  ...[[1, 52, 386, ['plan', 'c1']], [2, 396, 392, ['c2']], [3, 752, 390, ['c3']]].flatMap(([n, x, y, deps]) => [
    { id: `c${n}b`, skill: 'visual', label: `Drawing a buy button on card ${n}`, deps, run(A) {
      A.box(`c${n}b`, { type: 'rect', x: x + 214, y: y + 150, w: 88, h: 34, fill: GHOST, r: 17 }, 'rect', 0.3);
      A.fill(`c${n}b`, NAVY);
    } },
    { id: `c${n}bt`, skill: 'copy', label: `Labelling card ${n}'s button`, deps: [`c${n}b`], run(A) {
      A.text(`c${n}bt`, x + 214, y + 157, 88, 'Add', fonts.btn);
    } },
  ]),

  // Stats band: one stat, copied twice at once, each rewritten by someone else.
  { id: 'band', skill: 'visual', label: 'Laying the dark band', deps: ['plan'], run(A) {
    A.box('band', { type: 'rect', x: 0, y: 618, w: 1100, h: 82, fill: GHOST, r: 0 }, 'rect', 0.46);
    A.fill('band', NAVY);
  } },
  { id: 's1', skill: 'copy', label: 'Writing the first stat', deps: ['band'], run(A) {
    A.text('s1n', 44, 626, 240, '12 knots', fonts.stat);
    A.text('s1l', 44, 662, 240, 'is all you need', fonts.label);
  } },
  { id: 's2', skill: 'copy', src: 's1n', noun: 'stat', label: 'Reusing a stat', deps: ['s1'], run(A) {
    A.copy(['s1n', 's1l'], (s) => s.replace('s1', 's2'), 352, 0);
    A.rewrite('s2n', '48 hours'); A.rewrite('s2l', 'to your door');
  } },
  { id: 's3', skill: 'copy', src: 's1n', noun: 'stat', label: 'Reusing a stat', deps: ['s1'], run(A) {
    A.copy(['s1n', 's1l'], (s) => s.replace('s1', 's3'), 704, 0);
    A.rewrite('s3n', 'Free fixes'); A.rewrite('s3l', 'forever');
  } },
  ...[[1, 0, 44], [2, 2, 396], [3, 3, 748]].map(([n, idx, x]) => ({
    id: `s${n}i`, skill: 'visual', label: 'Adding a stat icon', deps: ['band'], run(A) { A.asset(`s${n}i`, idx, x + 262, 636, 34, 44); },
  })),

  // Footer: borrows a nav link from the top of the page, three times over.
  { id: 'foot', skill: 'layout', label: 'Laying the footer', deps: ['plan'], run(A) {
    A.box('foot', { type: 'rect', x: 0, y: 700, w: 1100, h: 60, fill: GHOST, r: 0 }, 'rect', 0.46);
    A.fill('foot', SAND);
  } },
  { id: 'foott', skill: 'copy', label: 'Writing the footer note', deps: ['foot'], run(A) {
    A.text('foott', 44, 712, 520, 'Paper Kite Co. is made up. A swarm built it for fun.', fonts.foot);
  } },
  { id: 'footc', skill: 'copy', label: 'Writing the small print', deps: ['foot'], run(A) {
    A.text('footc', 44, 732, 520, 'No real kites were harmed.', fonts.foot);
  } },
  ...[[1, 56, 'Shipping'], [2, 152, 'Repairs'], [3, 236, 'Contact']].map(([n, dx, word]) => ({
    id: `fl${n}`, skill: 'copy', src: 'link1', noun: 'nav link', label: 'Borrowing a nav link', deps: ['foot', 'link1'], run(A) {
      A.copy(['link1'], () => `fl${n}`, dx, 698); A.rewrite(`fl${n}`, word);
      A.say(`Rewrote it as "${word}"`);
    },
  })),

  // Review: notes that send work back to someone.
  { id: 'r1', skill: 'review', label: 'Reviewing the headline', deps: ['title', 'panel'], run(A) {
    A.comment('note1', 590, 200, 'Headline runs into the sky. Wrap it?');
  } },
  { id: 'f1', skill: 'copy', label: 'Wrapping the headline', deps: ['r1'], run(A) {
    A.resize('title', 470, 130);
    A.del('note1');
    A.log('wrapped the headline and closed the note');
  } },
  { id: 'r2', skill: 'review', label: 'Reviewing the button', deps: ['ctat'], run(A) {
    A.comment('note2', 270, 352, 'Button is too pale. Use the coral.');
  } },
  { id: 'f2', skill: 'visual', label: 'Fixing the button colour', deps: ['r2'], run(A) {
    A.fill('cta', CORAL);
    A.del('note2');
    A.log('fixed the button colour and closed the note');
  } },
  { id: 'r3', skill: 'review', label: 'Checking the prices', deps: ['c2w'], run(A) {
    A.comment('note3', 460, 575, 'Little Delta is $36, not $32.');
  } },
  { id: 'f3', skill: 'copy', label: 'Correcting a price', deps: ['r3'], run(A) {
    A.rewrite('c2p', '$36');
    A.del('note3');
    A.log('corrected the price and closed the note');
  } },
  { id: 'r4', skill: 'review', label: 'Reviewing the logo', deps: ['logo', 'brand'], run(A) {
    A.comment('note4', 60, 44, 'Logo looks small. Bump it up.');
  } },
  { id: 'f4', skill: 'visual', label: 'Enlarging the logo', deps: ['r4'], run(A) {
    A.resize('logo', 30, 36);
    A.del('note4');
    A.log('enlarged the logo and closed the note');
  } },
  { id: 'r5', skill: 'review', label: 'Reviewing the stats', deps: ['s3'], run(A) {
    A.comment('note5', 760, 650, 'We can’t promise forever. Reword?');
  } },
  { id: 'f5', skill: 'copy', label: 'Softening a claim', deps: ['r5'], run(A) {
    A.rewrite('s3n', 'Free');
    A.rewrite('s3l', 'repairs for life');
    A.del('note5');
    A.log('reworded the claim and closed the note');
  } },
  { id: 'r6', skill: 'review', label: 'Reviewing the subhead', deps: ['sub'], run(A) {
    A.comment('note6', 300, 296, 'Too long. Cut the weather bit.');
  } },
  { id: 'f6', skill: 'copy', label: 'Cutting the subhead', deps: ['r6'], run(A) {
    A.rewrite('sub', 'Hand-folded, wind-tested, and ready the moment you step outside.');
    A.del('note6');
    A.log('cut the subhead and closed the note');
  } },

  // Straighten everything against guides, one region per agent.
  { id: 'a1', skill: 'layout', label: 'Aligning the headline', deps: ['f1'], run(A) {
    A.drag(['title'], -12, -8);
    A.guide(44, 60, 44, 372, 0.8, 'left edge');
  } },
  { id: 'a2', skill: 'layout', label: 'Aligning the subhead', deps: ['f6'], run(A) {
    A.drag(['sub'], 6, -14);
    A.guide(44, 60, 44, 372, 0.8);
  } },
  { id: 'a3', skill: 'layout', label: 'Aligning the main button', deps: ['f2'], run(A) {
    A.drag(['cta', 'ctat'], -8, -14);
    A.guide(44, 60, 44, 372, 0.8);
  } },
  { id: 'a4', skill: 'layout', label: 'Squaring up card 1', deps: ['c2', 'c3', 'c1bt'], run(A) {
    A.drag(['c1', 'c1t', 'c1k', 'c1n', 'c1p', 'c1b', 'c1bt'], -8, 6);
    A.guide(0, 392, 1100, 392, 0.7);
  } },
  { id: 'a5', skill: 'layout', label: 'Spacing card 2', deps: ['c2bt', 'c2v', 'f3'], run(A) {
    A.drag(['c2', 'c2t', 'c2k', 'c2n', 'c2p', 'c2b', 'c2bt'], -4, 0);
    A.guide(360, 500, 392, 500, 0.9, '32');
  } },
  { id: 'a6', skill: 'layout', label: 'Spacing card 3', deps: ['c3bt', 'c3v', 'c3w'], run(A) {
    A.drag(['c3', 'c3t', 'c3k', 'c3n', 'c3p', 'c3b', 'c3bt'], -12, 2);
    A.guide(708, 500, 740, 500, 0.9, '32');
  } },

  // Final sign-off and ship.
  { id: 'qa', skill: 'review', label: 'Final check', deps: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'f4', 'f5', 'nudge', 'sun', 'kite1', 'cloud1', 'cloud2', 'trust', 'link2', 'link3', 'navline', 'shopt', 'c2w', 's2', 's1i', 's2i', 's3i', 'foott', 'footc', 'fl1', 'fl2', 'fl3'], run(A) {
    A.log('walked the whole page and approved it');
    [[160, 30], [300, 200], [800, 220], [880, 500], [550, 660]].forEach(([x, y]) => A.clickL(x, y));
  } },
  { id: 'publish', skill: 'layout', only: 0, label: 'Publishing', deps: ['qa'], run(A) {
    ['nav', 'hero', 'products', 'stats', 'footer'].forEach((n) => A.del(`sec-${n}`));
    A.click(PUBLISH.x + PUBLISH.w / 2, PUBLISH.y + PUBLISH.h / 2);
    A.log('hit Publish');
    A.ev('publish');
    A.run.publishT = A.t;
  } },
];

export function plan(N) {
  const agents = Array.from({ length: N }, (_, i) => ({
    i,
    name: i < NAMES.length ? NAMES[i] : `${NAMES[i % NAMES.length]}${Math.floor(i / NAMES.length) + 1}`,
    color: COLORS[i % COLORS.length],
    role: i === 0 ? 'layout' : ROLE_CYCLE[i % ROLE_CYCLE.length],
    pos: [AB.x + ((i * 97) % AB.w), -30],
    bench: [AB.x + 30 + ((i * 193) % (AB.w - 60)), 846 + (i % 2) * 10],
    free: 0, segs: [], spans: [], busy: 0,
  }));
  const run = { agents, events: [], logs: [], world: {}, publishT: 0 };

  // Everyone arrives from above and waits on the bench until there is work.
  agents.forEach((a) => {
    const A = new Act(run, a, {});
    A.t = i0(a.i);
    A.go(...a.bench);
    a.free = i0(a.i) * 0.5;
    if (a.i > 0) a.free = A.t;
    A.say('Waiting for the plan');
  });
  agents[0].free = 0.3;
  agents[0].segs.length = 0;
  agents[0].pos = [AB.x + 400, 20];

  const done = new Map();
  const left = [...TASKS];
  let guard = 0;
  while (left.length && guard++ < 20000) {
    const a = agents.reduce((m, o) => (o.free < m.free ? o : m), agents[0]);
    const ready = left.filter((t) => t.deps.every((d) => done.has(d) && done.get(d) <= a.free) && (t.only === undefined || t.only === a.i));
    const others = agents.filter((o) => o !== a);
    // Don't copy your own work if someone else is about to be free: the point is handing off.
    const fresh = (t) => !(t.src && run.world[t.src]?.owner === a.i && others.some((o) => o.free <= a.free + 1.5));
    const pick = ready.find((t) => t.skill === a.role && fresh(t))
      || ready.find((t) => fresh(t) && !others.some((o) => o.role === t.skill && o.free <= a.free + 0.15))
      || (N === 1 ? ready[0] : null);
    if (pick) {
      left.splice(left.indexOf(pick), 1);
      const A = new Act(run, a, pick);
      A.say(pick.label);
      if (!pick.noun) A.log(pick.label.charAt(0).toLowerCase() + pick.label.slice(1));
      const t0 = A.t;
      pick.run(A);
      A.sel(null);
      run.events.push({ type: 'status', t: A.t, a: a.i, text: 'Looking for the next task' });
      a.spans.push({ t0, t1: A.t, id: pick.id, label: pick.label });
      a.busy += A.t - t0;
      a.free = A.t;
      done.set(pick.id, A.t);
    } else {
      // Nothing to claim: head to the bench and wait for the next moment something changes.
      const times = agents.map((o) => o.free).concat([...done.values()]).filter((x) => x > a.free + 1e-6);
      const next = times.length ? Math.min(...times) : a.free + 0.25;
      const A = new Act(run, a, {});
      const blocked = left.find((t) => t.skill === a.role) || left[0];
      if (Math.hypot(a.pos[0] - a.bench[0], a.pos[1] - a.bench[1]) > 2) A.go(...a.bench);
      if (a.lastWait !== blocked?.id) { A.say(`Waiting: ${blocked ? blocked.label.toLowerCase() : 'nothing left'}`); a.lastWait = blocked?.id; }
      a.free = Math.max(next, A.t);
    }
  }

  // Curtain call: everyone circles the finished page.
  const T = run.publishT;
  agents.forEach((a, i) => {
    const A = new Act(run, a, {});
    A.t = Math.max(T + 0.1 + (i % 12) * 0.03, a.free);
    A.say('Done');
    const ang = (i / N) * Math.PI * 2;
    A.go(AB.x + AB.w / 2 + Math.cos(ang) * (AB.w * 0.53), AB.y + AB.h / 2 + Math.sin(ang) * (AB.h * 0.53));
  });

  run.events.sort((p, q) => p.t - q.t);
  run.logs.sort((p, q) => p.t - q.t);
  run.T = T;
  run.tasks = TASKS.length;
  run.busyShare = agents.reduce((s, a) => s + a.busy, 0) / (N * T);
  run.work = agents.reduce((s, a) => s + a.busy, 0);
  return run;
}

function i0(i) { return (i % 24) * 0.03; }
