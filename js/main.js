import { Scene, WEB_BEATS, ROLE_COLORS, dartSprite } from './scene.js';
import { DEFAULTS, MODELS, estimate, money, tokens } from './cost.js';

const $ = (id) => document.getElementById(id);
const params = { ...DEFAULTS };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MAX_DRAWN = 5000;

// ---- Hero ----------------------------------------------------------------------------------

const hero = $('hero');
let scene = null;
let startedAt = 0;
let heroVisible = true;
let lastWidth = 0;

function buildScene() {
  const hr = hero.getBoundingClientRect();
  const st = $('stage').getBoundingClientRect();
  lastWidth = hr.width;
  scene = new Scene({
    pageCanvas: $('page-canvas'),
    agentCanvas: $('agent-canvas'),
    width: hr.width,
    height: hr.height,
    dpr: Math.min(devicePixelRatio || 1, 2),
    pageRect: { x: st.left - hr.left, y: st.top - hr.top, w: st.width },
    N: Math.min(params.agents, MAX_DRAWN),
    beats: WEB_BEATS,
    scale: Math.min(1, Math.max(0.55, (st.width / 800) * 1.15)),
  });
  startedAt = performance.now();
}

function paintReceipt(t) {
  const est = estimate(params);
  const f = scene.spent(t);
  const ph = scene.phase(t);
  $('r-total').textContent = money(est.cost * f);
  $('r-tokens').textContent = `${tokens(est.tokens * f)} tokens`;
  const active = Math.round(scene.activity(t) * params.agents);
  $('r-active').textContent = `${active.toLocaleString('en-US')} / ${params.agents.toLocaleString('en-US')} active`;
  $('r-hit').textContent = money(est.hitCost * f);
  $('r-miss').textContent = money(est.missCost * f);
  $('r-out').textContent = money(est.outCost * f);
  $('r-status').textContent = ph.label;
  $('r-status').className = 'status' + (ph.tone === 'bad' ? ' bad' : '');
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!scene || !heroVisible || document.hidden) { startedAt += now - (frame.last || now); frame.last = now; return; }
  frame.last = now;
  let t = (now - startedAt) / 1000;
  if (t > WEB_BEATS.end) { startedAt = now; t = 0; }
  scene.update(t);
  scene.draw();
  paintReceipt(t);
}

function showFinished() {
  const t = WEB_BEATS.done + 1;
  scene.update(t);
  scene.draw();
  paintReceipt(t);
}

function restart() {
  buildScene();
  if (reduced) showFinished();
}

// ---- Calculator ----------------------------------------------------------------------------

// Agents slider is log-scaled: 1 to 10,000 across 0..100.
const agentsFromSlider = (v) => {
  const raw = Math.pow(10, (v / 100) * 4);
  const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(raw)) - 1));
  return Math.max(1, Math.round(raw / mag) * mag);
};
const sliderFromAgents = (n) => (Math.log10(n) / 4) * 100;

function paintCalc() {
  const e = estimate(params);
  $('o-agents').textContent = params.agents.toLocaleString('en-US');
  $('o-turns').textContent = params.turns;
  $('o-ctx').textContent = tokens(params.ctx) + ' tokens';
  $('o-hit').textContent = Math.round(params.hitRate * 100) + '%';
  $('o-out').textContent = params.outPerTurn.toLocaleString('en-US') + ' tokens';
  $('c-total').textContent = money(e.cost);
  $('c-sub').textContent = `${tokens(e.tokens)} tokens on ${MODELS[params.model].label}, ${params.peak ? 'peak' : 'off-peak'}. That is ${money(e.cost / params.agents)} per agent.`;
  const row = (name, amt, rate, cost) => `<tr><td>${name}</td><td class="n">${tokens(amt)}</td><td class="n">$${rate.toFixed(3)}</td><td class="n">${money(cost)}</td></tr>`;
  $('c-rows').innerHTML = row('Cached input', e.hit, e.rates.hit, e.hitCost) + row('Fresh input', e.miss, e.rates.miss, e.missCost) + row('Output', e.out, e.rates.out, e.outCost);
  $('r-model').textContent = `${MODELS[params.model].label}, ${params.peak ? 'peak' : 'off-peak'}`;
  $('h-agents').textContent = `${params.agents.toLocaleString('en-US')} ${params.agents === 1 ? 'agent' : 'agents'}.`;
  $('h-cost').textContent = money(e.cost) + '.';
  paintBars();
}

