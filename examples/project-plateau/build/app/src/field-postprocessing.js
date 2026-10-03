import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { CONTACT_OCCLUSION_PROFILE } from './render-budget.js';

export function createFieldPostprocessing({
  renderer,
  scene,
  camera,
  width,
  height,
  pixelRatio,
}) {
  // One depth texture is shared by both composer buffers, so whichever buffer
  // the scene pass lands in, GTAO reads the main pass's depth and rebuilds
  // normals from it instead of drawing the whole scene a second time.
  const sceneDepth = new THREE.DepthTexture(width * pixelRatio, height * pixelRatio);
  const target = new THREE.WebGLRenderTarget(width * pixelRatio, height * pixelRatio, {
    type: THREE.HalfFloatType,
    depthTexture: sceneDepth,
  });
  const composer = new EffectComposer(renderer, target);
  composer.renderTarget2.depthTexture = sceneDepth;
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
  // Swap in the shared depth after construction: passing it to the
  // constructor trips a three r185 GTAOPass bug in its debug depth material.
  gtaoPass.setGBuffer(sceneDepth);
  gtaoPass.blendIntensity = CONTACT_OCCLUSION_PROFILE.blendIntensity;
  gtaoPass.userData = {
    radiusMeters: CONTACT_OCCLUSION_PROFILE.radiusMeters,
    role: CONTACT_OCCLUSION_PROFILE.role,
  };
  composer.addPass(gtaoPass);
  // Bloom works on the linear HDR buffer before tone mapping, so only the sun,
  // its glow and wet speculars spill; lit foliage stays crisp.
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(Math.round(width / 2), Math.round(height / 2)),
    0.16,
    0.5,
    1.4,
  );
  composer.addPass(bloomPass);
  const fieldGradePass = new ShaderPass({
    name: 'ProjectPlateauFieldGrade',
    uniforms: {
      tDiffuse: { value: null },
      threat: { value: 0 },
      time: { value: 0 },
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
      uniform float threat;
      uniform float time;

      float fieldHash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      void main() {
        vec4 source = texture2D(tDiffuse, vUv);
        vec3 color = max(source.rgb, vec3(0.0));
        // Linear-light grade ahead of AgX: richer mid saturation, teal in the
        // shade, amber in the sun. AgX then rolls highlights off filmically.
        // Log-space contrast around mid grey restores the punch AgX trades away.
        color = pow(color / 0.18 + 1e-5, vec3(1.14)) * 0.18;
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = mix(vec3(luma), color, 1.22);
        float shade = 1.0 - smoothstep(0.02, 0.35, luma);
        float light = smoothstep(0.35, 1.6, luma);
        color *= mix(vec3(1.0), vec3(0.86, 0.98, 1.1), shade * 0.55);
        color *= mix(vec3(1.0), vec3(1.08, 1.0, 0.86), light * 0.5);
        vec2 centred = (vUv - 0.5) * vec2(1.0, 0.78);
        float vignette = smoothstep(0.18, 0.62, dot(centred, centred) * 1.6);
        color *= 1.0 - vignette * 0.28;
        float threatEdge = smoothstep(0.1, 0.75, dot(centred, centred) * 2.2);
        float heartbeat = 0.75 + 0.25 * pow(abs(sin(time * 2.6)), 6.0);
        color = mix(color, vec3(dot(color, vec3(0.2126, 0.7152, 0.0722))), threat * 0.35);
        color *= 1.0 - threatEdge * threat * 0.55 * heartbeat;
        float grain = fieldHash(gl_FragCoord.xy + fract(luma * 91.0)) - 0.5;
        color *= 1.0 + grain * 0.035;
        gl_FragColor = vec4(max(color, 0.0), source.a);
      }
    `,
  });
  fieldGradePass.material.name = 'Project Plateau field grade';
  composer.addPass(fieldGradePass);
  // Tone map before anti-aliasing so edge filters see display-referred values.
  composer.addPass(new OutputPass());
  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.material.name = 'Project Plateau single-pass FXAA';
  composer.addPass(fxaaPass);
  const smaaPass = new SMAAPass(width, height);
  smaaPass.name = 'Project Plateau balanced/high SMAA';
  composer.addPass(smaaPass);
  return { composer, gradePass: fieldGradePass, gtaoPass, bloomPass, fxaaPass, smaaPass };
}
