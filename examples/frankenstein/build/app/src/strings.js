// Every player-visible string in the game lives here and nowhere else.
// Interface language: English only. Register: the creature's — first person,
// past tense, sparse, period, no irony, never a modern contraction, never a
// joke, and he never names himself. Checked against GAME_DESIGN §16: no
// "not X, but Y", no omniscient explanation, no summary moral, emotion
// externalised, no stacked description, adverb budget, no all-purpose
// modifier clauses, no "a flicker of / as if / seemed to / a wave of".
// No digits appear in player-visible text anywhere below.

export const STRINGS = {
  title: {
    book: 'Frankenstein; or, The Modern Prometheus',
    slice: 'The Hovel · chapters XI–XVI',
    verbs: ['Begin the winter', 'Sound and text', 'The book this came from'],
  },

  about: [
    'This plate is drawn from the 1831 text, chapters eleven to sixteen.',
    'The novel is in the public domain. Nothing here comes from any film.',
    'Go back',
  ],

  options: {
    title: 'Sound and text',
    textSize: 'Text size',
    textSizeValues: ['plain', 'larger', 'largest'],
    ink: 'Ink weight',
    inkValues: ['plain', 'heavy'],
    sound: 'Sound',
    murmur: 'The murmur of speech',
    motion: 'Reduced motion',
    onOff: ['off', 'on'],
    back: 'Keep these and go back',
  },

  viewport: {
    line: 'This plate wants a wider window.',
    size: 'A landscape window, twelve-eighty by seven-twenty or more.',
  },

  prompts: {
    keepWatching: 'hold to keep watching',
    liftPlank: 'lift the plank',
    replacePlank: 'put the plank back',
    takeLoad: 'take the load',
    putDown: 'put it down and go',
    letLie: 'let it lie',
    water: 'draw the water',
    path: 'clear the path',
    take: 'take from their store',
    forage: "gather at the wood's edge",
    search: 'open the portmanteau',
    listen: 'listen at the chink',
    stopListen: 'come away from the chink',
    lesson: 'stay for the lesson',
    journal: 'read the journal of the four months',
    goIn: 'slip back inside',
    knock: 'knock',
    answer: 'answer him',
    stayHand: 'stay your hand',
    waitMoon: 'keep watching',
    letDayPass: 'let the day pass',
    waitDark: 'wait for the dark',
    begin: 'step out into the yard',
  },

  // The one piece of advice the game ever gives, offered once (M3 beat 4).
  advice: 'put it down and go',

  // The first four learned words are the novel's own (chapter 12); the rest
  // are the period nouns the lessons and the chink would plausibly yield.
  vocab: [
    'fire', 'milk', 'bread', 'wood', 'water', 'cottage', 'old man', 'father',
    'son', 'daughter', 'food', 'cold', 'night', 'day', 'door', 'window',
    'garden', 'path', 'snow', 'rain', 'sun', 'moon', 'tree', 'forest',
    'field', 'house', 'room', 'chair', 'table', 'book', 'word', 'name',
    'friend', 'kind', 'good', 'sad', 'weep', 'smile', 'hand', 'eye',
    'heart', 'soul', 'mind', 'voice', 'song', 'guitar', 'work', 'rest',
    'walk', 'village', 'morning', 'evening', 'winter', 'spring', 'summer',
    'autumn', 'year', 'month', 'week', 'hour', 'moment', 'life', 'death',
    'love', 'hate', 'fear', 'hope', 'peace', 'sorrow', 'joy', 'pain',
    'hunger', 'thirst', 'sleep', 'dream', 'wake', 'rise', 'sit', 'stand',
    'come', 'go', 'stay', 'leave', 'give', 'take', 'make', 'keep',
    'speak', 'hear', 'see', 'know', 'learn', 'teach', 'read', 'write',
    'help', 'serve', 'protect', 'save', 'home', 'family', 'stranger',
    'creature', 'man', 'woman', 'child', 'people', 'world', 'earth',
  ],

  // Speech through the wall. Each entry: speaker, the words (matched
  // against vocab by spelling; a word below the player's count prints, the
  // rest are engraved wavy rules).
  overheard: {
    latchDawn: { speaker: 'agatha', text: 'Father, come and see. The wood, again.' },
    listening: [
      { speaker: 'delacey', text: 'The fire is good tonight. Sit closer, child.' },
      { speaker: 'agatha', text: 'There is bread, and milk. Eat, father.' },
      { speaker: 'felix', text: 'Rest now. The garden can wait for spring.' },
      { speaker: 'delacey', text: 'Read to us, Felix. The old book again.' },
      { speaker: 'felix', text: 'The snow is going. The path will be clear soon.' },
      { speaker: 'agatha', text: 'Who gives us this wood? Good spirit, wonderful.' },
      { speaker: 'delacey', text: 'We are poor, but we are kind. Remember that.' },
      { speaker: 'felix', text: 'Winter will end. We will keep the cottage.' },
    ],
    lessonNouns: ['fire', 'bread', 'water', 'father', 'book', 'hand', 'heart', 'friend'],
    walkPlanned: {
      speaker: 'felix',
      text: 'On the morning after next we walk to the village, all three of us.',
    },
    walkPlannedErrand: {
      speaker: 'felix',
      text: 'I must go to the village on an errand. Keep father company.',
    },
  },

  door: {
    answer: 'Who is there? Come in.',
    answerWary: 'Who is there? …Who is there? Come in.',
    sitSilence: 'You are welcome to the fire, stranger, though we have little.',
    // The six exchanges, in the text's order, compressed (GAME_DESIGN §17).
    // Exchange 0 is admission; the five gates follow.
    exchanges: [
      {
        me: null,
        him: 'Sit by the fire, and take what warmth we have. You are welcome.',
      },
      {
        me: 'Pardon this intrusion. I am unfortunate, and I have no friend upon earth.',
        him: 'It will afford me true pleasure to be in any way serviceable to a human creature.',
      },
      {
        me: 'For many months I have lived against your wall, and I have learned your speech by listening.',
        him: 'Against my wall. Then you have heard us at our worst and at our best.',
      },
      {
        me: 'The firing at your door was laid there by my hands. The path, and the water, also.',
        him: 'The good spirit, then, had a shape. We wondered, and we could not guess.',
      },
      {
        me: 'I ask you to be my friend, and to protect me against those who will not hear me.',
        him: 'There is something in your words which persuades me that you are sincere.',
      },
      {
        me: 'I have, unknown to them, been for many months in the habits of daily kindness towards them.',
        him: 'Then they owe you more than they know, and I owe you my family.',
      },
    ],
    // His closing line depends on whether he was told anything true.
    closingTrue: 'Stay. I will speak for you, whatever comes through that door.',
    closingUnknown: 'I am sorry, stranger. I cannot help you. Go, before they return.',
  },

  failure: {
    seenAgatha: 'Agatha came out for the pail. Her eyes found me in the yard.',
    seenFelix: 'Felix woke and went to the door. His eyes found me in the dark.',
    seenFirstLight: 'Felix opened the door at first light. I was still in the yard.',
    seenGarden: 'I was still in the garden when the sky went grey.',
    header: 'SEEN',
  },

  epilogue: {
    lane: [
      'At dawn, two men stood in the lane. The other man did the asking.',
      'He asked whether Felix had considered the rent, and the produce of the garden.',
    ],
    laneSatUp: 'Felix answered that he had sat up watching, and would not stay another night.',
    laneAnswer: 'Felix answered: take possession of your tenement, and let me fly from this place.',
    laneAnswerProduce: 'He spoke of the produce of the garden, and would take some days to consider.',
    darkDay: 'The inside of the cottage was dark, and I heard no motion.',
    gone: {
      line1: 'At dawn the door stood open, and the room was bare.',
      line2: 'They had gone for want, and they did not say where.',
    },
    // Three closing lines, chosen by what the run earned (GAME_DESIGN §15).
    closing: {
      labourTrue: 'It was apparent that my conversation had interested the father in my behalf.',
      labourFalse: 'He had heard a stranger at his door, and nothing more.',
      theft: 'They went with nothing put by.',
      fed: 'The pile at their door had been high, once. It did not keep them.',
      journal: 'A name had been written down for me. I went toward Geneva.',
      noJournal: 'I went out into the night, and no place had a name for me.',
      fewWords: 'I had words enough for a door, and not enough for an answer.',
    },
  },

  cards: {
    restart: 'Go back to the first night',
    endOfRun: 'The run is ended.',
  },

  moments: {
    portmanteau: 'Three books, wrapped in a cloth. I knew some of the words already.',
    journalRead: 'The journal of the four months. I could read it now.',
    twoPlates: 'They set the food before the old man, and kept none for themselves.',
    pool: 'I had never seen myself. The water held me, and I started back.',
  },
};

// A word the player has banked prints; a word beyond the plank is a wavy
// rule. This is a rendering rule over these strings, not new state.
export function glossWords(state) {
  return STRINGS.vocab.slice(0, Math.max(0, Math.min(state.words, STRINGS.vocab.length)));
}
