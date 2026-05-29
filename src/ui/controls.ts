// Tweakpane control panel for live tuning. Lazily imported so Tweakpane never
// touches the critical-path bundle. Exposes a toggle for the toolbar button.

import type { Pane } from 'tweakpane';
import type { App } from '../app';
import { PALETTES } from '../palettes/palettes';

export interface ControlPanel {
  element: HTMLElement;
  toggle: () => void;
  show: () => void;
  hide: () => void;
}

export async function createControls(app: App): Promise<ControlPanel> {
  const { Pane } = await import('tweakpane');

  const container = document.createElement('div');
  container.className = 'controls is-hidden';
  document.body.appendChild(container);

  const c = app.config;
  // Mutable mirror Tweakpane binds against; pushed into the app on change.
  const params = {
    palette: c.palette,
    densityDissipation: c.densityDissipation,
    velocityDissipation: c.velocityDissipation,
    curl: c.curl,
    pressureIterations: c.pressureIterations,
    splatRadius: c.splatRadius,
    splatForce: c.splatForce,
    bloom: c.bloom,
    bloomIntensity: c.bloomIntensity,
    bloomThreshold: c.bloomThreshold,
    sunrays: c.sunrays,
    shading: c.shading,
    exposure: c.exposure,
    vignette: c.vignette,
    grain: c.grain,
    idle: c.idle,
    simResolution: c.simResolution,
    dyeResolution: c.dyeResolution,
  };

  const pane: Pane = new Pane({ container, title: 'Innerbloom' });

  const look = pane.addFolder({ title: 'Look' });
  look.addBinding(params, 'palette', {
    label: 'palette',
    options: Object.fromEntries(PALETTES.map((p) => [p.name, p.id])),
  });
  look.addBinding(params, 'bloom');
  look.addBinding(params, 'bloomIntensity', { min: 0, max: 2, step: 0.01, label: 'bloom amt' });
  look.addBinding(params, 'bloomThreshold', { min: 0, max: 1, step: 0.01, label: 'bloom thr' });
  look.addBinding(params, 'sunrays');
  look.addBinding(params, 'shading');
  look.addBinding(params, 'exposure', { min: 0.3, max: 2, step: 0.01 });
  look.addBinding(params, 'vignette', { min: 0, max: 1.5, step: 0.01 });
  look.addBinding(params, 'grain', { min: 0, max: 0.15, step: 0.005 });

  const fluid = pane.addFolder({ title: 'Fluid' });
  fluid.addBinding(params, 'densityDissipation', { min: 0, max: 4, step: 0.01, label: 'color fade' });
  fluid.addBinding(params, 'velocityDissipation', { min: 0, max: 4, step: 0.01, label: 'viscosity' });
  fluid.addBinding(params, 'curl', { min: 0, max: 50, step: 1, label: 'swirl' });
  fluid.addBinding(params, 'pressureIterations', { min: 1, max: 40, step: 1, label: 'pressure' });
  fluid.addBinding(params, 'splatRadius', { min: 0.05, max: 1, step: 0.01, label: 'splat size' });
  fluid.addBinding(params, 'splatForce', { min: 1000, max: 12000, step: 100, label: 'splat force' });
  fluid.addBinding(params, 'idle', { label: 'idle motion' });

  const quality = pane.addFolder({ title: 'Quality', expanded: false });
  quality.addBinding(params, 'simResolution', { min: 64, max: 256, step: 32, label: 'sim res' });
  quality.addBinding(params, 'dyeResolution', { min: 256, max: 1440, step: 64, label: 'dye res' });

  pane.addButton({ title: 'Reset canvas' }).on('click', () => app.reset());

  pane.on('change', () => {
    app.setConfig({ ...params });
  });

  return {
    element: container,
    toggle: () => container.classList.toggle('is-hidden'),
    show: () => container.classList.remove('is-hidden'),
    hide: () => container.classList.add('is-hidden'),
  };
}
