import type { Client, Message, MessageCreateOptions } from 'discord.js';
import { getCommand, isAdmin, parseArgs } from '../commands/registry.ts';
import { countNumber, type CountEffect } from '../game/counting.ts';
import { equippedEmoji } from '../game/economy.ts';
import { bossEmbed } from '../ui/embeds.ts';
import { rateLimit } from '../lib/rate-limit.ts';
import { constants } from '../game/constants.ts';
import { err, ok, type Result } from '../lib/result.ts';
import type { CommandContext } from './context.ts';
import type { Store } from '../store/store.ts';

const limiters = new Map<string, (fn: () => void) => void>();

/** Applies a command's declared rate limit, sharing one limiter per command. */
const withRateLimit = (name: string, waitMs: number | undefined, run: () => void): void => {
  if (!waitMs) {
    run();
    return;
  }
  let limiter = limiters.get(name);
  if (!limiter) {
    limiter = rateLimit((fn: () => void) => fn(), waitMs);
    limiters.set(name, limiter);
  }
  limiter(run);
};

export const bind = async (
  client: Client,
  store: Store,
  message: Message,
  rawChannel: string | undefined,
): Promise<Result<{ channelId: string }, { code: 'INVALID_CHANNEL' | 'MISSING_PERMISSION' }>> => {
  if (!isAdmin(message)) return err({ code: 'MISSING_PERMISSION' as const });

  const channelId = rawChannel?.replace(/\D/g, '');
  if (!channelId) return err({ code: 'INVALID_CHANNEL' as const });

  // Legacy chained .catch().then(), so the .then ran even when the fetch
  // rejected and an invalid channel id was bound anyway.
  try {
    await client.channels.fetch(channelId);
  } catch {
    return err({ code: 'INVALID_CHANNEL' as const });
  }

  store.setChannelId(channelId);
  return ok({ channelId });
};

const applyEffects = async (
  message: Message,
  send: (payload: MessageCreateOptions) => Promise<void>,
  effects: CountEffect[],
): Promise<boolean> => {
  let reacted = false;
  for (const effect of effects) {
    if (effect.kind === 'acrobatics') {
      await message.react(constants.ACROBATICS_EMOJI);
      reacted = true;
    } else if (effect.kind === 'coins') {
      await message.react('💰');
      reacted = true;
    } else if (effect.kind === 'milestone') {
      await message.react(effect.emoji);
      reacted = true;
    } else if (effect.kind === 'boss-spawned') {
      const { embeds, files } = bossEmbed(effect.boss);
      await send({ embeds, files });
    } else {
      if (effect.crit) {
        await message.react('💓');
        reacted = true;
      }
      if (effect.killed) {
        await send({
          content: `${effect.boss.bossName} was calmed down by ${message.author}! Paying rewards to everyone who helped...`,
        });
      }
    }
  }
  return reacted;
};

export const handleMessage = async (
  client: Client,
  store: Store,
  message: Message,
  prefix: string,
): Promise<void> => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.channel.isSendable()) return;

    const { channel } = message;
    const send = async (payload: MessageCreateOptions): Promise<void> => {
      await channel.send(payload);
    };

    const userId = message.author.id;
    store.ensureUser(userId);

    if (message.content.toLowerCase() === 'blaze it') {
      store.selectReaction(userId, 'blazeit');
    }

    if (message.content.startsWith(prefix)) {
      const { command, args } = parseArgs(message.content, prefix);

      // bind runs before the bound-channel guards so a fresh server can recover.
      if (command === 'bind') {
        const result = await bind(client, store, message, args[0]);
        await send({
          content: result.ok
            ? `Bound to <#${result.value.channelId}>.`
            : `${message.author}: could not bind to that channel.`,
        });
        return;
      }

      if (!store.getChannelId()) {
        await send({
          content: `Bot must be bound to a channel with \`${prefix}bind #<channel-name>\`.`,
        });
        return;
      }
      if (message.channel.id !== store.getChannelId()) return;

      const handler = getCommand(command);
      if (!handler) return;
      if (handler.adminOnly && !isAdmin(message)) return;

      const ctx: CommandContext = {
        message,
        userId,
        args,
        store,
        prefix,
        reply: async (content) => { await send({ content: `${message.author}: ${content}` }); },
        send,
      };

      withRateLimit(handler.name, handler.rateLimitMs, () => {
        void Promise.resolve(handler.run(ctx)).catch((e: unknown) => console.error(e));
      });
      return;
    }

    if (message.channel.id !== store.getChannelId()) return;

    const { command } = parseArgs(message.content, '');
    const value = Number.parseInt(command, 10);
    if (Number.isNaN(value)) return;

    const outcome = countNumber(store, userId, value);

    if (outcome.kind === 'repeat-counter') {
      await message.react(constants.REACT_TIMEOUT);
      return;
    }
    if (outcome.kind === 'wrong-number') {
      await message.react(constants.REACT_INCORRECT);
      return;
    }
    if (outcome.kind === 'win') {
      await message.react(equippedEmoji(store, userId, constants.REACT_CORRECT));
      await send({
        content: `👑 Congrats ${message.author}! New target: ±${outcome.newTarget}.`,
      });
      return;
    }

    const reacted = await applyEffects(message, send, outcome.effects);
    if (!reacted) await message.react(constants.REACT_CORRECT);
  } catch (error) {
    console.error(error);
  }
};
