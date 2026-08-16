export function createViewmodelController({ fieldCamera, rifle }) {
  const FIELD_CAMERA_VIEWMODEL = Object.freeze({
    position: Object.freeze([0.59, -0.91, -1.52]),
    rotation: Object.freeze([-0.14, 0.16, -0.065]),
    scale: 0.39,
  });
  const RIFLE_VIEWMODEL = Object.freeze({
    position: Object.freeze([0.72, -0.91, -1.14]),
    rotation: Object.freeze([-0.025, 0.15, -0.09]),
    scale: 0.205,
  });
  fieldCamera.position.fromArray(FIELD_CAMERA_VIEWMODEL.position);
  fieldCamera.rotation.set(...FIELD_CAMERA_VIEWMODEL.rotation);
  fieldCamera.scale.setScalar(FIELD_CAMERA_VIEWMODEL.scale);
  rifle.position.fromArray(RIFLE_VIEWMODEL.position);
  rifle.rotation.set(...RIFLE_VIEWMODEL.rotation);
  rifle.scale.setScalar(RIFLE_VIEWMODEL.scale);
  let observedShotCount = 0;
  let recoilStartedAt = -Infinity;

  function update(now, player, reducedMotion) {
    if ((player.shotCount ?? 0) > observedShotCount) {
      observedShotCount = player.shotCount;
      recoilStartedAt = now;
    }
    const speed = Math.hypot(player.velocity?.x ?? 0, player.velocity?.z ?? 0);
    const moving = speed > 0.08 && !player.paused;
    const motion = moving && !reducedMotion ? Math.min(1, speed / 5.2) : 0;
    const phase = player.distanceTravelled * 3.2;
    const horizontal = Math.cos(phase * 0.5) * 0.012 * motion;
    const vertical = Math.sin(phase) * 0.014 * motion;
    const recoilAge = Math.max(0, now - recoilStartedAt);
    const recoil = recoilAge < 150
      ? Math.sin((recoilAge / 150) * Math.PI) * (1 - recoilAge / 150)
      : 0;

    fieldCamera.position.set(
      FIELD_CAMERA_VIEWMODEL.position[0] + horizontal,
      FIELD_CAMERA_VIEWMODEL.position[1] + vertical,
      FIELD_CAMERA_VIEWMODEL.position[2],
    );
    fieldCamera.rotation.set(
      FIELD_CAMERA_VIEWMODEL.rotation[0] + vertical * 0.35,
      FIELD_CAMERA_VIEWMODEL.rotation[1] - horizontal * 0.55,
      FIELD_CAMERA_VIEWMODEL.rotation[2] + horizontal * 0.8,
    );
    rifle.position.set(
      RIFLE_VIEWMODEL.position[0] + horizontal * 0.65,
      RIFLE_VIEWMODEL.position[1] + vertical * 0.75 - recoil * 0.015,
      RIFLE_VIEWMODEL.position[2] + recoil * 0.08,
    );
    rifle.rotation.set(
      RIFLE_VIEWMODEL.rotation[0] + vertical * 0.24 + recoil * 0.045,
      RIFLE_VIEWMODEL.rotation[1] - horizontal * 0.4,
      RIFLE_VIEWMODEL.rotation[2] + horizontal * 0.62,
    );
  }

  return { update };
}
