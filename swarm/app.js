import { plan, WORLD, AB, TOOLS, PUBLISH, ASSETS, SWATCHES, ROLE_LABEL } from './plan.js';
import { estimate, money, tokens } from '../js/cost.js';

const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (k) => k * k * (3 - 2 * k);
const TAU = Math.PI * 2;
const HOLD = 6;
const COUNTS = [1, 3, 6, 12, 24, 48];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Modelled cost of one task: three agent turns, same assumptions as Swarm Bill.
const PER_TASK = estimate({ agents: 1, turns: 3, ctx: 20000, hitRate: 0.85, outPerTurn: 600, model: 'flash', peak: false });

const cv = $('cv');
const c = cv.getContext('2d');
let run, N = 12, t = 0, playing = !reduced, speed = 1, focus = -1;
let view = { k: 1, ox: 0, oy: 0, dpr: 1, w: 0, h: 0 };

// ---- Colour and text helpers -----------------------------------------------------------------

const rgbCache = new Map();
function rgb(hex) {
  let v = rgbCache.get(hex);
  if (!v) { v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); rgbCache.set(hex, v); }
  return v;
}
function mix(a, b, k) {
  const p = rgb(a), q = rgb(b);
  return `rgb(${p.map((v, i) => Math.round(v + (q[i] - v) * k)).join(',')})`;
}
const ink = (hex) => { const [r, g, b] = rgb(hex); return (r * 299 + g * 587 + b * 114) / 1000 > 165 ? '#1B1A18' : '#FFFFFF'; };

const wrapCache = new Map();
function wrap(text, font, w) {
  const key = `${font}|${Math.round(w)}|${text}`;
  let lines = wrapCache.get(key);
  if (lines) return lines;
  c.font = font;
  lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (line && c.measureText(test).width > w) { lines.push(line); line = word; } else line = test;
  }
  lines.push(line);
  wrapCache.set(key, lines);
  return lines;
}

// ---- Replaying the run to time t --------------------------------------------------------------

function stateAt(time) {
  const layers = new Map();
  const ag = run.agents.map(() => ({ sel: null, dims: false, status: 'Arriving', bubble: null, beam: null }));
  const guides = [], ripples = [], tools = {};
  let publishAt = null;
  for (const e of run.events) {
    if (e.t > time) break;
    const p = e.d ? clamp((time - e.t) / e.d) : 1;
    switch (e.type) {
      case 'add': layers.set(e.id, { ...e.props }); break;
      case 'del': layers.delete(e.id); break;
      case 'set': { const l = layers.get(e.id); if (l) Object.assign(l, e.props, e.props.text !== undefined ? { text: l.text } : null); break; }
      case 'tween': {
        const l = layers.get(e.id);
        if (!l) break;
        const q = ease(p);
        for (const k of Object.keys(e.to)) {
          const a = e.from[k], b = e.to[k];
          l[k] = typeof b === 'number' ? a + (b - a) * q : (q >= 1 ? b : mix(a, b, q));
        }
        break;
      }
      case 'type': {
        const l = layers.get(e.id);
        if (!l) break;
        l.text = e.str.slice(0, Math.ceil(p * e.str.length));
        l.typing = p < 1 ? e.a : -1;
        break;
      }
      case 'status': ag[e.a].status = e.text; break;
      case 'sel': ag[e.a].sel = e.ids; ag[e.a].dims = e.dims; break;
      case 'bubble': if (time < e.t + e.d) ag[e.a].bubble = e.text; break;
      case 'ripple': if (time < e.t + 0.4) ripples.push({ x: e.x, y: e.y, k: (time - e.t) / 0.4, a: e.a }); break;
      case 'tool': if (time < e.t + 0.5) tools[e.name] = e.a; break;
      case 'guide': if (time < e.t + e.d) guides.push(e); break;
      case 'beam': if (time < e.t + e.d) ag[e.a].beam = e; break;
      case 'publish': publishAt = e.t; break;
    }
  }
  return { layers, ag, guides, ripples, tools, publishAt };
}

