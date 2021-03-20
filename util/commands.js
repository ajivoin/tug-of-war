import _ from 'underscore';
import utils from './utils';
import shop from './shop/shop';
import constants from './constants';
import embeds, { shopEmbed } from './embeds';
import Command from './Command';
import AdminCommand from './AdminCommand';
import commands from './command_list';
import data from './data';
import { prefix } from '../config';
import BossManager from './bossman';

/**
 * @param {Discord.Message} message
 */
const helpFunction = (message) => {
  message.channel.send(utils.helpEmbed);
};

const help = new Command('help', commands.help, _.debounce(helpFunction, 10 * 1000, true));

const infoFunction = (message) => {
  const guildId = message.guild.id;
  message.channel.send(
    embeds.infoEmbed(data.getCurrentNumber(guildId), `±${data.getTargetNumber(guildId)}`, BossManager.get(guildId)),
  );
};

const info = new Command('info', commands.info, _.debounce(infoFunction, 1 * 2500, true));

const inventoryFunction = (message) => {
  message.channel.send(
    embeds.inventoryEmbedForUser(data.getUser(message.guild.id, message.author.id)),
  );
};

const inventory = new Command('inventory', commands.inventory, inventoryFunction);

const userFunction = (message) => {
  const user = message.author;
  message.channel.send(
    embeds.userEmbed(data.getUser(message.guild.id, user.id), message.member.displayName),
  );
};

const user = new Command('user', commands.user, userFunction);

const shopFunction = (message) => {
  message.channel.send(shopEmbed);
};

const shopCmd = new Command('shop', commands.shop, _.debounce(shopFunction, 10 * 1000, true));

const balanceFunction = (message) => {
  message.channel.send(
    `${message.author}: ${data.getCrowns(message.guild.id, message.author.id)} Crowns; ${data.getCoins(message.guild.id, message.author.id)}c`,
  );
};

const balance = new Command('balance', commands.balance, balanceFunction);

const convertOne = (guildId, userId, callback, errorCb) => {
  if (data.getCrowns(guildId, userId) >= 1) {
    data.removeCrowns(guildId, userId, 1);
    data.addCoins(guildId, userId, constants.CONVERSION_RATE);
    if (callback) callback("👑💨 You've gained 100c!");
  } else if (errorCb) errorCb('Not enough crowns to convert to coins.');
};

const handleConvert = (guildId, userId, arg, callback, errorCb) => {
  const number = parseInt(arg, 10);
  if (arg === null || arg === undefined) {
    convertOne(guildId, userId, callback, errorCb);
    return;
  }
  if (!Number.isNaN(number)) {
    if (number <= 0) return;
    if (data.getCrowns(guildId, userId) >= number) {
      const increase = number * constants.CONVERSION_RATE;
      data.removeCrowns(guildId, userId, number);
      data.addCoins(guildId, userId, increase);
      if (callback) {
        callback(`👑💨 You've gained ${increase}c!`);
      }
    } else if (errorCb) {
      errorCb(
        `Oopsies! You have ${data.getCrowns(guildId, userId)} Crowns and tried to convert ${number}.`,
      );
    }
  } else if (arg.toLowerCase() === 'all' && data.getCrowns(userId) > 0) {
    const increase = data.getCrowns(guildId, userId) * constants.CONVERSION_RATE;
    data.addCoins(guildId, userId, increase);
    data.removeCrowns(guildId, userId, data.getCrowns(guildId, userId));
    if (callback) {
      callback(`👑💨 You've gained ${increase}c!`);
    }
  }
};

const convertFunction = (message) => {
  const userId = message.author.id;
  const tokens = utils.tokenize(message.content.substr(prefix));
  handleConvert(message.guild.id, userId, tokens[1],
    (msg) => { message.channel.send(`${message.author}: ${msg}`); },
    (errorMsg) => { message.channel.send(`${message.author}: ${errorMsg}`); });
};

const convert = new Command('convert', commands.convert, convertFunction);

const setReactEmoji = (guildId, userId, reactionId, callback, errorCb) => {
  if (!reactionId) return;
  if (data.hasReaction(guildId, userId, reactionId)) {
    data.selectReaction(guildId, userId, reactionId);
    const emoji = utils.getEmoji(reactionId);
    if (callback) callback(`${emoji} You equipped a reaction skin!`);
  } else if (errorCb) errorCb('You do not own this reaction skin.');
};

const equipFunction = (message) => {
  const userId = message.author.id;
  const guildId = message.guild.id;
  const tokens = utils.tokenize(message.content.substr(prefix));
  setReactEmoji(guildId, userId, tokens[1],
    (msg) => { message.channel.send(`${message.author}: ${msg}`); },
    (errorMsg) => { message.channel.send(`${message.author}: ${errorMsg}`); });
};

const equip = new Command('equip', commands.equip, _.debounce(equipFunction, true));

const buyFunction = (message) => {
  const userId = message.author.id;
  const guildId = message.guild.id;
  const tokens = utils.tokenize(message.content.substr(prefix));
  if (tokens[1] === undefined) return;
  shop.buy(guildId, userId, tokens[1],
    (msg) => { message.channel.send(`${message.author}: ${msg}`); },
    (errorMsg) => { message.channel.send(`${message.author}: ${errorMsg}`); });
};

const buy = new Command('buy', commands.buy, buyFunction);

const debugFunction = (message) => {
  const userId = message.mentions.members.first().id;
  if (userId) message.channel.send(JSON.stringify(data.getUser(userId)));
};

const debug = new AdminCommand('debug', '', debugFunction);

const bossFunction = (message) => {
  if (BossManager.get(message.guild.id)) {
    message.channel.send(BossManager.get(message.guild.id).embed);
  } else {
    message.channel.send('There is no boss right now. Count to lure one!');
  }
};

const boss = new Command('boss', 'boss information', bossFunction);

/**
 * Expects: t?giveCrowns user amount
 * @param {Discord.Message} message
 */
const giveCrownsFunction = (message) => {
  const userId = message.mentions.members.first().id;
  if (userId) {
    const args = utils.tokenize(message.content);
    const amount = Number.parseInt(args[2], 10);
    if (amount) {
      if (amount > 0) data.addCrowns(userId, amount);
      else if (amount < 0) data.removeCrowns(userId, -amount);
    }
  }
};

const givecrowns = new AdminCommand('givecrowns', '', giveCrownsFunction);

const spawn = new AdminCommand('spawn', '', (message) => {
  const newBoss = BossManager.add(message.guild.id);
  message.channel.send(newBoss.embed);
});

const kill = new AdminCommand('kill', '', (message) => BossManager.get(message.guild.id).kill());

const ping = new Command('ping', 'Pong!', (message) => { message.react('☑'); });

const cmds = {
  h: help,
  '?': help,
  help,
  i: info,
  info,
  inv: inventory,
  inventory,
  u: user,
  stats: user,
  user,
  shop: shopCmd,
  b: balance,
  bal: balance,
  balance,
  convert,
  e: equip,
  equip,
  $: buy,
  buy,
  debug,
  givecrowns,
  boss,
  spawn,
  kill,
  ping,
};

const get = (cmd) => {
  if (utils.hasProperty(cmds, cmd)) {
    return cmds[cmd];
  }
  return null;
};

export default {
  get,
};
