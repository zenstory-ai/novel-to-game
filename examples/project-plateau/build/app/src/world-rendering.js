import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function toNonIndexed(geometry) {
  if (!geometry.index) return geometry;
  const expanded = geometry.toNonIndexed();
  geometry.dispose();
  return expanded;
}

function mergeParts(parts) {
  const expanded = parts.map(toNonIndexed);
  expanded.forEach((part) => {
    for (const attribute of Object.keys(part.attributes)) {
      if (attribute !== 'position') part.deleteAttribute(attribute);
    }
  });
  const merged = mergeGeometries(expanded, false);
  expanded.forEach((part) => part.dispose());
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function mergeSmoothParts(parts) {
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function transformGeometry(geometry, position, scale, rotation = [0, 0, 0]) {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

function createVerticalLoft(rings, radialSegments = 7) {
  const vertices = [];
  const indices = [];
  rings.forEach(([y, centreX, centreZ, radiusX, radiusZ, roll = 0]) => {
    for (let side = 0; side < radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2 + roll;
      vertices.push(
        centreX + Math.cos(angle) * radiusX,
        y,
        centreZ + Math.sin(angle) * radiusZ,
      );
    }
  });
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let side = 0; side < radialSegments; side += 1) {
      const next = (side + 1) % radialSegments;
      const a = ring * radialSegments + side;
      const b = ring * radialSegments + next;
      const c = (ring + 1) * radialSegments + side;
      const d = (ring + 1) * radialSegments + next;
      indices.push(a, b, c, b, d, c);
    }
  }
  const bottomCentre = vertices.length / 3;
  vertices.push(rings[0][1], rings[0][0], rings[0][2]);
  const topCentre = vertices.length / 3;
  const top = rings.at(-1);
  vertices.push(top[1], top[0], top[2]);
  const topOffset = (rings.length - 1) * radialSegments;
  for (let side = 0; side < radialSegments; side += 1) {
    const next = (side + 1) % radialSegments;
    indices.push(bottomCentre, side, next);
    indices.push(topCentre, topOffset + next, topOffset + side);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  return geometry;
}

function createCylinderBetween(start, end, startRadius, endRadius, radialSegments = 6) {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = to.clone().sub(from);
  const geometry = new THREE.CylinderGeometry(
    endRadius,
    startRadius,
    direction.length(),
    radialSegments,
    1,
    false,
  );
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  );
  geometry.applyMatrix4(new THREE.Matrix4().compose(
    from.clone().addScaledVector(direction, 0.5),
    quaternion,
    new THREE.Vector3(1, 1, 1),
  ));
  return geometry;
}

function primitive(material, geometry, position, scale, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export {
  createCylinderBetween,
  createVerticalLoft,
  mergeParts,
  mergeSmoothParts,
  primitive,
  transformGeometry,
};