function cursorAt(a, time) {
  const s = a.segs;
  let lo = 0, hi = s.length - 1, cur = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (s[m].t0 <= time) { cur = m; lo = m + 1; } else hi = m - 1; }
  if (cur < 0) return { x: a.pos0[0], y: a.pos0[1], down: false, moving: false };
  const g = s[cur];
  if (time >= g.t1) {
    // Resting: a small drift so nobody looks frozen.
    const w = 3;
    return { x: g.x1 + Math.sin(time * 1.3 + a.i) * w, y: g.y1 + Math.cos(time * 1.7 + a.i * 2) * w, down: false, moving: false };
  }
  const q = ease((time - g.t0) / (g.t1 - g.t0)), u = 1 - q;
  return {
    x: u * u * g.x0 + 2 * u * q * g.cx + q * q * g.x1,
    y: u * u * g.y0 + 2 * u * q * g.cy + q * q * g.y1,
    down: g.down, moving: true,
  };
}

// ---- Drawing ----------------------------------------------------------------------------------

function kite(l) {
  const w = l.w, h = l.h, x = l.x + w / 2, y = l.y + h * 0.42;
  if (l.tail) {
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(x, y + h * 0.58);
    c.bezierCurveTo(x + w * 0.45, y + h * 0.95, x - w * 0.45, y + h * 1.15, x + w * 0.12, y + h * 1.5); c.stroke();
    [[0.17, 0.85], [-0.05, 1.1], [0.05, 1.32]].forEach(([u, v], i) => {
      c.fillStyle = i % 2 ? l.b : l.a;
      c.beginPath(); c.ellipse(x + w * u, y + h * v, w * 0.08, h * 0.03, 0.5, 0, TAU); c.fill();
    });
  }
  c.fillStyle = l.a;
  c.beginPath(); c.moveTo(x, y - h * 0.42); c.lineTo(x + w / 2, y - h * 0.08); c.lineTo(x, y + h * 0.58); c.closePath(); c.fill();
  c.fillStyle = l.b;
  c.beginPath(); c.moveTo(x, y - h * 0.42); c.lineTo(x - w / 2, y - h * 0.08); c.lineTo(x, y + h * 0.58); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x - w / 2, y - h * 0.08); c.lineTo(x + w / 2, y - h * 0.08); c.moveTo(x, y - h * 0.42); c.lineTo(x, y + h * 0.58); c.stroke();
}

function drawLayer(l) {
  c.save();
  c.globalAlpha = (l.carried ? 0.72 : 1) * (l.op === undefined ? 1 : l.op);
  if (l.lifted || l.carried) { c.shadowColor = 'rgba(20,15,5,.3)'; c.shadowBlur = 16 * view.k * view.dpr; c.shadowOffsetY = 8 * view.k * view.dpr; }
  if (l.type === 'rect') {
    c.fillStyle = l.fill;
    c.beginPath(); c.roundRect(l.x, l.y, l.w, l.h, Math.min(l.r || 0, l.h / 2, l.w / 2)); c.fill();
    if (l.sky > 0) {
      const g = c.createLinearGradient(0, l.y, 0, l.y + l.h);
      g.addColorStop(0, '#1D3C8F'); g.addColorStop(0.62, '#E8739A'); g.addColorStop(1, '#FFC88A');
      c.globalAlpha *= l.sky; c.fillStyle = g; c.fill();
    }
    if (l.stroke) { c.shadowColor = 'transparent'; c.strokeStyle = l.stroke; c.lineWidth = 1; c.stroke(); }
  } else if (l.type === 'ellipse') {
    c.fillStyle = l.fill;
    c.beginPath(); c.ellipse(l.x + l.w / 2, l.y + l.h / 2, l.w / 2, l.h / 2, 0, 0, TAU); c.fill();
  } else if (l.type === 'kite') {
    kite(l);
  } else if (l.type === 'text') {
    c.shadowColor = 'transparent';
    const lines = wrap(l.text || '', l.font, l.w);
    c.font = l.font; c.textBaseline = 'alphabetic'; c.textAlign = l.align || 'left';
    const tx = l.align === 'center' ? l.x + l.w / 2 : l.x;
    lines.forEach((s, i) => {
      const by = l.y + l.lh * (i + 0.78);
      if (l.hl) {
        const tw = c.measureText(s).width;
        c.fillStyle = `${run.agents[l.owner].color}55`;
        c.fillRect(l.align === 'center' ? tx - tw / 2 : tx, by - l.lh * 0.78, tw, l.lh);
      }
      c.fillStyle = l.color;
      c.fillText(s, tx, by);
    });
    if (l.typing >= 0 && Math.floor(t * 3) % 2 === 0 || l.typing >= 0 && l.text.length < 3) {
      const last = lines[lines.length - 1], tw = c.measureText(last).width;
      const cx = l.align === 'center' ? tx + tw / 2 : tx + tw;
      c.fillStyle = run.agents[l.typing].color;
      c.fillRect(cx + 1.5, l.y + l.lh * (lines.length - 1) + l.lh * 0.1, 2, l.lh * 0.8);
    }
  }
  c.restore();
}

