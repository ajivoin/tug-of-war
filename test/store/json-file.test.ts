import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadState, saveState } from '../../src/store/json-file.ts';
import { createState } from '../../src/store/schema.ts';

const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'tow-json-'));

describe('json-file', () => {
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
});
