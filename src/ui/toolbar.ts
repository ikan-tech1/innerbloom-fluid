// Floating glass toolbar: palette swatches + transport/utility buttons.
// Auto-hides after inactivity and reappears on pointer movement.

import './ui.css';
import type { App } from '../app';
import { PALETTES } from '../palettes/palettes';

const ICONS = {
  play: '<polygon points="6 4 20 12 6 20 6 4"></polygon>',
  pause: '<rect x="6" y="5" width="4" height="14"></rect><rect x="14" y="5" width="4" height="14"></rect>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v4h4"></path>',
  camera:
    '<path d="M4 8h3l2-2h6l2 2h3v11H4z"></path><circle cx="12" cy="13.5" r="3.2"></circle>',
  fullscreen: '<path d="M4 9V4h5"></path><path d="M20 9V4h-5"></path><path d="M4 15v5h5"></path><path d="M20 15v5h-5"></path>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path>',
  music: '<path d="M9 18V6l10-2v12"></path><circle cx="6" cy="18" r="3"></circle><circle cx="16" cy="16" r="3"></circle>',
  sliders: '<path d="M4 6h10"></path><path d="M18 6h2"></path><circle cx="16" cy="6" r="2"></circle><path d="M4 12h2"></path><path d="M10 12h10"></path><circle cx="8" cy="12" r="2"></circle><path d="M4 18h8"></path><path d="M16 18h4"></path><circle cx="14" cy="18" r="2"></circle>',
};

function icon(name: keyof typeof ICONS): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
}

function button(label: string, svg: keyof typeof ICONS, pressed?: boolean): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'btn';
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.title = label;
  if (pressed !== undefined) b.setAttribute('aria-pressed', String(pressed));
  b.innerHTML = icon(svg);
  return b;
}

const IDLE_HIDE_MS = 3800;

export interface ToolbarHandles {
  onTogglePanel: () => void;
}

export function createToolbar(app: App, handles: ToolbarHandles): HTMLElement {
  const bar = document.createElement('nav');
  bar.className = 'toolbar';
  bar.setAttribute('aria-label', 'Fluid controls');

  // Palette swatches.
  const swatches = document.createElement('div');
  swatches.className = 'toolbar__swatches';
  swatches.setAttribute('role', 'group');
  swatches.setAttribute('aria-label', 'Color palette');
  const swatchButtons: HTMLButtonElement[] = [];
  for (const p of PALETTES) {
    const s = document.createElement('button');
    s.className = 'swatch';
    s.type = 'button';
    s.setAttribute('aria-label', `${p.name} palette`);
    s.title = p.name;
    s.setAttribute('aria-pressed', String(p.id === app.config.palette));
    s.style.background = `linear-gradient(135deg, ${p.stops[0]}, ${p.stops[Math.floor(p.stops.length / 2)]}, ${p.stops[p.stops.length - 1]})`;
    s.addEventListener('click', () => {
      app.setPalette(p.id);
      for (const b of swatchButtons) b.setAttribute('aria-pressed', String(b === s));
    });
    swatchButtons.push(s);
    swatches.appendChild(s);
  }
  bar.appendChild(swatches);
  bar.appendChild(divider());

  // Transport.
  const playBtn = button('Pause', 'pause', false);
  playBtn.addEventListener('click', () => {
    const next = !app.isPaused();
    app.setPaused(next);
    playBtn.innerHTML = icon(next ? 'play' : 'pause');
    playBtn.setAttribute('aria-label', next ? 'Play' : 'Pause');
    playBtn.title = next ? 'Play' : 'Pause';
  });

  const resetBtn = button('Reset canvas', 'reset');
  resetBtn.addEventListener('click', () => app.reset());

  const shotBtn = button('Save screenshot', 'camera');
  shotBtn.addEventListener('click', () => app.requestScreenshot());

  const fsBtn = button('Toggle fullscreen', 'fullscreen');
  fsBtn.addEventListener('click', () => void app.toggleFullscreen());

  bar.append(playBtn, resetBtn, shotBtn, fsBtn, divider());

  // Audio.
  const micBtn = button('Toggle microphone reactivity', 'mic', false);
  micBtn.addEventListener('click', async () => {
    if (micBtn.getAttribute('aria-pressed') === 'true') {
      app.disableAudio();
      micBtn.setAttribute('aria-pressed', 'false');
      return;
    }
    try {
      await app.enableAudioMic();
      micBtn.setAttribute('aria-pressed', 'true');
      musicBtn.setAttribute('aria-pressed', 'false');
    } catch {
      micBtn.setAttribute('aria-pressed', 'false');
    }
  });

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'audio/*';
  fileInput.className = 'visually-hidden';
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      await app.enableAudioFile(file);
      musicBtn.setAttribute('aria-pressed', 'true');
      micBtn.setAttribute('aria-pressed', 'false');
    } catch {
      musicBtn.setAttribute('aria-pressed', 'false');
    }
  });
  const musicBtn = button('Play an audio file', 'music', false);
  musicBtn.addEventListener('click', () => {
    if (musicBtn.getAttribute('aria-pressed') === 'true') {
      app.disableAudio();
      musicBtn.setAttribute('aria-pressed', 'false');
    } else {
      fileInput.click();
    }
  });

  const panelBtn = button('Toggle settings panel', 'sliders');
  panelBtn.addEventListener('click', () => handles.onTogglePanel());

  bar.append(micBtn, musicBtn, fileInput, divider(), panelBtn);

  document.body.appendChild(bar);
  setupAutoHide(bar);
  return bar;
}

function divider(): HTMLElement {
  const d = document.createElement('div');
  d.className = 'toolbar__divider';
  return d;
}

function setupAutoHide(bar: HTMLElement): void {
  let timer = 0;
  const show = (): void => {
    bar.classList.remove('is-hidden');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => bar.classList.add('is-hidden'), IDLE_HIDE_MS);
  };
  window.addEventListener('pointermove', show, { passive: true });
  window.addEventListener('keydown', show);
  bar.addEventListener('pointerenter', () => {
    window.clearTimeout(timer);
    bar.classList.remove('is-hidden');
  });
  show();
}