function worldUI(s) {
  const u = view.ui / view.k;
  // Tray
  c.font = `500 ${Math.max(11, 11.5 * u * 0.75)}px "Instrument Sans", sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillStyle = 'rgba(244,239,228,.55)';
  c.fillText('Assets', 30, 76);
  c.fillText('Colours', 30, 424);
  for (const as of ASSETS) {
    c.fillStyle = 'rgba(255,250,235,.07)';
    c.beginPath(); c.roundRect(as.x - 38, as.y - 36, 76, 72, 10); c.fill();
    kite({ x: as.x - 18, y: as.y - 24, w: 36, h: 46, a: as.a, b: as.b });
  }
  for (const sw of SWATCHES) {
    c.fillStyle = sw.c; c.strokeStyle = 'rgba(255,250,235,.25)'; c.lineWidth = 1;
    c.beginPath(); c.roundRect(sw.x - 17, sw.y - 17, 34, 34, 8); c.fill(); c.stroke();
  }
  // Toolbar
  c.fillStyle = 'rgba(255,250,235,.08)';
  c.beginPath(); c.roundRect(TOOLS.frame[0] - 28, 12, 210, 44, 11); c.fill();
  for (const [name, [x, y]] of Object.entries(TOOLS)) {
    if (s.tools[name] !== undefined) {
      c.fillStyle = run.agents[s.tools[name]].color;
      c.beginPath(); c.roundRect(x - 19, y - 17, 38, 34, 8); c.fill();
    }
    c.strokeStyle = '#F4EFE4'; c.fillStyle = '#F4EFE4'; c.lineWidth = 2;
    if (name === 'frame') { c.setLineDash([4, 3]); c.strokeRect(x - 9, y - 8, 18, 16); c.setLineDash([]); }
    if (name === 'rect') c.strokeRect(x - 9, y - 8, 18, 16);
    if (name === 'ellipse') { c.beginPath(); c.arc(x, y, 9, 0, TAU); c.stroke(); }
    if (name === 'text') { c.font = '600 21px "Fraunces", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('T', x, y + 1); }
  }
  // Publish
  const published = s.publishAt !== null;
  c.fillStyle = published ? '#46A758' : '#F4EFE4';
  c.beginPath(); c.roundRect(PUBLISH.x, PUBLISH.y, PUBLISH.w, PUBLISH.h, 9); c.fill();
  c.fillStyle = published ? '#FFFFFF' : '#1B1A18'; c.font = '600 15px "Instrument Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(published ? 'Live' : 'Publish', PUBLISH.x + PUBLISH.w / 2, PUBLISH.y + PUBLISH.h / 2 + 1);
}

function layerBounds(ids, layers) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const id of ids) {
    const l = layers.get(id);
    if (!l) continue;
    x0 = Math.min(x0, l.x); y0 = Math.min(y0, l.y);
    x1 = Math.max(x1, l.x + (l.w || 0)); y1 = Math.max(y1, l.y + (l.h || 0));
  }
  return x1 > x0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

function pill(x, y, text, bg, fg, u, size = 11) {
  c.font = `600 ${size * u}px "Instrument Sans", sans-serif`;
  c.textAlign = 'left'; c.textBaseline = 'middle';
  const w = c.measureText(text).width + 12 * u, h = (size + 8) * u;
  c.fillStyle = bg;
  c.beginPath(); c.roundRect(x, y, w, h, 5 * u); c.fill();
  c.fillStyle = fg;
  c.fillText(text, x + 6 * u, y + h / 2 + 0.5 * u);
  return w;
}

function comment(l, u) {
  const color = run.agents[l.owner].color, x = l.x, y = l.y;
  c.fillStyle = color;
  c.beginPath(); c.arc(x, y, 9 * u, 0, TAU); c.fill();
  c.fillStyle = ink(color); c.font = `700 ${11 * u}px "Instrument Sans", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('!', x, y + 0.5 * u);
  c.font = `500 ${12 * u}px "Instrument Sans", sans-serif`; c.textAlign = 'left';
  const w = c.measureText(l.text).width + 18 * u, h = 28 * u;
  const bx = Math.min(x + 14 * u, AB.w - w - 4 * u), by = y - h / 2;
  c.shadowColor = 'rgba(20,15,5,.35)'; c.shadowBlur = 12 * view.dpr; c.shadowOffsetY = 3 * view.dpr;
  c.fillStyle = '#FFFFFF';
  c.beginPath(); c.roundRect(bx, by, w, h, 8 * u); c.fill();
  c.shadowColor = 'transparent';
  c.fillStyle = '#1B1A18';
  c.fillText(l.text, bx + 9 * u, by + h / 2 + 0.5 * u);
}

