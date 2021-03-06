const { MessageEmbed } = require('discord.js');
const commands = require('./commands.json');
const shop = require('./shop.json');
const data = require('./data');
const skins = require('./skins.json');
const { prefix } = require('../config.json');

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
  const fields = Object.keys(shop).map((item) => ({
    name: `${item} (${shop[item].price}c)`,
    value: shop[item].description,
    inline: true,
  }));

  return getCoreEmbed('Shop', `Purchase items with ${prefix}buy <item name>.`, fields);
};

const inventoryEmbedForUser = (userId) => {
  const user = data.getUser(userId);
  const { reactions } = user;
  const fields = Object.keys(reactions).map((skin) => ({
    name: `${skin}${reactions[skin] ? ' (enabled)' : ''}`,
    description: skins[skin] || '',
    inline: true,
  }));

  return getCoreEmbed('Inventory', `Equip items with ${prefix}equip <item name>.`, fields);
};

const helpEmbed = generateHelpEmbed();
const shopEmbed = generateShopEmbed();

module.exports = {
  helpEmbed,
  shopEmbed,
  inventoryEmbedForUser,
};
