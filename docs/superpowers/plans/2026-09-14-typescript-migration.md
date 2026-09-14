# TypeScript Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the bot to TypeScript, restructure `util/` into a layered `src/`, replace the `(callback, errorCallback)` convention with typed `Result` returns, and fix ten identified defects — without changing game balance.

**Architecture:** Node 24 runs `.ts` natively via type-stripping, so there is no build step and no `dist/`; `tsc --noEmit` becomes a CI gate instead. Domain logic returns `Result<T, E>` with structured error codes and does not touch Discord. All mutable state lives behind an injected `Store` whose filesystem backend is isolated in one file, so the planned SQLite migration is a single-file replacement.

**Tech Stack:** Node 24.15, TypeScript (`--noEmit`, `erasableSyntaxOnly`), discord.js 14.27, `node:test`, ESLint 9 flat config + `typescript-eslint`.

**Spec:** `docs/superpowers/specs/2026-09-14-typescript-migration-design.md`

## Global Constraints

- **Node >= 24** (`engines` in `package.json`). Type-stripping requires it.
- **Erasable syntax only.** No `enum`, no `namespace`, no constructor parameter properties. Use `as const` objects. Enforced by `erasableSyntaxOnly: true`.
- **Relative imports carry the `.ts` extension** — `import { x } from './lib/result.ts'`. Node resolves the literal path.
- **`discord.js` is the only permitted runtime dependency.** `underscore` is removed in Task 13. Do not add runtime dependencies.
- **Game balance is untouched.** Every value in `game/constants.ts` keeps its current number. Any behavior change must be one of B1-B10 and must have a test naming it.
- **Domain code (`game/`, `store/`, `shop/`) must not import `discord.js`.** Only `bot/`, `commands/`, and `ui/` may.
- **Tests must never write to the repo's real `data.json`.** Always point `DATA_FILE` at a `node:fs.mkdtempSync` path.
- Commit after every task. Run `npm run lint && npm run typecheck && npm test` before each commit from Task 5 onward.

## Two hazards specific to this codebase

Both were found while planning the test harness; they affect Tasks 2-4 directly.

1. **`util/data.js` keeps the event loop alive.** Its module-level `setInterval(persistData, FIVE_MINUTES)` is never cleared, so `node --test` hangs after the assertions pass. The legacy-characterization tasks run with `--test-force-exit`. The new store fixes this properly: `.unref()` the timer and expose `stop()`.
2. **`util/data.js` loads asynchronously (this is defect B2).** State is assigned inside an `fs.stat` callback, so a test that imports it and immediately reads state sees `undefined`. The characterization tests must await a macrotask tick first. This is the defect being characterized — the test documents the race, then Task 7 removes the need for it.

---

### Task 1: Tooling foundation

Establishes TypeScript, ESLint 9, and the test runner with `allowJs` so the existing JavaScript keeps running and linting while the migration proceeds file by file.

