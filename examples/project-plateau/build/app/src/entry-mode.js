const IN_APP_BROWSER_PATTERN = /MicroMessenger|Weibo|QQ\/(?:[\d.]+)|QQBrowser|Telegram|FBAN|FBAV|Instagram|Line\/|Twitter/i;

export function isKnownInAppBrowser(userAgent = '') {
  return IN_APP_BROWSER_PATTERN.test(userAgent);
}

export function classifyEntryMode({
  hasWebGL2,
  width,
  height,
  coarsePointer,
  canHover,
  userAgent,
  forcePreview = false,
  forceInteractive = false,
}) {
  if (!hasWebGL2) return { mode: 'preview', reason: 'webgl2-unavailable' };
  if (forcePreview) return { mode: 'preview', reason: 'explicit-preview' };
  if (forceInteractive) return { mode: 'interactive', reason: 'explicit-interactive' };
  if (isKnownInAppBrowser(userAgent)) return { mode: 'preview', reason: 'in-app-browser' };
  if (coarsePointer && !canHover) {
    return { mode: 'preview', reason: 'mobile-controls-unavailable' };
  }
  if (width < 1100 || height < 640) {
    return { mode: 'preview', reason: 'viewport-below-desktop-floor' };
  }
  return { mode: 'interactive', reason: 'desktop-webgl2' };
}

export function browserEntryCapability(windowObject = window) {
  const query = new URLSearchParams(windowObject.location.search);
  const probe = windowObject.document.createElement('canvas');
  const context = probe.getContext('webgl2', {
    antialias: false,
    alpha: false,
    powerPreference: 'default',
  });
  context?.getExtension('WEBGL_lose_context')?.loseContext();
  return classifyEntryMode({
    hasWebGL2: Boolean(context),
    width: windowObject.innerWidth,
    height: windowObject.innerHeight,
    coarsePointer: windowObject.matchMedia('(pointer: coarse)').matches,
    canHover: windowObject.matchMedia('(hover: hover)').matches,
    userAgent: windowObject.navigator.userAgent,
    forcePreview: query.get('entry') === 'preview',
    forceInteractive: query.get('entry') === 'interactive',
  });
}