function paintBars() {
  const scenarios = [
    ['Your setup', params, true],
    ['At peak hours', { ...params, peak: true }],
    ['With no cache hits', { ...params, hitRate: 0 }],
    ['On V4 Pro', { ...params, model: 'pro' }],
  ];
  const ests = scenarios.map(([, p]) => estimate(p));
  const max = Math.max(...ests.map((e) => e.cost));
  const host = $('bars');
  host.innerHTML = '';
  scenarios.forEach(([name, , base], i) => {
    const e = ests[i];
    const row = document.createElement('div');
    row.className = 'bar' + (base ? ' base' : '');
    row.tabIndex = 0;
    row.innerHTML = `<div class="name">${name}</div><div class="track"><div class="fill" style="width:calc((100% - 92px) * ${(e.cost / max).toFixed(4)})"></div><div class="val">${money(e.cost)}</div></div>`;
    const tipText = `Cached ${money(e.hitCost)}<br>Fresh ${money(e.missCost)}<br>Output ${money(e.outCost)}`;
    const tip = $('tip');
    const show = (x, y) => { tip.innerHTML = `<b>${name}</b><br>${tipText}`; tip.hidden = false; tip.style.left = Math.min(x + 14, innerWidth - 270) + 'px'; tip.style.top = y + 14 + 'px'; };
    row.addEventListener('pointermove', (ev) => show(ev.clientX, ev.clientY));
    row.addEventListener('pointerleave', () => { tip.hidden = true; });
    row.addEventListener('focus', () => { const r = row.getBoundingClientRect(); show(r.left + 40, r.bottom - 8); });
    row.addEventListener('blur', () => { tip.hidden = true; });
    host.append(row);
  });
}

function syncAgentButtons() {
  document.querySelectorAll('.seg [data-n]').forEach((b) => b.classList.toggle('on', Number(b.dataset.n) === params.agents));
}

let rebuildTimer;
function setAgents(n, fromSlider) {
  params.agents = n;
  if (!fromSlider) $('s-agents').value = sliderFromAgents(n);
  syncAgentButtons();
  paintCalc();
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(restart, 180);
}

function initCalc() {
  const bind = (id, key, map = Number) => {
    $(id).value = key === 'hitRate' ? params.hitRate * 100 : params[key];
    $(id).addEventListener('input', (e) => { params[key] = map(e.target.value); paintCalc(); });
  };
  bind('s-turns', 'turns');
  bind('s-ctx', 'ctx');
  bind('s-hit', 'hitRate', (v) => Number(v) / 100);
  bind('s-out', 'outPerTurn');
  $('s-agents').value = sliderFromAgents(params.agents);
  $('s-agents').addEventListener('input', (e) => setAgents(agentsFromSlider(Number(e.target.value)), true));
  document.querySelectorAll('.seg [data-n]').forEach((b) => b.addEventListener('click', () => setAgents(Number(b.dataset.n))));
  document.querySelectorAll('[data-model]').forEach((b) => b.addEventListener('click', () => {
    params.model = b.dataset.model;
    document.querySelectorAll('[data-model]').forEach((o) => o.classList.toggle('on', o === b));
    paintCalc();
  }));
  document.querySelectorAll('[data-peak]').forEach((b) => b.addEventListener('click', () => {
    params.peak = b.dataset.peak === '1';
    document.querySelectorAll('[data-peak]').forEach((o) => o.classList.toggle('on', o === b));
    paintCalc();
  }));
  $('calc').addEventListener('submit', (e) => e.preventDefault());
  $('replay').addEventListener('click', restart);
  paintCalc();
}

// ---- The two small demos -------------------------------------------------------------------

