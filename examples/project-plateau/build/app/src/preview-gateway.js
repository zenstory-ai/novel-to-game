const COPY = {
  'webgl2-unavailable': {
    eyebrow: 'Watch the field report',
    title: 'Your browser cannot open the 3D expedition.',
    detail: 'The 15-second preview below is real footage from Project Plateau. Continue with a mobile-ready game or read the complete 3D case study.',
  },
  'mobile-controls-unavailable': {
    eyebrow: 'Mobile field report',
    title: 'Watch now. Play the full expedition on desktop.',
    detail: 'Project Plateau uses mouse-look and keyboard field controls. This 15-second preview shows the real build without sending your phone through the full 3D download.',
  },
  'viewport-below-desktop-floor': {
    eyebrow: 'Compact-screen field report',
    title: 'The expedition needs a larger desktop viewport.',
    detail: 'Watch the real 15-second build preview here, or continue with one of the mobile-ready 2D games.',
  },
  'in-app-browser': {
    eyebrow: 'Social preview',
    title: 'A 15-second glimpse of the plateau.',
    detail: 'In-app browsers are unreliable for a mouse-and-keyboard WebGL2 expedition. Watch the real build here, then open the full case study or a mobile-ready game.',
  },
  'explicit-preview': {
    eyebrow: 'Project Plateau preview',
    title: 'A 15-second glimpse of the plateau.',
    detail: 'This is real footage from the current 3D build, followed by links to mobile-ready games and the complete engineering case study.',
  },
  'runtime-unavailable': {
    eyebrow: '3D runtime interrupted',
    title: 'The field report is still available.',
    detail: 'The interactive build could not start in this browser. Watch the real 15-second preview or continue to a mobile-ready game.',
  },
};

export function showPreviewGateway(reason) {
  const gateway = document.querySelector('#preview-gateway');
  const video = document.querySelector('#preview-video');
  const source = video?.querySelector('source');
  const copy = COPY[reason] ?? COPY['runtime-unavailable'];
  hideLoading();
  document.body.dataset.mode = 'preview';
  document.querySelector('#title-screen').hidden = true;
  document.querySelector('#game-canvas').hidden = true;
  gateway.hidden = false;
  gateway.querySelector('.eyebrow').textContent = copy.eyebrow;
  gateway.querySelector('h1').textContent = copy.title;
  gateway.querySelector('.preview-detail').textContent = copy.detail;
  if (!video.poster) video.poster = video.dataset.poster;
  if (source && !source.src) {
    source.src = source.dataset.src;
    video.load();
  }
  void video.play().catch(() => {
    // Muted autoplay is best effort; native controls and poster remain usable.
  });
  window.__projectPlateauEntry = {
    ready: true,
    mode: 'preview',
    reason,
    video: source?.getAttribute('src') ?? null,
  };
}
import { hideLoading } from './loading-screen.js';
