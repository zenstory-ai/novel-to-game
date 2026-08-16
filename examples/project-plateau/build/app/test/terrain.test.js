import assert from 'node:assert/strict';
import test from 'node:test';
import { VEGETATION_LAYOUT } from '../src/environment-layout.js';
import {
  basaltEscarpmentHeight,
  brookFluvialProcessAt,
  terrainEcologyAt,
  terrainGradient,
  terrainHeight,
  terrainProcessRelief,
  terrainSlope,
  terrainVariation,
  terrainWetness,
} from '../src/terrain.js';

test('terrain field is deterministic, finite and visibly multi-scale', () => {
  const samples = [];
  for (let z = -90; z <= 90; z += 10) {
    for (let x = -80; x <= 80; x += 10) {
      const first = terrainHeight(x, z);
      const second = terrainHeight(x, z);
      assert.equal(first, second);
      assert.ok(Number.isFinite(first));
      assert.ok(Number.isFinite(terrainVariation(x, z)));
      samples.push(first);
    }
  }

  const relief = Math.max(...samples) - Math.min(...samples);
  assert.ok(relief >= 2.8, `terrain relief is still too flat: ${relief}`);
  assert.ok(relief <= 7.5, `terrain relief exceeds the traversal budget: ${relief}`);

  const oneMetreChanges = [
    Math.abs(terrainHeight(23, 18) - terrainHeight(24, 18)),
    Math.abs(terrainHeight(-31, -52) - terrainHeight(-31, -51)),
    Math.abs(terrainHeight(42, 63) - terrainHeight(43, 63)),
  ];
  assert.ok(oneMetreChanges.some((change) => change >= 0.015), oneMetreChanges);
});

test('terrain derivatives stay gentle on the playable route while preserving rolling relief', () => {
  const route = [
    [0, 70], [0, 45], [0, 18], [-10, 18], [-17, 8], [0, -10], [0, -30], [12, -40],
  ];
  for (const [x, z] of route) {
    const gradient = terrainGradient(x, z);
    assert.ok(Math.hypot(gradient.x, gradient.z) <= 0.2, { x, z, gradient });
    assert.ok(terrainSlope(x, z) <= 0.2, { x, z, slope: terrainSlope(x, z) });
  }

  assert.ok(terrainWetness(-11, 34) > terrainWetness(48, 34));
  assert.ok(terrainVariation(-37, -48) !== terrainVariation(37, 48));
});

test('named geomorphic relief couples brook incision, bend-side deposition and glade terrace', () => {
  const channel = terrainProcessRelief(-11, 40);
  const depositionalBank = terrainProcessRelief(-5, 40);
  const erodingBank = terrainProcessRelief(-17, 40);
  const innerProcess = brookFluvialProcessAt(-5, 40);
  const outerProcess = brookFluvialProcessAt(-17, 40);
  assert.ok(depositionalBank - channel > 0.35, { channel, depositionalBank });
  assert.ok(depositionalBank - erodingBank > 0.3, { depositionalBank, erodingBank });
  assert.ok(innerProcess.pointBar > 0.25, innerProcess);
  assert.equal(innerProcess.cutBank, 0);
  assert.ok(outerProcess.cutBank > 0.4, outerProcess);
  assert.equal(outerProcess.pointBar, 0);
  assert.ok(terrainProcessRelief(35, -33) - terrainProcessRelief(1.5, -33) > 0.2);
  assert.ok(terrainEcologyAt(-5, 40).alluvium > 0.18);
  assert.ok(terrainEcologyAt(25, -30).alluvium < 0.0001);
});


test('ecological ground transitions follow physical sources instead of a random mask', () => {
  const underCanopy = terrainEcologyAt(-25, 53);
  const brookBank = terrainEcologyAt(-11, 40);
  const compactedRoute = terrainEcologyAt(8, 31);
  const exposedEscarpment = terrainEcologyAt(29.3, -26);
  const openGlade = terrainEcologyAt(0, -30);
  const mainCanopy = terrainEcologyAt(
    VEGETATION_LAYOUT.trees[0].x,
    VEGETATION_LAYOUT.trees[0].z,
  );

  assert.ok(underCanopy.humus > 0.45, underCanopy);
  assert.ok(underCanopy.canopySource > 0.8, underCanopy);
  assert.ok(brookBank.wetBank > 0.95, brookBank);
  assert.ok(compactedRoute.routeWear > 0.98, compactedRoute);
  assert.ok(compactedRoute.humus < 0.05, compactedRoute);
  assert.ok(exposedEscarpment.mineralExposure > 0.7, exposedEscarpment);
  assert.ok(openGlade.humus < 0.05, openGlade);
  assert.ok(mainCanopy.canopySource >= 0.78, mainCanopy);
  assert.ok(mainCanopy.humus > 0.55, mainCanopy);
  assert.ok(mainCanopy.bryophyte > 0.3, mainCanopy);
  assert.equal(openGlade.bryophyte, 0);
  assert.equal(compactedRoute.bryophyte, 0);
  assert.ok(openGlade.alluvium > 0.15, openGlade);
});

test('the basalt sources rise from one continuous shoulder outside navigation', () => {
  for (const z of [-50, -38, -26, -14, -3]) {
    assert.equal(basaltEscarpmentHeight(29, z), 0);
    assert.ok(basaltEscarpmentHeight(34, z) >= 2.5, { z });
    assert.ok(basaltEscarpmentHeight(42, z) >= 2.5, { z });
  }
  assert.equal(basaltEscarpmentHeight(0, -30), 0);
  assert.equal(basaltEscarpmentHeight(12, -40), 0);
  assert.ok(terrainHeight(34, -26) - terrainHeight(29, -26) >= 2.6);
  const boundaryGradient = terrainGradient(28.4, -26, 0.05);
  assert.ok(Math.abs(boundaryGradient.x) < 0.08, boundaryGradient);
  assert.equal(basaltEscarpmentHeight(28.4, -26), 0);
});