function draw(time) {
  const s = stateAt(time);
  const { k, ox, oy, dpr, w, h } = view;
  const u = view.ui / k; // one "screen pixel" in world units, shrunk on small screens so labels don't bury the work
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = '#2B2A27'; c.fillRect(0, 0, w, h);
  c.setTransform(k * dpr, 0, 0, k * dpr, ox * dpr, oy * dpr);

  worldUI(s);

  // Artboard
  const pubK = s.publishAt !== null ? clamp((time - s.publishAt) / 0.6) : 0;
  c.save();
  c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 26 * k * dpr; c.shadowOffsetY = 8 * k * dpr;
  c.fillStyle = '#FFFDF8'; c.fillRect(AB.x, AB.y, AB.w, AB.h);
  c.restore();
  c.save();
  c.beginPath(); c.rect(AB.x, AB.y, AB.w, AB.h); c.clip();
  c.translate(AB.x, AB.y);

  if (pubK < 1) {
    c.fillStyle = `rgba(90,80,60,${0.17 * (1 - pubK)})`;
    for (let y = 12; y < AB.h; y += 24) for (let x = 12; x < AB.w; x += 24) c.fillRect(x, y, 1.6, 1.6);
  }
  for (const l of s.layers.values()) {
    if (l.type === 'section') {
      c.strokeStyle = '#2F6FED'; c.globalAlpha = 0.5; c.lineWidth = 1.4 * Math.max(1, u * 0.5); c.setLineDash([7, 5]);
      c.strokeRect(l.x, l.y, l.w, l.h); c.setLineDash([]);
      c.globalAlpha = 0.8; c.fillStyle = '#2F6FED'; c.font = `500 ${Math.max(12, 11 * u * 0.7)}px "IBM Plex Mono", monospace`; c.textAlign = 'right'; c.textBaseline = 'top';
      if (l.w > 100 && l.h > 20) c.fillText(l.name, l.x + l.w - 8, l.y + 6);
      c.globalAlpha = 1;
    } else if (l.type !== 'comment') {
      drawLayer(l);
    }
  }

  // LIVE stamp
  if (pubK > 0) {
    c.save();
    c.translate(818, 220); c.rotate(-0.15); const z = 1.6 - 0.6 * ease(pubK); c.scale(z, z);
    c.globalAlpha = 0.93 * pubK;
    c.strokeStyle = '#D92D20'; c.lineWidth = 6;
    c.beginPath(); c.roundRect(-112, -48, 224, 96, 12); c.stroke();
    c.fillStyle = '#D92D20'; c.font = '600 66px Fraunces, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('LIVE', 0, 4);
    c.restore();
  }

  // Guides, like the pink lines a design tool shows when things line up.
  for (const g of s.guides) {
    c.strokeStyle = '#FF2D6B'; c.lineWidth = 1.5 * Math.max(1, u * 0.5);
    c.beginPath(); c.moveTo(g.x1, g.y1); c.lineTo(g.x2, g.y2); c.stroke();
    if (g.label) pill((g.x1 + g.x2) / 2 - 16 * u, (g.y1 + g.y2) / 2 - 10 * u, g.label, '#FF2D6B', '#FFFFFF', u, 10.5);
  }

  // Selection boxes, in the colour of whoever holds them.
  run.agents.forEach((a, i) => {
    const st = s.ag[i];
    if (!st.sel) return;
    const b = layerBounds(st.sel, s.layers);
    if (!b) return;
    c.globalAlpha = focus >= 0 && focus !== i ? 0.2 : 1;
    c.strokeStyle = a.color; c.lineWidth = 1.5 * u;
    c.strokeRect(b.x, b.y, b.w, b.h);
    const hs = 7 * u;
    c.fillStyle = '#FFFFFF';
    for (const [hx, hy] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]) {
      c.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      c.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
    }
    if (st.dims) {
      const label = `${Math.round(b.w)} × ${Math.round(b.h)}`;
      c.font = `600 ${10.5 * u}px "Instrument Sans", sans-serif`;
      const lw = c.measureText(label).width + 12 * u;
      pill(b.x + b.w / 2 - lw / 2, b.y + b.h + 5 * u, label, a.color, ink(a.color), u, 10.5);
    }
    c.globalAlpha = 1;
  });
  for (const l of s.layers.values()) if (l.type === 'comment') comment(l, u);
  c.restore();

  // Cursors
  const showAll = N <= 24;
  const positions = run.agents.map((a) => cursorAt(a, time));
  // "Taken from X" lines run from the source to the agent carrying the copy.
  run.agents.forEach((a, i) => {
    const b = s.ag[i].beam;
    if (!b) return;
    const p = positions[i];
    c.globalAlpha = focus >= 0 && focus !== i ? 0.2 : 1;
    c.strokeStyle = a.color; c.lineWidth = 2 * u; c.setLineDash([6 * u, 5 * u]);
    c.beginPath(); c.moveTo(b.x + AB.x, b.y + AB.y); c.lineTo(p.x, p.y); c.stroke(); c.setLineDash([]);
    if (b.label) pill((b.x + AB.x + p.x) / 2, (b.y + AB.y + p.y) / 2 - 22 * u, b.label, a.color, ink(a.color), u, 11);
    c.globalAlpha = 1;
  });
  for (const r of s.ripples) {
    c.strokeStyle = run.agents[r.a].color; c.globalAlpha = 1 - r.k; c.lineWidth = 2 * u;
    c.beginPath(); c.arc(r.x, r.y, (4 + r.k * 18) * u, 0, TAU); c.stroke();
    c.globalAlpha = 1;
  }
  const order = run.agents.map((a) => a.i).sort((x, y) => (x === focus ? 1 : y === focus ? -1 : 0));
  for (const i of order) {
    const a = run.agents[i], p = positions[i], st = s.ag[i];
    const working = st.sel || p.moving;
    const dim = focus >= 0 && focus !== i;
    c.globalAlpha = dim ? 0.22 : 1;
    const z = (p.down ? 0.88 : 1) * (focus === i ? 1.25 : 1);
    c.save();
    c.translate(p.x, p.y); c.scale(u * z, u * z);
    c.beginPath();
    c.moveTo(0, 0); c.lineTo(0, 17); c.lineTo(4.6, 13); c.lineTo(8, 20.2); c.lineTo(10.8, 19); c.lineTo(7.5, 12); c.lineTo(13, 12); c.closePath();
    c.fillStyle = a.color; c.fill();
    c.strokeStyle = '#FFFFFF'; c.lineWidth = 1.3; c.lineJoin = 'round'; c.stroke();
    c.restore();
    if (focus === i || showAll || working) {
      const tw = pill(p.x + 13 * u, p.y + 16 * u, a.name, a.color, ink(a.color), u, 11.5);
      if (st.bubble) pill(p.x + 13 * u + tw + 3 * u, p.y + 16 * u, st.bubble, '#1B1A18', '#FFFFFF', u, 11.5);
    }
    c.globalAlpha = 1;
  }
  return s;
}

