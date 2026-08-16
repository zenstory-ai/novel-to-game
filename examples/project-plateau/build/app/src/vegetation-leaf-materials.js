import * as THREE from 'three';

export const CANOPY_WIND_PROFILE = Object.freeze({
  direction: Object.freeze([0.82, 0, 0.57]),
  horizontalTipDisplacementMeters: 0.085,
  verticalTipDisplacementMeters: 0.018,
  macroFrequencyHz: 0.82,
  flutterFrequencyHz: 2.3,
  anchorUvY: Object.freeze([0.04, 0.92]),
  supportModel: 'branch-attached-uv-base-with-flexible-leaf-tip',
  shadowModel: 'shared-displacement-uniforms-for-colour-and-depth-pass',
});

function injectLeafWindVertex(shader, uniforms) {
  shader.uniforms.leafWindTime = uniforms.time;
  shader.uniforms.leafWindStrength = uniforms.strength;
  shader.uniforms.leafWindVerticalStrength = uniforms.verticalStrength;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `
      #include <common>
      uniform float leafWindTime;
      uniform float leafWindStrength;
      uniform float leafWindVerticalStrength;
    `)
    .replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float leafWindAnchor = 0.0;
      #ifdef USE_UV
        leafWindAnchor = smoothstep(
          ${CANOPY_WIND_PROFILE.anchorUvY[0].toFixed(2)},
          ${CANOPY_WIND_PROFILE.anchorUvY[1].toFixed(2)},
          uv.y
        );
      #endif
      vec4 leafWindWorldPoint = modelMatrix * vec4(transformed, 1.0);
      mat3 leafWindBasis = mat3(modelMatrix);
      #ifdef USE_INSTANCING
        leafWindWorldPoint = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        leafWindBasis = mat3(modelMatrix) * mat3(instanceMatrix);
      #endif
      vec3 leafWindWorldDirection = normalize(vec3(
        ${CANOPY_WIND_PROFILE.direction.map((value) => value.toFixed(2)).join(', ')}
      ));
      vec3 leafWindLocalDirection = normalize(vec3(
        dot(leafWindBasis[0], leafWindWorldDirection),
        dot(leafWindBasis[1], leafWindWorldDirection),
        dot(leafWindBasis[2], leafWindWorldDirection)
      ));
      float leafWindMacro = sin(
        leafWindTime * ${CANOPY_WIND_PROFILE.macroFrequencyHz.toFixed(2)}
        + dot(leafWindWorldPoint.xz, vec2(0.071, 0.053))
      );
      float leafWindFlutter = sin(
        leafWindTime * ${CANOPY_WIND_PROFILE.flutterFrequencyHz.toFixed(2)}
        + dot(leafWindWorldPoint.xz, vec2(-0.117, 0.089))
      );
      float leafWindResponse = leafWindAnchor * (leafWindMacro * 0.72 + leafWindFlutter * 0.28);
      transformed += leafWindLocalDirection * leafWindResponse * leafWindStrength;
      transformed.y += leafWindAnchor * leafWindFlutter * leafWindVerticalStrength;
    `);
}

function applyThinLeafTransmission(material, family, wind = false) {
  const windUniforms = wind ? Object.freeze({
    time: { value: 0 },
    strength: { value: CANOPY_WIND_PROFILE.horizontalTipDisplacementMeters },
    verticalStrength: { value: CANOPY_WIND_PROFILE.verticalTipDisplacementMeters },
  }) : null;
  material.onBeforeCompile = (shader) => {
    if (windUniforms) injectLeafWindVertex(shader, windUniforms);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_begin>',
      `#include <lights_fragment_begin>
#if NUM_DIR_LIGHTS > 0
  // geometryNormal already follows the rendered face for DoubleSide
  // materials. Multiplying by faceDirection again would invert the back-face
  // normal twice and suppress the physically correct opposite-side lobe.
  vec3 leafSurfaceNormal = normalize( geometryNormal );
  vec3 leafSunDirection = normalize( directionalLights[ 0 ].direction );
  float leafLightSide = dot( leafSurfaceNormal, leafSunDirection );
  float leafViewSide = dot( leafSurfaceNormal, geometryViewDir );
  float leafOppositeSides = saturate( - leafLightSide * leafViewSide );
  float leafIncidence = max( abs( leafLightSide ), 0.22 );
  vec3 leafAbsorption = vec3( 1.65, 0.62, 2.15 );
  vec3 leafTransmittance = exp( - leafAbsorption * 0.55 / leafIncidence );
  float leafShadowVisibility = 1.0;
  #if defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 )
    DirectionalLightShadow leafTransmissionShadow = directionalLightShadows[ 0 ];
    leafShadowVisibility = receiveShadow ? getShadow(
      directionalShadowMap[ 0 ],
      leafTransmissionShadow.shadowMapSize,
      leafTransmissionShadow.shadowIntensity,
      leafTransmissionShadow.shadowBias,
      leafTransmissionShadow.shadowRadius,
      vDirectionalShadowCoord[ 0 ]
    ) : 1.0;
  #endif
  reflectedLight.directDiffuse += directionalLights[ 0 ].color
    * material.diffuseContribution
    * leafTransmittance
    * pow( leafOppositeSides, 0.42 )
    * leafShadowVisibility
    * RECIPROCAL_PI
    * 0.62;
#endif`,
    );
  };
  material.customProgramCacheKey = () => (
    `thin-leaf-beer-lambert-v3-${family}-${wind ? 'anchored-wind' : 'static'}`
  );
  material.userData.energyModel = 'shadow-aware-beer-lambert-thin-leaf-transmission';
  if (windUniforms) {
    material.userData.windUniforms = windUniforms;
  }
  return material;
}

function createLeafWindDepthMaterial(sourceMaterial) {
  const material = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: sourceMaterial.map,
    alphaTest: sourceMaterial.alphaTest,
    side: sourceMaterial.side,
  });
  const uniforms = sourceMaterial.userData.windUniforms;
  material.onBeforeCompile = (shader) => injectLeafWindVertex(shader, uniforms);
  material.customProgramCacheKey = () => (
    `leaf-wind-depth-v1-${sourceMaterial.userData.family}`
  );
  material.userData.windUniforms = uniforms;
  material.userData.shadowModel = CANOPY_WIND_PROFILE.shadowModel;
  return material;
}

export { applyThinLeafTransmission, createLeafWindDepthMaterial };
