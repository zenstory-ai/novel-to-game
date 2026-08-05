import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyEntryMode, isKnownInAppBrowser } from '../src/entry-mode.js';

const DESKTOP = {
  hasWebGL2: true,
  width: 1440,
  height: 900,
  coarsePointer: false,
  canHover: true,
  userAgent: 'Mozilla/5.0 Chrome/140 Safari/537.36',
};

test('supported desktop environments enter the interactive WebGL2 build', () => {
  assert.deepEqual(classifyEntryMode(DESKTOP), {
    mode: 'interactive',
    reason: 'desktop-webgl2',
  });
});

test('missing WebGL2 always routes to the local preview', () => {
  assert.deepEqual(classifyEntryMode({ ...DESKTOP, hasWebGL2: false }), {
    mode: 'preview',
    reason: 'webgl2-unavailable',
  });
  assert.deepEqual(
    classifyEntryMode({ ...DESKTOP, hasWebGL2: false, forceInteractive: true }),
    { mode: 'preview', reason: 'webgl2-unavailable' },
  );
});

test('touch-only and undersized devices route to the conversion preview', () => {
  assert.equal(
    classifyEntryMode({
      ...DESKTOP,
      width: 390,
      height: 844,
      coarsePointer: true,
      canHover: false,
    }).reason,
    'mobile-controls-unavailable',
  );
  assert.equal(
    classifyEntryMode({ ...DESKTOP, width: 1024, height: 768 }).reason,
    'viewport-below-desktop-floor',
  );
});

test('known social in-app browsers route to preview even at a desktop viewport', () => {
  const userAgent = 'Mozilla/5.0 MicroMessenger/8.0.55';
  assert.equal(isKnownInAppBrowser(userAgent), true);
  assert.deepEqual(classifyEntryMode({ ...DESKTOP, userAgent }), {
    mode: 'preview',
    reason: 'in-app-browser',
  });
});

test('explicit preview is deterministic while interactive override still requires WebGL2', () => {
  assert.equal(classifyEntryMode({ ...DESKTOP, forcePreview: true }).mode, 'preview');
  assert.equal(
    classifyEntryMode({
      ...DESKTOP,
      width: 390,
      height: 844,
      coarsePointer: true,
      canHover: false,
      forceInteractive: true,
    }).mode,
    'interactive',
  );
});