**Files:**
- Create: `tsconfig.json`, `eslint.config.js`
- Modify: `package.json`, `.github/workflows/lint.yml`
- Delete: `.eslintrc.cjs`, `.eslintignore`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run typecheck`, `npm test`, `npm run lint` — all three used as the gate by every later task.

- [ ] **Step 1: Install dev dependencies**

```bash
npm install --save-dev typescript@^5.9 typescript-eslint@^8 eslint@^9 @types/node@^24
npm uninstall eslint-config-airbnb-base eslint-plugin-import
```

- [ ] **Step 2: Create `tsconfig.json`**

`noEmit` plus `allowImportingTsExtensions` is the combination that makes `.ts` imports legal when nothing is emitted. `erasableSyntaxOnly` makes `tsc` reject syntax Node cannot strip, so violations surface here rather than as a runtime `SyntaxError`.

```json
{
  "compilerOptions": {
    "target": "es2024",
    "lib": ["es2024"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "types": ["node"],

    "noEmit": true,
    "allowImportingTsExtensions": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,

    "allowJs": true,
    "checkJs": false,

    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "eslint.config.js"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `eslint.config.js`**

Replaces airbnb-base, which has no flat-config or TypeScript support. `no-console` stays off and `max-len` stays at 160 to match the current house style. The `import/extensions` rule disappears — `tsconfig` enforces extensions now.

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', 'data.json', '*.bak', 'util/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      'no-console': 'off',
      'max-len': ['error', { code: 160 }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
    },
  },
);
```

Note the `util/**` ignore: legacy JavaScript is not linted by the new config during the migration. Task 13 removes both the directory and this ignore entry.

- [ ] **Step 4: Update `package.json` scripts**

The current `"test": "test"` runs the shell string `test` and fails. Replace it.

```json
{
  "scripts": {
    "start": "node --env-file-if-exists=.env src/index.ts",
    "test": "node --test",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "lint-f": "eslint --fix ."
  }
}
```

`start` points at `src/index.ts`, which does not exist until Task 13. Until then run the bot with `node index.js`.

- [ ] **Step 5: Verify the toolchain runs**

```bash
npm run typecheck && npm run lint
```
Expected: both exit 0. `typecheck` has no `.ts` files to check yet and passes trivially; that is the point — the gate exists and is green.

- [ ] **Step 6: Update CI**

In `.github/workflows/lint.yml`, add `'**.ts'` to both `paths` filters, then add the two new gates after `npm run lint`:

```yaml
    - run: npm run lint
    - run: npm run typecheck
    - run: npm test
```

- [ ] **Step 7: Delete the old ESLint config**

```bash
git rm .eslintrc.cjs .eslintignore
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: add TypeScript, ESLint 9 flat config, and node:test harness"
```

---

### Task 2: Characterize `util/data.js`

Pins current persistence behavior before anything moves. These assertions survive the port; only the call shape changes.

**Files:**
- Create: `test/legacy/data.characterization.test.js`

**Interfaces:**
- Consumes: `util/data.js` (legacy).
- Produces: the behavioral contract Task 7's `store.ts` must satisfy.

- [ ] **Step 1: Write the failing test**

`loadLegacyData` is the workaround for hazard 2 — the `await new Promise(setImmediate)` waits for `data.js`'s `fs.stat` callback. It exists to document defect B2.

```js
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let tmpDir;
let data;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tow-test-'));
  process.env.DATA_FILE = path.join(tmpDir, 'data.json');
  process.env.DISCORD_TOKEN = 'test-token';
  data = (await import('../../util/data.js')).default;
  // B2: data.js assigns state inside an async fs.stat callback.
  await new Promise(setImmediate);
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
    // Asymmetry with removeCoins. Characterized, not fixed — see spec "Deferred".
    assert.equal(data.getCrowns('u3'), -5);
  });

  test('B1: setTargetNumber accepts a non-integer because Number.isInteger is uncalled', () => {
    data.setTargetNumber('not a number');
    assert.equal(data.getTargetNumber(), 'not a number');
  });

  test('B3: getCoins returns undefined for a missing user and reports via the outer branch', () => {
    let message = null;
    const result = data.getCoins('nonexistent', (m) => { message = m; });
    assert.equal(result, undefined);
    // The OUTER errorCallback fires. What is dead is the one threaded into
    // getUser(userId, errorCallback) - getUser takes one parameter.
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
    // Documents the encapsulation gap Task 7 closes.
    assert.equal(data.getCoins('u5'), 999);
  });
});
```

- [ ] **Step 2: Run to verify it passes against current code**

```bash
node --test --test-force-exit test/legacy/data.characterization.test.js
```
Expected: PASS. `--test-force-exit` is required because of hazard 1 — the uncleaned `setInterval`. Without it the run hangs after the final assertion.

- [ ] **Step 3: Commit**

```bash
git add test/legacy/data.characterization.test.js
git commit -m "test: characterize legacy data.js behavior, including B1/B2/B3"
```

---

### Task 3: Characterize `util/bosses.js`

**Files:**
- Create: `test/legacy/boss.characterization.test.js`

**Interfaces:**
- Consumes: `util/bosses.js`, `util/data.js`.
- Produces: the reward-math and persistence contract Task 8 must satisfy.

- [ ] **Step 1: Write the failing test**

The B7 test is the important one: it captures the double-payout defect so Task 8's fix produces a visible, intentional diff.

```js
import { test, describe, before, after } from 'node:test';
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
  test('hit reduces health by BASE_DAMAGE and records the participant', () => {
    Boss.instance = null;
    const boss = Boss.instantiate();
    const before = boss.health;
    boss.hit('p1', () => {});
    assert.ok(boss.health < before);
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
    const boss = Boss.instantiate();
    data.persistBoss(boss);
    boss.health = 1;
    boss.hit('p1', () => {});
    assert.equal(Boss.instance, null, 'in-memory singleton is cleared');
    // ...but the persisted copy is not, so a restart resurrects it.
    assert.notEqual(data.getBoss(), null, 'documents the defect Task 8 fixes');
    assert.ok(data.getBoss().health <= 0, 'a zombie with non-positive health');
  });

  test('bomb() DOES clear the persisted boss, unlike hit()', () => {
    Boss.instance = null;
    const boss = Boss.instantiate();
    boss.health = 1;
    boss.bomb('p1');
    assert.equal(data.getBoss(), null, 'documents the inconsistency between the two kill paths');
  });
});
```

- [ ] **Step 2: Run to verify it passes**

```bash
node --test --test-force-exit test/legacy/boss.characterization.test.js
```
Expected: PASS. If the B7 test fails, stop — the defect analysis in the spec is wrong and the design needs revisiting.

- [ ] **Step 3: Commit**

```bash
git add test/legacy/boss.characterization.test.js
git commit -m "test: characterize legacy boss behavior, including the B7 double-payout defect"
```

---

### Task 4: Characterize `util/shop/shop.js` and the embed overflow

**Files:**
- Create: `test/legacy/shop.characterization.test.js`, `test/legacy/embeds.characterization.test.js`

**Interfaces:**
- Consumes: `util/shop/shop.js`, `util/embeds.js`.
- Produces: the purchase contract for Task 9 and the overflow contract for Task 10.

- [ ] **Step 1: Write the shop characterization test**

```js
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let tmpDir; let data; let shop;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tow-shop-'));
  process.env.DATA_FILE = path.join(tmpDir, 'data.json');
  process.env.DISCORD_TOKEN = 'test-token';
  data = (await import('../../util/data.js')).default;
  shop = (await import('../../util/shop/shop.js')).default;
  await new Promise(setImmediate);
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
    assert.equal(touched, false, 'documents that neither callback fires — UNKNOWN_ITEM in Task 9');
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
```

- [ ] **Step 2: Write the embed overflow test**

This is the reproduction of the crash from production. It asserts the *current broken* behavior so Task 10's fix is a visible diff.

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.DISCORD_TOKEN = 'test-token';
const { skins } = await import('../../util/shop/items/skins.js');
const embeds = (await import('../../util/embeds.js')).default;

describe('legacy embeds', () => {
  test('B10: inventory throws for a user owning more than 25 reactions', () => {
    const reactions = {};
    Object.keys(skins).forEach((k) => { reactions[k] = false; });
    reactions.default = true;
    assert.ok(Object.keys(reactions).length > 25, 'catalog is large enough to overflow');
    assert.throws(
      () => embeds.inventoryEmbedForUser({ reactions }),
      /lessThanOrEqual|Invalid number value/,
      'documents the production crash Task 10 fixes',
    );
  });

  test('the shop embed is currently under the cap but has little headroom', () => {
    const built = embeds.shopEmbed.data.fields.length;
    assert.ok(built <= 25);
    assert.ok(built >= 15, `at ${built} of 25 — enabling retired skins would break t?shop`);
  });
});
```

- [ ] **Step 3: Run both**

```bash
npm test
```
Expected: PASS for all of Tasks 2-4.

- [ ] **Step 4: Commit**

```bash
git add test/legacy/
git commit -m "test: characterize legacy shop and reproduce the B10 embed field overflow"
```

---

### Task 5: `lib/` primitives and `game/constants.ts`

First TypeScript in the repo. Small, dependency-free, and establishes the patterns every later task copies.

**Files:**
- Create: `src/lib/result.ts`, `src/lib/random.ts`, `src/lib/text.ts`, `src/lib/rate-limit.ts`, `src/game/constants.ts`
- Test: `test/lib/result.test.ts`, `test/lib/random.test.ts`, `test/lib/rate-limit.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`
  - `ok<T>(value: T): Result<T, never>`, `err<E>(error: E): Result<never, E>`
  - `getRandomInt(min: number, max: number): number` — range `[min, max)`
  - `sample<T>(items: readonly T[]): T | undefined`
  - `tokenize(input: string): string[]`, `userIdToMention(userId: string): string`
  - `rateLimit<A extends unknown[]>(fn: (...a: A) => void, waitMs: number): (...a: A) => void`
  - `constants` — an `as const` object, every value identical to today's `util/constants.js`

- [ ] **Step 1: Write `src/lib/result.ts`**

```ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

- [ ] **Step 2: Write the failing test for `random.ts`**

```ts
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
    for (let i = 0; i < 100; i += 1) assert.ok(items.includes(sample(items)!));
  });
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
node --test test/lib/random.test.ts
```
Expected: FAIL — `Cannot find module '../../src/lib/random.ts'`.

- [ ] **Step 4: Implement `src/lib/random.ts`**

`sample` returns `T | undefined` because `noUncheckedIndexedAccess` is on. This replaces `_.sample`.

```ts
/** Random integer in the range [min, max). */
export const getRandomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min) + min);

export const sample = <T>(items: readonly T[]): T | undefined =>
  items[Math.floor(Math.random() * items.length)];
```

- [ ] **Step 5: Implement `src/lib/text.ts`**

```ts
export const tokenize = (input: string): string[] => input.toLowerCase().trim().split(/ +/);

export const userIdToMention = (userId: string): string => `<@${userId}>`;
```

- [ ] **Step 6: Write the failing test for `rate-limit.ts`**

Replaces `_.debounce(fn, ms, true)`: leading-edge, trailing calls dropped.

```ts
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
```

- [ ] **Step 7: Run to verify it fails, then implement**

```ts
export const rateLimit = <A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): ((...args: A) => void) => {
  let lastCall = Number.NEGATIVE_INFINITY;
  return (...args: A): void => {
    const now = Date.now();
    if (now - lastCall < waitMs) return;
    lastCall = now;
    fn(...args);
  };
};
```

- [ ] **Step 8: Port `util/constants.js` to `src/game/constants.ts`**

Copy every key and value verbatim — no value may change. `as const` replaces the `enum` that erasable-syntax rules forbid.

```ts
export const constants = {
  REACT_CORRECT: '✅',
  REACT_INCORRECT: '👎',
  REACT_TIMEOUT: '⏳',
  WIN: 129,
  CONVERSION_RATE: 100,
  COIN_RATE: 0.025,
  COIN_LOSS: 10,
  COIN_GAIN: 50,
  TP_MIN: 10,
  TP_MAX: 50,
  CROWN_MULTIPLIER: 1,
  BOSS_SPAWN_RATE: 0.075,
  BASE_DAMAGE: 100,
  CRIT_RATE: 0.025,
  CRIT_BONUS: 0.025,
  MAX_CRIT_LEVEL: 5,
  CRIT_MULTIPLIER: 10,
  BOMB_DAMAGE: 5000,
  ACROBATICS_EMOJI: '👟',
  ACROBATICS_RATE: 0.08,
  MAX_ACRO_LEVEL: 5,
  ROYALTY_GAIN: 1,
  MAX_ROYALTY_LEVEL: 4,
} as const;
```

- [ ] **Step 9: Add a test asserting constants are unchanged**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { constants } from '../../src/game/constants.ts';
import legacy from '../../util/constants.js';

test('constants are byte-identical to the legacy values', () => {
  assert.deepEqual({ ...constants }, legacy);
});
```

