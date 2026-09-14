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

let tmpDir; let data; let shop;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tow-shop-'));
  process.env.DATA_FILE = path.join(tmpDir, 'data.json');
  process.env.DISCORD_TOKEN = 'test-token';
  data = (await import('../../util/data.js')).default;
  shop = (await import('../../util/shop/shop.js')).default;
  await waitForLegacyLoad(data);
});

after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

describe('legacy shop', () => {
  test('insufficient coins does not charge and reports an error', () => {
    data.createUser('poor');
    let error = null;
    shop.buy('poor', 'reroll', undefined, () => {}, (e) => { error = e; });
    assert.equal(data.getCoins('poor'), 0);
    assert.match(error, /enough coins/);
  });

  test('crit caps at MAX_CRIT_LEVEL and refunds the purchase at the cap', () => {
    data.createUser('rich');
    data.addCoins('rich', 100000);
    for (let i = 0; i < 5; i += 1) shop.buy('rich', 'crit', undefined, () => {}, () => {});
    assert.equal(data.getCritBonus('rich'), 5);
    const coinsAtCap = data.getCoins('rich');
    shop.buy('rich', 'crit', undefined, () => {}, () => {});
    assert.equal(data.getCritBonus('rich'), 5, 'stays capped');
    assert.equal(data.getCoins('rich'), coinsAtCap, 'refunded, so net zero');
  });

  test('an unknown item is silently ignored', () => {
    data.createUser('u');
    data.addCoins('u', 10000);
    let touched = false;
    shop.buy('u', 'not-a-real-item', undefined, () => { touched = true; }, () => { touched = true; });
    assert.equal(touched, false, 'documents that neither callback fires - UNKNOWN_ITEM later');
    assert.equal(data.getCoins('u'), 10000);
  });

  test('crowncard quantity multiplies both price and crowns granted', () => {
    data.createUser('q');
    data.addCoins('q', 1000);
    shop.buy('q', 'crowncard', '3', () => {}, () => {});
    assert.equal(data.getCrowns('q'), 3);
    assert.equal(data.getCoins('q'), 1000 - (110 * 3));
  });
});
