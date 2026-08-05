import './styles.css';
import { browserEntryCapability } from './entry-mode.js';
import { showLoading } from './loading-screen.js';
import { showPreviewGateway } from './preview-gateway.js';

showLoading('Opening the plateau…', 'runtime');
const decision = browserEntryCapability(window);
window.__projectPlateauEntry = { ready: true, ...decision };

if (decision.mode === 'preview') {
  showPreviewGateway(decision.reason);
} else {
  import('./main.js').catch((error) => {
    console.error('Project Plateau interactive runtime failed to start.', error);
    showPreviewGateway('runtime-unavailable');
  });
}
