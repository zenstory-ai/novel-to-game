export function classifyEntryMode({
  hasWebGL2,
  width,
  height,
  coarsePointer,
  canHover,
}) {
  if (!hasWebGL2) return { mode: 'unsupported', reason: 'webgl2-unavailable' };
  if (coarsePointer && !canHover) {
    return { mode: 'unsupported', reason: 'mobile-controls-unavailable' };
  }
  if (width < 1100 || height < 640) {
    return { mode: 'unsupported', reason: 'viewport-below-desktop-floor' };
  }
  return { mode: 'interactive', reason: 'desktop-webgl2' };
}

export function browserEntryCapability(windowObject = window) {
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
  });
}
