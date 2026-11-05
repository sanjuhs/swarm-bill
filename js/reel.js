// 1080x1920 stage for the reel. Nothing here reads the clock: render/capture.py calls
// window.renderAt(t) once per frame, and preview mode (?play) does the same from rAF.
import { Scene } from './scene.js';
import { DEFAULTS, estimate, money, tokens } from './cost.js';
import { SEGMENTS, BEATS, GLYPHS } from './reel-cues.js';

const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const ease = (k) => k * k * (3 - 2 * k);
const est = estimate(DEFAULTS);

// Spread each caption line's words across its span, weighted by length.
const WORDS = SEGMENTS.map(([t0, t1, text]) => {
  const parts = text.split(' ');
  const total = parts.reduce((s, w) => s + w.length + 2, 0);
  let acc = 0;
  return { t0, t1, words: parts.map((w) => { const at = t0 + (acc / total) * (t1 - t0); acc += w.length + 2; return { w, at }; }) };
});

let shownLine = -1;
function paintCaption(t) {
  let li = -1;
  for (let i = 0; i < WORDS.length; i++) if (t >= WORDS[i].t0 - 0.05) li = i;
  const host = $('caption');
  if (li < 0 || (li < WORDS.length - 1 && t > WORDS[li].t1 + 0.45)) { host.innerHTML = ''; shownLine = -1; return; }
  if (li !== shownLine) {
    host.innerHTML = WORDS[li].words.map((x) => `<span>${x.w}</span> `).join('');
    shownLine = li;
  }
  const spans = host.children, words = WORDS[li].words;
  let cur = -1;
  for (let i = 0; i < words.length; i++) if (t >= words[i].at) cur = i;
  for (let i = 0; i < spans.length; i++) spans[i].className = i === cur ? 'now' : i < cur ? 'said' : '';
}

let scene;
window.renderAt = (t) => {
  scene.update(t);
  scene.draw();
  paintCaption(t);

  const f = scene.spent(t), ph = scene.phase(t);
  $('m-total').textContent = money(est.cost * f);
  $('m-tokens').textContent = `${tokens(est.tokens * f)} tokens`;
  $('m-active').textContent = `${Math.round(scene.activity(t) * DEFAULTS.agents).toLocaleString('en-US')} / 1,000 active`;
  $('m-phase').textContent = ph.tone === 'bad' ? 'BUILD FAILED' : ph.label;
  $('m-phase').className = ph.tone === 'bad' ? 'bad' : '';

  // "Watch this number": the meter swells once before anything moves.
  const pulse = Math.sin(prog(t, 3.55, 4.55) * Math.PI);
  $('meter').style.transform = `scale(${1 + pulse * 0.045})`;

  const g = GLYPHS.find((x) => t >= x.t0 && t < x.t1);
  const note = $('note');
  note.textContent = g ? g.note : '';
  note.style.opacity = g ? ease(prog(t, g.t0 + 0.2, g.t0 + 0.6)) * (1 - prog(t, g.t1 - 0.15, g.t1)) : 0;

  // The receipt prints downwards out of the top of the stage.
  const rIn = $('receipt-in').offsetHeight;
  const open = ease(prog(t, BEATS.bill + 0.1, BEATS.bill + 3.2));
  const close = ease(prog(t, BEATS.billEnd - 0.2, BEATS.billEnd + 0.15));
  $('receipt').style.height = `${rIn * open * (1 - close)}px`;

  const endK = ease(prog(t, 28.0, 28.6));
  $('end').style.opacity = endK;
  $('meter').style.opacity = 1 - endK;
};

async function boot() {
  await Promise.all([
    document.fonts.load('600 45px Fraunces'), document.fonts.load('800 54px Fraunces'), document.fonts.load('italic 500 25px Fraunces'),
    document.fonts.load('400 15px "Instrument Sans"'), document.fonts.load('600 15px "Instrument Sans"'),
    document.fonts.load('500 11px "IBM Plex Mono"'), document.fonts.load('600 56px Fraunces'), document.fonts.load('700 100px "Instrument Sans"'),
  ]);
  const glyphBox = { x: 90, y: 330, w: 900, h: 520 };
  scene = new Scene({
    pageCanvas: $('page'), agentCanvas: $('agents'),
    width: 1080, height: 1920, dpr: 1,
    pageRect: { x: 60, y: 256, w: 960 },
    N: DEFAULTS.agents, beats: BEATS, scale: 1.25, dims: [[BEATS.bill, BEATS.billEnd]], clearAt: 25.9,
    glyphs: GLYPHS.map((g) => ({ ...g, box: g.text === '?' ? { x: 200, y: 280, w: 680, h: 720 } : glyphBox })),
  });
  window.renderAt(0);
  if (new URLSearchParams(location.search).has('play')) {
    const t0 = performance.now();
    const loop = (now) => { window.renderAt(((now - t0) / 1000) % BEATS.end); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  window.reelReady = true;
}
boot();
