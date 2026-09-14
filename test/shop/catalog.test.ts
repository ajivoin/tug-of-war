import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { powerups, enabledPowerups } from '../../src/shop/powerups.ts';
import { skins, enabledSkins } from '../../src/shop/skins.ts';
// Legacy JS modules; deleted in the final task along with this test.
import legacyPowerups, { powerups as legacyAllPowerups } from '../../util/shop/items/powerups.js';
import legacySkins, { skins as legacyAllSkins } from '../../util/shop/items/skins.js';

describe('catalog port fidelity', () => {
  test('every powerup is byte-identical to the legacy catalog', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(powerups)), legacyAllPowerups);
  });

  test('every skin is byte-identical to the legacy catalog', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(skins)), legacyAllSkins);
  });

  test('the enabled filters match legacy exactly', () => {
    assert.deepEqual(Object.keys(enabledPowerups).sort(), Object.keys(legacyPowerups).sort());
    assert.deepEqual(Object.keys(enabledSkins).sort(), Object.keys(legacySkins).sort());
  });

  test('retired entries are retained as a seasonal catalog', () => {
    assert.ok(Object.keys(skins).length > Object.keys(enabledSkins).length);
    assert.equal(Object.keys(skins).length, 45);
    assert.equal(Object.keys(powerups).length, 11);
  });
});
