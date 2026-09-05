import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ABANDON_HOLD_SECONDS,
  ABANDONED_RECORD_COPY,
  INITIAL_LIGHT_SECONDS,
  RETURN_ROUTE_SECONDS,
  abandonPromptDue,
  applyThreatContact,
  createPlayerState,
  intactEvidence,
  restartPlayer,
  setCameraRaised,
  startExposure,
  stepPlayer,
} from '../src/simulation.js';

function holdAbandon(player, seconds, slice = 0.1) {
  let remaining = seconds;
  let next = player;
  while (remaining > 1e-9) {
    const delta = Math.min(slice, remaining);
    next = stepPlayer(next, { abandon: true }, delta);
    remaining -= delta;
  }
  return next;
}

function gladeStateWithProof() {
  const player = createPlayerState();
  player.reachedGlade = true;
  player.zone = 'iguanodon-glade';
  player.position = { x: 0, z: -8 };
  player.lastStablePosition = { ...player.position };
  player.plates[0] = {
    ...player.plates[0],
    status: 'exposed',
    points: 1,
    label: 'PARTIAL — foliage hides the flank.',
    frameKey: 'brook-partial',
  };
  player.plates[1] = {
    ...player.plates[1],
    status: 'exposed',
    points: 2,
    label: 'CONTEXT — basalt gives scale.',
    frameKey: 'basalt-scale',
  };
  return player;
}

function commitRoute(player, position) {
  const next = { ...player, position, lastStablePosition: { ...position } };
  return stepPlayer(next, {}, 0.1);
}

test('the case release commits only after the full hold threshold', () => {
  assert.equal(ABANDON_HOLD_SECONDS, 0.8);
  let player = createPlayerState();
  player = holdAbandon(player, 0.7);
  assert.equal(player.caseAbandoned, false);
  assert.ok(player.abandonHoldSeconds > 0.69, player.abandonHoldSeconds);

  player = holdAbandon(player, 0.3);
  assert.equal(player.caseAbandoned, true);
  assert.equal(player.abandonHoldSeconds, 0);
  assert.deepEqual(player.caseDropPosition, player.position);
  assert.equal(player.lastEvent, 'case:abandoned');
});

test('the release is available anywhere during an active run, including the Fort', () => {
  const player = holdAbandon(createPlayerState(), 0.9);
  assert.equal(player.caseAbandoned, true);
  assert.equal(player.zone, 'fort');
});

test('releasing the case release early cancels with no cost', () => {
  let player = createPlayerState();
  player = holdAbandon(player, 0.5);
  assert.equal(player.caseAbandoned, false);

  player = stepPlayer(player, {}, 0.1);
  assert.equal(player.abandonHoldSeconds, 0);
  assert.equal(player.caseAbandoned, false);
  assert.equal(player.plates.every((plate) => plate.recoverable), true);
  assert.ok(Math.abs(player.remainingLight - (INITIAL_LIGHT_SECONDS - 0.6)) < 1e-8);

  player = holdAbandon(player, 0.5);
  assert.equal(player.caseAbandoned, false);
  assert.ok(player.abandonHoldSeconds < ABANDON_HOLD_SECONDS, player.abandonHoldSeconds);
});

test('abandoning keeps the plates recorded state and marks them unrecoverable', () => {
  const abandoned = holdAbandon(gladeStateWithProof(), 1);
  assert.equal(abandoned.caseAbandoned, true);
  assert.equal(abandoned.abandonedPlates, 2);
  assert.equal(abandoned.abandonedEvidence, 3);
  assert.equal(abandoned.plates[0].status, 'exposed');
  assert.equal(abandoned.plates[0].points, 1);
  assert.equal(abandoned.plates[0].frameKey, 'brook-partial');
  assert.equal(abandoned.plates[1].status, 'exposed');
  assert.equal(abandoned.plates[1].points, 2);
  assert.equal(abandoned.plates.every((plate) => plate.recoverable === false), true);
  assert.equal(intactEvidence(abandoned), 0);
  assert.equal(
    abandoned.lastObservation,
    'The case is down. Two recorded plates stay in the basin.',
  );
});