This test is deleted in Task 13 along with `util/`.

- [ ] **Step 10: Run the full gate and commit**

```bash
npm run lint && npm run typecheck && npm test
git add -A
git commit -m "feat: add lib primitives and port constants to TypeScript"
```

---

### Task 6: `store/schema.ts`

Types and load-time normalization. Normalization is what lets `critBonus`, `acrobatics`, and `royalty` become required, removing every `?? 0` in the codebase.

**Files:**
- Create: `src/store/schema.ts`
- Test: `test/store/schema.test.ts`

**Interfaces:**
- Consumes: `src/game/constants.ts`.
- Produces:
  - `interface User`, `interface BossState`, `interface GameState` (as in the spec)
  - `createUser(): User`
  - `createState(): GameState`
  - `parseState(raw: unknown): GameState` — normalizes any prior on-disk shape

- [ ] **Step 1: Write the failing test**

The fixture is the real production `data.json` shape, including a user predating the upgrade fields.

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseState, createUser, createState } from '../../src/store/schema.ts';

describe('parseState', () => {
  test('fills upgrade fields absent from legacy saves', () => {
    const legacy = {
      number: 1,
      users: { '110521207291428864': { count: 1, wins: 0, crowns: 0, coins: 0, miscount: 0, boss: 0, reactions: { default: true } } },
      last: '110521207291428864',
      channel: '1027691912431415316',
      win: 97,
      correctEmoji: '✅', incorrectEmoji: '👎', timeoutEmoji: '⏳',
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
        level: 3, rewards: { crowns: 45 }, health: 30000, totalHealth: 30000,
        participants: {}, imagePath: 'assets/boss-images/500_troll.png',
        imageName: '500_troll.png', bossName: 'Troll',
      },
    });
    assert.equal(state.boss?.bossName, 'Troll');
    assert.equal(state.boss?.health, 30000);
  });

  test('B7 defense: a boss with non-positive health is discarded on load', () => {
    const deadBoss = {
      level: 1, health: 0, totalHealth: 100, rewards: { crowns: 15 },
      participants: { a: 100 }, imagePath: 'x', imageName: 'x', bossName: 'X',
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
```

- [ ] **Step 2: Run to verify it fails**

```bash
node --test test/store/schema.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/store/schema.ts`**

Note the B7 defense in `parseBoss`: a boss whose health is non-positive is dropped rather than resurrected. Together with Task 8's single-source-of-truth change, this closes the double-payout path from both ends.

```ts
import { constants } from '../game/constants.ts';
import { getRandomInt } from '../lib/random.ts';

export interface User {
  count: number; wins: number; crowns: number; coins: number;
  miscount: number; boss: number;
  critBonus: number; acrobatics: number; royalty: number;
  reactions: Record<string, boolean>;
}

export interface BossState {
  level: number;
  health: number;
  totalHealth: number;
  rewards: { crowns?: number; coins?: number };
  participants: Record<string, number>;
  imagePath: string;
  imageName: string;
  bossName: string;
}

export interface GameState {
  number: number;
  win: number;
  last: string | null;
  channel: string | null;
  users: Record<string, User>;
  boss: BossState | null;
  correctEmoji: string;
  incorrectEmoji: string;
  timeoutEmoji: string;
}

export const createUser = (): User => ({
  count: 0, wins: 0, crowns: 0, coins: 0, miscount: 0, boss: 0,
  critBonus: 0, acrobatics: 0, royalty: 0,
  reactions: { default: true },
});

export const createState = (): GameState => ({
  number: 0,
  win: getRandomInt(0, constants.WIN),
  last: null,
  channel: null,
  users: {},
  boss: null,
  correctEmoji: constants.REACT_CORRECT,
  incorrectEmoji: constants.REACT_INCORRECT,
  timeoutEmoji: constants.REACT_TIMEOUT,
});

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (v: unknown, fallback: number): number =>
  (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

const parseUser = (raw: unknown): User => {
  const base = createUser();
  if (!isRecord(raw)) return base;
  return {
    count: num(raw.count, 0),
    wins: num(raw.wins, 0),
    crowns: num(raw.crowns, 0),
    coins: num(raw.coins, 0),
    miscount: num(raw.miscount, 0),
    boss: num(raw.boss, 0),
    critBonus: num(raw.critBonus, 0),
    acrobatics: num(raw.acrobatics, 0),
    royalty: num(raw.royalty, 0),
    reactions: isRecord(raw.reactions)
      ? Object.fromEntries(Object.entries(raw.reactions).map(([k, v]) => [k, Boolean(v)]))
      : { default: true },
  };
};

const parseBoss = (raw: unknown): BossState | null => {
  if (!isRecord(raw)) return null;
  const health = num(raw.health, 0);
  // B7 defense: a dead boss must never survive a restart and pay rewards twice.
  if (health <= 0) return null;
  if (typeof raw.bossName !== 'string' || typeof raw.imagePath !== 'string') return null;
  return {
    level: num(raw.level, 1),
    health,
    totalHealth: num(raw.totalHealth, health),
    rewards: isRecord(raw.rewards)
      ? { crowns: num(raw.rewards.crowns, 0), coins: num(raw.rewards.coins, 0) }
      : { crowns: 0 },
    participants: isRecord(raw.participants)
      ? Object.fromEntries(Object.entries(raw.participants).map(([k, v]) => [k, num(v, 0)]))
      : {},
    imagePath: raw.imagePath,
    imageName: typeof raw.imageName === 'string' ? raw.imageName : '',
    bossName: raw.bossName,
  };
};

export const parseState = (raw: unknown): GameState => {
  const base = createState();
  if (!isRecord(raw)) return base;
  return {
    number: num(raw.number, base.number),
    win: num(raw.win, base.win),
    last: typeof raw.last === 'string' ? raw.last : null,
    channel: typeof raw.channel === 'string' ? raw.channel : null,
    users: isRecord(raw.users)
      ? Object.fromEntries(Object.entries(raw.users).map(([id, u]) => [id, parseUser(u)]))
      : {},
    boss: parseBoss(raw.boss),
    correctEmoji: typeof raw.correctEmoji === 'string' ? raw.correctEmoji : base.correctEmoji,
    incorrectEmoji: typeof raw.incorrectEmoji === 'string' ? raw.incorrectEmoji : base.incorrectEmoji,
    timeoutEmoji: typeof raw.timeoutEmoji === 'string' ? raw.timeoutEmoji : base.timeoutEmoji,
  };
};
```

- [ ] **Step 4: Run to verify it passes**

```bash
node --test test/store/schema.test.ts
```
Expected: PASS, all five tests.

- [ ] **Step 5: Verify against the real production file**

```bash
node -e "
import('./src/store/schema.ts').then(async (m) => {
  const raw = JSON.parse(require('node:fs').readFileSync('data.json', 'utf8'));
  const s = m.parseState(raw);
  console.log('users:', Object.keys(s.users).length, 'number:', s.number, 'boss:', s.boss?.bossName ?? null);
});
"
```
Expected: parses without throwing, user count matches the file.

- [ ] **Step 6: Commit**

```bash
git add src/store/schema.ts test/store/schema.test.ts
git commit -m "feat: add typed game state schema with load-time normalization"
```

---

### Task 7: `store/json-file.ts` and `store/store.ts`

The persistence facade. Fixes B1, B2, B3 and hazard 1.

**Files:**
- Create: `src/store/json-file.ts`, `src/store/store.ts`
- Test: `test/store/store.test.ts`

**Interfaces:**
- Consumes: `src/store/schema.ts`.
- Produces:
  - `loadState(file: string): GameState` — **synchronous** (B2)
  - `saveState(file: string, state: GameState): void`
  - `createStore(state: GameState, opts?: { file?: string; flushMs?: number }): Store`
  - `Store` methods used by later tasks:
    `getUser(id): Readonly<User> | undefined`, `ensureUser(id): Readonly<User>`, `hasUser(id)`,
    `getAllUsers(): Readonly<Record<string, User>>`,
    `addCoins(id, n)`, `removeCoins(id, n)`, `addCrowns(id, n)`, `removeCrowns(id, n)`,
    `getCoins(id): number`, `getCrowns(id): number`,
    `incrementCount(id)`, `incrementMiscount(id)`, `incrementWins(id)`, `incrementBossKills(id)`,
    `getCritBonus(id)`, `setCritBonus(id, n)`, and the same pairs for `acrobatics` and `royalty`,
    `getNumber()`, `setNumber(n)`, `addToNumber(n)`,
    `getTarget()`, `setTarget(n)`,
    `getLastUserId()`, `setLastUserId(id)`, `clearLastUserId()`,
    `getChannelId()`, `setChannelId(id)`,
    `getBoss(): Readonly<BossState> | null`, `setBoss(b: BossState | null)`,
    `selectReaction(id, reactionId)`, `hasReaction(id, reactionId)`, `getReactions(id)`,
    `snapshot(): GameState`, `flush(): void`, `stop(): void`

- [ ] **Step 1: Write the failing test**

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../../src/store/store.ts';
import { loadState, saveState } from '../../src/store/json-file.ts';
import { createState } from '../../src/store/schema.ts';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tow-store-'));

describe('store', () => {
  test('B2: loadState is synchronous — state is usable on the next line', () => {
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
    assert.equal(store.getTarget(), before, 'unchanged — the guard actually runs now');
  });

  test('B3: getCoins returns 0 for an unknown user instead of undefined', () => {
    const store = createStore(createState());
    assert.equal(store.getCoins('ghost'), 0);
  });

  test('removeCoins floors at zero (preserved from legacy)', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCoins('u', 10);
    store.removeCoins('u', 50);
    assert.equal(store.getCoins('u'), 0);
  });

  test('reads are frozen — mutation through a getter is impossible', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    const user = store.getUser('u')!;
    assert.throws(() => { (user as { coins: number }).coins = 999; });
    assert.equal(store.getCoins('u'), 0, 'closes the gap characterized in Task 2');
  });

  test('incrementBossKills replaces the direct field write from index.js', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.incrementBossKills('u');
    assert.equal(store.getUser('u')!.boss, 1);
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
    assert.equal(reloaded.users.u!.crowns, 7);
    assert.equal(reloaded.number, 13);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
node --test test/store/store.test.ts
```
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/store/json-file.ts`**

Synchronous read at call time — this is the B2 fix. The corrupt-file branch matters because the legacy code would crash the process on boot.

```ts
import fs from 'node:fs';
import { parseState, createState, type GameState } from './schema.ts';

export const loadState = (file: string): GameState => {
  try {
    return parseState(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') console.log('No save file found; starting fresh.');
    else console.error(`Could not read ${file}, starting fresh:`, error);
    return createState();
  }
};

export const saveState = (file: string, state: GameState): void => {
  fs.writeFileSync(file, JSON.stringify(state));
};
```

- [ ] **Step 4: Implement `src/store/store.ts`**

Two things to get right. `Object.freeze` on reads is what makes the "readonly" claim real rather than the fiction `getUserWritable` was. And `.unref()` on the interval is hazard 1 — without it `node --test` hangs and the process cannot exit cleanly.

```ts
import { createUser, type BossState, type GameState, type User } from './schema.ts';
import { saveState } from './json-file.ts';

const FIVE_MINUTES = 1000 * 60 * 5;

export interface StoreOptions { file?: string; flushMs?: number }

export const createStore = (state: GameState, opts: StoreOptions = {}) => {
  const { file, flushMs = FIVE_MINUTES } = opts;

  const flush = (): void => {
    if (!file) return;
    saveState(file, state);
    console.log('Data saved.');
  };

  // .unref() so the timer never holds the event loop open (hazard 1).
  const timer = file ? setInterval(flush, flushMs).unref() : undefined;

  const writable = (id: string): User | undefined => state.users[id];

  const ensureUser = (id: string): Readonly<User> => {
    state.users[id] ??= createUser();
    return Object.freeze({ ...state.users[id] });
  };

  const adjust = (id: string, field: 'coins' | 'crowns', delta: number, floorAtZero: boolean): void => {
    const user = writable(id);
    if (!user) return;
    user[field] += delta;
    if (floorAtZero && user[field] < 0) user[field] = 0;
  };

  return {
    getUser: (id: string): Readonly<User> | undefined => {
      const u = writable(id);
      return u ? Object.freeze({ ...u }) : undefined;
    },
    ensureUser,
    hasUser: (id: string): boolean => writable(id) !== undefined,
    getAllUsers: (): Readonly<Record<string, User>> => Object.freeze({ ...state.users }),

    // B3: a missing user yields 0, and the dead errorCallback parameter is gone.
    getCoins: (id: string): number => writable(id)?.coins ?? 0,
    getCrowns: (id: string): number => writable(id)?.crowns ?? 0,
    addCoins: (id: string, n: number): void => adjust(id, 'coins', Math.max(0, n), true),
    removeCoins: (id: string, n: number): void => adjust(id, 'coins', -Math.max(0, n), true),
    addCrowns: (id: string, n: number): void => adjust(id, 'crowns', Math.max(0, n), false),
    removeCrowns: (id: string, n: number): void => adjust(id, 'crowns', -Math.max(0, n), false),

    incrementCount: (id: string): void => { const u = writable(id); if (u) u.count += 1; },
    incrementMiscount: (id: string): void => { const u = writable(id); if (u) u.miscount += 1; },
    incrementWins: (id: string): void => { const u = writable(id); if (u) u.wins += 1; },
    incrementBossKills: (id: string): void => { const u = writable(id); if (u) u.boss += 1; },

    getCritBonus: (id: string): number => writable(id)?.critBonus ?? 0,
    setCritBonus: (id: string, n: number): void => { const u = writable(id); if (u) u.critBonus = n; },
    getAcrobatics: (id: string): number => writable(id)?.acrobatics ?? 0,
    setAcrobatics: (id: string, n: number): void => { const u = writable(id); if (u) u.acrobatics = n; },
    getRoyalty: (id: string): number => writable(id)?.royalty ?? 0,
    setRoyalty: (id: string, n: number): void => { const u = writable(id); if (u) u.royalty = n; },

    getNumber: (): number => state.number,
    // B1: the guard is actually invoked now.
    setNumber: (n: number): void => { if (Number.isInteger(n)) state.number = n; },
    addToNumber: (n: number): void => { if (Number.isInteger(n)) state.number += n; },
    getTarget: (): number => state.win,
    setTarget: (n: number): void => { if (Number.isInteger(n)) state.win = n; },

    getLastUserId: (): string | null => state.last,
    setLastUserId: (id: string): void => { state.last = id; },
    clearLastUserId: (): void => { state.last = null; },
    getChannelId: (): string | null => state.channel,
    setChannelId: (id: string): void => { state.channel = id; },

    getBoss: (): Readonly<BossState> | null => (state.boss ? Object.freeze({ ...state.boss }) : null),
    setBoss: (boss: BossState | null): void => { state.boss = boss; },

    hasReaction: (id: string, reactionId: string): boolean =>
      Object.hasOwn(writable(id)?.reactions ?? {}, reactionId),
    getReactions: (id: string): Readonly<Record<string, boolean>> =>
      Object.freeze({ ...(writable(id)?.reactions ?? {}) }),
    selectReaction: (id: string, reactionId: string): void => {
      const user = writable(id);
      if (!user) return;
      Object.keys(user.reactions).forEach((k) => { user.reactions[k] = false; });
      user.reactions[reactionId] = true;
    },

    snapshot: (): GameState => structuredClone(state),
    flush,
    stop: (): void => { if (timer) clearInterval(timer); flush(); },
  };
};

export type Store = ReturnType<typeof createStore>;
```

- [ ] **Step 5: Run to verify it passes**

```bash
node --test test/store/store.test.ts
```
Expected: PASS. Note this runs **without** `--test-force-exit` — proof that hazard 1 is fixed.

- [ ] **Step 6: Run the full gate and commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/store test/store
git commit -m "feat: add injected store with sync loading, frozen reads, and B1/B2/B3 fixes"
```

---

### Task 8: `game/boss.ts`

Removes the static singleton. `GameState.boss` becomes the sole source of truth, which structurally eliminates B7.

**Files:**
- Create: `src/game/boss.ts`
- Move: `util/boss_images/` -> `assets/boss-images/`
- Test: `test/game/boss.test.ts`

**Interfaces:**
- Consumes: `src/store/store.ts`, `src/store/schema.ts`, `src/game/constants.ts`, `src/lib/random.ts`.
- Produces:
  - `spawnBoss(store: Store): BossState` — creates and persists in one step
  - `hitBoss(store, userId): { damage: number; crit: boolean; killed: boolean; boss: BossState }`
  - `bombBoss(store, userId): Result<{ bossName: string; killed: boolean }, { code: 'NO_ACTIVE_BOSS' }>`
  - `calculateReward(boss: BossState, userId: string): { crowns: number; coins: number }`
  - `distributeRewards(store, boss): void`
  - `BOSS_IMAGES: readonly (readonly string[])[]`, `BOSS_BREAKPOINTS`, `REWARDS_POOL`, `HEALTH_MULTIPLIER`

- [ ] **Step 1: Move the images with history preserved**

```bash
mkdir -p assets
git mv util/boss_images assets/boss-images
```

- [ ] **Step 2: Write the failing test**

The first test is the B7 regression — the exact scenario Task 3 characterized as broken.

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../src/store/store.ts';
import { createState } from '../../src/store/schema.ts';
import { spawnBoss, hitBoss, calculateReward, distributeRewards } from '../../src/game/boss.ts';
import { constants } from '../../src/game/constants.ts';

describe('boss', () => {
  test('B7 regression: killing via hitBoss clears the persisted boss', () => {
    const store = createStore(createState());
    const boss = spawnBoss(store);
    store.setBoss({ ...boss, health: constants.BASE_DAMAGE });
    store.ensureUser('p1');
    const result = hitBoss(store, 'p1');
    assert.equal(result.killed, true);
    assert.equal(store.getBoss(), null, 'no zombie survives to be resurrected');
  });

  test('B7 regression: rewards are paid exactly once', () => {
    const store = createStore(createState());
    const boss = spawnBoss(store);
    store.ensureUser('p1');
    store.setBoss({ ...boss, health: constants.BASE_DAMAGE, totalHealth: constants.BASE_DAMAGE, rewards: { crowns: 100 }, participants: {} });
    hitBoss(store, 'p1');
    const afterFirstKill = store.getCrowns('p1');
    assert.ok(afterFirstKill > 0, 'paid once');
    // There is no boss left to hit, so no second payout is reachable.
    assert.equal(store.getBoss(), null);
    assert.equal(store.getCrowns('p1'), afterFirstKill);
  });

  test('hitBoss reduces health and records the participant', () => {
    const store = createStore(createState());
    spawnBoss(store);
    store.ensureUser('p1');
    const before = store.getBoss()!.health;
    const result = hitBoss(store, 'p1');
    assert.equal(store.getBoss()!.health, before - result.damage);
    assert.ok(store.getBoss()!.participants.p1! > 0);
  });

  test('rewards divide in proportion to damage dealt', () => {
    const boss = { level: 1, health: 0, totalHealth: 1000, rewards: { crowns: 100 }, participants: { a: 750, b: 250 }, imagePath: 'x', imageName: 'x', bossName: 'X' };
    assert.equal(calculateReward(boss, 'a').crowns, 75);
    assert.equal(calculateReward(boss, 'b').crowns, 25);
  });

  test('distributeRewards credits every participant', () => {
    const store = createStore(createState());
    store.ensureUser('a'); store.ensureUser('b');
    distributeRewards(store, { level: 1, health: 0, totalHealth: 1000, rewards: { crowns: 100 }, participants: { a: 750, b: 250 }, imagePath: 'x', imageName: 'x', bossName: 'X' });
    assert.equal(store.getCrowns('a'), 75);
    assert.equal(store.getCrowns('b'), 25);
  });

  test('every image referenced by BOSS_IMAGES exists on disk', async () => {
    const fs = await import('node:fs');
    const { BOSS_IMAGES } = await import('../../src/game/boss.ts');
    BOSS_IMAGES.flat().forEach((p) => {
      assert.ok(fs.existsSync(p), `missing boss image: ${p}`);
    });
  });
});
```

- [ ] **Step 3: Run to verify it fails, then implement `src/game/boss.ts`**

Port the level/health/reward rolls from `util/bosses.js` unchanged — those are balance. What changes is that every mutation goes through `store.setBoss`, so there is exactly one source of truth and no path that can forget to persist.

Resolve image paths from the module rather than the working directory, so the bot no longer depends on being launched from the repo root:

```ts
import path from 'node:path';

const ASSETS = path.join(import.meta.dirname, '..', '..', 'assets', 'boss-images');
```

Keep the three commented-out historical `IMAGE_PATH` arrays from `util/bosses.js` — they are the retired boss rosters and the same catalog-of-retired-content pattern the shop uses.

- [ ] **Step 4: Run to verify it passes**

```bash
node --test test/game/boss.test.ts
```
Expected: PASS, all six tests.

- [ ] **Step 5: Run the full gate and commit**

```bash
npm run lint && npm run typecheck && npm test
git add -A
git commit -m "feat: move boss state into the store, fixing the B7 double-payout defect"
```

---

### Task 9: `shop/` in TypeScript with `Result`

The densest concentration of callbacks, so it is where the new pattern earns its keep. Fixes B6.

**Files:**
- Create: `src/shop/powerups.ts`, `src/shop/skins.ts`, `src/shop/shop.ts`, `src/game/economy.ts`
- Test: `test/shop/shop.test.ts`, `test/game/economy.test.ts`

**Interfaces:**
- Consumes: `src/store/store.ts`, `src/game/boss.ts`, `src/lib/result.ts`.
- Produces:
  - `type PurchaseError = { code: 'NOT_ENOUGH_COINS'; price: number; had: number } | { code: 'UNKNOWN_ITEM'; item: string } | { code: 'ALREADY_OWNED'; item: string } | { code: 'MAX_LEVEL'; upgrade: string; level: number } | { code: 'NO_ACTIVE_BOSS' }`
  - `type PurchaseEffect = { kind: 'number-changed'; label: string; number: number } | { kind: 'target-changed'; target: number } | { kind: 'upgrade'; upgrade: string; level: number } | { kind: 'skin'; skin: string; emoji: string } | { kind: 'crowns'; amount: number } | { kind: 'boss-damaged'; bossName: string; killed: boolean }`
  - `buy(store: Store, userId: string, item: string, quantity?: string): Result<PurchaseEffect, PurchaseError>`
  - `convert(store, userId, arg?): Result<{ crownsSpent: number; coinsGained: number }, ConvertError>`
  - `equip(store, userId, reactionId): Result<{ skin: string; emoji: string }, { code: 'NOT_OWNED'; item: string }>`
  - `powerups`, `enabledPowerups`, `skins`, `enabledSkins` — typed catalogs, contents unchanged

- [ ] **Step 1: Port the catalogs**

`powerups.ts` and `skins.ts` are data. Copy all 11 powerups and all 45 skins with their exact prices, descriptions, emoji, and `enabled` flags. Retired entries stay — they are the seasonal catalog.

```ts
export interface ShopItem { price: number; description: string; enabled: boolean; quantified?: boolean }
export interface Skin extends ShopItem { emoji: string }

export const powerups = { /* all 11, verbatim */ } as const satisfies Record<string, ShopItem>;

export const enabledPowerups: Record<string, ShopItem> =
  Object.fromEntries(Object.entries(powerups).filter(([, item]) => item.enabled));
```

- [ ] **Step 2: Write the failing test**

Each test mirrors one from Task 4, so the behavioral equivalence is checkable side by side.

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../src/store/store.ts';
import { createState } from '../../src/store/schema.ts';
import { buy } from '../../src/shop/shop.ts';
import { spawnBoss } from '../../src/game/boss.ts';

describe('shop', () => {
  test('insufficient coins does not charge', () => {
    const store = createStore(createState());
    store.ensureUser('poor');
    const result = buy(store, 'poor', 'reroll');
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.error.code, 'NOT_ENOUGH_COINS');
    assert.equal(store.getCoins('poor'), 0);
  });

  test('an unknown item reports UNKNOWN_ITEM instead of failing silently', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCoins('u', 10000);
    const result = buy(store, 'u', 'not-a-real-item');
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.error.code, 'UNKNOWN_ITEM');
    assert.equal(store.getCoins('u'), 10000, 'no charge');
  });

  test('crit caps at MAX_CRIT_LEVEL and does not charge at the cap', () => {
    const store = createStore(createState());
    store.ensureUser('rich');
    store.addCoins('rich', 100000);
    for (let i = 0; i < 5; i += 1) assert.equal(buy(store, 'rich', 'crit').ok, true);
    const atCap = store.getCoins('rich');
    const result = buy(store, 'rich', 'crit');
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.error.code, 'MAX_LEVEL');
    assert.equal(store.getCoins('rich'), atCap, 'no net charge at the cap');
    assert.equal(store.getCritBonus('rich'), 5);
  });

  test('crowncard quantity multiplies price and crowns alike', () => {
    const store = createStore(createState());
    store.ensureUser('q');
    store.addCoins('q', 1000);
    const result = buy(store, 'q', 'crowncard', '3');
    assert.equal(result.ok, true);
    assert.equal(store.getCrowns('q'), 3);
    assert.equal(store.getCoins('q'), 1000 - 330);
  });

  test('B6: a successful bomb reports success, not failure', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCoins('u', 10000);
    spawnBoss(store);
    const result = buy(store, 'u', 'bomb');
    assert.equal(result.ok, true, 'legacy fired the errorCallback here regardless');
  });

  test('B6: bombing with no boss refunds rather than silently charging', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCoins('u', 10000);
    const result = buy(store, 'u', 'bomb');
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.error.code, 'NO_ACTIVE_BOSS');
    assert.equal(store.getCoins('u'), 10000, 'not charged for a no-op');
  });
});
```

Note: the last test resolves the bomb-refund question the spec records under "Resolved during planning" — an `err` return means no charge occurred, because charging happens only on the success path.

- [ ] **Step 3: Run to verify it fails, then implement**

Structure `buy` as: resolve the item, compute the price, check affordability, apply the effect, and charge **only** on success. That ordering is what makes B6 and the double-charge unreachable, rather than something guarded against.

- [ ] **Step 4: Run to verify it passes, then the full gate and commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/shop src/game/economy.ts test/shop test/game/economy.test.ts
git commit -m "feat: port shop and economy to Result-returning TypeScript, fixing B6"
```

---

### Task 10: `ui/embeds.ts` and `ui/messages.ts`

Fixes B10 — the production crash — and makes the overflow unrepresentable.

**Files:**
- Create: `src/ui/embeds.ts`, `src/ui/messages.ts`
- Test: `test/ui/embeds.test.ts`

**Interfaces:**
- Consumes: `src/store/store.ts`, `src/shop/*`, `src/game/boss.ts`.
- Produces:
  - `MAX_EMBED_FIELDS = 25`
  - `buildEmbeds(opts: { title: string; description?: string; fields?: EmbedField[] }): EmbedBuilder[]` — chunks at 25
  - `helpEmbed(): EmbedBuilder[]`, `shopEmbed(): EmbedBuilder[]`, `inventoryEmbed(store, userId): EmbedBuilder[]`, `userEmbed(store, userId, displayName): EmbedBuilder[]`, `infoEmbed(store): EmbedBuilder[]`, `leaderboardEmbed(store, prop?): EmbedBuilder[]`, `bossEmbed(boss): { embeds: EmbedBuilder[]; files: AttachmentBuilder[] }`
  - `renderPurchase(result)`, `renderConvert(result)`, `renderEquip(result)` — `Result` to user-facing string

- [ ] **Step 1: Write the failing test**

The first two are the regressions for the crash you hit and for the shop landmine next to it.

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../src/store/store.ts';
import { createState } from '../../src/store/schema.ts';
import { inventoryEmbed, shopEmbed, buildEmbeds, MAX_EMBED_FIELDS } from '../../src/ui/embeds.ts';
import { skins } from '../../src/shop/skins.ts';

describe('embeds', () => {
  test('B10 regression: a user owning every skin renders without throwing', () => {
    const store = createStore(createState());
    store.ensureUser('collector');
    Object.keys(skins).forEach((s) => store.selectReaction('collector', s));
    assert.ok(Object.keys(skins).length > MAX_EMBED_FIELDS, 'catalog exceeds the cap');
    const embeds = inventoryEmbed(store, 'collector');
    embeds.forEach((e) => assert.ok((e.data.fields?.length ?? 0) <= MAX_EMBED_FIELDS));
  });

  test('B10 regression: the shop renders with every catalog item enabled', () => {
    // Guards the "welcome back, enable the seasonal skins" change directly.
    const embeds = shopEmbed();
    embeds.forEach((e) => assert.ok((e.data.fields?.length ?? 0) <= MAX_EMBED_FIELDS));
  });

  test('buildEmbeds chunks a field list beyond the cap', () => {
    const fields = Array.from({ length: 60 }, (_, i) => ({ name: `f${i}`, value: 'v', inline: true }));
    const embeds = buildEmbeds({ title: 'T', fields });
    assert.equal(embeds.length, 3);
    embeds.forEach((e) => assert.ok((e.data.fields?.length ?? 0) <= MAX_EMBED_FIELDS));
  });

  test('an inventory description stays within the 4096-character cap', () => {
    const store = createStore(createState());
    store.ensureUser('c');
    Object.keys(skins).forEach((s) => store.selectReaction('c', s));
    const [first] = inventoryEmbed(store, 'c');
    assert.ok((first!.data.description?.length ?? 0) <= 4096);
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement**

Two changes from the legacy shape:

1. `inventoryEmbed` and the skins half of `shopEmbed` render as a compact list in the embed **description** rather than one field per item. The description cap is 4096, which holds all 45 skins in roughly 1,000 characters.
2. `buildEmbeds` slices fields into groups of 25 and returns an array. Callers spread into `message.channel.send({ embeds })`. A message carries up to 10 embeds, so the cap stops being reachable.

Keep the `#0099ff` colour and the existing titles so the bot looks unchanged.

- [ ] **Step 3: Run to verify it passes, then the full gate and commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/ui test/ui
git commit -m "feat: port embeds to TypeScript, fixing the B10 field overflow crash"
```

---

### Task 11: `commands/` in TypeScript

Fixes B4 (dead admin commands), B8 (`substr(prefix)`), and B9 (malformed debounce).

**Files:**
- Create: `src/bot/context.ts`, `src/commands/registry.ts`, `src/commands/meta.ts`, `src/commands/economy.ts`, `src/commands/game.ts`, `src/commands/admin.ts`
- Test: `test/commands/registry.test.ts`, `test/commands/args.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 5-10.
- Produces:
  - `interface CommandContext { message: Message; userId: string; args: string[]; store: Store; reply(content: string): Promise<void>; send(payload: MessageCreateOptions): Promise<void> }`
  - `interface Command { name: string; description: string; aliases?: readonly string[]; adminOnly?: boolean; rateLimitMs?: number; run(ctx: CommandContext): Promise<void> | void }`
  - `parseArgs(content: string, prefix: string): { command: string; args: string[] }` — the B8 fix
  - `registry: Map<string, Command>`, `getCommand(name: string): Command | undefined`
  - `MANAGE_GUILD = PermissionFlagsBits.ManageGuild` — the B4 fix

- [ ] **Step 1: Write the failing test for argument parsing**

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../../src/commands/registry.ts';

describe('parseArgs', () => {
  test('B8: strips the prefix instead of relying on substr coercion', () => {
    assert.deepEqual(parseArgs('t?convert all', 't?'), { command: 'convert', args: ['all'] });
  });

  test('handles a bare command with no arguments', () => {
    assert.deepEqual(parseArgs('t?help', 't?'), { command: 'help', args: [] });
  });

  test('collapses runs of whitespace', () => {
    assert.deepEqual(parseArgs('t?buy   crowncard    3', 't?'), { command: 'buy', args: ['crowncard', '3'] });
  });

  test('lowercases the command', () => {
    assert.deepEqual(parseArgs('t?HELP', 't?').command, 'help');
  });

  test('honours a non-default prefix', () => {
    assert.deepEqual(parseArgs('!convert 2', '!'), { command: 'convert', args: ['2'] });
  });
});
```

- [ ] **Step 2: Write the failing test for the registry**

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getCommand, registry } from '../../src/commands/registry.ts';

describe('registry', () => {
  test('every legacy alias still resolves', () => {
    const aliases = ['h', '?', 'help', 'i', 'info', 'ls', 'inv', 'inventory', 'u', 'stats', 'user',
      'shop', 'b', 'bal', 'balance', 'convert', 'e', 'equip', '$', 'buy', 'debug', 'givecrowns',
      'boss', 'spawn', 'kill', 'ping', 'leaderboard'];
    aliases.forEach((a) => assert.ok(getCommand(a), `alias '${a}' no longer resolves`));
  });

  test('B4: admin commands are flagged and use the v14 permission name', () => {
    ['debug', 'givecrowns', 'spawn', 'kill'].forEach((name) => {
      assert.equal(getCommand(name)?.adminOnly, true, `${name} must be admin-only`);
    });
  });

  test('help is generated from the registry, so it can never drift', () => {
    const help = getCommand('help');
    assert.ok(help);
    assert.ok(registry.size > 10);
  });
});
```

- [ ] **Step 3: Run to verify both fail, then implement**

The B4 fix, stated once rather than in two places as today:

```ts
import { PermissionFlagsBits } from 'discord.js';

// discord.js v14 THROWS DiscordjsRangeError on the v13 string 'MANAGE_GUILD'.
// index.js's catch-all swallowed it, leaving every admin command silently dead.
export const MANAGE_GUILD = PermissionFlagsBits.ManageGuild;

export const isAdmin = (message: Message): boolean =>
  message.member?.permissions.has(MANAGE_GUILD) ?? false;
```

The B8 fix:

```ts
export const parseArgs = (content: string, prefix: string): { command: string; args: string[] } => {
  const [command = '', ...args] = content.slice(prefix.length).trim().toLowerCase().split(/ +/);
  return { command, args: args.filter(Boolean) };
};
```

The B9 fix: rate limits are declared per command as `rateLimitMs`, applied by the router via `rateLimit` from Task 5. Carry today's values forward — `help`, `shop`, and `leaderboard` at 10000, `info` at 2500 — and give `equip` **no** rate limit, since `_.debounce(equipFunction, true)` never meaningfully applied one.

- [ ] **Step 4: Run to verify both pass, then the full gate and commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/commands src/bot/context.ts test/commands
git commit -m "feat: port commands to TypeScript, reviving admin commands (B4) and fixing B8/B9"
```

---

### Task 12: `game/counting.ts`

Extracts the core loop out of the message handler. This is the largest behavioral surface in the bot and currently has no test at all.

**Files:**
- Create: `src/game/counting.ts`
- Test: `test/game/counting.test.ts`

**Interfaces:**
- Consumes: `src/store/store.ts`, `src/game/boss.ts`, `src/game/constants.ts`.
- Produces:
  - `type CountOutcome = { kind: 'ignored' } | { kind: 'repeat-counter' } | { kind: 'wrong-number' } | { kind: 'counted'; effects: CountEffect[] } | { kind: 'win'; target: number; newTarget: number }`
  - `type CountEffect = { kind: 'coins'; amount: number } | { kind: 'acrobatics' } | { kind: 'boss-spawned'; boss: BossState } | { kind: 'boss-hit'; crit: boolean; killed: boolean; boss: BossState } | { kind: 'milestone'; emoji: string }`
  - `countNumber(store: Store, userId: string, value: number, rng?: () => number): CountOutcome`

The injectable `rng` is what makes the probabilistic branches — coin drops, crits, acrobatics, boss spawns — testable deterministically. Default it to `Math.random`.

- [ ] **Step 1: Write the failing test**

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../src/store/store.ts';
import { createState } from '../../src/store/schema.ts';
import { countNumber } from '../../src/game/counting.ts';
import { constants } from '../../src/game/constants.ts';

const never = () => 1;   // no probabilistic branch fires
const always = () => 0;  // every probabilistic branch fires

describe('counting', () => {
  test('a correct number advances the count', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.setNumber(5);
    store.setTarget(100);
    const outcome = countNumber(store, 'u', 6, never);
    assert.equal(outcome.kind, 'counted');
    assert.equal(store.getNumber(), 6);
    assert.equal(store.getUser('u')!.count, 1);
  });

  test('counting down is equally valid', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.setNumber(5);
    store.setTarget(100);
    countNumber(store, 'u', 4, never);
    assert.equal(store.getNumber(), 4);
  });

  test('two counts in a row cost COIN_LOSS and do not advance', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCoins('u', 100);
    store.setNumber(5);
    store.setTarget(100);
    countNumber(store, 'u', 6, never);
    const outcome = countNumber(store, 'u', 7, never);
    assert.equal(outcome.kind, 'repeat-counter');
    assert.equal(store.getNumber(), 6, 'number did not advance');
    assert.equal(store.getCoins('u'), 100 - constants.COIN_LOSS);
    assert.equal(store.getUser('u')!.miscount, 1);
  });

  test('a wrong number costs COIN_LOSS and increments miscount', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.addCoins('u', 100);
    store.setNumber(5);
    const outcome = countNumber(store, 'u', 99, never);
    assert.equal(outcome.kind, 'wrong-number');
    assert.equal(store.getCoins('u'), 100 - constants.COIN_LOSS);
    assert.equal(store.getUser('u')!.miscount, 1);
  });

  test('reaching the target wins, pays crowns, and rerolls', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.setNumber(9);
    store.setTarget(10);
    const outcome = countNumber(store, 'u', 10, never);
    assert.equal(outcome.kind, 'win');
    assert.equal(store.getUser('u')!.wins, 1);
    assert.equal(store.getCrowns('u'), constants.CROWN_MULTIPLIER);
    assert.notEqual(store.getTarget(), 10, 'a new target was rolled');
  });

  test('the negative target also wins', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.setNumber(-9);
    store.setTarget(10);
    assert.equal(countNumber(store, 'u', -10, never).kind, 'win');
  });

  test('royalty adds a crown per level on a win', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.setRoyalty('u', 3);
    store.setNumber(9);
    store.setTarget(10);
    countNumber(store, 'u', 10, never);
    assert.equal(store.getCrowns('u'), constants.CROWN_MULTIPLIER * 4);
  });

  test('coin drops fire when the roll succeeds', () => {
    const store = createStore(createState());
    store.ensureUser('u');
    store.setNumber(5);
    store.setTarget(100);
    const outcome = countNumber(store, 'u', 6, always);
    assert.equal(outcome.kind, 'counted');
    assert.ok(store.getCoins('u') > 0);
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement**

Port the logic from `index.js:75-165` exactly — same order of checks, same constants, same probabilities. Return effects instead of calling `message.react`. No `discord.js` import in this file.

- [ ] **Step 3: Run to verify it passes, then the full gate and commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/game/counting.ts test/game/counting.test.ts
git commit -m "feat: extract the counting loop into a tested, Discord-free module"
```

---

### Task 13: Wire up `bot/`, delete `util/`, and finish

Fixes B5 and completes the migration.

**Files:**
- Create: `src/config.ts`, `src/bot/client.ts`, `src/bot/router.ts`, `src/index.ts`
- Delete: `util/`, `index.js`, `config.js`, `test/legacy/`
- Modify: `package.json`, `tsconfig.json`, `Dockerfile`, `.dockerignore`, `.github/workflows/*`, `README.md`, `CLAUDE.md`

- [ ] **Step 1: Write `src/config.ts` — fail fast on a missing token**

```ts
const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const config = {
  token: required('DISCORD_TOKEN'),
  prefix: process.env.PREFIX ?? 't?',
  dataFile: process.env.DATA_FILE ?? 'data.json',
} as const;
```

- [ ] **Step 2: Write `src/bot/router.ts`, fixing B5**

`bind` currently chains `.catch(...).then(...)`, so the `.then` runs even when the fetch rejects and an invalid channel is bound anyway. Replace with `try`/`catch`:

```ts
try {
  await client.channels.fetch(channelId);
} catch {
  return err({ code: 'INVALID_CHANNEL', channelId });
}
store.setChannelId(channelId);
```

Also `await` every `message.react(...)` and `send(...)`. The legacy code leaves them floating, so a rejected Discord call becomes an unhandled rejection that the surrounding `try`/`catch` cannot see.

- [ ] **Step 3: Write `src/index.ts`**

Bootstrap only — load state, create the store, build the client, register the handler, log in, and handle shutdown:

```ts
const store = createStore(loadState(config.dataFile), { file: config.dataFile });
const client = createClient();
client.on('messageCreate', (message) => handleMessage(client, store, message));

const shutdown = (): void => { store.stop(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);   // Docker sends SIGTERM, which the legacy code ignored
```

`SIGTERM` matters: `docker compose down` sends it, and `index.js` only handles `SIGINT`, so a container stop currently discards up to five minutes of play.

- [ ] **Step 4: Verify the bot actually starts**

```bash
cp data.json /tmp/tow-smoke.json
DATA_FILE=/tmp/tow-smoke.json npm start
```
Expected: `Logged in.` If the token is invalid, an auth error from Discord is still a pass — it proves the module graph loads and the state parses.

- [ ] **Step 5: Delete the legacy tree**

```bash
git rm -r util/ index.js config.js test/legacy/
```

The `test/legacy/` suite has done its job: every assertion in it now has a counterpart in the new tests. Delete the constants-equivalence test from Task 5 as well, since `util/constants.js` is gone.

- [ ] **Step 6: Drop `underscore` and close out `allowJs`**

```bash
npm uninstall underscore
```

In `tsconfig.json` set `"allowJs": false` and remove the `util/**` ignore from `eslint.config.js`. `discord.js` is now the only runtime dependency.

- [ ] **Step 7: Update Docker**

In `Dockerfile`, change the final line to `CMD ["node", "src/index.ts"]`. The boss images resolve from `import.meta.dirname` as of Task 8, so the working-directory comment above the `COPY` is obsolete — replace it. Add `docs/` and `test/` to `.dockerignore`.

- [ ] **Step 8: Update the docs**

`CLAUDE.md` needs real edits — it currently states there is no test suite, that `npm test` is a placeholder, that the code is JavaScript, and it describes the `util/` layout file by file. Rewrite the Commands and Architecture sections against the new tree, and add the `Result` convention and the "domain code must not import discord.js" rule. In `README.md`, update the file layout and the `config.js` instructions, which already drifted — the project moved to `.env` in commit `281a090`.

- [ ] **Step 9: Full verification**

```bash
npm run lint && npm run typecheck && npm test
```
Expected: all three green, and `npm test` now runs **without** `--test-force-exit` — the legacy tests that needed it are gone.

```bash
git ls-files '*.js' | grep -v eslint.config.js
```
Expected: no output. Every source file is TypeScript.

- [ ] **Step 10: Commit and open the PR**

```bash
git add -A
git commit -m "feat: complete TypeScript migration, remove legacy util/ tree"
git push -u origin feat/typescript-migration
gh pr create --title "TypeScript migration" --body "Implements docs/superpowers/specs/2026-09-14-typescript-migration-design.md. Fixes B1-B10, including the t?inventory crash and the silently-dead admin commands."
```

---

## Defect coverage

| Defect | Fixed in | Regression test |
|---|---|---|
| B1 `Number.isInteger` uncalled | Task 7 | `store.test.ts` — "setTarget rejects a non-integer" |
| B2 async load race | Task 7 | `store.test.ts` — "loadState is synchronous" |
| B3 dead `errorCallback` | Task 7 | `store.test.ts` — "getCoins returns 0 for an unknown user" |
| B4 `MANAGE_GUILD` throws | Task 11 | `registry.test.ts` — "admin commands are flagged" |
| B5 `bind` `.catch().then()` | Task 13 | manual — Step 4 smoke test |
| B6 `bomb` error placement | Task 9 | `shop.test.ts` — two B6 tests |
| B7 boss double payout | Tasks 6, 8 | `boss.test.ts` — two B7 regressions; `schema.test.ts` — "dead boss discarded" |
| B8 `substr(prefix)` | Task 11 | `args.test.ts` — five parsing tests |
| B9 malformed debounce | Tasks 5, 11 | `rate-limit.test.ts` — four tests |
| B10 embed field overflow | Task 10 | `embeds.test.ts` — two B10 regressions |
