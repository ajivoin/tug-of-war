import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStore } from '../../src/store/store.ts';
import { createState, type BossState } from '../../src/store/schema.ts';
import {
  spawnBoss, hitBoss, bombBoss, calculateReward, distributeRewards, rollBoss,
  BOSS_IMAGES, BOSS_BREAKPOINTS,
} from '../../src/game/boss.ts';
import { constants } from '../../src/game/constants.ts';

const fixedBoss = (over: Partial<BossState> = {}): BossState => ({
  level: 1,
  health: 1000,
  totalHealth: 1000,
  rewards: { crowns: 100, coins: 0 },
  participants: {},
  imagePath: 'x',
  imageName: 'x',
  bossName: 'X',
  ...over,
});

describe('boss', () => {
  test('B7 regression: killing via hitBoss clears the persisted boss', () => {
    const store = createStore(createState());
    store.ensureUser('p1');
    store.setBoss(fixedBoss({ health: constants.BASE_DAMAGE }));
    const result = hitBoss(store, 'p1');
    assert.equal(result.killed, true);
    assert.equal(store.getBoss(), null, 'no zombie survives to be resurrected');
  });

  test('B7 regression: rewards are paid exactly once', () => {
    const store = createStore(createState());
    store.ensureUser('p1');
    store.setBoss(fixedBoss({ health: constants.BASE_DAMAGE, totalHealth: constants.BASE_DAMAGE }));
    hitBoss(store, 'p1');
    const afterFirstKill = store.getCrowns('p1');
    assert.ok(afterFirstKill > 0, 'paid once');
    assert.equal(store.getBoss(), null, 'no boss left to hit, so no second payout is reachable');
    assert.equal(store.getCrowns('p1'), afterFirstKill);
  });

  test('hitBoss reduces health and records the participant', () => {
    const store = createStore(createState());
    store.ensureUser('p1');
    store.setBoss(fixedBoss());
    const result = hitBoss(store, 'p1');
    assert.equal(store.getBoss()?.health, 1000 - result.damage);
    assert.ok((store.getBoss()?.participants.p1 ?? 0) > 0);
  });

  test('hitBoss is safe for a user the store has never seen', () => {
    const store = createStore(createState());
    store.setBoss(fixedBoss());
    assert.doesNotThrow(() => hitBoss(store, 'never-seen'), 'legacy getCritBonus threw here');
  });

  test('rewards divide in proportion to damage dealt', () => {
    const boss = fixedBoss({ health: 0, participants: { a: 750, b: 250 } });
    assert.equal(calculateReward(boss, 'a').crowns, 75);
    assert.equal(calculateReward(boss, 'b').crowns, 25);
  });

  test('distributeRewards credits every participant', () => {
    const store = createStore(createState());
    store.ensureUser('a');
    store.ensureUser('b');
    distributeRewards(store, fixedBoss({ health: 0, participants: { a: 750, b: 250 } }));
    assert.equal(store.getCrowns('a'), 75);
    assert.equal(store.getCrowns('b'), 25);
  });

  test('bombBoss reports NO_ACTIVE_BOSS when there is none', () => {
    const store = createStore(createState());
    const result = bombBoss(store, 'u');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'NO_ACTIVE_BOSS');
  });

  test('bombBoss deals BOMB_DAMAGE and reports the kill', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.setBoss(fixedBoss({ health: constants.BOMB_DAMAGE }));
    const result = bombBoss(store, 'u');
    assert.equal(result.ok, true);
    assert.equal(result.value.killed, true);
    assert.equal(store.getBoss(), null);
  });

  test('spawnBoss persists immediately', () => {
    const store = createStore(createState());
    const boss = spawnBoss(store);
    assert.equal(store.getBoss()?.bossName, boss.bossName);
    assert.ok(boss.health > 0);
  });

  test('B11: every breakpoint tier rolls a valid boss, including the top 1%', () => {
    // BOSS_BREAKPOINTS has 6 tiers but the active roster has 5. Legacy indexed
    // IMAGE_PATH[5] -> undefined -> _.sample(undefined).split() -> TypeError,
    // throwing on ~1% of spawns and silently losing the boss.
    [0.1, 0.4, 0.7, 0.9, 0.97, 0.995, 0.9999].forEach((odds) => {
      const boss = rollBoss(() => odds);
      assert.ok(boss.bossName.length > 0, `odds=${odds} produced no name`);
      assert.ok(boss.health > 0, `odds=${odds} produced no health`);
      assert.ok(fs.existsSync(boss.imagePath), `odds=${odds} -> missing ${boss.imagePath}`);
    });
  });

  test('tier 6 has its own art, distinct from tier 5', () => {
    const tier5 = rollBoss(() => 0.97);
    const tier6 = rollBoss(() => 0.995);
    assert.equal(tier5.level, 5);
    assert.equal(tier6.level, 6);
    assert.notEqual(tier6.imagePath, tier5.imagePath, 'the rarest boss must look distinct');
  });

  test('BOSS_IMAGES covers every breakpoint, so the clamp is a safety net not a crutch', () => {
    assert.equal(BOSS_IMAGES.length, BOSS_BREAKPOINTS.length);
  });

  test('every image referenced by BOSS_IMAGES exists on disk', () => {
    BOSS_IMAGES.flat().forEach((p) => {
      assert.ok(fs.existsSync(p), `missing boss image: ${p}`);
    });
  });
});
