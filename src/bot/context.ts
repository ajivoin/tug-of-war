import type { Message, MessageCreateOptions } from 'discord.js';
import type { Store } from '../store/store.ts';

export interface CommandContext {
  message: Message;
  userId: string;
  args: string[];
  store: Store;
  prefix: string;
  /** Sends a plain reply, prefixed with the author mention. */
  reply(content: string): Promise<void>;
  send(payload: MessageCreateOptions): Promise<void>;
}

export interface Command {
  name: string;
  description: string;
  aliases?: readonly string[];
  adminOnly?: boolean;
  rateLimitMs?: number;
  run(ctx: CommandContext): Promise<void> | void;
}
