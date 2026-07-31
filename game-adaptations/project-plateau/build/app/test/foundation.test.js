import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import test from 'node:test';
import { PRODUCT_BUDGET, SCENE_BUDGET, percentile, seededRandom } from '../src/config.js';

const root = new URL('../', import.meta.url);

test('foundation exposes the locked viewport and performance budgets', () => {
  assert.deepEqual(PRODUCT_BUDGET.targetViewport, [1440, 900]);
  assert.deepEqual(PRODUCT_BUDGET.minimumViewport, [1280, 720]);
  assert.equal(PRODUCT_BUDGET.medianFps, 45);
  assert.equal(PRODUCT_BUDGET.onePercentLowFps, 30);
  assert.equal(PRODUCT_BUDGET.ttiMs, 8000);
});

test('procedural placement is deterministic for a recorded seed', () => {
  const first = seededRandom(139);
  const second = seededRandom(139);
  assert.deepEqual(
    Array.from({ length: 12 }, first),
    Array.from({ length: 12 }, second),
  );
});

test('representative scene contains all declared subject and pressure groups', () => {
  assert.equal(SCENE_BUDGET.adultIguanodons, 2);
  assert.equal(SCENE_BUDGET.youngIguanodons, 3);
  assert.ok(SCENE_BUDGET.pterodactyls >= 1);
  assert.ok(SCENE_BUDGET.trees + SCENE_BUDGET.ferns >= 400);
});

test('frame percentile is stable and keeps the slow tail visible', () => {
  const frames = [16, 17, 15, 18, 40, 14, 16, 17, 19, 16];
  assert.equal(percentile(frames, 0.5), 17);
  assert.equal(percentile(frames, 0.99), 40);
  assert.equal(percentile([], 0.5), 0);
});

test('runtime sources contain no remote asset or CDN request', () => {
  const files = ['index.html', ...globSync('src/*.{js,css}', { cwd: root })];
  for (const relative of files) {
    const source = readFileSync(new URL(relative, root), 'utf8');
    assert.doesNotMatch(source, /https?:\/\//i, relative);
    assert.doesNotMatch(source, /(?:src|href)\s*=\s*['"]\/\//i, relative);
    assert.doesNotMatch(source, /url\(\s*['"]?https?:/i, relative);
  }
});
