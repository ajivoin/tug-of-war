const { MessageEmbed } = require('discord.js');
const commands = require('./commands.json');
const shop = require('./shop.json');
const { prefix } = require('../config.json');

const getCoreEmbed = (title, description, fields) => new MessageEmbed()
  .setColor('#0099ff')
  .setTitle(title)
  .setDescription(description)
  .fields(...fields);

const generateHelpEmbed = () => {
  const fields = Object.keys(commands).map((cmd) => ({
    name: cmd,
    value: commands[cmd],
    inline: true,
  }));
  return getCoreEmbed('Help', `Information on available commands. Prefix: ${prefix}`, fields);
};

const generateShopEmbed = () => {
  const fields = Object.keys(shop).map((item) => ({
    name: `${item} (${shop[item].price}c)`,
    value: shop[item].description,
    inline: true,
  }));

  return getCoreEmbed('Shop', `Purchase items with ${prefix}buy <item name>.`, fields);
};

const helpEmbed = generateHelpEmbed();
const shopEmbed = generateShopEmbed();

module.exports = {
  helpEmbed,
  shopEmbed,
};
