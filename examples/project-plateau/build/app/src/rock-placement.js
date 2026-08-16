import * as THREE from 'three';

import { terrainGradient, terrainHeight } from './terrain.js';

const rockSupportPoint = new THREE.Vector3();
const rockTerrainNormal = new THREE.Vector3();
const rockTerrainAlignment = new THREE.Quaternion();
const rockTerrainYaw = new THREE.Quaternion();
const rockUp = new THREE.Vector3(0, 1, 0);

function settleRockOnTerrain(target, geometry, placement) {
  const gradient = terrainGradient(placement.x, placement.z, 0.35);
  rockTerrainNormal.set(-gradient.x, 1, -gradient.z).normalize();
  rockTerrainAlignment.setFromUnitVectors(rockUp, rockTerrainNormal);
  rockTerrainYaw.setFromAxisAngle(rockTerrainNormal, placement.yaw ?? 0);
  target.position.set(placement.x, 0, placement.z);
  target.quaternion.multiplyQuaternions(rockTerrainYaw, rockTerrainAlignment);
  target.scale.fromArray(placement.scale);
  target.updateMatrix();

  const positions = geometry.getAttribute('position');
  const supportLimit = geometry.boundingBox.min.y + 0.0001;
  const requiredOffsets = [];
  for (let index = 0; index < positions.count; index += 1) {
    if (positions.getY(index) > supportLimit) continue;
    rockSupportPoint.fromBufferAttribute(positions, index).applyMatrix4(target.matrix);
    requiredOffsets.push(
      terrainHeight(rockSupportPoint.x, rockSupportPoint.z) - rockSupportPoint.y,
    );
  }
  const burial = placement.burial ?? 0.04;
  target.position.y = Math.max(...requiredOffsets) - burial;
  target.updateMatrix();

  const supportClearances = [];
  for (let index = 0; index < positions.count; index += 1) {
    if (positions.getY(index) > supportLimit) continue;
    rockSupportPoint.fromBufferAttribute(positions, index).applyMatrix4(target.matrix);
    supportClearances.push(
      rockSupportPoint.y - terrainHeight(rockSupportPoint.x, rockSupportPoint.z),
    );
  }
  return Object.freeze({
    id: placement.id,
    x: placement.x,
    z: placement.z,
    yaw: placement.yaw,
    burial,
    slope: Math.hypot(gradient.x, gradient.z),
    minimumSupportClearance: Math.min(...supportClearances),
    maximumSupportClearance: Math.max(...supportClearances),
    contactVertexCount: supportClearances.filter((clearance) => clearance <= 0.025).length,
    supportVertexCount: supportClearances.length,
    solid: placement.solid,
  });
}

function renderedRockObstacleCandidate(id, sourceClass, geometry, matrix) {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const worldBounds = geometry.boundingBox.clone().applyMatrix4(matrix);
  const center = worldBounds.getCenter(new THREE.Vector3());
  const size = worldBounds.getSize(new THREE.Vector3());
  return Object.freeze({
    id,
    sourceClass,
    x: center.x,
    z: center.z,
    radiusMeters: Math.max(size.x, size.z) * 0.5,
    topElevation: worldBounds.max.y,
    bottomElevation: worldBounds.min.y,
    bedElevation: terrainHeight(center.x, center.z),
  });
}

export { renderedRockObstacleCandidate, settleRockOnTerrain };
