import {
  test, describe, before, after,
} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// B2: util/data.js assigns state inside an async fs.stat callback, which goes
// to the libuv threadpool. A macrotask tick does not reliably win that race
// under parallel test load, so poll until state actually exists.
const waitForLegacyLoad = async (mod) => {
  for (let i = 0; i < 400; i += 1) {
    // Throws while the module-level `data` is still undefined - that IS the race.
    try {
      if (mod.getCurrentNumber() !== undefined) return;
    } catch { /* not loaded yet */ }
    await new Promise((r) => { setTimeout(r, 5); });
  }
  throw new Error('legacy data.js never finished loading');
};

let tmpDir;
let data;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tow-test-'));
  process.env.DATA_FILE = path.join(tmpDir, 'data.json');
  process.env.DISCORD_TOKEN = 'test-token';
  data = (await import('../../util/data.js')).default;
  await waitForLegacyLoad(data);
});

after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

describe('legacy data', () => {
  test('createUser produces the documented schema', () => {
    data.createUser('u1');
    const u = data.getUser('u1');
    assert.equal(u.count, 0);
    assert.equal(u.coins, 0);
    assert.equal(u.crowns, 0);
    assert.equal(u.boss, 0);
    assert.deepEqual(u.reactions, { default: true });
    // Documents that critBonus/acrobatics/royalty are absent, not zero.
    assert.equal(u.critBonus, undefined);
  });

  test('removeCoins floors at zero rather than going negative', () => {
    data.createUser('u2');
    data.addCoins('u2', 10);
    data.removeCoins('u2', 50);
    assert.equal(data.getCoins('u2'), 0);
  });

  test('removeCrowns does NOT floor at zero', () => {
    data.createUser('u3');
    data.removeCrowns('u3', 5);
    // Asymmetry with removeCoins. Characterized, not fixed.
    assert.equal(data.getCrowns('u3'), -5);
  });

  test('B1: setTargetNumber accepts a non-integer because Number.isInteger is uncalled', () => {
    data.setTargetNumber('not a number');
    assert.equal(data.getTargetNumber(), 'not a number');
  });

  test('B3: getCoins returns undefined for a missing user and reports via the outer branch', () => {
    let message = null;
    const result = data.getCoins('nonexistent', (m) => { message = m; });
    // The returned value is undefined, not 0 - the new store changes this to 0.
    assert.equal(result, undefined);
    // The OUTER errorCallback does fire. What is dead is the errorCallback
    // threaded into getUser(userId, errorCallback), since getUser takes one
    // parameter and ignores the second. That is unobservable from here.
    assert.match(message, /has no coins attribute/);
  });

  test('B3: getUser ignores the second argument entirely', () => {
    let called = false;
    data.getUser('nonexistent', () => { called = true; });
    assert.equal(called, false, 'the argument getCoins threads in is dead');
  });

  test('selectReaction disables all others', () => {
    data.createUser('u4');
    data.enableReaction('u4', 'pumpkin');
    data.selectReaction('u4', 'skeleton');
    const { reactions } = data.getUser('u4');
    assert.equal(reactions.skeleton, true);
    assert.equal(reactions.pumpkin, false);
    assert.equal(reactions.default, false);
  });

  test('getUser returns a live mutable reference', () => {
    data.createUser('u5');
    data.getUser('u5').coins = 999;
    // Documents the encapsulation gap the new store closes.
    assert.equal(data.getCoins('u5'), 999);
  });
});
