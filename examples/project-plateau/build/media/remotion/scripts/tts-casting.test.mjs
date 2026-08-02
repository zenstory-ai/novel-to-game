import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hydrateScenarioCandidates,
  resolveScenarioReference,
  scenarioCoverageChecks,
  validateProjectTrialCasting,
} from './tts-casting.mjs';

const profile = (castingId, gender) => ({
  casting_id: castingId,
  role: 'character',
  gender_presentation: gender,
  age_presentation: 'adult',
  delivery: 'clear and restrained',
  must_not_sound_like: 'a generic narrator',
});

test('project trials require explicit speaker casting and distinct voice references', () => {
  const scenarios = [
    {
      id: 'female-character', project: 'game-a', scope: 'project-trial', source: 'generate', speaker: 'A',
      reference_env: 'FISH_REFERENCE_ID_CHARACTER_A', voice_profile: profile('character-a', 'female'),
    },
    {
      id: 'male-character', project: 'game-b', scope: 'project-trial', source: 'generate', speaker: 'B',
      reference_env: 'FISH_REFERENCE_ID_CHARACTER_B', voice_profile: profile('character-b', 'male'),
    },
  ];
  assert.equal(validateProjectTrialCasting(scenarios), true);
  assert.throws(
    () => validateProjectTrialCasting([{...scenarios[1], reference_env: scenarios[0].reference_env}, scenarios[0]]),
    /already assigned to another character/,
  );
});

test('a named character voice never falls back to a generic language voice', () => {
  const scenario = {id: 'character-a', language: 'zh-Hans', reference_env: 'FISH_REFERENCE_ID_CHARACTER_A'};
  assert.throws(
    () => resolveScenarioReference({scenario, environment: {FISH_REFERENCE_ID_ZH: 'generic-zh'}}),
    /do not replace character casting with a generic language voice/,
  );
  assert.deepEqual(
    resolveScenarioReference({scenario, environment: {FISH_REFERENCE_ID_CHARACTER_A: 'specific-a'}}),
    {referenceId: 'specific-a', referenceEnv: 'FISH_REFERENCE_ID_CHARACTER_A'},
  );
});

test('QA matrix scenarios may retain language-level fallback voices', () => {
  assert.deepEqual(
    resolveScenarioReference({
      scenario: {id: 'matrix-zh', language: 'zh-Hans'},
      environment: {FISH_REFERENCE_ID: 'generic', FISH_REFERENCE_ID_ZH: 'generic-zh'},
    }),
    {referenceId: 'generic-zh', referenceEnv: 'FISH_REFERENCE_ID_ZH'},
  );
});

test('audition ownership is hydrated from the project document, not provider config', async () => {
  const [scenario] = await hydrateScenarioCandidates(
    [{id: 'character-a', project: 'game-a', scope: 'project-trial', source: 'generate', candidate_ref: 'game-a/voice.json'}],
    {
      repositoryRoot: '/repo',
      readText: async () =>
        JSON.stringify({
          schemaVersion: 1,
          status: 'AUDITION_APPROVED_NOT_RUNTIME_ADOPTED',
          runtimeVoiceStrategy: 'none',
          candidate: {
            id: 'character-a',
            project: 'game-a',
            language: 'zh-Hans',
            speaker: 'A',
            voice_profile: profile('character-a', 'female'),
            text: '一句试听。',
            source_ref: 'game-a/text.js#line',
            reason: 'audition',
          },
        }),
    },
  );
  assert.equal(scenario.speaker, 'A');
  assert.equal(scenario.candidateStatus, 'AUDITION_APPROVED_NOT_RUNTIME_ADOPTED');
  await assert.rejects(
    hydrateScenarioCandidates(
      [{
        id: 'character-a', project: 'game-a', scope: 'project-trial', source: 'generate',
        candidate_ref: 'game-a/voice.json', speaker: 'provider-owned',
      }],
      {repositoryRoot: '/repo', readText: async () => '{}'},
    ),
    /must be owned by/,
  );
});

