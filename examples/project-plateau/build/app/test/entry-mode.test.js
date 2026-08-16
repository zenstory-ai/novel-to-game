import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { classifyEntryMode } from '../src/entry-mode.js';

const DESKTOP = {
  hasWebGL2: true,
  width: 1440,
  height: 900,
  coarsePointer: false,
  canHover: true,
};

test('supported desktop environments enter the interactive WebGL2 build', () => {
  assert.deepEqual(classifyEntryMode(DESKTOP), {
    mode: 'interactive',
    reason: 'desktop-webgl2',
  });
});

test('missing WebGL2 reports an unsupported runtime', () => {
  assert.deepEqual(classifyEntryMode({ ...DESKTOP, hasWebGL2: false }), {
    mode: 'unsupported',
    reason: 'webgl2-unavailable',
  });
});

test('touch-only and undersized devices report the desktop runtime boundary', () => {
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

test('the app shell contains no promotional media or cross-demo navigation', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /<video|\/media\/|vibecoco|github\.com/i);
  assert.equal(existsSync(new URL('../src/preview-gateway.js', import.meta.url)), false);
  assert.equal(existsSync(new URL('../public/media', import.meta.url)), false);
});
