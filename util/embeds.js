import { EmbedBuilder } from 'discord.js';

import commands from './command_list';
import shopSkins, { skins } from './shop/items/skins';
import enabledPowerups from './shop/items/powerups';
import { prefix } from '../config';
import constants from './constants';
import data from './data';
import utils from './utils';

const getCoreEmbed = (title, description, fields) => new EmbedBuilder()
  .setColor('#0099ff')
  .setTitle(title)
  .setDescription(description)
  .addFields(...fields);

const generateHelpEmbed = () => {
  const fields = Object.keys(commands).map((cmd) => ({
    name: `${prefix}${cmd}`,
    value: commands[cmd],
    inline: true,
  }));
  return getCoreEmbed('Help', 'Information on available commands.', fields);
};

const generateShopEmbed = () => {
  const fields = Object.keys(enabledPowerups).map((item) => ({
    name: `${item} (${enabledPowerups[item].price})`,
    value: enabledPowerups[item].description,
    inline: true,
  }));

  const embed = getCoreEmbed(
    'Shop',
    `Purchase items with \`${prefix}buy <item name>\`.`,
    fields,
  );
  // embed.addField('\u200b', '\u200b'); // blank link
  embed.addFields(
    Object.keys(shopSkins).map((item) => ({
      name: `${item} (${shopSkins[item].price}c)`,
      value: shopSkins[item].description,
      inline: true,
    })),
  );
  return embed;
};

const inventoryEmbedForUser = (user) => {
  const { reactions } = user;
  const fields = Object.keys(reactions).map((skin) => ({
    name: `${skin}${reactions[skin] ? ' (enabled)' : ''}`,
    value: skins[skin].emoji || '',
    inline: true,
  }));

  return getCoreEmbed(
    'Inventory',
    `Equip items with ${prefix}equip <item name>.`,
    fields,
  );
};

const userEmbed = (user, name) => {
  const fields = [
    {
      name: 'Counts',
      value: user.count.toString(),
      inline: true,
    },
    {
      name: 'Mistakes',
      value: user.miscount.toString(),
      inline: true,
    },
    {
      name: 'Accuracy',
      value: `${((100 * user.count) / (user.count + user.miscount)).toFixed(
        1,
      )}%`,
      inline: true,
    },
    {
      name: 'Wins',
      value: user.wins.toString(),
      inline: true,
    },
    {
      name: 'Bosses Defeated',
      value: user.boss.toString(),
      inline: true,
    },
    {
      name: 'Crit Bonus',
      value: `${user.critBonus ?? 0}/${constants.MAX_CRIT_LEVEL}`,
      inline: true,
    },
    {
      name: 'Acrobatics',
      value: `${user.acrobatics ?? 0}/${constants.MAX_ACRO_LEVEL}`,
      inline: true,
    },
    {
      name: 'Royalty',
      value: `${user.royalty ?? 0}/${constants.MAX_ROYALTY_LEVEL}`,
      inline: true,
    },
  ];
  return getCoreEmbed(name, `Statistics for ${name}.`, fields);
};

const infoEmbed = (currentNumber, targetNumber, boss) => {
  const fields = [
    {
      name: 'Current Number',
      value: `${currentNumber}`,
      inline: true,
    },
    {
      name: 'Target Number',
      value: `${targetNumber}`,
      inline: true,
    },
    {
      name: 'Last Counter',
      value: data.getLastUserId()
        ? utils.userIdToMention(data.getLastUserId())
        : 'None',
      inline: true,
    },
  ];

  const embed = getCoreEmbed('Tug-of-War Information', 'Information on current status of TOW', fields);
  if (boss) {
    // embed.addField('\u200b', '\u200b'); // blank link
    embed.addFields([{ name: '\u200b', value: '**Boss Information**' }]);
    embed
      .addFields(boss.embed.embeds[0].data.fields)
      .setThumbnail(`attachment://${boss.imageName}`);
  }
  return embed;
};

const generateLeaderboardEmbed = (prop = 'wins') => {
  const users = data.getAllUsers();
  const leaderboardContents = utils.generateLeaderboard(users, prop);
  const textContents = leaderboardContents.reduce(
    (acc, [mention, score], i) => `${acc}${i + 1}. ${mention}: ${score}\n`,
    '',
  );
  return getCoreEmbed('Leaderboard', `Leaderboard for ${prop}`, [
    {
      name: prop.toUpperCase(),
      value: textContents,
      inline: false,
    },
  ]);
};

export const helpEmbed = generateHelpEmbed();
export const shopEmbed = generateShopEmbed();

export default {
  helpEmbed,
  shopEmbed,
  inventoryEmbedForUser,
  userEmbed,
  infoEmbed,
  generateLeaderboardEmbed,
};
