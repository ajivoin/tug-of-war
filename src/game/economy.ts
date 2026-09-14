import { constants } from './constants.ts';
import { ok, err, type Result } from '../lib/result.ts';
import type { Store } from '../store/store.ts';
import { skinEmoji } from '../shop/skins.ts';

export type ConvertError =
  | { code: 'NOT_ENOUGH_CROWNS'; had: number; wanted: number }
  | { code: 'INVALID_AMOUNT'; input: string };

export interface ConvertSuccess { crownsSpent: number; coinsGained: number }

/**
 * Converts crowns to coins. `arg` is undefined for a bare `convert`, a positive
 * integer, or the literal "all".
 */
export const convert = (
  store: Store,
  userId: string,
  arg?: string,
): Result<ConvertSuccess, ConvertError> => {
  const had = store.getCrowns(userId);

  let wanted: number;
  if (arg === undefined) {
    wanted = 1;
  } else if (arg.toLowerCase() === 'all') {
    wanted = had;
  } else {
    const parsed = Number.parseInt(arg, 10);
    if (Number.isNaN(parsed) || parsed <= 0) return err({ code: 'INVALID_AMOUNT' as const, input: arg });
    wanted = parsed;
  }

  if (wanted <= 0 || had < wanted) return err({ code: 'NOT_ENOUGH_CROWNS' as const, had, wanted });

  const coinsGained = wanted * constants.CONVERSION_RATE;
  store.removeCrowns(userId, wanted);
  store.addCoins(userId, coinsGained);
  return ok({ crownsSpent: wanted, coinsGained });
};

export interface EquipError { code: 'NOT_OWNED'; item: string }

export const equip = (
  store: Store,
  userId: string,
  reactionId: string,
): Result<{ skin: string }, EquipError> => {
  if (!store.hasReaction(userId, reactionId)) return err({ code: 'NOT_OWNED' as const, item: reactionId });
  store.selectReaction(userId, reactionId);
  return ok({ skin: reactionId });
};

/**
 * The emoji a user's correct counts are reacted with. Falls back to the default
 * correct-answer emoji when nothing is equipped or the equipped skin has no
 * emoji, matching legacy `getReaction`.
 */
export const equippedEmoji = (store: Store, userId: string, fallback: string): string => {
  const reactions = store.getReactions(userId);
  const selected = Object.keys(reactions).find((r) => reactions[r]);
  return (selected ? skinEmoji(selected) : undefined) ?? fallback;
};
