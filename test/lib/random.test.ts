import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getRandomInt, sample } from '../../src/lib/random.ts';

describe('random', () => {
  test('getRandomInt stays within [min, max)', () => {
    for (let i = 0; i < 1000; i += 1) {
      const n = getRandomInt(5, 10);
      assert.ok(n >= 5 && n < 10, `${n} out of range`);
    }
  });

  test('sample returns undefined for an empty array', () => {
    assert.equal(sample([]), undefined);
  });

  test('sample returns a member of the array', () => {
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i += 1) {
      assert.ok(items.includes(sample(items)!));
    }
  });
});