test('the field note says when nothing was exposed on the dropped plates', () => {
  const abandoned = holdAbandon(createPlayerState(), 1);
  assert.equal(abandoned.abandonedPlates, 0);
  assert.equal(
    abandoned.lastObservation,
    'The case is down. Nothing was exposed on its plates.',
  );
});

test('abandoning mid-exposure cancels the commitment without spending the plate', () => {
  let player = startExposure(setCameraRaised(createPlayerState(), true));
  assert.ok(player.pendingExposure);
  player = stepPlayer(player, { abandon: true }, 0.9);
  assert.equal(player.caseAbandoned, true);
  assert.equal(player.pendingExposure, null);
  assert.equal(player.plates[0].status, 'unexposed');
  assert.equal(player.cameraRaised, false);
});

test('the camera cannot be raised once the case is left behind', () => {
  const abandoned = holdAbandon(createPlayerState(), 1);
  const attempted = setCameraRaised(abandoned, true);
  assert.equal(attempted.cameraRaised, false);
});

test('any committed return route costs eight seconds once the case is down', () => {
  const covered = commitRoute(holdAbandon(gladeStateWithProof(), 1), { x: 0, z: 18 });
  assert.equal(covered.returnRoute, 'covered');
  assert.equal(covered.returnCostSeconds, RETURN_ROUTE_SECONDS.abandoned);
  assert.ok(
    Math.abs(covered.remainingLight - (INITIAL_LIGHT_SECONDS - 1 - RETURN_ROUTE_SECONDS.abandoned - 0.1)) < 1e-8,
    covered.remainingLight,
  );

  const exposed = commitRoute(holdAbandon(gladeStateWithProof(), 1), { x: 7, z: 18 });
  assert.equal(exposed.returnRoute, 'exposed');
  assert.equal(exposed.returnCostSeconds, RETURN_ROUTE_SECONDS.abandoned);

  const fired = gladeStateWithProof();
  fired.gunshotFired = true;
  const exposedAfterShot = commitRoute(holdAbandon(fired, 1), { x: 7, z: 18 });
  assert.equal(exposedAfterShot.returnCostSeconds, RETURN_ROUTE_SECONDS.abandoned);
});

test('the three existing route costs are unchanged while the case is carried', () => {
  const covered = commitRoute(gladeStateWithProof(), { x: 0, z: 18 });
  assert.equal(covered.returnCostSeconds, RETURN_ROUTE_SECONDS.covered);

  const exposed = commitRoute(gladeStateWithProof(), { x: 7, z: 18 });
  assert.equal(exposed.returnCostSeconds, RETURN_ROUTE_SECONDS.exposed);

  const fired = gladeStateWithProof();
  fired.gunshotFired = true;
  const exposedAfterShot = commitRoute(fired, { x: 7, z: 18 });
  assert.equal(exposedAfterShot.returnCostSeconds, RETURN_ROUTE_SECONDS.exposedAfterShot);
});

test('the creek case-strike cannot fire after the case is abandoned', () => {
  const player = gladeStateWithProof();
  player.threatAwareness = 3;
  player.threatState = 'attack';
  const abandoned = holdAbandon(player, 1);
  const committed = commitRoute(abandoned, { x: 7, z: 18 });
  assert.equal(committed.returnRoute, 'exposed');
  assert.equal(committed.returnStrike, false);
  assert.equal(committed.plates[1].status, 'exposed');
  assert.equal(committed.plates[1].points, 2);
});

