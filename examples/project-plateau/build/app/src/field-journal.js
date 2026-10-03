const PLATE_NOTES = Object.freeze({
  'brook-partial': 'A flank beyond the wet fern',
  'brook-flank': 'The family far down the bar',
  'subject-occluded': 'A body behind leaves',
  'brook-unread': 'Shapes on the bar, spoor unread',
  'canopy-flank': 'A flank through the fern gap',
  'basalt-scale': 'Adult beneath the red bank',
  'basalt-scale-repeat': 'The same adult and red bank',
  'glade-form': 'The family on the pale bar',
  'glade-young-play': 'Young running at the river bend',
  'glade-young-repeat': 'The young at play once more',
  'glade-branch-pull': 'Adult drawing down a bough',
  'glade-branch-repeat': 'The feeding bough again',
  'glade-alarm': 'The family turning to the wings',
  'pterodactyl-dive': 'The hunting wing, low and whole',
  'pterodactyl-repeat': 'The same circling wing',
  'pterodactyl-edge': 'Wingtip at the plate edge',
  'return-occluded': 'A flank lost behind thorns',
  'creek-scale': 'Animal beside the open creek',
  'creek-scale-repeat': 'The same creek crossing',
  'shaken-frame': 'Glass blurred by movement',
  'family-edge': 'A body leaving the plate',
  'empty-subject': 'River light on empty glass',
  'subject-glimpse': 'A body at the very rim',
  'empty-fort': 'An empty plate at the fort',
  'stegosaurus-drinking': "Maple White's creature at the water",
  'behavior-lost': 'Heads up before the glass was done',
  'stegosaurus-drinking-repeat': 'The plated drinker once more',
  'stegosaurus-walking': 'A plated back among the reeds',
  'stegosaurus-edge': 'A plated tail leaving the plate',
});

const FRAME_CONDITIONS = Object.freeze({
  'empty-fort': 'Nothing living on the plate.',
  'brook-unread': 'Only mud reaches the glass.',
  'brook-partial': 'Wet fern crosses the flank.',
  'brook-flank': 'Small and far down the bar.',
  'subject-occluded': 'Leaves cross the body.',
  'canopy-flank': 'The flank clears the fern.',
  'basalt-scale': 'Animal and red bank together.',
  'glade-form': 'The family settles on the bar.',
  'glade-behavior': 'Their movement holds.',
  'glade-young-play': 'The young hold between strides.',
  'glade-branch-pull': 'The bent bough holds.',
  'glade-young-repeat': 'That run is already in the case.',
  'glade-branch-repeat': 'That feeding moment is already in the case.',
  'glade-alarm': 'Every head turns to the wings.',
  'pterodactyl-dive': 'The circling wing fills the glass.',
  'pterodactyl-repeat': 'That pass is already in the case.',
  'pterodactyl-edge': 'The wing is leaving the plate.',
  'shaken-frame': 'The glass is moving; detail is lost.',
  'family-edge': 'The body is leaving the plate.',
  'empty-subject': 'Only river light reaches the glass.',
  'subject-glimpse': 'Only the rim of a body touches the glass.',
  'return-occluded': 'Thorn closes across the flank.',
  'creek-scale': 'Animal and open creek together.',
  'stegosaurus-drinking': 'The plated back bows to the water.',
  'stegosaurus-drinking-repeat': 'That drinking pose is already in the case.',
  'stegosaurus-walking': 'The plated back is moving.',
  'stegosaurus-edge': 'The tail is leaving the plate.',
});

const BEHAVIOUR_NAMES = Object.freeze({
  'young-play': 'Young at play',
  'branch-pull': 'Bough drawn down',
  'predatory-dive': 'Hunting pass',
  drinking: 'Drinking',
  alarm: 'Alarm only',
});

const RANGE_NAMES = Object.freeze({
  close: ['Close', true],
  fair: ['Fair range', true],
  distant: ['Distant', false],
});

function framingStamp(plate) {
  if (plate.composition === 'clear') return ['Clean frame', true];
  if (plate.composition === 'edge') return ['Cut at the edge', false];
  if (plate.composition === 'unread') return ['Spoor unread', false];
  if (plate.composition === 'occluded') {
    return [plate.frameKey === 'brook-partial' ? 'Fern across the flank' : 'Leaves across the body', false];
  }
  return [plate.frameKey === 'subject-glimpse' ? 'Off the glass' : 'Empty glass', false];
}

