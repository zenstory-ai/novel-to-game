function elements() {
  return {
    screen: document.querySelector('#loading-screen'),
    status: document.querySelector('#loading-status'),
  };
}

export function showLoading(statusText, phase = 'runtime') {
  const { screen, status } = elements();
  if (!screen || !status) return;
  status.textContent = statusText;
  screen.dataset.phase = phase;
  screen.hidden = false;
  screen.setAttribute('aria-busy', 'true');
}

export function hideLoading() {
  const { screen } = elements();
  if (!screen) return;
  screen.hidden = true;
  screen.setAttribute('aria-busy', 'false');
}

export function loadingScreenSnapshot() {
  const { screen, status } = elements();
  return {
    visible: Boolean(screen && !screen.hidden),
    phase: screen?.dataset.phase ?? null,
    status: status?.textContent ?? null,
  };
}
