// Timing for the reel. These are draft estimates of the script at a normal pace.
// Once the real voice recording exists, its word timestamps replace SEGMENTS and BEATS.

export const SEGMENTS = [
  [0.15, 3.35, 'What would it cost to have a thousand AI agents build you one website?'],
  [3.55, 4.55, 'Watch this number.'],
  [4.85, 5.75, 'This is a swarm.'],
  [5.85, 9.75, 'One orchestrator splits the job: research, design, code, review, all at the same time.'],
  [10.05, 11.15, 'And when something breaks?'],
  [11.25, 13.75, 'They all attack that one bug, from every angle.'],
  [14.05, 14.95, 'This is already real.'],
  [15.0, 17.2, 'Kimi can run three hundred agents on one task.'],
  [17.3, 20.0, 'Halcyon has agents watching energy filings across America.'],
  [20.4, 21.1, 'So, the bill.'],
  [21.2, 23.6, 'A quarter of a billion tokens on DeepSeek Flash.'],
  [23.75, 25.6, 'By my math, about ten dollars.'],
  [26.1, 28.5, 'So what would you point a thousand agents at?'],
];

export const BEATS = {
  spawn: 4.85, research: 5.0, design: 6.6, build: 7.4, buildEnd: 10.0, review: 9.0, bug: 10.05,
  fix: 13.9, deploy: 19.95, done: 20.45, bill: 20.4, billEnd: 25.9, end: 31.0,
};

export const GLYPHS = [
  { t0: 15.0, t1: 17.25, text: '300', note: 'Kimi Agent Swarm: up to 300 sub-agents' },
  { t0: 17.3, t1: 20.0, text: 'ENERGY', note: 'Halcyon: alerts on filings from all 50 US states' },
  { t0: 26.0, t1: 31.5, text: '?', note: '' },
];
