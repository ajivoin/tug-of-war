import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../src/store/store.ts';
import { createState } from '../../src/store/schema.ts';
import { countNumber } from '../../src/game/counting.ts';
import { constants } from '../../src/game/constants.ts';

const never = (): number => 1; // no probabilistic branch fires
const always = (): number => 0; // every probabilistic branch fires

describe('counting', () => {
  test('a correct number advances the count', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.setNumber(5);
    store.setTarget(100);
    const outcome = countNumber(store, 'u', 6, never);
    assert.equal(outcome.kind, 'counted');
    assert.equal(store.getNumber(), 6);
    assert.equal(store.getUser('u')?.count, 1);
  });

  test('counting down is equally valid', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.setNumber(5);
    store.setTarget(100);
    countNumber(store, 'u', 4, never);
    assert.equal(store.getNumber(), 4);
  });

  test('two counts in a row cost COIN_LOSS and do not advance', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCoins('u', 100);
    store.setNumber(5);
    store.setTarget(100);
    countNumber(store, 'u', 6, never);
    const outcome = countNumber(store, 'u', 7, never);
    assert.equal(outcome.kind, 'repeat-counter');
    assert.equal(store.getNumber(), 6, 'number did not advance');
    assert.equal(store.getCoins('u'), 100 - constants.COIN_LOSS);
    assert.equal(store.getUser('u')?.miscount, 1);
  });

  test('a wrong number costs COIN_LOSS and increments miscount', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCoins('u', 100);
    store.setNumber(5);
    store.setTarget(100);
    const outcome = countNumber(store, 'u', 99, never);
    assert.equal(outcome.kind, 'wrong-number');
    assert.equal(store.getCoins('u'), 100 - constants.COIN_LOSS);
    assert.equal(store.getUser('u')?.miscount, 1);
    assert.equal(store.getNumber(), 5, 'unchanged');
  });

  test('reaching the target wins, pays crowns, and rerolls', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.setNumber(9);
    store.setTarget(10);
    const outcome = countNumber(store, 'u', 10, never);
    assert.equal(outcome.kind, 'win');
    assert.equal(store.getUser('u')?.wins, 1);
    assert.equal(store.getCrowns('u'), constants.CROWN_MULTIPLIER);
    assert.equal(store.getLastUserId(), null, 'the winner may count again');
  });

  test('the negative target also wins', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.setNumber(-9);
    store.setTarget(10);
    assert.equal(countNumber(store, 'u', -10, never).kind, 'win');
  });

  test('royalty adds a crown per level on a win', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.setRoyalty('u', 3);
    store.setNumber(9);
    store.setTarget(10);
    countNumber(store, 'u', 10, never);
    assert.equal(store.getCrowns('u'), constants.CROWN_MULTIPLIER * 4);
  });

  test('coin drops fire when the roll succeeds', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.setNumber(5);
    store.setTarget(100);
    const outcome = countNumber(store, 'u', 6, always);
    assert.equal(outcome.kind, 'counted');
    assert.ok(store.getCoins('u') > 0);
    assert.ok(outcome.effects.some((e) => e.kind === 'coins'));
  });

  test('acrobatics clears the last counter so the same user may count again', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.setAcrobatics('u', constants.MAX_ACRO_LEVEL);
    store.setNumber(5);
    store.setTarget(100);
    const outcome = countNumber(store, 'u', 6, always);
    assert.equal(outcome.kind, 'counted');
    assert.ok(outcome.effects.some((e) => e.kind === 'acrobatics'));
    assert.equal(store.getLastUserId(), null);
  });

  test('a boss spawns when no boss is active and the roll succeeds', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.setNumber(5);
    store.setTarget(100);
    const outcome = countNumber(store, 'u', 6, always);
    assert.equal(outcome.kind, 'counted');
    assert.ok(outcome.effects.some((e) => e.kind === 'boss-spawned'));
    assert.ok(store.getBoss());
  });

  test('an active boss takes damage instead of a new one spawning', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.setNumber(5);
    store.setTarget(100);
    store.setBoss({
      level: 1,
      health: 100_000,
      totalHealth: 100_000,
      rewards: { crowns: 15, coins: 0 },
      participants: {},
      imagePath: 'x',
      imageName: 'x',
      bossName: 'X',
    });
    const outcome = countNumber(store, 'u', 6, always);
    assert.equal(outcome.kind, 'counted');
    assert.ok(outcome.effects.some((e) => e.kind === 'boss-hit'));
    assert.ok(!outcome.effects.some((e) => e.kind === 'boss-spawned'));
    assert.ok((store.getBoss()?.health ?? 0) < 100_000);
  });

  test('killing a boss by counting credits the kill exactly once', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.setNumber(5);
    store.setTarget(100);
    store.setBoss({
      level: 1,
      health: constants.BASE_DAMAGE,
      totalHealth: constants.BASE_DAMAGE,
      rewards: { crowns: 15, coins: 0 },
      participants: {},
      imagePath: 'x',
      imageName: 'x',
      bossName: 'X',
    });
    const outcome = countNumber(store, 'u', 6, never);
    assert.equal(outcome.kind, 'counted');
    assert.ok(outcome.effects.some((e) => e.kind === 'boss-hit' && e.killed));
    assert.equal(store.getUser('u')?.boss, 1);
    assert.equal(store.getBoss(), null, 'B7: no zombie left behind');
  });

  test('milestone reactions fire at 69 and 100', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.setTarget(500);
    store.setNumber(68);
    const at69 = countNumber(store, 'u', 69, never);
    assert.equal(at69.kind, 'counted');
    assert.ok(at69.effects.some((e) => e.kind === 'milestone' && e.emoji === '😎'));

    store.setNumber(99);
    store.clearLastUserId();
    const at100 = countNumber(store, 'u', 100, never);
    assert.equal(at100.kind, 'counted');
    assert.ok(at100.effects.some((e) => e.kind === 'milestone' && e.emoji === '💯'));
  });

  test('a user the store has never seen is created on first count', () => {
    const store = createStore(createState());
    store.setNumber(5);
    store.setTarget(100);
    countNumber(store, 'brand-new', 6, never);
    assert.ok(store.hasUser('brand-new'));
    assert.equal(store.getUser('brand-new')?.count, 1);
  });
});