test('a dive contact after the drop costs body margin but cannot crack the case', () => {
  const abandoned = holdAbandon(gladeStateWithProof(), 1);
  const contacted = applyThreatContact(abandoned);
  assert.equal(contacted.failed, false);
  assert.equal(contacted.bodyMargin, 0);
  assert.equal(contacted.plates[1].status, 'exposed');
  assert.equal(contacted.plates[1].points, 2);
  assert.equal(contacted.lastEvent, 'contact:body-margin');
});

test('the deliberate trade resolves to the no-record band with its own honest copy', () => {
  let player = commitRoute(holdAbandon(gladeStateWithProof(), 1), { x: 0, z: 18 });
  player = commitRoute(player, { x: 0, z: 70 });
  assert.equal(player.runStatus, 'result');
  assert.equal(player.result.kind, 'alive');
  assert.equal(player.result.band, 'returned-without-record');
  assert.equal(player.result.copy, ABANDONED_RECORD_COPY);
  assert.equal(player.result.evidence, 0);
  assert.equal(player.result.survivingPlates, 0);
  assert.equal(player.result.caseAbandoned, true);
  assert.equal(player.result.abandonedPlates, 2);
});

test('a carried-but-empty return keeps the original no-record copy', () => {
  let player = createPlayerState();
  player.reachedGlade = true;
  player = commitRoute(player, { x: 0, z: 18 });
  player = commitRoute(player, { x: 0, z: 70 });
  assert.equal(player.result.band, 'returned-without-record');
  assert.equal(
    player.result.copy,
    'The fire heard your account. London will ask for the glass.',
  );
  assert.equal(player.result.caseAbandoned, false);
  assert.equal(player.result.abandonedPlates, 0);
});

test('identical abandon inputs produce identical outcomes', () => {
  const runOnce = () => {
    let player = holdAbandon(gladeStateWithProof(), 1);
    player = commitRoute(player, { x: 0, z: 18 });
    return commitRoute(player, { x: 0, z: 70 });
  };
  const first = runOnce();
  const second = runOnce();
  assert.deepEqual(
    {
      plates: first.plates,
      result: first.result,
      remainingLight: first.remainingLight,
      returnCostSeconds: first.returnCostSeconds,
      abandonedPlates: first.abandonedPlates,
      abandonedEvidence: first.abandonedEvidence,
    },
    {
      plates: second.plates,
      result: second.result,
      remainingLight: second.remainingLight,
      returnCostSeconds: second.returnCostSeconds,
      abandonedPlates: second.abandonedPlates,
      abandonedEvidence: second.abandonedEvidence,
    },
  );
});

test('the abandon prompt is due only when the covered route can no longer make it', () => {
  assert.equal(abandonPromptDue(createPlayerState()), false);

  const atGlade = gladeStateWithProof();
  assert.equal(abandonPromptDue(atGlade), false);

  const lowLight = { ...atGlade, remainingLight: RETURN_ROUTE_SECONDS.covered - 0.1 };
  assert.equal(abandonPromptDue(lowLight), true);

  const exactBudget = { ...atGlade, remainingLight: RETURN_ROUTE_SECONDS.covered };
  assert.equal(abandonPromptDue(exactBudget), false);

  const routeCommitted = { ...lowLight, returnRoute: 'covered' };
  assert.equal(abandonPromptDue(routeCommitted), false);

  const abandoned = { ...lowLight, caseAbandoned: true };
  assert.equal(abandonPromptDue(abandoned), false);
});

test('restart clears the drop, the hold and every unrecoverable mark', () => {
  const abandoned = holdAbandon(gladeStateWithProof(), 1);
  const restarted = restartPlayer(abandoned);
  assert.equal(restarted.caseAbandoned, false);
  assert.equal(restarted.caseDropPosition, null);
  assert.equal(restarted.abandonHoldSeconds, 0);
  assert.equal(restarted.abandonedPlates, 0);
  assert.equal(restarted.abandonedEvidence, 0);
  assert.equal(restarted.plates.every((plate) => plate.recoverable), true);
  assert.equal(restarted.remainingLight, INITIAL_LIGHT_SECONDS);
});
