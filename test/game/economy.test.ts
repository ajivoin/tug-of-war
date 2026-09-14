import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../src/store/store.ts';
import { createState } from '../../src/store/schema.ts';
import { convert, equip, equippedEmoji } from '../../src/game/economy.ts';
import { constants } from '../../src/game/constants.ts';

describe('convert', () => {
  test('a bare convert exchanges exactly one crown', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCrowns('u', 5);
    const result = convert(store, 'u');
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, { crownsSpent: 1, coinsGained: constants.CONVERSION_RATE });
    assert.equal(store.getCrowns('u'), 4);
    assert.equal(store.getCoins('u'), constants.CONVERSION_RATE);
  });

  test('converting more crowns than held reports NOT_ENOUGH_CROWNS', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCrowns('u', 2);
    const result = convert(store, 'u', '5');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'NOT_ENOUGH_CROWNS');
    assert.equal(store.getCrowns('u'), 2, 'unchanged');
    assert.equal(store.getCoins('u'), 0, 'unchanged');
  });

  test('"all" converts the entire balance', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCrowns('u', 7);
    const result = convert(store, 'u', 'all');
    assert.equal(result.ok, true);
    assert.equal(store.getCrowns('u'), 0);
    assert.equal(store.getCoins('u'), 7 * constants.CONVERSION_RATE);
  });

  test('"all" with no crowns reports NOT_ENOUGH_CROWNS rather than doing nothing', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    const result = convert(store, 'u', 'all');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'NOT_ENOUGH_CROWNS');
  });

  test('a non-numeric amount reports INVALID_AMOUNT', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCrowns('u', 5);
    const result = convert(store, 'u', 'banana');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'INVALID_AMOUNT');
  });

  test('a negative amount reports INVALID_AMOUNT rather than granting coins', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCrowns('u', 5);
    const result = convert(store, 'u', '-3');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'INVALID_AMOUNT');
    assert.equal(store.getCoins('u'), 0);
  });
});

describe('equip', () => {
  test('equipping an owned skin succeeds and deselects the rest', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.selectReaction('u', 'pumpkin');
    store.selectReaction('u', 'skeleton');
    const result = equip(store, 'u', 'pumpkin');
    assert.equal(result.ok, true);
    assert.equal(store.getReactions('u').pumpkin, true);
    assert.equal(store.getReactions('u').skeleton, false);
  });

  test('equipping an unowned skin reports NOT_OWNED', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    const result = equip(store, 'u', 'pumpkin');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'NOT_OWNED');
  });
});

describe('equippedEmoji', () => {
  test('maps the equipped skin id through the catalog', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.selectReaction('u', 'pumpkin');
    assert.equal(equippedEmoji(store, 'u', '✅'), '🎃');
  });

  test('falls back for the default skin and for unknown users', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    assert.equal(equippedEmoji(store, 'u', '✅'), '👑', 'default skin has its own emoji');
    assert.equal(equippedEmoji(store, 'ghost', '✅'), '✅');
  });
});
