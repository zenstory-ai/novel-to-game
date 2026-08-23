import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(resolve(here, 'playable-model.json'), 'utf8'));
const data = await import(resolve(here, '../build/app/js/data.js'));
const engine = await import(resolve(here, '../build/app/js/engine.js'));

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const assertText = (value, label) => assert.equal(typeof value === 'string' && value.length > 0, true, label);

function finishOpening(state) {
  let beats = 0;
  while (state.phase === 'opening_aftermath') {
    const current = engine.currentOpeningAftermath(state);
    assert.ok(current?.current, '开场后章必须存在当前拍');
    assert.equal(engine.advanceOpeningAftermath(state).ok, true);
    beats += 1;
  }
  assert.equal(beats, contract.replay.openingAftermathBeats);
  assert.equal(state.phase, contract.replay.expectedDayPhase);
}

function runOpening(action) {
  const state = engine.newGame(contract.replay.seed);
  assert.deepEqual(state.resources, contract.stateSurface.resources.initial);
  assert.deepEqual(Object.keys(state.relations), contract.stateSurface.relationshipActors);
  const eventLog = state[contract.stateSurface.eventLog];
  const knowledgeLedger = state[contract.stateSurface.knowledgeLedger];
  assert.equal(Array.isArray(eventLog), true, '事件日志字段必须指向数组');
  assert.equal(Array.isArray(knowledgeLedger), true, '知识账字段必须指向数组');
  assert.equal(engine.chooseOpening(state, action.id).ok, true);
  assert.equal(eventLog.length, 1);
  assert.deepEqual(eventLog[0], {
    day: 1,
    type: 'opening',
    choice: action.id,
    public: true,
  });
  assert.equal(state.flags[action.expected.flag], true);
  assert.equal(state.flags[action.expected.absentFlag], undefined, '未选起手不得污染 history/flags');
  assert.equal(state.resources.house, action.expected.house);
  for (const [key, value] of Object.entries(action.expected.bonds)) assert.equal(state.bonds[key], value, key);

  finishOpening(state);
  const memory = engine.openingMemory(state);
  assert.equal(memory.choice, action.id);
  for (const field of contract.callbacks) {
    if (field === 'endingTexts' || field === 'epilogueTexts') {
      assert.equal(Object.keys(memory[field]).length, 5, `${field} 应提供五份长期回调载荷`);
      for (const text of Object.values(memory[field])) assertText(text, `${field} 不得为空`);
    } else assertText(memory[field], `${field} 不得为空`);
  }

  const options = engine.dayOptions(state);
  assert.deepEqual(options.map(({ id }) => id), contract.stateSurface.dayActions);
  assert.equal(options.filter(({ resolvesPressure }) => resolvesPressure).length >= 1, true);

  const serialized = engine.serialize(state);
  assert.deepEqual(engine.deserialize(serialized), state, '合法 snapshot 必须从 history 重演通过');
  const tampered = JSON.parse(serialized);
  tampered.flags[action.expected.absentFlag] = true;
  assert.equal(engine.deserialize(JSON.stringify(tampered)), null, '未选分支注入必须拒读');

  return {
    state: engine.snapshot(state),
    digest: digest(state),
  };
}

function verifyKnowledgeLedger() {
  const probe = contract.knowledgeProbe;
  const state = engine.newGame(contract.replay.seed);
  assert.equal(engine.chooseOpening(state, probe.opening).ok, true);
  finishOpening(state);
  assert.equal(engine.chooseDayAction(state, probe.action).ok, true);
  assert.equal(state[contract.stateSurface.knowledgeLedger].includes(probe.factId), true, '知识账必须记录已获知事实');
  const fact = engine.secretInventory(state).find(({ id }) => id === probe.factId);
  assertText(fact?.label, '证物标签不得为空');
  assert.deepEqual(fact, {
    id: probe.factId,
    label: fact.label,
    source: probe.source,
    confidence: probe.confidence,
    expiresOn: probe.expiresOn,
    expired: false,
    selected: false,
  });
  assert.equal(state.selectedSecret, null, '获得事实不等于已经选择提交');
  assert.deepEqual(state.secretsUsed, [], '未选择的事实不得被动作标成已消费');
  assert.equal(state.history.at(-1).secretUsed, null, '事件日志不得伪造事实消费');

  const tampered = JSON.parse(engine.serialize(state));
  tampered.secretsUsed.push(probe.factId);
  assert.equal(engine.deserialize(JSON.stringify(tampered)), null, '伪造已消费事实必须拒读');
}

assert.equal(contract.schemaVersion, 1);
assert.equal(contract.source, 'design/GAME_DESIGN.md#10-可执行切片合同');
assert.equal(contract.experienceProfile, 'narrative-led');
assert.equal(contract.buildPath, 'custom');
assert.match(contract.versions.contentRevision, /^NOT_AVAILABLE:/);
assert.match(contract.versions.rulesRevision, /^NOT_AVAILABLE:/);
assert.equal(engine.SAVE_VERSION, contract.versions.saveSchema);
assert.equal(contract.replay.tamperedStateMustBeRejected, true, '合同必须门控伪造状态拒读');
assert.equal(contract.validationPaths.primary.opening, contract.openingActions[0].id);
assert.equal(contract.validationPaths.adjacentCounterexample.opening, contract.openingActions[1].id);
for (const [index, path] of Object.values(contract.validationPaths).entries()) {
  const action = contract.openingActions[index];
  assert.equal(path.aftermathAdvances, contract.replay.openingAftermathBeats);
  assert.equal(path.expectedFlag, action.expected.flag);
  assert.equal(path.absentFlag, action.expected.absentFlag);
  assert.equal(path.expectedHouse, action.expected.house);
  assertText(path.expectedFeedback, '固定验证路径必须声明预期反馈');
}
assert.deepEqual(Object.keys(data.DAY_ACTIONS), contract.stateSurface.dayActions);
assert.deepEqual(data.HEROINE_IDS, contract.stateSurface.relationshipActors);
assert.deepEqual(data.OPENING_CHOICES.map(({ id }) => id), contract.openingActions.map(({ id }) => id));

const firstRuns = contract.openingActions.map(runOpening);
const replayRuns = contract.openingActions.map(runOpening);
assert.deepEqual(replayRuns.map(({ digest: value }) => value), firstRuns.map(({ digest: value }) => value));
assert.notEqual(firstRuns[0].digest, firstRuns[1].digest, '两条起手必须产生可区分状态');
verifyKnowledgeLedger();

console.log('可执行改编合同：2 条起手、3 拍回响、非空回调载荷、知识来源、确定性重放与分支污染拒绝均一致');
