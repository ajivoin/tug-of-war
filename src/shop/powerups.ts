export interface ShopItem {
  price: number;
  description: string;
  enabled: boolean;
  quantified?: boolean;
}

export const powerups = {
  crowncard: {
    price: 110,
    description: "💳 Convert coins back into a crown at a premium.",
    quantified: true,
    enabled: true,
  },
  sneak: {
    price: 60,
    description: "🤫 Sneakily move towards the target number.",
    quantified: false,
    enabled: true,
  },
  reroll: {
    price: 50,
    description: "🎲 Reroll the target number.",
    enabled: true,
  },
  teleport: {
    price: 25,
    description: "🧙‍♂️ Moves the current number far, far away.",
    enabled: false,
  },
  sqrt: {
    price: 50,
    description: "🤏 Square roots the current number.",
    enabled: true,
  },
  nice: {
    price: 69,
    description: "😎 Nice.",
    enabled: true,
  },
  zero: {
    price: 50,
    description: "0️⃣",
    enabled: false,
  },
  bomb: {
    price: 1000,
    description: "Deal significant damage to the boss.",
    quantified: false,
    enabled: false,
  },
  crit: {
    price: 3000,
    description: "💓 Permanently increase your crit chance (up to 5 times).",
    quantified: false,
    enabled: true,
  },
  acrobatics: {
    price: 2500,
    description: "👟 Permanently increase your chance to be able to count two numbers in a row (up to 5 times).",
    quantified: false,
    enabled: true,
  },
  royalty: {
    price: 5000,
    description: "👑 Permanently gain an extra crown each time you win (up to 4 times).",
    quantified: false,
    enabled: true,
  },
} as const satisfies Record<string, ShopItem>;

export const enabledPowerups: Record<string, ShopItem> = Object.fromEntries(
  Object.entries(powerups).filter(([, item]) => item.enabled),
);
