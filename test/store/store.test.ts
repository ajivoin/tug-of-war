import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../../src/store/store.ts';
import { loadState, saveState } from '../../src/store/json-file.ts';
import { createState } from '../../src/store/schema.ts';

const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'tow-store-'));

describe('store', () => {
  test('B2: loadState is synchronous - state is usable on the next line', () => {
    const dir = tmp();
    const file = path.join(dir, 'data.json');
    saveState(file, { ...createState(), number: 42 });
    const state = loadState(file);
    assert.equal(state.number, 42, 'no tick required, unlike legacy data.js');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('loadState returns a default state when the file is missing', () => {
    const dir = tmp();
    const state = loadState(path.join(dir, 'nope.json'));
    assert.deepEqual(state.users, {});
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('loadState survives a corrupt file rather than crashing on boot', () => {
    const dir = tmp();
    const file = path.join(dir, 'data.json');
    fs.writeFileSync(file, '{ not valid json');
    assert.deepEqual(loadState(file).users, {});
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('B1: setTarget rejects a non-integer', () => {
    const store = createStore(createState());
    const before = store.getTarget();
    store.setTarget(Number.NaN);
    assert.equal(store.getTarget(), before, 'unchanged - the guard actually runs now');
  });

  test('B3: getCoins returns 0 for an unknown user instead of undefined', () => {
    const store = createStore(createState());
    assert.equal(store.getCoins('ghost'), 0);
  });

  test('the upgrade getters are safe for unknown users, unlike legacy', () => {
    const store = createStore(createState());
    assert.equal(store.getCritBonus('ghost'), 0);
    assert.equal(store.getAcrobatics('ghost'), 0);
    assert.equal(store.getRoyalty('ghost'), 0);
  });

  test('removeCoins floors at zero (preserved from legacy)', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCoins('u', 10);
    store.removeCoins('u', 50);
    assert.equal(store.getCoins('u'), 0);
  });

  test('reads are frozen - mutation through a getter is impossible', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    const user = store.getUser('u');
    assert.ok(user);
    assert.throws(() => { (user as { coins: number }).coins = 999; });
    assert.equal(store.getCoins('u'), 0, 'closes the gap characterized in the legacy suite');
  });

  test('incrementBossKills replaces the direct field write from index.js', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.incrementBossKills('u');
    assert.equal(store.getUser('u')?.boss, 1);
  });

  test('hazard 1: stop() releases the flush timer so the process can exit', () => {
    const store = createStore(createState(), { flushMs: 60_000 });
    store.stop();
    assert.ok(true, 'if this suite exits without --test-force-exit, the timer was released');
  });

  test('a full round-trip through disk preserves state', () => {
    const dir = tmp();
    const file = path.join(dir, 'data.json');
    const store = createStore(createState(), { file });
    store.ensureUser('u');
    store.addCrowns('u', 7);
    store.setNumber(13);
    store.flush();
    store.stop();
    const reloaded = loadState(file);
    assert.equal(reloaded.users.u?.crowns, 7);
    assert.equal(reloaded.number, 13);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('selectReaction disables all others (preserved from legacy)', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.selectReaction('u', 'pumpkin');
    store.selectReaction('u', 'skeleton');
    const reactions = store.getReactions('u');
    assert.equal(reactions.skeleton, true);
    assert.equal(reactions.pumpkin, false);
    assert.equal(reactions.default, false);
  });
});
