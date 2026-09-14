import { test } from 'node:test';
import assert from 'node:assert/strict';
import { constants } from '../../src/game/constants.ts';
// Legacy JS module; this test and the import are deleted in the final task.
import legacy from '../../util/constants.js';

test('constants are byte-identical to the legacy values', () => {
  assert.deepEqual({ ...constants }, legacy);
});