// ---- Roster, log and readouts -------------------------------------------------------------------

const rows = [];
function buildRoster() {
  const host = $('roster');
  host.innerHTML = '';
  rows.length = 0;
  run.agents.forEach((a, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'agent';
    b.innerHTML = `<i style="background:${a.color}"></i><b>${a.name}<em>${ROLE_LABEL[a.role]}</em></b><span class="n"></span><span class="what"></span><span class="prog" style="background:${a.color}"></span>`;
    b.addEventListener('click', () => setFocus(focus === i ? -1 : i));
    li.append(b);
    host.append(li);
    rows.push({ b, n: b.querySelector('.n'), what: b.querySelector('.what'), prog: b.querySelector('.prog'), lastWhat: '', lastN: -1 });
  });
}

function setFocus(i) {
  focus = i;
  rows.forEach((r, j) => r.b.classList.toggle('focus', j === i));
  $('log-title').textContent = i >= 0 ? `What ${run.agents[i].name} did` : 'Activity';
  lastLogKey = '';
  render();
}

let lastLogKey = '';
function paintPanels(s) {
  let done = 0, partial = 0;
  run.agents.forEach((a, i) => {
    const r = rows[i];
    let count = 0, cur = null;
    for (const sp of a.spans) {
      if (sp.t1 <= t) count++;
      else if (sp.t0 <= t) cur = sp;
    }
    done += count;
    if (cur) partial += (t - cur.t0) / (cur.t1 - cur.t0);
    const what = s.ag[i].status;
    if (what !== r.lastWhat) { r.what.textContent = what; r.lastWhat = what; }
    if (count !== r.lastN) { r.n.textContent = count ? `${count} done` : ''; r.lastN = count; }
    r.prog.style.width = cur ? `${((t - cur.t0) / (cur.t1 - cur.t0)) * 100}%` : '0';
    r.b.classList.toggle('working', !!cur);
  });
  const shown = Math.min(t, run.T);
  const m = Math.floor(shown / 60), sec = Math.floor(shown % 60);
  $('s-time').textContent = `${m}:${String(sec).padStart(2, '0')}`;
  $('s-tasks').textContent = `${done} / ${run.tasks}`;
  const units = done + partial;
  $('s-tokens').textContent = tokens(units * PER_TASK.tokens);
  $('s-cost').textContent = money(units * PER_TASK.cost);
  $('seek').value = (t / (run.T + HOLD)) * 1000;

  const items = [];
  for (let i = run.logs.length - 1; i >= 0 && items.length < 40; i--) {
    const l = run.logs[i];
    if (l.t <= t && (focus < 0 || l.a === focus)) items.push(l);
  }
  const key = `${items.length}|${items[0] ? items[0].t : 0}|${focus}`;
  if (key !== lastLogKey) {
    lastLogKey = key;
    $('log').innerHTML = items.map((l) => {
      const a = run.agents[l.a], tm = `${Math.floor(l.t / 60)}:${String(Math.floor(l.t % 60)).padStart(2, '0')}`;
      return `<li><time>${tm}</time><b>${a.name}</b> ${escapeHtml(l.text)}</li>`;
    }).join('');
  }
}
const escapeHtml = (s) => s.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));

