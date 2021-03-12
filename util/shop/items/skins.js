export const skins = {
  'skin-default': {
    price: 0,
    description: '✅ Simple.',
    enabled: true,
    emoji: '✅',
  },
  'skin-devil': {
    price: 666,
    description: "😈 Let's make a deal.",
    enabled: true,
    emoji: '😈',
  },
  'skin-mad': {
    price: 500,
    description: '😡 My face when I type the wrong number.',
    enabled: true,
    emoji: '😡',
  },
  'skin-rage': {
    price: 1000,
    description: '🤬 @!#?@!.',
    enabled: true,
    emoji: '🤬',
  },
  'skin-flex': {
    price: 1000,
    description: '💪 Do you even lift?',
    enabled: true,
    emoji: '💪',
  },
  'skin-pancake': {
    price: 1000,
    description: '🥞 Breakfast is served.',
    enabled: false,
    emoji: '🥞',
  },
  'skin-megaflex': {
    price: 2500,
    description: '❓ We get it. You lift.',
    enabled: true,
    emoji: '🌌',
  },
  'skin-ultraflex': {
    price: 5000,
    description: '❓ Gives ability to throw competition into space.',
    enabled: true,
    emoji: '🚀',
  },
  'skin-hyperflex': {
    price: 10000,
    description: "❓ It's all in the name.",
    enabled: true,
    emoji: '🍆',
  },
  'skin-monke': {
    price: 500,
    description: '🐵 MONKE.',
    enabled: false,
    emoji:'🐵',
  },
  'skin-brain': {
    price: 700,
    description: '🧠 Big brain plays only.',
    enabled: false,
    emoji:'🧠',
  },
  'skin-sparkle': {
    price: 800,
    description: '✨ Shining bright!',
    enabled: false,
    emoji:'✨',
  },
  'skin-bug': {
    price: 1e23,
    description: '🐛',
    enabled: false,
    emoji:'💩',
  },
  'skin-wiz': {
    price: 0,
    description: '',
    enabled: false,
    emoji:'🧙‍♂️',
  },
  'skin-debug': {
    price: 0,
    description: "🤖 You shouldn't have this.",
    enabled: false,
    emoji:'🤖',
  },
  'skin-trees': {
    price: 420,
    description: '🍁 Blaze it.',
    enabled: false,
    emoji:'🍁',
  },
  'skin-clown': {
    price: 999,
    description: '🤡 Quit clowning around.',
    enabled: false,
    emoji:'🤡',
  },
  'skin-koala': {
    price: 750,
    description: '🐨 Very cute yet very unintelligent.',
    enabled: false,
    emoji:'🐨',
  },
  'skin-kiss': {
    price: 696,
    description: '💋 Smooch.',
    enabled: false,
    emoji:'💋',
  },
  'skin-ufo': {
    price: 1337,
    description: '🛸 Somewhere out there...',
    enabled: false,
    emoji:'🛸',
  },
};

const enabledSkins = {};

Object.keys(skins).forEach((key) => {
  if (skins[key].enabled) {
    enabledSkins[key] = skins[key];
  }
});

export default enabledSkins;
