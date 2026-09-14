import type { Command } from '../bot/context.ts';
import { bossEmbed } from '../ui/embeds.ts';

const boss: Command = {
  name: 'boss',
  description: 'shows information on current boss',
  run: async (ctx) => {
    const current = ctx.store.getBoss();
    if (!current) {
      await ctx.send({ content: 'There is no boss right now. Count to lure one!' });
      return;
    }
    const { embeds, files } = bossEmbed(current);
    await ctx.send({ embeds, files });
  },
};

export const gameCommands: readonly Command[] = [boss];
