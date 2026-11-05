// Off-peak USD per 1M tokens, from https://api-docs.deepseek.com/quick_start/pricing (checked 2026-11-05).
// Peak rates are exactly double.
export const MODELS = {
  flash: { label: 'DeepSeek V4.1 Flash', hit: 0.003, miss: 0.15, out: 0.6 },
  pro: { label: 'DeepSeek V4 Pro', hit: 0.022, miss: 0.66, out: 1.98 },
};

export const DEFAULTS = { agents: 1000, turns: 12, ctx: 20000, hitRate: 0.85, outPerTurn: 600, model: 'flash', peak: false };

export function estimate(p) {
  const m = MODELS[p.model];
  const k = (p.peak ? 2 : 1) / 1e6;
  const input = p.agents * p.turns * p.ctx;
  const hit = input * p.hitRate;
  const miss = input - hit;
  const out = p.agents * p.turns * p.outPerTurn;
  const rates = { hit: m.hit * k * 1e6, miss: m.miss * k * 1e6, out: m.out * k * 1e6 };
  const hitCost = hit * m.hit * k;
  const missCost = miss * m.miss * k;
  const outCost = out * m.out * k;
  return { input, hit, miss, out, tokens: input + out, rates, hitCost, missCost, outCost, cost: hitCost + missCost + outCost, modelLabel: m.label };
}

export function money(x) {
  if (x >= 1000) return '$' + Math.round(x).toLocaleString('en-US');
  if (x >= 0.1) return '$' + x.toFixed(2);
  return '$' + x.toFixed(4);
}

export function tokens(x) {
  if (x >= 1e9) return (x / 1e9).toFixed(2) + 'B';
  if (x >= 1e6) return (x / 1e6).toFixed(1) + 'M';
  if (x >= 1e3) return (x / 1e3).toFixed(1) + 'K';
  return String(Math.round(x));
}
