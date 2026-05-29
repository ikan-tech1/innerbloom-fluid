# Innerbloom Fluid

An interactive, real-time **WebGL2 fluid simulation** inspired by the macro-liquid,
acrylic-pour visuals of RÜFÜS DU SOL's _Innerbloom_. Click and drag to push color
through a true Navier–Stokes fluid that bleeds and marbles like ink in water.

The solver follows the architecture of [Pavel Dobryakov's WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation)
— advection, vorticity confinement, a Jacobi pressure solve, and divergence-free
projection running entirely on the GPU via ping-ponged float framebuffers — re-implemented
from scratch in raw WebGL2 + TypeScript and tuned toward a slower, iridescent aesthetic.

## Features

- **Drag to swirl** — mouse, pen, and **multitouch**; each pointer carries its own color.
- **True fluid dynamics** — Navier–Stokes on the GPU at 60 fps.
- **Switchable palettes** — Iridescent (default), Neon, Monochrome Ink, Sunset.
- **Idle auto-motion** — curl-noise drift keeps the canvas breathing when untouched.
- **Bloom + sunrays + shading** — luminous, lit liquid with vignette and film grain.
- **Audio reactivity** — react to your **microphone** or a chosen **audio file**;
  bass triggers beat blooms, mids/highs shimmer.
- **Live control panel** — Tweakpane for viscosity, color fade, swirl, bloom, quality, etc.
- **Screenshot, fullscreen, pause, reset** from the floating toolbar.
- **Adaptive & accessible** — device-based quality, an FPS watchdog that downshifts under
  load, `prefers-reduced-motion` support, and a clean fallback when WebGL2 is unavailable.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # type-check + production build to dist/
npm run preview    # serve the built bundle
```

## Tests

```bash
npm test           # Vitest unit tests (color, palettes, noise, config, formats)
npm run test:e2e   # Playwright smoke tests (boot, render, palette, drag)
```

`npm run test:e2e` downloads a Chromium build on first run (`npx playwright install chromium`)
and renders WebGL via SwiftShader, so it works headlessly in CI.

## How it works

Each frame runs this GPU pipeline (one fragment-shader pass per step, fields stored as
double-buffered half-float textures):

1. **curl** of the velocity field
2. **vorticity confinement** — re-injects swirl that numerical diffusion smears away
3. **divergence**
4. **pressure** — Jacobi iterations solving the Poisson equation
5. **gradient subtract** — projects velocity to be divergence-free
6. **advect** velocity, then dye, along the flow (with dissipation)
7. **splats** — pointer / idle / audio inject velocity + color
8. **display** — palette-mapped dye composited with bloom, sunrays, shading, vignette, grain

The simulation runs on a low-resolution velocity grid, the dye on a higher-resolution grid,
and the final image at full device resolution — the standard performance split.

## Project layout

```
src/
  gl/          WebGL2 context, capability detection, programs, FBOs, fullscreen quad
  sim/         FluidSimulation (the pass pipeline), config, splat model
  shaders/     GLSL ES 3.00 vertex + fragment shaders
  input/       pointer (mouse/touch) and idle curl-noise motion
  audio/       lazy-loaded WebAudio reactivity
  palettes/    curated color palettes + sampling
  ui/          glass toolbar + Tweakpane control panel
  lib/         color + simplex-noise helpers
  app.ts       orchestrator (loop, resize, quality, screenshots, audio)
  main.ts      bootstrap + graceful fallback
```

## Browser support

Requires **WebGL2** with renderable float (or half-float) textures — all current versions
of Chrome, Firefox, Edge, and Safari. GPUs without `OES_texture_float_linear` fall back to
in-shader bilinear filtering automatically. Without WebGL2, a friendly message is shown.

## Credits

Solver architecture after Pavel Dobryakov's WebGL-Fluid-Simulation; marble/acrylic aesthetic
inspired by RÜFÜS DU SOL's _Innerbloom_ and generative liquid shader work by Marta Verde.
