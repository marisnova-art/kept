/* Story home — English lines. phrases: short literary noun phrases that meet the day; lines: sentence frames
   that narrate the records. Slots: {chip} count chip, {first} first record title, {when} time, {list} titles, {n} number.
   Particles like {chip:이/가} are Korean only; in English they are ignored. */
export default {
  phrases: {
    spring: [
      'The white breath of a new magnolia', 'An alley that smells of earth after spring rain', 'A pale green afternoon resting on the sill', 'Slow steps under falling blossoms',
      'The thrill of a notebook\'s first page', 'A soft wind melting into sunlight', 'A heart that shimmers like a heat haze', 'A warm breath at the end of the cold snap',
      'Fresh greens on the table', 'Small birds waking the fields', 'A day as light as a thinner coat', 'An afternoon dyed in canola yellow'
    ],
    summer: [
      'The crisp feeling of a summer day', 'Ice clinking in a glass', 'A sky rinsed clear after a shower', 'Noon full of cicadas',
      'Salt carried on the sea breeze', 'The sweet cool of a watermelon slice', 'A short rest in the shade of a tree', 'Long shadows stained by sunset',
      'Night air through an open window', 'Sunlight on rippling water', 'Pages turned by the fan', 'Crickets singing in a summer lane'
    ],
    autumn: [
      'The whisper of rustling leaves', 'A high, blue autumn sky', 'The warmth of a cup of tea', 'An afternoon ripening in the glow',
      'A cool breeze asking how you are', 'An evening made for turning pages', 'A road paved in ginkgo gold', 'The firm scent of a ripe apple',
      'Longer shadows, shorter days', 'Cool air at the tip of your nose', 'Reeds swaying by the river', 'Sunlight soaking into a knit sleeve'
    ],
    winter: [
      'The hush after the first snow', 'A drawing on a fogged window', 'A long breath under a soft blanket', 'Hellos written in white breath',
      'Slow time by the heater', 'Winter in the scent of tangerine peel', 'The sparkle of a frosty morning', 'The comfort of a spoonful of warm soup',
      'A night you can hear snow underfoot', 'Rosy cheeks under a woolly hat', 'Long, low winter light', 'A heart at the edge of the year'
    ],
    morning: [
      'The first sip of fresh coffee', 'Morning light slipping through the curtains', 'A day no one has stepped on yet', 'The quiet before the alarm',
      'Birds saying good morning outside', 'A mind as clear as a freshly set clock', 'An hour that smells of warm bread', 'Morning air still holding the dew'
    ],
    afternoon: [
      'Afternoon light leaning slowly', 'Warm light settled on the desk', 'An afternoon between drowsy and focused', 'The ease of the last sip of coffee',
      'The sound of a plant growing by the window', 'Clouds drifting past at their own pace', 'A short walk after lunch', 'The sweet gap of three o\'clock'
    ],
    evening: [
      'The evening breath that sets the day down', 'A window washed in sunset', 'Warm lights coming on down the street', 'The rhythm of steps heading home',
      'The simple warmth of the dinner table', 'Time to shake off the day\'s dust', 'A sky deepening shade by shade', 'Stillness under a small lamp'
    ],
    night: [
      'A quiet night under the stars', 'A mind still awake while everyone sleeps', 'Moonlight across the desk', 'Thoughts that surface under the covers',
      'The last bus somewhere far away', 'The night page that folds the day', 'Soft music before dawn', 'A quiet breath waiting for tomorrow'
    ],
    rain: ['Rain tapping on the window', 'Small beats falling on an umbrella', 'Streets that smell of rain', 'Raindrops painting the view'],
    snow: ['Snowflakes piling up without a sound', 'Footprints in a landscape erased white'],
    clear: ['A sky without a crease', 'A day with sunlight to spare'],
    cloudy: ['A soft day tucked under clouds', 'A calm mind under a grey sky'],
    any: [
      'A day flowing slowly, like handwriting', 'A moment that brings back an old song', 'A small luck in your pocket', 'A day worth underlining',
      'The joy of rereading a favourite line', 'A day precious because it is ordinary', 'A day when small things shine', 'Time to catch your breath and walk again',
      'A heart a little lighter than yesterday', 'A day to ask someone how they are', 'A familiar scent on an unfamiliar road', 'A day painted in its own colour',
      'Small notes quietly piling up', 'Today\'s temperature, worth remembering'
    ]
  },
  lines: {
    greet: ['{greet}, {name}.', '{greet}, {name}. Good to see you.'],
    events: [
      'Today holds {chip}. It starts with {when}{first}.',
      'The calendar keeps the day\'s rhythm with {chip}. First up, {when}{first}.',
      'On the calendar: {chip}. The opening scene is {when}{first}.'
    ],
    eventsNone: [
      'Today\'s calendar is empty. A good day to wander.',
      'No plans set for today. A blank is just another word for possibility.',
      'Nothing booked today. Time is entirely on your side.'
    ],
    tasks: [
      'You have {chip} today. One at a time, starting with {first}.',
      '{chip} waiting for your touch. Begin lightly with {first}.',
      'One small check makes the day lighter. {chip} left, starting with {first}.'
    ],
    tasksNone: [
      'Nothing has to be finished today. Follow where your mind goes.',
      'Your task list is quiet. Give yourself a pause.'
    ],
    overdue: ['{n} earlier tasks are quietly waiting too.', '{n} postponed tasks. Maybe bring one out today?'],
    ideas: [
      'You have {chip} still shining. The latest: {first}.',
      'Seeds that will bloom someday: {chip}. The newest is {first}.'
    ],
    items: [
      'The places of {chip}, safely remembered. Just ask when you need them.',
      'Holding on to {chip} so nothing gets lost.'
    ],
    contacts: [
      '{chip} close to your heart. Why not send {first} a hello today?',
      '{chip}, each name a story still going.'
    ],
    notes: [
      '{chip}, quietly gathered. The last line: {first}.',
      'Past thoughts, {chip}. The most recent sentence: {first}.'
    ],
    others: [
      '{chip}, gathered one by one. The latest: {first}.',
      '{chip} close by too. The last one you kept: {first}.'
    ],
    featured: ['And the pieces you keep close: {list}.', 'Some writing you pinned to your heart: {list}.'],
    streak: ['{n} days of writing in a row. One line is enough today.', 'You have written {n} days straight. That steadiness is lovely.'],
    total: ['{chip}, remembering your days for you.'],
    empty: ['A clean page with nothing written yet. What will the first sentence be?']
  },
  counts: {
    events: n => n === 1 ? '1 event' : `${n} events`, tasks: n => n === 1 ? '1 task' : `${n} tasks`, ideas: n => n === 1 ? '1 idea' : `${n} ideas`,
    items: n => n === 1 ? '1 item' : `${n} items`, contacts: n => n === 1 ? '1 person' : `${n} people`, notes: n => n === 1 ? '1 note' : `${n} notes`, total: n => n === 1 ? '1 record' : `${n} records`,
    other: (n, label) => `${label} · ${n}`
  },
  quote: s => `“${s}”`,
  joinList: a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a.join('')
};
