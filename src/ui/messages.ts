import type { Result } from '../lib/result.ts';
import type { ConvertError, ConvertSuccess, EquipError } from '../game/economy.ts';
import type { PurchaseEffect, PurchaseError } from '../shop/shop.ts';

const purchaseError = (error: PurchaseError): string => {
  switch (error.code) {
    case 'NOT_ENOUGH_COINS':
      return `You don't have enough coins. That costs ${error.price}c and you have ${error.had}c.`;
    case 'UNKNOWN_ITEM':
      return `There's no item called \`${error.item}\` in the shop.`;
    case 'ALREADY_OWNED':
      return 'You already own this reaction skin.';
    case 'MAX_LEVEL':
      return `You already have the maximum ${error.upgrade} level!`;
    case 'NO_ACTIVE_BOSS':
      return 'There is no active boss right now.';
    default:
      return 'That purchase failed.';
  }
};

const purchaseEffect = (effect: PurchaseEffect): string => {
  switch (effect.kind) {
    case 'number-changed':
      return `${effect.label} The current number is now ${effect.number}.`;
    case 'target-changed':
      return `🎲 Reroll! Target number is now ±${effect.target}.`;
    case 'upgrade':
      return `Your ${effect.upgrade} level is now ${effect.level}.`;
    case 'skin':
      return `${effect.emoji} You bought a reaction skin!`;
    case 'crowns':
      return `💳 You have purchased a Crown Gift Card! (+${effect.amount} 👑)`;
    case 'boss-damaged':
      return effect.killed ? `⚔ ${effect.bossName} defeated!` : `💣 ${effect.bossName} was bombed!`;
    default:
      return 'Done.';
  }
};

export const renderPurchase = (result: Result<PurchaseEffect, PurchaseError>): string => (
  result.ok ? purchaseEffect(result.value) : purchaseError(result.error)
);

export const renderConvert = (result: Result<ConvertSuccess, ConvertError>): string => {
  if (result.ok) return `👑💨 You've gained ${result.value.coinsGained}c!`;
  if (result.error.code === 'NOT_ENOUGH_CROWNS') {
    return `Oopsies! You have ${result.error.had} Crowns and tried to convert ${result.error.wanted}.`;
  }
  return `\`${result.error.input}\` isn't a number of crowns I understand.`;
};

export const renderEquip = (result: Result<{ skin: string }, EquipError>, emoji: string): string => (
  result.ok ? `${emoji} You equipped a reaction skin!` : 'You do not own this reaction skin.'
);
