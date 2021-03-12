const powerups = {
  crowncard: {
    price: 110,
    description: 'Convert coins back into a crown at a premium.',
    enabled: true,
  },
  sneak: {
    price: 20,
    description: 'Say a number again without getting timed out.',
    enabled: true,
  },
  reroll: {
    price: 25,
    description: 'Reroll the target number.',
    enabled: true,
  },
  teleport: {
    price: 25,
    description: 'Moves the current number far away.',
    enabled: true,
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
    price: 0,
    description: '0',
    enabled: false,
  },
};

export default powerups;