function render() {
  const s = draw(t);
  paintPanels(s);
}

// ---- Sizing, playback, controls ------------------------------------------------------------------

function resize() {
  const r = $('stage').getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const k = Math.min(r.width / WORLD.w, r.height / WORLD.h);
  view = { k, dpr, ui: window.swarmUi || clamp(k / 0.5, 0.62, 1), w: r.width, h: r.height, ox: (r.width - WORLD.w * k) / 2, oy: (r.height - WORLD.h * k) / 2 };
  wrapCache.clear();
  render();
}

function setTeam(n) {
  N = n;
  run = plan(N);
  run.agents.forEach((a) => { a.pos0 = a.segs.length ? [a.segs[0].x0, a.segs[0].y0] : [AB.x + 400, 20]; });
  t = reduced ? run.T + 1 : 0;
  focus = -1;
  lastLogKey = '';
  $('log-title').textContent = 'Activity';
  document.querySelectorAll('#counts button').forEach((b) => b.classList.toggle('on', Number(b.dataset.n) === N));
  buildRoster();
  paintChart();
  const u = new URL(location.href);
  if (N === 12) u.searchParams.delete('agents'); else u.searchParams.set('agents', N);
  history.replaceState(null, '', u);
  render();
}

function setPlaying(p) {
  playing = p;
  $('play').textContent = p ? 'Pause' : 'Play';
  $('play').setAttribute('aria-label', p ? 'Pause' : 'Play');
}

