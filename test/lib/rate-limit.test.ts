import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit } from '../../src/lib/rate-limit.ts';

describe('rateLimit', () => {
  test('invokes immediately on the first call', () => {
    let calls = 0;
    rateLimit(() => { calls += 1; }, 1000)();
    assert.equal(calls, 1);
  });

  test('suppresses calls inside the window', () => {
    let calls = 0;
    const limited = rateLimit(() => { calls += 1; }, 1000);
    limited(); limited(); limited();
    assert.equal(calls, 1);
  });

  test('allows a call again once the window has elapsed', async () => {
    let calls = 0;
    const limited = rateLimit(() => { calls += 1; }, 10);
    limited();
    await new Promise((r) => { setTimeout(r, 25); });
    limited();
    assert.equal(calls, 2);
  });

  test('forwards arguments', () => {
    const seen: string[] = [];
    rateLimit((s: string) => { seen.push(s); }, 1000)('hello');
    assert.deepEqual(seen, ['hello']);
  });
});
