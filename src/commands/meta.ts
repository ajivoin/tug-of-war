import type { Command } from '../bot/context.ts';
import {
  helpEmbed, infoEmbed, userEmbed, leaderboardEmbed,
} from '../ui/embeds.ts';

const help: Command = {
  name: 'help',
  description: 'shows all commands',
  aliases: ['h', '?'],
  rateLimitMs: 10_000,
  run: async (ctx) => {
    // Imported lazily to avoid a cycle: registry -> meta -> registry.
    const { helpEntries } = await import('./registry.ts');
    await ctx.send({ embeds: helpEmbed(ctx.prefix, helpEntries()) });
  },
};

const info: Command = {
  name: 'info',
  description: 'shows the current number and target number',
  aliases: ['i', 'ls'],
  rateLimitMs: 2_500,
  run: async (ctx) => {
    const { embeds, files } = infoEmbed(ctx.store);
    await ctx.send({ embeds, files });
  },
};

const user: Command = {
  name: 'user',
  description: 'shows your statistics',
  aliases: ['u', 'stats'],
  run: async (ctx) => {
    const record = ctx.store.ensureUser(ctx.userId);
    const name = ctx.message.member?.displayName ?? ctx.message.author.username;
    await ctx.send({ embeds: userEmbed(record, name) });
  },
};

const leaderboard: Command = {
  name: 'leaderboard',
  description: 'show leaderboard',
  rateLimitMs: 10_000,
  run: async (ctx) => {
    await ctx.send({ embeds: leaderboardEmbed(ctx.store) });
  },
};

const ping: Command = {
  name: 'ping',
  description: 'Pong!',
  run: async (ctx) => {
    await ctx.message.react('☑');
  },
};

export const metaCommands: readonly Command[] = [help, info, user, leaderboard, ping];
