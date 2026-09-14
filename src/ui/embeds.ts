import fs from 'node:fs';
import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { enabledPowerups } from '../shop/powerups.ts';
import { enabledSkins, skins, type Skin } from '../shop/skins.ts';
import { levelText } from '../game/boss.ts';
import { constants } from '../game/constants.ts';
import { userIdToMention } from '../lib/text.ts';
import type { BossState, User } from '../store/schema.ts';
import type { Store } from '../store/store.ts';

/** Discord rejects an embed with more than 25 fields. */
export const MAX_EMBED_FIELDS = 25;
/** Discord rejects an embed description longer than 4096 characters. */
export const MAX_DESCRIPTION = 4096;

const COLOR = '#0099ff';

export interface EmbedField { name: string; value: string; inline?: boolean }

export interface EmbedSpec {
  title: string;
  description?: string;
  fields?: EmbedField[];
}

/**
 * Builds one or more embeds, chunking fields at Discord's limit. Returning an
 * array rather than a single builder is what makes the overflow that crashed
 * `t?inventory` unrepresentable: a message carries up to 10 embeds.
 */
export const buildEmbeds = ({ title, description, fields = [] }: EmbedSpec): EmbedBuilder[] => {
  const chunks: EmbedField[][] = [];
  for (let i = 0; i < fields.length; i += MAX_EMBED_FIELDS) {
    chunks.push(fields.slice(i, i + MAX_EMBED_FIELDS));
  }
  if (chunks.length === 0) chunks.push([]);

  return chunks.map((chunk, index) => {
    const embed = new EmbedBuilder().setColor(COLOR).setTitle(index === 0 ? title : `${title} (cont.)`);
    if (index === 0 && description) embed.setDescription(description.slice(0, MAX_DESCRIPTION));
    if (chunk.length > 0) embed.addFields(...chunk);
    return embed;
  });
};

export const helpEmbed = (prefix: string, commands: { name: string; description: string }[]): EmbedBuilder[] => buildEmbeds({
  title: 'Help',
  description: 'Information on available commands.',
  fields: commands.map((c) => ({ name: `${prefix}${c.name}`, value: c.description, inline: true })),
});

/**
 * Powerups stay as fields; skins render as a description list. A one-field-per
 * skin layout put the shop 7 entries from Discord's cap, so enabling retired
 * seasonal skins would have broken it for everyone at once.
 */
export const shopEmbed = (prefix: string): EmbedBuilder[] => {
  const skinList = Object.entries(enabledSkins)
    .map(([id, skin]: [string, Skin]) => `${skin.emoji} \`${id}\` — ${skin.price}c`)
    .join('\n');

  return buildEmbeds({
    title: 'Shop',
    description: `Purchase items with \`${prefix}buy <item name>\`.\n\n**Reaction skins**\n${skinList}`,
    fields: Object.entries(enabledPowerups).map(([id, item]) => ({
      name: `${id} (${item.price})`,
      value: item.description,
      inline: true,
    })),
  });
};

/** Renders owned skins as a description list, which has no practical ceiling. */
export const inventoryEmbed = (store: Store, userId: string, prefix: string): EmbedBuilder[] => {
  const reactions = store.getReactions(userId);
  const owned = Object.keys(reactions);
  const catalog = skins as Record<string, Skin | undefined>;

  const list = owned.length === 0
    ? '_Nothing yet — buy a skin from the shop._'
    : owned
      .map((id) => {
        const emoji = catalog[id]?.emoji ?? '';
        return `${emoji} \`${id}\`${reactions[id] ? ' **(equipped)**' : ''}`;
      })
      .join('\n');

  return buildEmbeds({
    title: 'Inventory',
    description: `Equip items with \`${prefix}equip <item name>\`.\n\n${list}`,
  });
};

export const userEmbed = (user: Readonly<User>, name: string): EmbedBuilder[] => {
  const attempts = user.count + user.miscount;
  const accuracy = attempts === 0 ? '—' : `${((100 * user.count) / attempts).toFixed(1)}%`;
  return buildEmbeds({
    title: name,
    description: `Statistics for ${name}.`,
    fields: [
      { name: 'Counts', value: `${user.count}`, inline: true },
      { name: 'Mistakes', value: `${user.miscount}`, inline: true },
      { name: 'Accuracy', value: accuracy, inline: true },
      { name: 'Wins', value: `${user.wins}`, inline: true },
      { name: 'Bosses Defeated', value: `${user.boss}`, inline: true },
      { name: 'Crit Bonus', value: `${user.critBonus}/${constants.MAX_CRIT_LEVEL}`, inline: true },
      { name: 'Acrobatics', value: `${user.acrobatics}/${constants.MAX_ACRO_LEVEL}`, inline: true },
      { name: 'Royalty', value: `${user.royalty}/${constants.MAX_ROYALTY_LEVEL}`, inline: true },
    ],
  });
};

/**
 * A boss whose art file is gone renders as text rather than throwing: handing
 * discord.js a missing path fails the whole send, taking `t?info` with it.
 */
const bossArt = (boss: BossState): AttachmentBuilder | null => (
  fs.existsSync(boss.imagePath) ? new AttachmentBuilder(boss.imagePath) : null
);

export const bossFields = (boss: BossState): EmbedField[] => [
  { name: 'Name', value: boss.bossName },
  { name: 'Level', value: levelText(boss.level) },
  { name: 'Anger', value: `${boss.health} 💢` },
];

export const bossEmbed = (boss: BossState): { embeds: EmbedBuilder[]; files: AttachmentBuilder[] } => {
  const embeds = buildEmbeds({
    title: 'Boss battle!',
    description: `Count numbers to pet the ${boss.bossName}! All participants will receive a reward!`,
    fields: bossFields(boss),
  });
  const art = bossArt(boss);
  if (art) embeds[0]!.setImage(`attachment://${boss.imageName}`);
  return { embeds, files: art ? [art] : [] };
};

export const infoEmbed = (store: Store): { embeds: EmbedBuilder[]; files: AttachmentBuilder[] } => {
  const boss = store.getBoss();
  const last = store.getLastUserId();

  const fields: EmbedField[] = [
    { name: 'Current Number', value: `${store.getNumber()}`, inline: true },
    { name: 'Target Number', value: `±${store.getTarget()}`, inline: true },
    { name: 'Last Counter', value: last ? userIdToMention(last) : 'None', inline: true },
  ];

  if (boss) {
    fields.push({ name: '​', value: '**Boss Information**' }, ...bossFields(boss));
  }

  const embeds = buildEmbeds({
    title: 'Tug-of-War Information',
    description: 'Information on current status of TOW',
    fields,
  });

  const art = boss ? bossArt(boss) : null;
  if (boss && art) {
    embeds[0]!.setThumbnail(`attachment://${boss.imageName}`);
    return { embeds, files: [art] };
  }
  return { embeds, files: [] };
};

export const leaderboardEmbed = (store: Store, prop: keyof User = 'wins'): EmbedBuilder[] => {
  const rows = Object.entries(store.getAllUsers())
    .map(([id, user]) => [id, user[prop]] as const)
    .filter((row): row is readonly [string, number] => typeof row[1] === 'number')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const text = rows.length === 0
    ? '_No scores yet._'
    : rows.map(([id, score], i) => `${i + 1}. ${userIdToMention(id)}: ${score}`).join('\n');

  return buildEmbeds({
    title: 'Leaderboard',
    description: `Leaderboard for ${prop}`,
    fields: [{ name: String(prop).toUpperCase(), value: text, inline: false }],
  });
};