test('scenario coverage rejects missing, duplicate and extra manifest results', () => {
  const scenarios = [
    {id: 'a', scope: 'project-trial'},
    {id: 'b', scope: 'project-trial'},
  ];
  const complete = scenarioCoverageChecks({
    scope: 'project-trial',
    scenarios,
    manifest: {scope: 'project-trial', expectedScenarioIds: ['a', 'b'], results: [{id: 'a'}, {id: 'b'}]},
  });
  assert.ok(complete.every((check) => check.passed));
  const missing = scenarioCoverageChecks({
    scope: 'project-trial',
    scenarios,
    manifest: {scope: 'project-trial', expectedScenarioIds: ['a', 'b'], results: [{id: 'a'}]},
  });
  assert.equal(missing.find((check) => check.id === 'complete_scenario_coverage').passed, false);
  const duplicate = scenarioCoverageChecks({
    scope: 'project-trial',
    scenarios,
    manifest: {scope: 'project-trial', expectedScenarioIds: ['a', 'b'], results: [{id: 'a'}, {id: 'a'}]},
  });
  assert.equal(duplicate.find((check) => check.id === 'unique_scenario_ids').passed, false);
  const extra = scenarioCoverageChecks({
    scope: 'project-trial',
    scenarios,
    manifest: {scope: 'project-trial', expectedScenarioIds: ['a', 'b'], results: [{id: 'a'}, {id: 'b'}, {id: 'c'}]},
  });
  assert.equal(extra.find((check) => check.id === 'complete_scenario_coverage').passed, false);
});

test('an audition document cannot overwrite provider-owned scenario fields', async () => {
  const auditionWith = (extra) => async () =>
    JSON.stringify({
      schemaVersion: 1,
      status: 'AUDITION_APPROVED_NOT_RUNTIME_ADOPTED',
      runtimeVoiceStrategy: 'none',
      candidate: {
        id: 'character-a',
        project: 'game-a',
        language: 'zh-Hans',
        speaker: 'A',
        voice_profile: profile('character-a', 'female'),
        text: '一句试听。',
        ...extra,
      },
    });
  const scenario = {
    id: 'character-a', project: 'game-a', scope: 'project-trial', source: 'generate',
    reference_env: 'FISH_REFERENCE_ID_CHARACTER_A', candidate_ref: 'game-a/voice.json',
  };
  // Silently rescoping out of the trial set, or recasting onto the generic language voice, would
  // otherwise pass every downstream check — they all compare the override against itself.
  for (const override of [{scope: 'qa-matrix'}, {reference_env: 'FISH_REFERENCE_ID_ZH'}, {maximum_seconds: 999}]) {
    await assert.rejects(
      hydrateScenarioCandidates([scenario], {repositoryRoot: '/repo', readText: auditionWith(override)}),
      /is owned by provider config/,
    );
  }
  const [hydrated] = await hydrateScenarioCandidates([scenario], {
    repositoryRoot: '/repo',
    readText: auditionWith({}),
  });
  assert.equal(hydrated.scope, 'project-trial');
  assert.equal(hydrated.reference_env, 'FISH_REFERENCE_ID_CHARACTER_A');
});

test('a candidate_ref cannot read outside the repository', async () => {
  await assert.rejects(
    hydrateScenarioCandidates(
      [{id: 'character-a', project: 'game-a', scope: 'project-trial', source: 'generate', candidate_ref: '../secrets.json'}],
      {repositoryRoot: '/repo', readText: async () => '{}'},
    ),
    /leaves the repository/,
  );
});

test('an audition document that implies runtime adoption is rejected', async () => {
  const document = (patch) => async () =>
    JSON.stringify({
      schemaVersion: 1,
      status: 'AUDITION_APPROVED_NOT_RUNTIME_ADOPTED',
      runtimeVoiceStrategy: 'none',
      candidate: {id: 'character-a', project: 'game-a', speaker: 'A'},
      ...patch,
    });
  const scenario = {
    id: 'character-a', project: 'game-a', scope: 'project-trial', source: 'generate',
    candidate_ref: 'game-a/voice.json',
  };
  for (const patch of [{schemaVersion: 2}, {status: 'APPROVED'}, {runtimeVoiceStrategy: 'key-lines'}]) {
    await assert.rejects(
      hydrateScenarioCandidates([scenario], {repositoryRoot: '/repo', readText: document(patch)}),
      /incomplete or implies runtime adoption/,
    );
  }
  await assert.rejects(
    hydrateScenarioCandidates([scenario], {
      repositoryRoot: '/repo',
      readText: document({candidate: {id: 'someone-else', project: 'game-a'}}),
    }),
    /identity does not match/,
  );
});
