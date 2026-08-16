import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { CONTACT_OCCLUSION_PROFILE } from './render-budget.js';

export function createFieldPostprocessing({
  renderer,
  scene,
  camera,
  excludedRoots,
  width,
  height,
  pixelRatio,
}) {
  const gtaoExcluded = [...excludedRoots];
  scene.traverse((object) => {
    if (!object.isMesh && !object.isSprite) return;
    if (gtaoExcluded.some((root) => root === object || root.getObjectById?.(object.id))) return;
    if (object.userData.gtaoExcluded) {
      gtaoExcluded.push(object);
      return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.some((material) => material?.transparent || material?.opacity < 1)) {
      gtaoExcluded.push(object);
    }
  });
  gtaoExcluded.forEach((object) => { object.userData.gtaoExcluded = true; });
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  const gtaoPass = new GTAOPass(
    scene,
    camera,
    width,
    height,
    undefined,
    {
      radius: CONTACT_OCCLUSION_PROFILE.radiusMeters,
      distanceExponent: CONTACT_OCCLUSION_PROFILE.distanceExponent,
      thickness: CONTACT_OCCLUSION_PROFILE.thicknessMeters,
      distanceFallOff: CONTACT_OCCLUSION_PROFILE.distanceFallOff,
      scale: CONTACT_OCCLUSION_PROFILE.scale,
      samples: CONTACT_OCCLUSION_PROFILE.samples,
      screenSpaceRadius: false,
    },
    CONTACT_OCCLUSION_PROFILE.denoise,
  );
  const renderGtao = gtaoPass.render.bind(gtaoPass);
  gtaoPass.render = (...args) => {
    const visibility = gtaoExcluded.map((object) => object.visible);
    gtaoExcluded.forEach((object) => { object.visible = false; });
    try {
      return renderGtao(...args);
    } finally {
      gtaoExcluded.forEach((object, index) => { object.visible = visibility[index]; });
    }
  };
  gtaoPass.blendIntensity = CONTACT_OCCLUSION_PROFILE.blendIntensity;
  gtaoPass.userData = {
    radiusMeters: CONTACT_OCCLUSION_PROFILE.radiusMeters,
    role: CONTACT_OCCLUSION_PROFILE.role,
  };
  composer.addPass(gtaoPass);
  const fieldGradePass = new ShaderPass({
    name: 'ProjectPlateauFieldGrade',
    uniforms: {
      tDiffuse: { value: null },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D tDiffuse;

      float fieldHash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      void main() {
        vec4 source = texture2D(tDiffuse, vUv);
        float luma = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 color = mix(vec3(luma), source.rgb, 1.035);
        float shadowWeight = 1.0 - smoothstep(0.12, 0.52, luma);
        float highlightWeight = smoothstep(0.46, 0.9, luma);
        color = mix(color, color * vec3(0.94, 1.0, 1.045), shadowWeight * 0.045);
        color = mix(color, color * vec3(1.035, 1.0, 0.955), highlightWeight * 0.03);
        vec2 centred = (vUv - 0.5) * vec2(1.0, 0.82);
        float vignette = smoothstep(0.34, 0.76, dot(centred, centred));
        color *= 1.0 - vignette * 0.055;
        float grain = fieldHash(gl_FragCoord.xy) - 0.5;
        color += grain * 0.002;
        gl_FragColor = vec4(max(color, 0.0), source.a);
      }
    `,
  });
  fieldGradePass.material.name = 'Project Plateau restrained field grade';
  composer.addPass(fieldGradePass);
  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.material.name = 'Project Plateau single-pass FXAA';
  composer.addPass(fxaaPass);
  const smaaPass = new SMAAPass(width, height);
  smaaPass.name = 'Project Plateau balanced/high SMAA';
  composer.addPass(smaaPass);
  composer.addPass(new OutputPass());
  return { composer, gtaoPass, fxaaPass, smaaPass };
}
