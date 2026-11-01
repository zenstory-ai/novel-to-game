import assert from 'node:assert/strict';

import {
  worldActorBounds,
  worldDepthScale,
  worldSpriteGeometry,
} from '../js/world.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  PASS  ${name}`);
}

console.log('\n== 行走场景：人物脚底、景深与点击几何 ==');

test('景深只读取世界坐标，不随镜头平移改变', () => {
  const a = worldDepthScale(420, 1082);
  const b = worldDepthScale(420, 1082);
  assert.equal(a, b);
});

test('远近缩放温和且有明确上下限', () => {
  assert.equal(worldDepthScale(-100, 1000), 0.9);
  assert.equal(worldDepthScale(1100, 1000), 1.06);
  assert.ok(worldDepthScale(180, 1000) < worldDepthScale(820, 1000));
});

test('任意画布比例和透明留白都以脚底锚点落在地面坐标', () => {
  const geometry = worldSpriteGeometry({
    groundX: 320,
    groundY: 460,
    bodyHeight: 132,
    imageWidth: 900,
    imageHeight: 1200,
    metadata: { anchorX: 0.44, anchorY: 0.91, bodyTop: 0.13 },
    depthScale: 0.96,
  });
  assert.ok(Math.abs(geometry.anchorX - 320) < 1e-9);
  assert.ok(Math.abs(geometry.anchorY - 460) < 1e-9);
  assert.ok(Math.abs(geometry.left + geometry.width * 0.44 - 320) < 1e-9);
  assert.ok(Math.abs(geometry.top + geometry.height * 0.91 - 460) < 1e-9);
  assert.ok(Math.abs(geometry.bodyBottom - 460) < 1e-9);
  assert.ok(Math.abs(geometry.bodyTop - (460 - 132 * 0.96)) < 1e-9);
});

test('点击与头顶信息共用同一缩放后人体边界', () => {
  const geometry = worldSpriteGeometry({
    groundX: 500,
    groundY: 600,
    bodyHeight: 140,
    imageWidth: 1024,
    imageHeight: 1024,
    metadata: { anchorX: 0.5, anchorY: 0.92, bodyTop: 0.1 },
    depthScale: 1.02,
  });
  const bounds = worldActorBounds(geometry);
  assert.equal(bounds.bottom, geometry.bodyBottom + 18);
  assert.equal(bounds.top, geometry.bodyTop - 70);
  assert.ok(bounds.left < geometry.anchorX && bounds.right > geometry.anchorX);
});

console.log(`\n行走表现结果: ${passed} 通过, 0 失败`);
