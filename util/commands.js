import _ from 'underscore';
import utils from './utils';
import shop from './shop/shop';
import constants from './constants';
import embeds, { shopEmbed, helpEmbed } from './embeds';
import Command from './Command';
import AdminCommand from './AdminCommand';
import commands from './command_list';
import data from './data';
import { prefix } from '../config';
import Boss from './bosses';

/**
 * @param {Discord.Message} message
 */
const helpFunction = (message) => {
  message.channel.send({ embeds: [helpEmbed] });
};

const help = new Command('help', commands.help, _.debounce(helpFunction, 10 * 1000, true));

const infoFunction = (message) => {
  message.channel.send(
    {
      embeds: [embeds.infoEmbed(data.getCurrentNumber(), `±${data.getTargetNumber()}`, Boss.instance)], files: Boss.instance ? [Boss.instance?.imagePath] : [],
    },
  );
};

const info = new Command('info', commands.info, _.debounce(infoFunction, 1 * 2500, true));

const leaderboardFunction = (message) => {
  message.channel.send({ embeds: [embeds.generateLeaderboardEmbed()] });
};

const leaderboard = new Command('leaderboard', commands.leaderboard, _.debounce(leaderboardFunction, 10 * 1000, true));

const inventoryFunction = (message) => {
  message.channel.send({ embeds: [embeds.inventoryEmbedForUser(data.getUser(message.author.id))] });
};

const inventory = new Command('inventory', commands.inventory, inventoryFunction);

const userFunction = (message) => {
  const user = message.author;
  message.channel.send({ embeds: [embeds.userEmbed(data.getUser(user.id), message.member.displayName)] });
};

const user = new Command('user', commands.user, userFunction);

const shopFunction = (message) => {
  message.channel.send({ embeds: [shopEmbed] });
};

const shopCmd = new Command('shop', commands.shop, _.debounce(shopFunction, 10 * 1000, true));

const balanceFunction = (message) => {
  message.channel.send({ content: `${message.author}: ${data.getCrowns(message.author.id)} Crowns; ${data.getCoins(message.author.id)}c` });
};

const balance = new Command('balance', commands.balance, balanceFunction);

const convertOne = (userId, callback, errorCb) => {
  if (data.getCrowns(userId) >= 1) {
    data.removeCrowns(userId, 1);
    data.addCoins(userId, constants.CONVERSION_RATE);
    if (callback) callback("👑💨 You've gained 100c!");
  } else if (errorCb) errorCb('Not enough crowns to convert to coins.');
};

const handleConvert = (userId, arg, callback, errorCb) => {
  const number = parseInt(arg, 10);
  if (arg === null || arg === undefined) {
    convertOne(userId, callback, errorCb);
    return;
  }
  if (!Number.isNaN(number)) {
    if (number <= 0) return;
    if (data.getCrowns(userId) >= number) {
      const increase = number * constants.CONVERSION_RATE;
      data.removeCrowns(userId, number);
      data.addCoins(userId, increase);
      if (callback) {
        callback(`👑💨 You've gained ${increase}c!`);
      }
    } else if (errorCb) {
      errorCb(
        `Oopsies! You have ${data.getCrowns(userId)} Crowns and tried to convert ${number}.`,
      );
    }
  } else if (arg.toLowerCase() === 'all' && data.getCrowns(userId) > 0) {
    const increase = data.getCrowns(userId) * constants.CONVERSION_RATE;
    data.addCoins(userId, increase);
    data.removeCrowns(userId, data.getCrowns(userId));
    if (callback) {
      callback(`👑💨 You've gained ${increase}c!`);
    }
  }
};

const convertFunction = (message) => {
  const userId = message.author.id;
  const tokens = utils.tokenize(message.content.substr(prefix));
  handleConvert(userId, tokens[1],
    (msg) => { message.channel.send({ content: `${message.author}: ${msg}` }); },
    (errorMsg) => { message.channel.send({ content: `${message.author}: ${errorMsg}` }); });
};

const convert = new Command('convert', commands.convert, convertFunction);

const setReactEmoji = (userId, reactionId, callback, errorCb) => {
  if (!reactionId) return;
  if (data.hasReaction(userId, reactionId)) {
    data.selectReaction(userId, reactionId);
    const emoji = utils.getEmoji(reactionId);
    if (callback) callback(`${emoji} You equipped a reaction skin!`);
  } else if (errorCb) errorCb('You do not own this reaction skin.');
};

const equipFunction = (message) => {
  const userId = message.author.id;
  const tokens = utils.tokenize(message.content.substr(prefix));
  setReactEmoji(userId, tokens[1],
    (msg) => { message.channel.send({ content: `${message.author}: ${msg}` }); },
    (errorMsg) => { message.channel.send({ content: `${message.author}: ${errorMsg}` }); });
};

const equip = new Command('equip', commands.equip, _.debounce(equipFunction, true));

const buyFunction = (message) => {
  const userId = message.author.id;
  const tokens = utils.tokenize(message.content.substr(prefix));
  if (tokens[1] === undefined) return;
  shop.buy(userId, tokens[1], tokens[2],
    (msg) => { if (msg) message.channel.send({ content: `${message.author}: ${msg}` }); },
    (errorMsg) => { if (errorMsg) message.channel.send({ content: `${message.author}: ${errorMsg}` }); });
};

const buy = new Command('buy', commands.buy, buyFunction);

const debugFunction = (message) => {
  const userId = message.mentions.members.first().id;
  if (userId) message.channel.send(JSON.stringify(data.getUser(userId)));
};

const debug = new AdminCommand('debug', '', debugFunction);

const bossFunction = (message) => {
  if (Boss.instance) {
    message.channel.send({ embeds: [Boss.instance.embed] });
  } else {
    message.channel.send({ content: 'There is no boss right now. Count to lure one!' });
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
  const newBoss = Boss.instantiate();
  message.channel.send({ embeds: [newBoss.embed] });
});

const kill = new AdminCommand('kill', '', () => Boss.kill());

const ping = new Command('ping', 'Pong!', (message) => { message.react('☑'); });

const cmds = {
  h: help,
  '?': help,
  help,
  i: info,
  info,
  ls: info,
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
  leaderboard,
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
