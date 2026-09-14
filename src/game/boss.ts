import path from 'node:path';
import { constants } from './constants.ts';
import { bossImage as image } from './boss-images.ts';
import { sample } from '../lib/random.ts';
import { ok, err, type Result } from '../lib/result.ts';
import type { BossState } from '../store/schema.ts';
import type { Store } from '../store/store.ts';

// Retired rosters are kept as a catalog of seasonal content, matching the
// convention used for disabled shop items.
//
// Original roster:
//   0_sunglasses 5_clown 6_poop | 1_ogre 2_monster 3_ghost |
//   9_cowboy 10_bezos 15_rock | 7_devil 8_goblin 401_prankster |
//   4_dragon 7_devil | 12_sun 13_moon
//
// Second roster:
//   17_snail 19_bloon 24_blurtle | 21_scorpion 30_monke 20_crab |
//   27_poodle 25_whale 29_fox | 16_crocodile 23_octopus |
//   2_monster 26_eagle | 22_whale 4_dragon

export const BOSS_IMAGES: readonly (readonly string[])[] = [
  [image('503_roach.png'), image('505_worm.png')],
  [image('501_bat.png'), image('502_owl.png'), image('504_spider.png')],
  [image('500_troll.png'), image('506_skeleton.png'), image('507_ogre.png'), image('510_zombie.png')],
  [image('508_ghost.png'), image('509_alien.png'), image('512_cat.png'), image('513_jack.png')],
  [image('511_floater.png')],
  // Tier 6 (odds > 0.99). Promoted from the retired rosters, where these were
  // the final tier. Before this existed the index ran off the end of the array
  // and ~1% of spawns threw.
  [image('12_sun.png'), image('13_moon.png'), image('4_dragon.png')],
];

export const REWARDS_POOL: readonly { crowns: number; coins: number }[] = [
  { crowns: 15, coins: 0 },
  { crowns: 30, coins: 0 },
  { crowns: 45, coins: 0 },
  { crowns: 60, coins: 0 },
  { crowns: 75, coins: 0 },
  { crowns: 100, coins: 0 },
];

export const HEALTH_MULTIPLIER = 100 * constants.BASE_DAMAGE;

export const BOSS_BREAKPOINTS: readonly number[] = [0.30, 0.55, 0.80, 0.95, 0.99, 1.0];

export const levelText = (level: number): string => (level <= 5 ? '⭐'.repeat(level) : '💀'.repeat(level - 5));

/** Rolls a new boss. Balance identical to the legacy constructor. */
export const rollBoss = (rng: () => number = Math.random): BossState => {
  const odds = rng();
  let bp = 0;
  while (bp < BOSS_BREAKPOINTS.length - 1 && odds > BOSS_BREAKPOINTS[bp]!) bp += 1;

  const level = bp + 1;
  const health = level <= 5
    ? level * HEALTH_MULTIPLIER
    : level * HEALTH_MULTIPLIER * 1.5;

  const roster = BOSS_IMAGES[Math.min(bp, BOSS_IMAGES.length - 1)]!;
  const imagePath = sample(roster) ?? roster[0]!;
  const imageName = path.basename(imagePath);
  const rawName = imageName.split(/[_.]/)[1] ?? 'boss';
  const bossName = rawName[0]!.toUpperCase() + rawName.slice(1);

  return {
    level,
    health,
    totalHealth: health,
    rewards: REWARDS_POOL[Math.min(bp, REWARDS_POOL.length - 1)]!,
    participants: {},
    imagePath,
    imageName,
    bossName,
  };
};

export const spawnBoss = (store: Store, rng: () => number = Math.random): BossState => {
  const boss = rollBoss(rng);
  store.setBoss(boss);
  return boss;
};

export const calculateReward = (boss: BossState, userId: string): { crowns: number; coins: number } => {
  const ratio = (boss.participants[userId] ?? 0) / boss.totalHealth;
  return {
    crowns: Math.ceil(ratio * boss.rewards.crowns),
    coins: Math.ceil(ratio * boss.rewards.coins),
  };
};

export const distributeRewards = (store: Store, boss: BossState): void => {
  Object.keys(boss.participants).forEach((userId) => {
    const reward = calculateReward(boss, userId);
    if (reward.crowns > 0) store.addCrowns(userId, reward.crowns);
    if (reward.coins > 0) store.addCoins(userId, reward.coins);
  });
};

/**
 * Applies damage and settles the kill in one place. Every exit path writes the
 * boss back through the store, so the two-sources-of-truth drift that let a
 * dead boss persist and pay rewards twice (B7) is unrepresentable.
 */
const applyDamage = (
  store: Store,
  userId: string,
  damage: number,
): { killed: boolean; boss: BossState } => {
  const current = store.getBoss()!;
  const boss: BossState = {
    ...current,
    health: current.health - damage,
    participants: { ...current.participants, [userId]: (current.participants[userId] ?? 0) + damage },
  };

  if (boss.health <= 0) {
    distributeRewards(store, boss);
    store.addCrowns(userId, 5 + store.getRoyalty(userId)); // last-hit bonus
    store.setBoss(null);
    return { killed: true, boss };
  }

  store.setBoss(boss);
  return { killed: false, boss };
};

export const hitBoss = (
  store: Store,
  userId: string,
  rng: () => number = Math.random,
): { damage: number; crit: boolean; killed: boolean; boss: BossState } => {
  const crit = rng() < constants.CRIT_RATE + store.getCritBonus(userId) * constants.CRIT_BONUS;
  const damage = constants.BASE_DAMAGE * (crit ? constants.CRIT_MULTIPLIER : 1);
  const { killed, boss } = applyDamage(store, userId, damage);
  return {
    damage, crit, killed, boss,
  };
};

export const bombBoss = (
  store: Store,
  userId: string,
): Result<{ bossName: string; killed: boolean }, { code: 'NO_ACTIVE_BOSS' }> => {
  const current = store.getBoss();
  if (!current) return err({ code: 'NO_ACTIVE_BOSS' as const });
  const { bossName } = current;
  const { killed } = applyDamage(store, userId, constants.BOMB_DAMAGE);
  return ok({ bossName, killed });
};
