export const skins = {
  ily: {
    price: 0,
    description: '🤟 Welcome back everyone! I love you.',
    enabled: true,
    emoji: '🤟',
  },
  high: {
    price: 1000,
    description: "😶‍🌫️ Why'd I smoke this shit?",
    enabled: true,
    emoji: '😶‍🌫️',
  },
  doge: {
    price: 1000,
    description: '🐶 TO THE MOON!',
    enabled: false,
    emoji: '🐶',
  },
  moon: {
    price: 2000,
    description: '🌙 Wtf is a doge coin?',
    enabled: false,
    emoji: '🌙',
  },
  satellite: {
    price: 5000,
    description: '🛰 Space is pretty cool.',
    enabled: false,
    emoji: '🛰',
  },
  test: {
    price: 2000,
    description: 'test emoji please ignore',
    enabled: false,
    emoji: '🤖',
  },
  bunny: {
    price: 1500,
    description: '🐰 Happy Bunny Day! **[LIMITED]**',
    enabled: false,
    emoji: '🐰',
  },
  rabbit: {
    price: 3500,
    description: '🐇 Hop hop.',
    enabled: false,
    emoji: '🐇',
  },
  default: {
    price: 0,
    description: '',
    enabled: false,
    emoji: '👑',
  },
  trees: {
    price: 420,
    description: '🍁 Blaze it.',
    enabled: false,
    emoji: '🍁',
  },
  blazeit: {
    price: 420,
    description: '🔥 BLAZE IT!',
    enabled: false,
    emoji: '🔥',
  },
  sunflower: {
    price: 500,
    description: "🌻 Then you're left in the dust...",
    enabled: false,
    emoji: '🌻',
  },
  tulip: {
    price: 500,
    description: '🌷 One lip, tulip, red lip, blue lip.',
    enabled: true,
    emoji: '🌷',
  },
  blossom: {
    price: 1000,
    description: '🌸 Spring has sprung!',
    enabled: false,
    emoji: '🌸',
  },
  goat: {
    price: 3000,
    description: '🐐 THE GOAT.',
    enabled: false,
    emoji: '🐐',
  },
  pancake: {
    price: 1000,
    description: '🥞 Breakfast is served.',
    enabled: true,
    emoji: '🥞',
  },
  pizza: {
    price: 2000,
    description: '🍕 Now THIS is pie.',
    enabled: false,
    emoji: '🍕',
  },
  ufo: {
    price: 1337,
    description: '🛸 Somewhere out there...',
    enabled: false,
    emoji: '🛸',
  },
  chipmunk: {
    price: 1000,
    description: '🐿 This skin is nuts!',
    enabled: false,
    emoji: '🐿',
  },
  /* FLEX */
  flex: {
    price: 1000,
    description: '💪 Do you even lift?',
    enabled: true,
    emoji: '💪',
  },
  megaflex: {
    price: 2500,
    description: '🌌 We get it. You lift.',
    enabled: true,
    emoji: '🌌',
  },
  ultraflex: {
    price: 5000,
    description: '🚀 Gives ability to throw competition into space.',
    enabled: true,
    emoji: '🚀',
  },
  hyperflex: {
    price: 10000,
    description: '🍆',
    enabled: true,
    emoji: '🍆',
  },
  diamond: {
    price: 25000,
    description: '💎 Flex.',
    enabled: true,
    emoji: '💎',
  },
  /* DISABLED */
  sauropod: {
    price: 2000,
    description: '🦕 How is this for extinction?',
    enabled: true,
    emoji: '🦕',
  },
  trex: {
    price: 5000,
    description: '🦖 Haha, short arms.',
    enabled: false,
    emoji: '🦖',
  },
  devil: {
    price: 666,
    description: "😈 Let's make a deal.",
    enabled: false,
    emoji: '😈',
  },
  mad: {
    price: 500,
    description: '😡 My face when I type the wrong number.',
    enabled: false,
    emoji: '😡',
  },
  rage: {
    price: 1000,
    description: '🤬 @!#?@!.',
    enabled: false,
    emoji: '🤬',
  },
  monke: {
    price: 500,
    description: '🐵 MONKE.',
    enabled: false,
    emoji: '🐵',
  },
  brain: {
    price: 700,
    description: '🧠 Big brain plays only.',
    enabled: false,
    emoji: '🧠',
  },
  sparkle: {
    price: 800,
    description: '✨ Shining bright!',
    enabled: true,
    emoji: '✨',
  },
  bug: {
    price: 1e23,
    description: '🐛',
    enabled: false,
    emoji: '💩',
  },
  wiz: {
    price: 0,
    description: '',
    enabled: false,
    emoji: '🧙‍♂️',
  },
  debug: {
    price: 0,
    description: "🤖 You shouldn't have this.",
    enabled: false,
    emoji: '🤖',
  },
  fool: {
    price: 99,
    description: '🃏 The Fool. **[LIMITED]**',
    enabled: false,
    emoji: '🃏',
  },
  clown: {
    price: 999,
    description: '🤡 Quit clowning around.',
    enabled: false,
    emoji: '🤡',
  },
  koala: {
    price: 750,
    description: '🐨 Very cute yet very unintelligent.',
    enabled: false,
    emoji: '🐨',
  },
  kiss: {
    price: 696,
    description: '💋 Smooch.',
    enabled: false,
    emoji: '💋',
  },
  pie: {
    price: 200,
    description: "🥧 **LIMITED** Wait, it isn't pie day?",
    enabled: false,
    emoji: '🥧',
  },
  patty: {
    price: 100,
    description: "🍀 **LIMITED** Happy St. Patrick's Day!",
    enabled: false,
    emoji: '🍀',
  },
  clink: {
    price: 1000,
    description: '🍻 **LIMITED** Happy Green Beer Day!',
    enabled: false,
    emoji: '🍻',
  },
  basketball: {
    price: 1000,
    description: '🏀 **LIMITED** MARCH MADNESS',
    enabled: false,
    emoji: '🏀',
  },
};

const enabledSkins = {};

Object.keys(skins).forEach((key) => {
  if (skins[key].enabled) {
    enabledSkins[key] = skins[key];
  }
});

export default enabledSkins;
