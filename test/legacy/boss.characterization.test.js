import {
  test, describe, before, after,
} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let tmpDir; let data; let Boss;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tow-boss-'));
  process.env.DATA_FILE = path.join(tmpDir, 'data.json');
  process.env.DISCORD_TOKEN = 'test-token';
  data = (await import('../../util/data.js')).default;
  Boss = (await import('../../util/bosses.js')).default;
  await new Promise(setImmediate);
});

after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

describe('legacy boss', () => {
  test('getCritBonus throws for an unknown user, unlike getCoins', () => {
    // Unreachable in production because index.js creates the user on every
    // message, but it means the upgrade getters are unsafe where getCoins is not.
    assert.throws(() => data.getCritBonus('never-seen'), TypeError);
  });

  test('hit reduces health by BASE_DAMAGE and records the participant', () => {
    Boss.instance = null;
    data.createUser('p1');
    const boss = Boss.instantiate();
    const healthBefore = boss.health;
    boss.hit('p1', () => {});
    assert.ok(boss.health < healthBefore);
    assert.ok(boss.participants.p1 > 0);
  });

  test('rewards divide in proportion to damage dealt', () => {
    Boss.instance = null;
    const boss = Boss.instantiate();
    boss.totalHealth = 1000;
    boss.rewards = { crowns: 100 };
    boss.participants = { a: 750, b: 250 };
    assert.deepEqual(boss.calculateReward('a'), { crowns: 75 });
    assert.deepEqual(boss.calculateReward('b'), { crowns: 25 });
  });

  test('B7: killing via hit() leaves the dead boss persisted', () => {
    Boss.instance = null;
    data.createUser('p1');
    const boss = Boss.instantiate();
    data.persistBoss(boss);
    boss.health = 1;
    boss.hit('p1', () => {});
    assert.equal(Boss.instance, null, 'in-memory singleton is cleared');
    // ...but the persisted copy is not, so a restart resurrects it.
    assert.notEqual(data.getBoss(), null, 'documents the defect the new design fixes');
    assert.ok(data.getBoss().health <= 0, 'a zombie with non-positive health');
  });

  test('bomb() DOES clear the persisted boss, unlike hit()', () => {
    Boss.instance = null;
    data.createUser('p1');
    const boss = Boss.instantiate();
    boss.health = 1;
    boss.bomb('p1');
    assert.equal(data.getBoss(), null, 'documents the inconsistency between the two kill paths');
  });
});
