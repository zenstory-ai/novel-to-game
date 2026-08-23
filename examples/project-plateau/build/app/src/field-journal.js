const PLATE_NOTES = Object.freeze({
  'brook-partial': 'Brook flank',
  'brook-unread': 'Unread track',
  'canopy-flank': 'Fern-gap flank',
  'basalt-scale': 'Basalt scale',
  'basalt-scale-repeat': 'Basalt view repeated',
  'glade-form': 'Family at rest',
  'glade-young-play': 'Young at play',
  'glade-young-repeat': 'Young play repeated',
  'glade-branch-pull': 'Branch pulled',
  'glade-branch-repeat': 'Branch pull repeated',
  'glade-alarm': 'Family alarm',
  'pterodactyl-dive': 'Committed wing',
  'pterodactyl-repeat': 'Committed wing repeated',
  'pterodactyl-edge': 'Wing at edge',
  'return-occluded': 'Thorn-obscured flank',
  'creek-scale': 'Creek scale',
  'creek-scale-repeat': 'Creek view repeated',
  'shaken-frame': 'Smeared plate',
  'behavior-lost': 'Movement lost',
  'family-edge': 'Form at edge',
  'empty-subject': 'Empty glass',
  'empty-sky': 'Empty sky',
  'empty-fort': 'Empty glass',
});

const FRAME_CONDITIONS = Object.freeze({
  'empty-fort': 'NO LIVING SUBJECT',
  'brook-unread': 'TRACK UNREAD // GLASS EMPTY',
  'brook-partial': 'FOLIAGE ACROSS THE GLASS',
  'canopy-flank': 'FORM CLEAR THROUGH FERN',
  'basalt-scale': 'FORM AND BASALT IN FRAME',
  'glade-form': 'FAMILY HELD IN FRAME',
  'glade-behavior': 'MOVEMENT HELD IN FRAME',
  'glade-young-play': 'MOVEMENT HELD IN FRAME',
  'glade-branch-pull': 'MOVEMENT HELD IN FRAME',
  'glade-young-repeat': 'MOVEMENT ALREADY ON GLASS',
  'glade-branch-repeat': 'MOVEMENT ALREADY ON GLASS',
  'glade-alarm': 'FAMILY MOVING IN ALARM',
  'pterodactyl-dive': 'WING HELD IN FRAME',
  'pterodactyl-repeat': 'WING ALREADY ON GLASS',
  'pterodactyl-edge': 'WING AT PLATE EDGE',
  'empty-sky': 'EMPTY SKY',
  'shaken-frame': 'PLATE MOVING // DETAIL SMEARED',
  'family-edge': 'FORM AT PLATE EDGE',
  'empty-subject': 'NO LIVING FORM ON GLASS',
  'return-occluded': 'THORN ACROSS THE GLASS',
  'creek-scale': 'FORM AND CREEK IN FRAME',
});

export function noteForPlate(plate) {
  if (plate.status === 'cracked') return 'Cracked plate';
  if (plate.status !== 'exposed') return '';
  return PLATE_NOTES[plate.frameKey]
    ?? PLATE_NOTES[plate.sourceFrameKey]
    ?? 'Living form';
}

export function daylightCondition(seconds) {
  if (seconds > 120) return 'High light';
  if (seconds > 60) return 'Long light';
  if (seconds > 25) return 'Light fading';
  return 'Last light';
}

export function frameConditionCopy(frame) {
  return FRAME_CONDITIONS[frame.key] ?? 'FIELD FRAME';
}

export function routeConsequence(result) {
  const gunshotAftermath = result.gunshotCallback ? ` ${result.gunshotCallback}` : '';
  if (result.caseAbandoned) {
    return `The scout reached Fort. The plate case stayed in the basin.${gunshotAftermath}`;
  }
  if (result.route === 'turnback') {
    return `You turned back before the glade; what the case held still reached camp.${gunshotAftermath}`;
  }
  if (result.returnStrike) return 'The open creek saved time, but the wing struck the case on the return.';
  if (result.route === 'covered') {
    return result.gunshotFired
      ? 'The rifle cleared the dive; the longer thorn return kept the surviving glass under cover.'
      : 'The longer thorn return kept the glass under cover.';
  }
  if (result.route === 'exposed') {
    return result.gunshotFired
      ? 'The rifle cleared the dive. Something moved beside the open creek on the way back.'
      : 'The open creek cut the return short and left the case in the wing corridor.';
  }
  return '';
}