function miniDemo(cv, mode) {
  const dpr = Math.min(devicePixelRatio || 1, 2), W = 560, H = 300, N = 180;
  cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d');
  const colors = Object.values(ROLE_COLORS);
  const sprites = colors.map((col) => dartSprite(col, 7, dpr));
  const half = sprites[0].width / dpr / 2;
  const tasks = [[300, 45], [440, 45], [300, 150], [440, 150], [300, 255], [440, 255]];
  const A = Array.from({ length: N }, (_, i) => ({
    x: 60, y: 150, vx: 0, vy: 0, h: 0, k: i % 6, a: (i * 2.399) % (Math.PI * 2), r: 0.6 + ((i * 7) % 10) / 10, s: 0.6 + ((i * 13) % 10) / 15,
  }));
  const draw = (t) => {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const cyc = t % 8;
    if (mode === 'fan') {
      c.strokeStyle = 'rgba(70,60,40,.3)'; c.setLineDash([4, 4]);
      tasks.forEach(([x, y]) => c.strokeRect(x - 52, y - 32, 104, 64));
      c.setLineDash([]);
      c.fillStyle = '#1C1A17'; c.fillRect(44, 134, 32, 32);
    } else {
      const fixed = cyc > 5.2;
      c.fillStyle = fixed ? '#0B8F65' : '#C8261B';
      c.beginPath(); c.arc(280, 150, 15, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.font = '700 14px "Instrument Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(fixed ? '✓' : '!', 280, 151);
    }
    A.forEach((a, i) => {
      let tx, ty;
      if (mode === 'fan') {
        const going = cyc < 6.8;
        const [x, y] = tasks[a.k];
        tx = going ? x + Math.cos(t * 1.6 + a.a) * 44 * a.r : 60;
        ty = going ? y + Math.sin(t * 2.1 + a.a) * 24 * a.r : 150;
      } else if (cyc < 5.2) {
        const rad = (130 - Math.min(cyc / 4, 1) * 90) * (0.75 + a.r * 0.3);
        tx = 280 + Math.cos(a.a + t * 2 * a.s) * rad; ty = 150 + Math.sin(a.a + t * 2 * a.s) * rad * 0.9;
      } else {
        tx = 280 + Math.cos(a.a) * 240 * a.r; ty = 150 + Math.sin(a.a) * 125 * a.r;
      }
      const dx = tx - a.x, dy = ty - a.y;
      a.vx += (dx * 5 - a.vx) * 0.09; a.vy += (dy * 5 - a.vy) * 0.09;
      a.x += a.vx / 60; a.y += a.vy / 60;
      if (Math.hypot(a.vx, a.vy) > 12) a.h = Math.atan2(a.vy, a.vx);
      c.setTransform(Math.cos(a.h) * dpr, Math.sin(a.h) * dpr, -Math.sin(a.h) * dpr, Math.cos(a.h) * dpr, a.x * dpr, a.y * dpr);
      c.drawImage(sprites[mode === 'fan' ? a.k : i % 6], -half, -half, half * 2, half * 2);
    });
  };
  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(cv);
  if (reduced) { for (let i = 0; i < 180; i++) draw(2 + i / 60); return; }
  const loop = (now) => { requestAnimationFrame(loop); if (visible && !document.hidden) draw(now / 1000); };
  requestAnimationFrame(loop);
}

// ---- Boot ----------------------------------------------------------------------------------

async function boot() {
  await Promise.all([
    document.fonts.load('600 45px Fraunces'), document.fonts.load('800 54px Fraunces'), document.fonts.load('italic 500 25px Fraunces'),
    document.fonts.load('400 15px "Instrument Sans"'), document.fonts.load('600 15px "Instrument Sans"'), document.fonts.load('500 11px "IBM Plex Mono"'),
  ]);
  initCalc();
  restart();
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);
  addEventListener('resize', () => {
    if (hero.getBoundingClientRect().width === lastWidth) return;
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(restart, 200);
  });
  if (!reduced) requestAnimationFrame(frame);
  miniDemo($('demo-fan'), 'fan');
  miniDemo($('demo-ring'), 'ring');
}
boot();
