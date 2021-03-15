import { MessageEmbed } from 'discord.js';

import commands from './command_list';
import shopSkins, { skins } from './shop/items/skins';
import enabledPowerups from './shop/items/powerups';
import { prefix } from '../config';

const getCoreEmbed = (title, description, fields) => new MessageEmbed()
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
    name: `${item} (${enabledPowerups[item].price}c)`,
    value: enabledPowerups[item].description,
    inline: true,
  }));

  const embed = getCoreEmbed('Shop', `Purchase items with \`${prefix}buy <item name>\`.`, fields);
  embed.addField('\u200b', '\u200b'); // blank link
  embed.addFields(...Object.keys(shopSkins).map((item) => ({
    name: `${item} (${shopSkins[item].price}c)`,
    value: shopSkins[item].description,
    inline: true,
  })));
  return embed;
};

const inventoryEmbedForUser = (user) => {
  const { reactions } = user;
  const fields = Object.keys(reactions).map((skin) => ({
    name: `${skin}${reactions[skin] ? ' (enabled)' : ''}`,
    value: skins[skin].emoji || '',
    inline: true,
  }));

  return getCoreEmbed('Inventory', `Equip items with ${prefix}equip <item name>.`, fields);
};

export const helpEmbed = generateHelpEmbed();
export const shopEmbed = generateShopEmbed();

export default {
  helpEmbed,
  shopEmbed,
  inventoryEmbedForUser,
};
