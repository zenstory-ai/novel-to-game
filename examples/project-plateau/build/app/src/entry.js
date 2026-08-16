import './styles.css';
import { browserEntryCapability } from './entry-mode.js';
import { hideLoading, showLoading } from './loading-screen.js';

const FAILURE_COPY = {
  'webgl2-unavailable': 'This browser does not provide the WebGL2 renderer required by the expedition.',
  'mobile-controls-unavailable': 'Project Plateau requires desktop mouse-look and keyboard controls.',
  'viewport-below-desktop-floor': 'Project Plateau requires a desktop viewport of at least 1100 × 640.',
  'runtime-unavailable': 'The interactive runtime could not start in this browser.',
};

function showRuntimeUnavailable(reason) {
  hideLoading();
  document.body.dataset.mode = 'runtime-error';
  document.querySelector('#title-screen').hidden = true;
  document.querySelector('#game-canvas').hidden = true;
  document.querySelector('#runtime-error-copy').textContent = (
    FAILURE_COPY[reason] ?? FAILURE_COPY['runtime-unavailable']
  );
  document.querySelector('#retry-runtime').hidden = true;
  document.querySelector('#runtime-error').hidden = false;
  window.__projectPlateauEntry = { ready: true, mode: 'unsupported', reason };
}

showLoading('Opening the plateau…', 'runtime');
const decision = browserEntryCapability(window);
window.__projectPlateauEntry = { ready: true, ...decision };

if (decision.mode === 'unsupported') {
  showRuntimeUnavailable(decision.reason);
} else {
  import('./main.js').catch((error) => {
    console.error('Project Plateau interactive runtime failed to start.', error);
    showRuntimeUnavailable('runtime-unavailable');
  });
}
