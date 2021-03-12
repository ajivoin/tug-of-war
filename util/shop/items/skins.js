const skins = {
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
    emoji: '🌠',
  },
  'skin-hyperflex': {
    price: 10000,
    description: "❓ It's all in the name.",
    enabled: true,
    emoji: '🍆',
  },
};

const enabledSkins = {};

Object.keys(skins).forEach((key) => {
  if (skins[key].enabled) {
    enabledSkins[key] = skins[key];
  }
});

export default enabledSkins;
