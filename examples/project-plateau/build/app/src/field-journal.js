const PLATE_NOTES = Object.freeze({
  'brook-partial': 'A flank beyond the wet fern',
  'brook-unread': 'Mud and water, no animal',
  'canopy-flank': 'A flank through the fern gap',
  'basalt-scale': 'Adult beneath the red bank',
  'basalt-scale-repeat': 'The same adult and red bank',
  'glade-form': 'The family on the pale bar',
  'glade-young-play': 'Young running at the river bend',
  'glade-young-repeat': 'The young at play once more',
  'glade-branch-pull': 'Adult drawing down a bough',
  'glade-branch-repeat': 'The feeding bough again',
  'glade-alarm': 'The family turning to the wings',
  'pterodactyl-dive': 'Wing folded into the dive',
  'pterodactyl-repeat': 'The same descending wing',
  'pterodactyl-edge': 'Wingtip at the plate edge',
  'return-occluded': 'A flank lost behind thorns',
  'creek-scale': 'Animal beside the open creek',
  'creek-scale-repeat': 'The same creek crossing',
  'shaken-frame': 'Glass blurred by movement',
  'behavior-lost': 'The movement ended too soon',
  'family-edge': 'A body leaving the plate',
  'empty-subject': 'River light on empty glass',
  'empty-sky': 'Cloud and no wing',
  'empty-fort': 'An empty plate at the fort',
});

const FRAME_CONDITIONS = Object.freeze({
  'empty-fort': 'Nothing living on the plate.',
  'brook-unread': 'Only mud reaches the glass.',
  'brook-partial': 'Wet fern crosses the flank.',
  'canopy-flank': 'The flank clears the fern.',
  'basalt-scale': 'Animal and red bank together.',
  'glade-form': 'The family settles on the bar.',
  'glade-behavior': 'Their movement holds.',
  'glade-young-play': 'The young hold between strides.',
  'glade-branch-pull': 'The bent bough holds.',
  'glade-young-repeat': 'That run is already in the case.',
  'glade-branch-repeat': 'That feeding moment is already in the case.',
  'glade-alarm': 'Every head turns to the wings.',
  'pterodactyl-dive': 'The folded wing holds.',
  'pterodactyl-repeat': 'That dive is already in the case.',
  'pterodactyl-edge': 'The wing is leaving the plate.',
  'empty-sky': 'Cloud, but no wing.',
  'shaken-frame': 'The glass is moving; detail is lost.',
  'family-edge': 'The body is leaving the plate.',
  'empty-subject': 'Only river light reaches the glass.',
  'return-occluded': 'Thorn closes across the flank.',
  'creek-scale': 'Animal and open creek together.',
});

export function noteForPlate(plate) {
  if (plate.status === 'cracked') return 'Cracked plate';
  if (plate.status !== 'exposed') return '';
  return PLATE_NOTES[plate.frameKey]
    ?? PLATE_NOTES[plate.sourceFrameKey]
    ?? 'A living shape';
}

export function daylightCondition(seconds) {
  if (seconds > 120) return 'Sun above the western wall';
  if (seconds > 60) return 'Shadows crossing the bar';
  if (seconds > 25) return 'Light leaving the river';
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
  if (result.returnStrike) return 'The open creek saved the light, but a wing struck the case before the fort.';
  if (result.route === 'covered') {
    return result.gunshotFired
      ? 'The rifle turned the dive. The long thorn tunnel kept the surviving glass out of the open sky.'
      : 'The long thorn tunnel kept the plate case out of the open sky.';
  }
  if (result.route === 'exposed') {
    return result.gunshotFired
      ? 'The rifle turned the dive. Something still paced you beside the bright creek.'
      : 'The bright creek was the quicker road, with no leaf between the case and the wings.';
  }
  return '';
}
