// Entry point: boot the simulation, mount the UI, and fail gracefully when the
// browser can't provide what the fluid solver needs.

import '../styles/global.css';
import { App, WebGLUnsupportedError } from './app';
import { createToolbar, type ToolbarHandles } from './ui/toolbar';
import type { ControlPanel } from './ui/controls';

function showFatal(title: string, message: string): void {
  const el = document.createElement('div');
  el.className = 'fatal';
  el.setAttribute('role', 'alert');
  const h = document.createElement('h1');
  h.textContent = title;
  const p = document.createElement('p');
  p.textContent = message;
  el.append(h, p);
  document.body.appendChild(el);
}

function showHint(): void {
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'Click & drag to swirl the color';
  document.body.appendChild(hint);
  window.setTimeout(() => hint.classList.add('is-hidden'), 4200);
  const dismiss = (): void => hint.classList.add('is-hidden');
  window.addEventListener('pointerdown', dismiss, { once: true });
  window.setTimeout(() => hint.remove(), 9000);
}

function boot(): void {
  const canvas = document.getElementById('scene');
  if (!(canvas instanceof HTMLCanvasElement)) {
    showFatal('Something went wrong', 'The canvas element could not be found.');
    return;
  }

  let app: App;
  try {
    app = new App(canvas);
  } catch (err) {
    if (err instanceof WebGLUnsupportedError) {
      showFatal('WebGL2 required', err.message);
    } else {
      showFatal('Could not start', err instanceof Error ? err.message : 'Unknown error.');
      console.error(err);
    }
    return;
  }

  app.start();

  // Lazily build the Tweakpane panel the first time it's requested.
  let panel: ControlPanel | null = null;
  let loading = false;
  const handles: ToolbarHandles = {
    onTogglePanel: async () => {
      if (panel) {
        panel.toggle();
        return;
      }
      if (loading) return;
      loading = true;
      const { createControls } = await import('./ui/controls');
      panel = await createControls(app);
      panel.show();
      loading = false;
    },
  };

  createToolbar(app, handles);
  showHint();

  // Expose for debugging / e2e hooks without polluting module scope.
  (window as unknown as { __app: App }).__app = app;
}

boot();