// The developed plate is graded in observations, never numbers: what framed,
// whether the detail held, how near, and what the animal was doing. A stamp
// is good (true), a fault (false) or plain fact (null).
export function gradeForPlate(plate) {
  if (!plate || plate.status !== 'exposed') return [];
  const framed = framingStamp(plate);
  const detail = plate.stability === 'shaken' ? ['Smeared', false] : ['Sharp', true];
  const [rangeName, rangeGood] = RANGE_NAMES[plate.range]
    ?? (plate.composition === 'unread' ? ['Not identified', false]
      : plate.frameKey === 'subject-glimpse' ? ['Too little to count', false] : ['No subject', false]);
  const behaviour = BEHAVIOUR_NAMES[plate.behavior];
  return [
    { label: framed[0], good: framed[1] },
    { label: detail[0], good: detail[1] },
    { label: rangeName, good: rangeGood },
    behaviour
      ? { label: behaviour, good: plate.behavior !== 'alarm' }
      : { label: 'At rest', good: null },
  ];
}

// The verdict reads the stamps, so it can never praise a plate they fault.
export function verdictForPlate(plate) {
  if (!plate) return '';
  if (plate.status === 'cracked') return 'Broken glass proves nothing.';
  if (plate.status !== 'exposed') return '';
  if (plate.points <= 0) return 'Nothing here for Summerlee to dispute.';
  const stamps = gradeForPlate(plate);
  const faulted = stamps.some((stamp) => stamp.good === false);
  const telling = Boolean(BEHAVIOUR_NAMES[plate.behavior]) && plate.behavior !== 'alarm';
  if (plate.frameKey?.endsWith('-repeat')) return 'Summerlee has seen this one already; the case needs something new.';
  // Praise follows the points: a clean plate of an idle animal is honest but weak.
  if (!faulted && plate.points >= 2 && (telling || plate.range === 'close')) return 'Summerlee cannot wave this one away.';
  if (!faulted && plate.points >= 2) return 'Summerlee will argue, but the body is plainly there.';
  if (!faulted) return 'A clean plate, but Summerlee will ask what the animal was doing.';
  if (plate.frameKey === 'brook-partial' || plate.frameKey === 'brook-flank') {
    return 'Summerlee will call it a smudge. Follow them downriver for a clear view.';
  }
  return 'Summerlee will call it a smudge.';
}

// What would lift the record one band, said plainly on the result board.
export function nextBandCopy(result) {
  if (!result || result.kind !== 'alive') return '';
  if (result.caseAbandoned) return 'Carry the case home and the plates can speak for you.';
  if (result.band === 'returned-without-record') return 'One clean plate of the family would start the argument.';
  if (result.band === 'insufficient-record') {
    return 'Catch the young at play or the bough drawn down, framed whole and held still.';
  }
  if (result.band === 'corroborating-record') {
    return 'Summerlee would yield to an unbroken case: two behaviours, sharp and close.';
  }
  if (!result.aerialEvidence && !result.stegosaurusEvidence) {
    return 'The circling wing, or the creature that comes down to drink, would make it a record no one forgets.';
  }
  if (!result.aerialEvidence) return 'The circling wing, held whole on the glass, would make it a record no one forgets.';
  if (!result.stegosaurusEvidence) return 'The creature that comes down to drink would make it a record no one forgets.';
  return '';
}

export function noteForPlate(plate) {
  if (plate.status === 'cracked') return 'Cracked plate';
  if (plate.status !== 'exposed') return '';
  return PLATE_NOTES[plate.frameKey]
    ?? PLATE_NOTES[plate.sourceFrameKey]
    ?? 'A living shape';
}

export function daylightCondition(seconds) {
  if (seconds > 200) return 'Sun above the western wall';
  if (seconds > 110) return 'Shadows crossing the bar';
  if (seconds > 40) return 'Light leaving the river';
  return 'Last light at the fort';
}

export function frameConditionCopy(frame) {
  return FRAME_CONDITIONS[frame.key] ?? 'The plate is open.';
}

export function routeConsequence(result) {
  const gunshotAftermath = result.gunshotCallback ? ` ${result.gunshotCallback}` : '';
  if (result.caseAbandoned) {
    return `You reached Fort Challenger. The case lies where you left it in the basin.${gunshotAftermath}`;
  }
  if (result.route === 'turnback') {
    return `You turned back before the river bend. Whatever was already in the case reached camp.${gunshotAftermath}`;
  }
  if (result.returnStrike) return 'The open creek was the shorter road, but a wing struck the case before the fort.';
  if (result.route === 'covered') {
    return result.gunshotFired
      ? 'The rifle turned the dive. The thorn arches kept the surviving glass out of the open sky.'
      : 'Under the thorn arches, the plate case never showed itself to the open sky.';
  }
  if (result.route === 'exposed') {
    return result.gunshotFired
      ? 'The rifle turned the dive. Something still paced you beside the bright creek.'
      : 'The bright creek was the open road, with no leaf between the case and the wings.';
  }
  return '';
}
