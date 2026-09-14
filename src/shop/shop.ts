import { constants } from '../game/constants.ts';
import { getRandomInt } from '../lib/random.ts';
import { ok, err, type Result } from '../lib/result.ts';
import { bombBoss } from '../game/boss.ts';
import { enabledPowerups } from './powerups.ts';
import { enabledSkins, skinEmoji } from './skins.ts';
import type { Store } from '../store/store.ts';

export type PurchaseError =
  | { code: 'NOT_ENOUGH_COINS'; price: number; had: number }
  | { code: 'UNKNOWN_ITEM'; item: string }
  | { code: 'ALREADY_OWNED'; item: string }
  | { code: 'MAX_LEVEL'; upgrade: string; level: number }
  | { code: 'NO_ACTIVE_BOSS' };

export type PurchaseEffect =
  | { kind: 'number-changed'; label: string; number: number }
  | { kind: 'target-changed'; target: number }
  | { kind: 'upgrade'; upgrade: string; level: number }
  | { kind: 'skin'; skin: string; emoji: string }
  | { kind: 'crowns'; amount: number }
  | { kind: 'boss-damaged'; bossName: string; killed: boolean }
  /** Applied, but announces nothing — the point of sneak is that nobody sees it. */
  | { kind: 'silent' };

const UPGRADES = {
  crit: { get: 'getCritBonus', set: 'setCritBonus', max: constants.MAX_CRIT_LEVEL },
  acrobatics: { get: 'getAcrobatics', set: 'setAcrobatics', max: constants.MAX_ACRO_LEVEL },
  royalty: { get: 'getRoyalty', set: 'setRoyalty', max: constants.MAX_ROYALTY_LEVEL },
} as const;

type UpgradeName = keyof typeof UPGRADES;

const isUpgrade = (item: string): item is UpgradeName => item in UPGRADES;

const buyUpgrade = (store: Store, userId: string, name: UpgradeName): Result<PurchaseEffect, PurchaseError> => {
  const { max } = UPGRADES[name];
  const current = name === 'crit'
    ? store.getCritBonus(userId)
    : name === 'acrobatics' ? store.getAcrobatics(userId) : store.getRoyalty(userId);

  if (current >= max) return err({ code: 'MAX_LEVEL' as const, upgrade: name, level: current });

  const next = current + 1;
  if (name === 'crit') store.setCritBonus(userId, next);
  else if (name === 'acrobatics') store.setAcrobatics(userId, next);
  else store.setRoyalty(userId, next);

  return ok({ kind: 'upgrade' as const, upgrade: name, level: next });
};

const applyPowerup = (
  store: Store,
  userId: string,
  item: string,
  quantity: number,
): Result<PurchaseEffect, PurchaseError> => {
  switch (item) {
    case 'reroll':
      store.clearLastUserId();
      store.setTarget(getRandomInt(0, constants.WIN));
      return ok({ kind: 'target-changed' as const, target: store.getTarget() });

    case 'zero':
      store.clearLastUserId();
      store.setNumber(0);
      return ok({ kind: 'number-changed' as const, label: '💩 Zero!', number: 0 });

    case 'teleport': {
      store.clearLastUserId();
      const magnitude = getRandomInt(constants.TP_MIN, constants.TP_MAX);
      store.addToNumber(Math.random() < 0.5 ? -magnitude : magnitude);
      return ok({ kind: 'number-changed' as const, label: '🧙‍♂️ Teleport!', number: store.getNumber() });
    }

    case 'fliparoo': {
      store.clearLastUserId();
      const current = store.getNumber();
      const target = store.getTarget();
      store.setNumber(Math.sign(current) * target);
      store.setTarget(Math.abs(current));
      return ok({ kind: 'number-changed' as const, label: '😵 Fliparoo!', number: store.getNumber() });
    }

    case 'nice':
      store.clearLastUserId();
      store.setNumber(69);
      return ok({ kind: 'number-changed' as const, label: 'Nice 😎.', number: 69 });

    case 'sneak': {
      store.clearLastUserId();
      store.addToNumber(Math.sign(store.getTarget() - store.getNumber()));
      return ok({ kind: 'silent' as const });
    }

    case 'sqrt': {
      store.clearLastUserId();
      const current = store.getNumber();
      store.setNumber(Math.sign(current) * Math.floor(Math.sqrt(Math.abs(current))));
      return ok({ kind: 'number-changed' as const, label: '👩‍🏫 Square Root!', number: store.getNumber() });
    }

    case 'crowncard':
      store.addCrowns(userId, quantity);
      return ok({ kind: 'crowns' as const, amount: quantity });

    case 'bomb': {
      const result = bombBoss(store, userId);
      if (!result.ok) return err({ code: 'NO_ACTIVE_BOSS' as const });
      return ok({ kind: 'boss-damaged' as const, bossName: result.value.bossName, killed: result.value.killed });
    }

    default:
      return err({ code: 'UNKNOWN_ITEM' as const, item });
  }
};

/**
 * Resolves the item, prices it, applies the effect, and charges ONLY on
 * success. Ordering matters: it makes a failed purchase that still took coins
 * unrepresentable, which is what B6 was.
 */
export const buy = (
  store: Store,
  userId: string,
  item: string,
  quantityArg?: string,
): Result<PurchaseEffect, PurchaseError> => {
  const powerup = enabledPowerups[item];
  const skin = enabledSkins[item];

  if (!powerup && !skin) return err({ code: 'UNKNOWN_ITEM' as const, item });

  const had = store.getCoins(userId);

  if (powerup) {
    let quantity = 1;
    let price = powerup.price;

    if (powerup.quantified) {
      if (quantityArg?.toLowerCase() === 'max') {
        quantity = Math.max(1, Math.floor(had / price));
      } else if (quantityArg !== undefined) {
        const parsed = Number.parseInt(quantityArg, 10);
        if (!Number.isNaN(parsed) && parsed > 0) quantity = parsed;
      }
      price *= quantity;
    }

    if (had < price) return err({ code: 'NOT_ENOUGH_COINS' as const, price, had });

    const result = isUpgrade(item)
      ? buyUpgrade(store, userId, item)
      : applyPowerup(store, userId, item, quantity);

    if (!result.ok) return result;
    store.removeCoins(userId, price);
    return result;
  }

  if (had < skin!.price) return err({ code: 'NOT_ENOUGH_COINS' as const, price: skin!.price, had });
  if (store.hasReaction(userId, item)) return err({ code: 'ALREADY_OWNED' as const, item });

  store.removeCoins(userId, skin!.price);
  store.selectReaction(userId, item);
  return ok({ kind: 'skin' as const, skin: item, emoji: skinEmoji(item) ?? '' });
};
