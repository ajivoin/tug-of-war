import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../src/store/store.ts';
import { createState, type BossState } from '../../src/store/schema.ts';
import { buy } from '../../src/shop/shop.ts';
import { constants } from '../../src/game/constants.ts';

const boss = (health: number): BossState => ({
  level: 1,
  health,
  totalHealth: health,
  rewards: { crowns: 100, coins: 0 },
  participants: {},
  imagePath: 'x',
  imageName: 'x',
  bossName: 'Troll',
});

describe('shop', () => {
  test('insufficient coins does not charge', () => {
    const store = createStore(createState());
    store.ensureUser('poor');
    const result = buy(store, 'poor', 'reroll');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'NOT_ENOUGH_COINS');
    assert.equal(store.getCoins('poor'), 0);
  });

  test('an unknown item reports UNKNOWN_ITEM instead of failing silently', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCoins('u', 10000);
    const result = buy(store, 'u', 'not-a-real-item');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'UNKNOWN_ITEM');
    assert.equal(store.getCoins('u'), 10000, 'no charge');
  });

  test('crit caps at MAX_CRIT_LEVEL and does not charge at the cap', () => {
    const store = createStore(createState());
    store.ensureUser('rich');
    store.addCoins('rich', 100000);
    for (let i = 0; i < constants.MAX_CRIT_LEVEL; i += 1) {
      assert.equal(buy(store, 'rich', 'crit').ok, true);
    }
    const atCap = store.getCoins('rich');
    const result = buy(store, 'rich', 'crit');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'MAX_LEVEL');
    assert.equal(store.getCoins('rich'), atCap, 'no net charge at the cap');
    assert.equal(store.getCritBonus('rich'), constants.MAX_CRIT_LEVEL);
  });

  test('crowncard quantity multiplies price and crowns alike', () => {
    const store = createStore(createState());
    store.ensureUser('q');
    store.addCoins('q', 1000);
    const result = buy(store, 'q', 'crowncard', '3');
    assert.equal(result.ok, true);
    assert.equal(store.getCrowns('q'), 3);
    assert.equal(store.getCoins('q'), 1000 - 330);
  });

  test('crowncard max spends as much as affordable', () => {
    const store = createStore(createState());
    store.ensureUser('q');
    store.addCoins('q', 1000);
    assert.equal(buy(store, 'q', 'crowncard', 'max').ok, true);
    assert.equal(store.getCrowns('q'), 9, 'floor(1000 / 110)');
    assert.equal(store.getCoins('q'), 1000 - 990);
  });

  test('B6: bomb is disabled in the catalog, so it is not purchasable today', () => {
    // This is why B6 stayed latent. The charge-ordering fix below is what makes
    // re-enabling bomb safe; the legacy code would have reported failure on a
    // successful bomb and charged for one with no boss.
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCoins('u', 10000);
    store.setBoss(boss(constants.BOMB_DAMAGE * 3));
    const result = buy(store, 'u', 'bomb');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'UNKNOWN_ITEM');
    assert.equal(store.getCoins('u'), 10000);
  });

  test('B6 structural fix: a failed effect never charges', () => {
    // buy() applies the effect first and charges only on success, so no error
    // path can take coins. Exercised here through the reachable MAX_LEVEL path,
    // which shares the exact code path bomb's NO_ACTIVE_BOSS would take.
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCoins('u', 100000);
    store.setRoyalty('u', constants.MAX_ROYALTY_LEVEL);
    const before = store.getCoins('u');
    const result = buy(store, 'u', 'royalty');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'MAX_LEVEL');
    assert.equal(store.getCoins('u'), before, 'the error path cannot charge');
  });

  test('buying a skin equips it and charges once', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCoins('u', 5000);
    const result = buy(store, 'u', 'pumpkin');
    assert.equal(result.ok, true);
    assert.equal(result.value.kind, 'skin');
    assert.equal(store.getReactions('u').pumpkin, true);
    assert.equal(store.getCoins('u'), 5000 - 1031);
  });

  test('re-buying an owned skin reports ALREADY_OWNED without charging', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCoins('u', 5000);
    buy(store, 'u', 'pumpkin');
    const afterFirst = store.getCoins('u');
    const result = buy(store, 'u', 'pumpkin');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'ALREADY_OWNED');
    assert.equal(store.getCoins('u'), afterFirst, 'no double charge');
  });

  test('a disabled catalog item is not purchasable', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCoins('u', 100000);
    const result = buy(store, 'u', 'teleport');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'UNKNOWN_ITEM');
  });
});
