import type { Command } from '../bot/context.ts';
import { spawnBoss, distributeRewards } from '../game/boss.ts';
import { bossEmbed } from '../ui/embeds.ts';

const debug: Command = {
  name: 'debug',
  description: '',
  adminOnly: true,
  run: async (ctx) => {
    const target = ctx.message.mentions.members?.first()?.id;
    if (!target) return;
    await ctx.send({ content: `\`\`\`json\n${JSON.stringify(ctx.store.getUser(target), null, 2)}\n\`\`\`` });
  },
};

const givecrowns: Command = {
  name: 'givecrowns',
  description: '',
  adminOnly: true,
  run: (ctx) => {
    const target = ctx.message.mentions.members?.first()?.id;
    if (!target) return;
    const amount = Number.parseInt(ctx.args[1] ?? '', 10);
    if (Number.isNaN(amount) || amount === 0) return;
    ctx.store.ensureUser(target);
    if (amount > 0) ctx.store.addCrowns(target, amount);
    else ctx.store.removeCrowns(target, -amount);
  },
};

const spawn: Command = {
  name: 'spawn',
  description: '',
  adminOnly: true,
  run: async (ctx) => {
    const boss = spawnBoss(ctx.store);
    const { embeds, files } = bossEmbed(boss);
    await ctx.send({ embeds, files });
  },
};

const kill: Command = {
  name: 'kill',
  description: '',
  adminOnly: true,
  run: (ctx) => {
    const boss = ctx.store.getBoss();
    if (!boss) return;
    distributeRewards(ctx.store, boss);
    ctx.store.setBoss(null);
  },
};

export const adminCommands: readonly Command[] = [debug, givecrowns, spawn, kill];
