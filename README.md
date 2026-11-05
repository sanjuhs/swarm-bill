# Swarm Bill

Watch a simulated swarm of AI agents build a small website while a receipt prints the running cost, then change the assumptions yourself.

**Live:** https://sanjuhs.github.io/swarm-bill/

The swarm is a simulation. The cost is a calculation using DeepSeek's published prices, checked 5 November 2026. Nothing here calls a model.

## How it works

- `js/cost.js`: the token and price model.
- `js/scene.js`: the swarm. It is a fixed-step simulation driven only by the time passed to `update(t)`, so the same code runs the live page and a frame-by-frame video render.
- `js/main.js`: the page, the calculator and the two small demos.
- `reel.html`, `js/reel.js`, `js/reel-cues.js`: the 1080×1920 stage used to render the Instagram reel.

- `swarm/`: **Swarm**, a sub-site where a small team of named agents builds a page in a Figma-style workspace (https://sanjuhs.github.io/swarm-bill/swarm/). `plan.js` is a list scheduler that turns a team size into every cursor move and edit up front, and `app.js` replays that to any time `t`, which is why the page can be scrubbed. `window.swarmSeek(t)` steps it frame by frame for video.

There's no build step and there are no dependencies. Serve the folder with any static server:

```bash
python3 -m http.server 8765
```

Idea inspired by [Swarm by califa](https://califa.github.io/swarm-site/). All the code here is written from scratch.
