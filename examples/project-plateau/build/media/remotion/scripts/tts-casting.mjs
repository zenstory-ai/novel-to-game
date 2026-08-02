import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const REFERENCE_ENV = /^FISH_REFERENCE_ID_[A-Z0-9_]+$/;

const REQUIRED_PROFILE_FIELDS = [
  'casting_id',
  'role',
  'gender_presentation',
  'age_presentation',
  'delivery',
  'must_not_sound_like',
];
const CANDIDATE_OWNED_FIELDS = ['language', 'speaker', 'voice_profile', 'text', 'source_ref', 'reason'];
// The ownership fence has to hold in both directions. Without this list an audition document could
// overwrite its own scope, casting reference or duration bounds and every downstream check — which
// hydrates the same way — would compare the override against itself and pass.
const PROVIDER_OWNED_FIELDS = [
  'scope',
  'source',
  'reference_env',
  'file',
  'metadata_file',
  'minimum_seconds',
  'maximum_seconds',
  'candidate_ref',
];

export async function hydrateScenarioCandidates(scenarios, {repositoryRoot, readText = readFile} = {}) {
  const root = path.resolve(repositoryRoot);
  return Promise.all(
    scenarios.map(async (scenario) => {
      if (!scenario.candidate_ref) return scenario;
      for (const field of CANDIDATE_OWNED_FIELDS) {
        if (scenario[field] !== undefined) {
          throw new Error(`${scenario.id}: ${field} must be owned by ${scenario.candidate_ref}, not provider config.`);
        }
      }
      const candidatePath = path.resolve(root, scenario.candidate_ref);
      if (!candidatePath.startsWith(`${root}${path.sep}`)) {
        throw new Error(`${scenario.id}: candidate_ref leaves the repository.`);
      }
      const document = JSON.parse(await readText(candidatePath, 'utf8'));
      if (
        document.schemaVersion !== 1 ||
        document.status !== 'AUDITION_APPROVED_NOT_RUNTIME_ADOPTED' ||
        document.runtimeVoiceStrategy !== 'none'
      ) {
        throw new Error(`${scenario.id}: audition ownership document is incomplete or implies runtime adoption.`);
      }
      if (document.candidate?.id !== scenario.id || document.candidate?.project !== scenario.project) {
        throw new Error(`${scenario.id}: audition candidate identity does not match provider config.`);
      }
      for (const field of PROVIDER_OWNED_FIELDS) {
        if (document.candidate[field] !== undefined) {
          throw new Error(`${scenario.id}: ${field} is owned by provider config, not ${scenario.candidate_ref}.`);
        }
      }
      return {...scenario, ...document.candidate, candidateStatus: document.status};
    }),
  );
}

export function scenarioContractSha256(config, hydratedScenarios) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        schemaVersion: config.schemaVersion,
        policy: config.policy,
        defaults: config.defaults,
        scenarios: hydratedScenarios,
      }),
    )
    .digest('hex');
}

export function scenarioCoverageChecks({scope, scenarios, manifest}) {
  const expected = scenarios.filter((scenario) => scenario.scope === scope).map((scenario) => scenario.id).sort();
  const actual = (manifest.results || []).map((item) => item.id);
  const unique = [...new Set(actual)].sort();
  return [
    {
      id: 'manifest_scope',
      passed: manifest.scope === scope,
      evidence: `${manifest.scope || 'missing'} == ${scope}`,
    },
    {
      id: 'unique_scenario_ids',
      passed: unique.length === actual.length,
      evidence: `${unique.length} unique == ${actual.length} result(s)`,
    },
    {
      id: 'complete_scenario_coverage',
      passed: JSON.stringify(unique) === JSON.stringify(expected),
      evidence: `actual ${JSON.stringify(unique)}; expected ${JSON.stringify(expected)}`,
    },
  ];
}

export function validateProjectTrialCasting(scenarios) {
  const trials = scenarios.filter((scenario) => scenario.scope === 'project-trial');
  const castingIds = new Set();
  const generatedReferenceEnvs = new Set();
  const projects = new Set();

  for (const scenario of trials) {
    if (!scenario.speaker?.trim()) throw new Error(`${scenario.id}: speaker is required for a project trial.`);
    const profile = scenario.voice_profile;
    if (!profile || typeof profile !== 'object') throw new Error(`${scenario.id}: voice_profile is required.`);
    for (const field of REQUIRED_PROFILE_FIELDS) {
      if (!String(profile[field] || '').trim()) throw new Error(`${scenario.id}: voice_profile.${field} is required.`);
    }
    if (castingIds.has(profile.casting_id)) {
      throw new Error(`${scenario.id}: casting_id ${profile.casting_id} is already assigned to another trial.`);
    }
    castingIds.add(profile.casting_id);
    if (!scenario.project?.trim()) throw new Error(`${scenario.id}: project is required for a project trial.`);
    if (projects.has(scenario.project)) {
      throw new Error(`${scenario.id}: project ${scenario.project} already has a trial; keep the audition sparse.`);
    }
    projects.add(scenario.project);

    if (scenario.source !== 'generate') continue;
    if (!REFERENCE_ENV.test(scenario.reference_env || '')) {
      throw new Error(`${scenario.id}: a scenario-specific FISH_REFERENCE_ID_* reference_env is required.`);
    }
    if (generatedReferenceEnvs.has(scenario.reference_env)) {
      throw new Error(`${scenario.id}: ${scenario.reference_env} is already assigned to another character.`);
    }
    generatedReferenceEnvs.add(scenario.reference_env);
  }
  return true;
}

export function resolveScenarioReference({scenario, environment = process.env}) {
  if (scenario.reference_env) {
    const referenceId = environment[scenario.reference_env];
    if (!referenceId) {
      throw new Error(`${scenario.id}: ${scenario.reference_env} is required; do not replace character casting with a generic language voice.`);
    }
    return {referenceId, referenceEnv: scenario.reference_env};
  }

  const generic = environment.FISH_REFERENCE_ID;
  const chinese = environment.FISH_REFERENCE_ID_ZH;
  const referenceId = scenario.language?.startsWith('zh') ? chinese || generic : generic || chinese;
  if (!referenceId) {
    throw new Error(`${scenario.id}: FISH_REFERENCE_ID or FISH_REFERENCE_ID_ZH is required for this QA-matrix voice.`);
  }
  return {
    referenceId,
    referenceEnv: scenario.language?.startsWith('zh') && chinese ? 'FISH_REFERENCE_ID_ZH' : generic ? 'FISH_REFERENCE_ID' : 'FISH_REFERENCE_ID_ZH',
  };
}
