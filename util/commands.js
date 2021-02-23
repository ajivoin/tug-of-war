const Discord = require('discord.js');

const commands = require('./commands.json');
const utils = require('./utils');
const shop = require('./shop');
const data = require('./data');
const constants = require('./constants');
const { prefix } = require('../config.json');

class Command {
  /**
   * @param {string} name
   * @param {string} description
   * @param {function} execute
   * @param {Array.<String>?} aliases
   */
  constructor(name, description, execute, aliases) {
    this.name = name;
    this.description = description;
    this.executeFunction = execute;
    if (aliases) this.aliases = aliases;
  }

  execute(message) {
    this.executeFunction(message);
  }
}

/**
 * @param {Discord.Message} message
 */
const helpFunction = (message) => {
  message.channel.send(utils.helpMsg);
};

const help = new Command('help', commands.help, helpFunction);

const infoFunction = (message) => {
  message.channel.send(`Current number is ${data.getCurrentNumber()}. Target: ±${data.getTargetNumber()}.`);
};

const info = new Command('info', commands.info, infoFunction);

const inventoryFunction = (message) => {
  message.channel.send(`${message.author}: ${data.getUserReactionsMessage(message.author.id)}`);
};

const inventory = new Command('inventory', commands.inventory, inventoryFunction);

const userFunction = (message) => {
  const user = message.author;
  message.channel.send(
    `${user}: ${data.getCount(user.id)} numbers counted, ${data.getWins(user.id)} wins, ${data.getMiscount(user.id)} goofs.`,
  );
};

const user = new Command('user', commands.user, userFunction);

const shopFunction = (message) => {
  message.channel.send(`${message.author}: ${shop.contents}`);
};

const shopCmd = new Command('shop', commands.shop, shopFunction);

const balanceFunction = (message) => {
  message.channel.send(`${data.getCrowns(message.author.id)} Crowns; ${data.getCoins(message.author.id)}c`);
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
    (msg) => { message.channel.send(`${message.author}: ${msg}`); },
    (errorMsg) => { message.channel.send(`${message.author}: ${errorMsg}`); });
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
    (msg) => { message.channel.send(`${message.author}: ${msg}`); },
    (errorMsg) => { message.channel.send(`${message.author}: ${errorMsg}`); });
};

const equip = new Command('equip', commands.equip, equipFunction);

const buyFunction = (message) => {
  const userId = message.author.id;
  const tokens = utils.tokenize(message.content.substr(prefix));
  shop.buy(userId, tokens[1],
    (msg) => { message.channel.send(`${message.author}: ${msg}`); },
    (errorMsg) => { message.channel.send(`${message.author}: ${errorMsg}`); });
};

const buy = new Command('buy', commands.buy, buyFunction);

const cmds = {
  help,
  info,
  inventory,
  user,
  shop: shopCmd,
  balance,
  convert,
  equip,
  buy,
};

const get = (cmd) => {
  if (utils.hasProperty(cmds, cmd)) {
    return cmds[cmd];
  }
  return null;
};

module.exports = {
  get,
};
