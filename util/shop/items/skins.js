export const skins = {
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
  default: {
    price: 0,
    description: '✅ Simple.',
    enabled: true,
    emoji: '✅',
  },
  sunflower: {
    price: 500,
    description: "🌻 Then you're left in the dust...",
    enabled: true,
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
    enabled: true,
    emoji: '🌸',
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
  flex: {
    price: 1000,
    description: '💪 Do you even lift?',
    enabled: true,
    emoji: '💪',
  },
  pancake: {
    price: 1000,
    description: '🥞 Breakfast is served.',
    enabled: false,
    emoji: '🥞',
  },
  pizza: {
    price: 2000,
    description: '🍕 Now THIS is pie.',
    enabled: true,
    emoji: '🍕',
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
    enabled: false,
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
  trees: {
    price: 420,
    description: '🍁 Blaze it.',
    enabled: false,
    emoji: '🍁',
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
  ufo: {
    price: 1337,
    description: '🛸 Somewhere out there...',
    enabled: false,
    emoji: '🛸',
  },
  pie: {
    price: 200,
    description: "🥧 **LIMITED** Wait, it isn't pie day?",
    enabled: false,
    emoji: '🥧',
  },
};

const enabledSkins = {};

Object.keys(skins).forEach((key) => {
  if (skins[key].enabled) {
    enabledSkins[key] = skins[key];
  }
});

export default enabledSkins;
