export const powerups = {
  crowncard: {
    price: 110,
    description: 'Convert coins back into a crown at a premium.',
    quantified: true,
    enabled: true,
  },
  sneak: {
    price: 60,
    description: 'Sneakily move towards the target number.',
    quantified: false,
    enabled: true,
  },
  reroll: {
    price: 50,
    description: 'Reroll the target number.',
    enabled: true,
  },
  teleport: {
    price: 25,
    description: 'Moves the current number far away.',
    enabled: false,
  },
  sqrt: {
    price: 50,
    description: 'Square roots the current number.',
    enabled: true,
  },
  nice: {
    price: 50,
    description: 'Nice.',
    enabled: true,
  },
  zero: {
    price: 50,
    description: '0',
    enabled: false,
  },
  bomb: {
    price: 1000,
    description: 'Deal significant damage to the boss.',
    quantified: false,
    enabled: false,
  },
  crit: {
    price: 3000,
    description: 'Permanently increase your crit chance (up to 5 times).',
    quantified: false,
    enabled: true,
  },
  acrobatics: {
    price: 2500,
    description: 'Permanently increase your chance to be able to count two numbers in a row (up to 5 times).',
    quantified: false,
    enabled: true,
  },
  royalty: {
    price: 5000,
    description: 'Permanently gain an extra crown each time you win (up to 4 times).',
    quantified: false,
    enabled: true,
  },
};

const enabledPowerups = {};

Object.keys(powerups).forEach((key) => {
  if (powerups[key].enabled) {
    enabledPowerups[key] = powerups[key];
  }
});

export default enabledPowerups;
