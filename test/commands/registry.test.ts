import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getCommand, registry, parseArgs, helpEntries } from '../../src/commands/registry.ts';

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
    assert.equal(parseArgs('t?HELP', 't?').command, 'help');
  });

  test('honours a non-default prefix', () => {
    assert.deepEqual(parseArgs('!convert 2', '!'), { command: 'convert', args: ['2'] });
  });
});

describe('registry', () => {
  test('every legacy alias still resolves', () => {
    const aliases = ['h', '?', 'help', 'i', 'info', 'ls', 'inv', 'inventory', 'u', 'stats', 'user',
      'shop', 'b', 'bal', 'balance', 'convert', 'e', 'equip', '$', 'buy', 'debug', 'givecrowns',
      'boss', 'spawn', 'kill', 'ping', 'leaderboard'];
    aliases.forEach((a) => assert.ok(getCommand(a), `alias '${a}' no longer resolves`));
  });

  test('B4: admin commands are flagged so the permission check reaches them', () => {
    ['debug', 'givecrowns', 'spawn', 'kill'].forEach((name) => {
      assert.equal(getCommand(name)?.adminOnly, true, `${name} must be admin-only`);
    });
  });

  test('non-admin commands are not flagged', () => {
    ['help', 'info', 'buy', 'balance', 'boss'].forEach((name) => {
      assert.notEqual(getCommand(name)?.adminOnly, true, `${name} must not be admin-only`);
    });
  });

  test('B4: MANAGE_GUILD uses the v14 flag, which the v13 string is not', async () => {
    const { PermissionsBitField } = await import('discord.js');
    const { MANAGE_GUILD } = await import('../../src/commands/registry.ts');
    assert.equal(MANAGE_GUILD, PermissionsBitField.Flags.ManageGuild);
    // The legacy spelling throws rather than returning false - that is why the
    // catch-all in index.js silently disabled every admin command.
    assert.throws(() => new PermissionsBitField(MANAGE_GUILD).has('MANAGE_GUILD' as never));
  });

  test('help is generated from the registry, so it cannot drift', () => {
    assert.ok(registry.size > 20);
    const entries = helpEntries();
    assert.ok(entries.some((e) => e.name === 'buy'));
    assert.ok(!entries.some((e) => e.name === 'debug'), 'admin commands are hidden');
    entries.forEach((e) => assert.ok(e.description.length > 0, `${e.name} needs a description`));
  });

  test('B9: rate limits carry legacy values and equip has none', () => {
    assert.equal(getCommand('help')?.rateLimitMs, 10_000);
    assert.equal(getCommand('shop')?.rateLimitMs, 10_000);
    assert.equal(getCommand('leaderboard')?.rateLimitMs, 10_000);
    assert.equal(getCommand('info')?.rateLimitMs, 2_500);
    // _.debounce(equipFunction, true) passed `true` as the wait in ms, so equip
    // was never meaningfully rate-limited. Carried forward as no limit.
    assert.equal(getCommand('equip')?.rateLimitMs, undefined);
  });
});