let lastNow = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  if (!playing || document.hidden || !stageVisible) return;
  t += dt * speed;
  if (t > run.T + HOLD) t = 0;
  render();
}

let stageVisible = true;

// Team size against finish time.
const plans = new Map();
function paintChart() {
  for (const n of COUNTS) if (!plans.has(n)) plans.set(n, plan(n));
  const max = Math.max(...COUNTS.map((n) => plans.get(n).T));
  const best = plans.get(COUNTS[COUNTS.length - 1]);
  const twelve = plans.get(12), one = plans.get(1);
  $('chart-note').textContent = `The site is the same work however big the team is, so the modelled bill stays the same. One agent needs ${Math.round(one.T)} seconds. Twelve need ${Math.round(twelve.T)}. Forty-eight still need ${Math.round(best.T)}, because some tasks can't start until others finish, so many of those agents sit on the bench.`;
  const host = $('bars'), tip = $('tip');
  host.innerHTML = '';
  COUNTS.forEach((n) => {
    const r = plans.get(n);
    const row = document.createElement('button');
    row.className = 'bar-row' + (n === N ? ' cur' : '');
    row.innerHTML = `<span class="name">${n} ${n === 1 ? 'agent' : 'agents'}</span><span class="track"><span class="fill" style="width:calc((100% - 150px) * ${(r.T / max).toFixed(4)})"></span><span class="val">${Math.round(r.T)} s<small>${Math.round(r.busyShare * 100)}% busy</small></span></span>`;
    row.setAttribute('aria-label', `${n} agents: ${Math.round(r.T)} seconds, ${Math.round(r.busyShare * 100)} percent busy. Switch to this team.`);
    const show = (x, y) => {
      tip.innerHTML = `<b>${n} ${n === 1 ? 'agent' : 'agents'}</b><br>Finishes in ${Math.round(r.T)} s<br>Busy ${Math.round(r.busyShare * 100)}% of the time<br>Click to watch`;
      tip.hidden = false;
      tip.style.left = `${Math.min(x + 14, innerWidth - 280)}px`;
      tip.style.top = `${y + 14}px`;
    };
    row.addEventListener('pointermove', (e) => show(e.clientX, e.clientY));
    row.addEventListener('pointerleave', () => { tip.hidden = true; });
    row.addEventListener('focus', () => { const b = row.getBoundingClientRect(); show(b.left + 40, b.bottom - 6); });
    row.addEventListener('blur', () => { tip.hidden = true; });
    row.addEventListener('click', () => { tip.hidden = true; setTeam(n); setPlaying(true); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    host.append(row);
  });
}

async function boot() {
  await Promise.all([
    document.fonts.load('600 56px Fraunces'), document.fonts.load('italic 500 26px Fraunces'),
    document.fonts.load('400 18px "Instrument Sans"'), document.fonts.load('600 15px "Instrument Sans"'), document.fonts.load('500 12px "IBM Plex Mono"'),
  ]);
  const wanted = Number(new URLSearchParams(location.search).get('agents'));
  N = COUNTS.includes(wanted) ? wanted : 12;
  setTeam(N);
  resize();
  new ResizeObserver(resize).observe($('stage'));
  new IntersectionObserver(([e]) => { stageVisible = e.isIntersecting; }).observe($('stage'));
  document.querySelectorAll('#counts button').forEach((b) => b.addEventListener('click', () => { setTeam(Number(b.dataset.n)); setPlaying(true); }));
  document.querySelectorAll('#speeds button').forEach((b) => b.addEventListener('click', () => {
    speed = Number(b.dataset.s);
    document.querySelectorAll('#speeds button').forEach((o) => o.classList.toggle('on', o === b));
  }));
  $('play').addEventListener('click', () => setPlaying(!playing));
  $('seek').addEventListener('input', (e) => { t = (Number(e.target.value) / 1000) * (run.T + HOLD); setPlaying(false); render(); });
  setPlaying(playing);
  // Lets a video render step through the run frame by frame.
  window.swarmSeek = (time) => { setPlaying(false); t = time; render(); return run.T; };
  lastNow = performance.now();
  requestAnimationFrame(loop);
}
boot();
