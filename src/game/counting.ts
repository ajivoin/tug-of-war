import { constants } from './constants.ts';
import { getRandomInt } from '../lib/random.ts';
import { hitBoss, spawnBoss } from './boss.ts';
import type { BossState } from '../store/schema.ts';
import type { Store } from '../store/store.ts';

export type CountEffect =
  | { kind: 'coins'; amount: number }
  | { kind: 'acrobatics' }
  | { kind: 'boss-spawned'; boss: BossState }
  | { kind: 'boss-hit'; crit: boolean; killed: boolean; boss: BossState }
  | { kind: 'milestone'; emoji: string };

export type CountOutcome =
  | { kind: 'ignored' }
  | { kind: 'repeat-counter' }
  | { kind: 'wrong-number' }
  | { kind: 'counted'; effects: CountEffect[] }
  | { kind: 'win'; target: number; newTarget: number; effects: CountEffect[] };

/**
 * The core counting loop, lifted out of the message handler. Returns effects
 * rather than reacting to a message, so it can be exercised without Discord.
 * `rng` is injectable to make the probabilistic branches deterministic.
 */
export const countNumber = (
  store: Store,
  userId: string,
  value: number,
  rng: () => number = Math.random,
): CountOutcome => {
  store.ensureUser(userId);

  if (store.getLastUserId() === userId) {
    store.incrementMiscount(userId);
    store.removeCoins(userId, constants.COIN_LOSS);
    return { kind: 'repeat-counter' };
  }

  if (Math.abs(value - store.getNumber()) !== 1) {
    store.setLastUserId(userId);
    store.incrementMiscount(userId);
    store.removeCoins(userId, constants.COIN_LOSS);
    return { kind: 'wrong-number' };
  }

  store.incrementCount(userId);
  store.setNumber(value);

  const effects: CountEffect[] = [];

  if (Math.abs(value) === store.getTarget()) {
    const target = store.getTarget();
    store.incrementWins(userId);
    store.addCrowns(userId, constants.CROWN_MULTIPLIER * (1 + store.getRoyalty(userId)));
    store.setTarget(getRandomInt(0, constants.WIN));
    store.clearLastUserId();
    return {
      kind: 'win', target, newTarget: store.getTarget(), effects,
    };
  }

  if (rng() <= constants.ACROBATICS_RATE * store.getAcrobatics(userId)) {
    effects.push({ kind: 'acrobatics' });
    store.clearLastUserId();
  } else if (Math.abs(Math.abs(value) - store.getTarget()) > 1) {
    store.setLastUserId(userId);
  } else {
    store.clearLastUserId();
  }

  if (store.getBoss()) {
    const hit = hitBoss(store, userId, rng);
    effects.push({
      kind: 'boss-hit', crit: hit.crit, killed: hit.killed, boss: hit.boss,
    });
    if (hit.killed) store.incrementBossKills(userId);
  } else if (rng() < constants.BOSS_SPAWN_RATE) {
    effects.push({ kind: 'boss-spawned', boss: spawnBoss(store, rng) });
  }

  if (rng() <= constants.COIN_RATE) {
    const amount = constants.COIN_GAIN * getRandomInt(2, 10);
    store.addCoins(userId, amount);
    effects.push({ kind: 'coins', amount });
  }

  const absolute = Math.abs(store.getNumber());
  if (absolute === 69) effects.push({ kind: 'milestone', emoji: '😎' });
  else if (absolute === 100) effects.push({ kind: 'milestone', emoji: '💯' });

  return { kind: 'counted', effects };
};
