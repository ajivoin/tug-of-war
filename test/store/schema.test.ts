import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseState, createUser, createState } from '../../src/store/schema.ts';

describe('parseState', () => {
  test('fills upgrade fields absent from legacy saves', () => {
    const legacy = {
      number: 1,
      users: {
        '110521207291428864': {
          count: 1, wins: 0, crowns: 0, coins: 0, miscount: 0, boss: 0, reactions: { default: true },
        },
      },
      last: '110521207291428864',
      channel: '1027691912431415316',
      win: 97,
      correctEmoji: '✅',
      incorrectEmoji: '👎',
      timeoutEmoji: '⏳',
    };
    const state = parseState(legacy);
    const user = state.users['110521207291428864']!;
    assert.equal(user.critBonus, 0);
    assert.equal(user.acrobatics, 0);
    assert.equal(user.royalty, 0);
    assert.equal(user.count, 1, 'existing values are preserved');
  });

  test('preserves a persisted boss', () => {
    const state = parseState({
      ...createState(),
      boss: {
        level: 3,
        rewards: { crowns: 45 },
        health: 30000,
        totalHealth: 30000,
        participants: {},
        imagePath: 'assets/boss-images/500_troll.png',
        imageName: '500_troll.png',
        bossName: 'Troll',
      },
    });
    assert.ok(state.boss);
    assert.equal(state.boss.bossName, 'Troll');
    assert.equal(state.boss.health, 30000);
  });

  test('B7 defense: a boss with non-positive health is discarded on load', () => {
    const deadBoss = {
      level: 1,
      health: 0,
      totalHealth: 100,
      rewards: { crowns: 15 },
      participants: { a: 100 },
      imagePath: 'x',
      imageName: 'x',
      bossName: 'X',
    };
    const state = parseState({ ...createState(), boss: deadBoss });
    assert.equal(state.boss, null, 'a dead boss never survives a restart');
  });

  test('an empty or malformed input yields a valid default state', () => {
    assert.deepEqual(parseState(null).users, {});
    assert.deepEqual(parseState('garbage').users, {});
    assert.equal(typeof parseState(undefined).win, 'number');
  });

  test('createUser has every field required and defaulted', () => {
    const u = createUser();
    assert.equal(u.critBonus, 0);
    assert.equal(u.acrobatics, 0);
    assert.equal(u.royalty, 0);
    assert.deepEqual(u.reactions, { default: true });
  });
});
