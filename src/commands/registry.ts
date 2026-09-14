import { PermissionFlagsBits, type Message } from 'discord.js';
import type { Command } from '../bot/context.ts';
import { metaCommands } from './meta.ts';
import { economyCommands } from './economy.ts';
import { gameCommands } from './game.ts';
import { adminCommands } from './admin.ts';

/**
 * discord.js v14 THROWS DiscordjsRangeError on the v13 string 'MANAGE_GUILD'.
 * index.js's catch-all swallowed it, leaving every admin command silently dead
 * since the v14 upgrade.
 */
export const MANAGE_GUILD = PermissionFlagsBits.ManageGuild;

export const isAdmin = (message: Message): boolean => message.member?.permissions.has(MANAGE_GUILD) ?? false;

/** Strips the prefix and splits. Replaces `content.substr(prefix)`, where the string prefix coerced to NaN. */
export const parseArgs = (content: string, prefix: string): { command: string; args: string[] } => {
  const [command = '', ...args] = content.slice(prefix.length).trim().toLowerCase().split(/ +/);
  return { command, args: args.filter(Boolean) };
};

export const allCommands: readonly Command[] = [
  ...metaCommands,
  ...economyCommands,
  ...gameCommands,
  ...adminCommands,
];

export const registry = new Map<string, Command>();
allCommands.forEach((command) => {
  registry.set(command.name, command);
  command.aliases?.forEach((alias) => registry.set(alias, command));
});

export const getCommand = (name: string): Command | undefined => registry.get(name);

/** Commands shown in `t?help` - admin commands are omitted, as in the legacy list. */
export const helpEntries = (): { name: string; description: string }[] => allCommands
  .filter((c) => !c.adminOnly && c.description.length > 0)
  .map((c) => ({ name: c.name, description: c.description }));
