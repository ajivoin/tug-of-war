import type { Command } from '../bot/context.ts';
import { buy } from '../shop/shop.ts';
import { convert, equip } from '../game/economy.ts';
import { renderPurchase, renderConvert, renderEquip } from '../ui/messages.ts';
import { shopEmbed, inventoryEmbed } from '../ui/embeds.ts';
import { skinEmoji } from '../shop/skins.ts';

const balance: Command = {
  name: 'balance',
  description: 'shows your crown and coin balance',
  aliases: ['b', 'bal'],
  run: async (ctx) => {
    await ctx.reply(`${ctx.store.getCrowns(ctx.userId)} Crowns; ${ctx.store.getCoins(ctx.userId)}c`);
  },
};

const convertCommand: Command = {
  name: 'convert',
  description: 'converts crowns to coins (`convert <n>` or `convert all`)',
  run: async (ctx) => {
    await ctx.reply(renderConvert(convert(ctx.store, ctx.userId, ctx.args[0])));
  },
};

const shop: Command = {
  name: 'shop',
  description: 'shows items in the shop',
  rateLimitMs: 10_000,
  run: async (ctx) => {
    await ctx.send({ embeds: shopEmbed(ctx.prefix) });
  },
};

const inventory: Command = {
  name: 'inventory',
  description: 'shows your inventory',
  aliases: ['inv'],
  run: async (ctx) => {
    ctx.store.ensureUser(ctx.userId);
    await ctx.send({ embeds: inventoryEmbed(ctx.store, ctx.userId, ctx.prefix) });
  },
};

const equipCommand: Command = {
  name: 'equip',
  description: 'equip a reaction skin',
  aliases: ['e'],
  run: async (ctx) => {
    const item = ctx.args[0];
    if (!item) return;
    const result = equip(ctx.store, ctx.userId, item);
    await ctx.reply(renderEquip(result, skinEmoji(item) ?? ''));
  },
};

const buyCommand: Command = {
  name: 'buy',
  description: 'buys item from the shop (`buy <item> [n]`)',
  aliases: ['$'],
  run: async (ctx) => {
    const item = ctx.args[0];
    if (!item) return;
    ctx.store.ensureUser(ctx.userId);
    await ctx.reply(renderPurchase(buy(ctx.store, ctx.userId, item, ctx.args[1])));
  },
};

export const economyCommands: readonly Command[] = [
  balance, convertCommand, shop, inventory, equipCommand, buyCommand,
];
