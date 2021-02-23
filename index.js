// #region imports
const Discord = require('discord.js');
const utils = require('./util/utils');
const constants = require('./util/constants');
const data = require('./util/data');
const shop = require('./util/shop');

const commands = require('./commands.json');

const { token, prefix } = require('./config.json');
const skins = require('./skins.json');
// #endregion

// #region constants
// #endregion

// Discord client
const client = new Discord.Client();

/**
 * @param {Object} o
 * @returns {boolean}
 */
const isNullUndefined = (o) => o === null || o === undefined;

const setReactEmoji = (userId, reactionId, callback, errorCb) => {
  if (!reactionId) return;
  if (data.hasReaction(userId, reactionId)) {
    data.selectReaction(userId, reactionId);
    const emoji = utils.getEmoji(reactionId);
    if (callback) callback(`${emoji} You equipped a reaction skin!`);
  } else if (errorCb) errorCb('You do not own this reaction skin.');
};

const helpMsgBuilder = () => {
  let output = 'Command info:\n```\n';
  output += Object.keys(commands).reduce((acc, cmd) => `${acc}${prefix}${cmd}: ${commands[cmd]}\n`, '');
  output += '```';
  return output;
};

const getUserReactions = (userId) => {
  let output = 'Your reactions:\n```\n';
  const user = data.getUser(userId);
  output += Object.keys(user.reactions).reduce((acc, react) => `${acc}${skins[react]}: ${react}\n`, '');
  output += `Select a skin with ${prefix}equip <item>\n`;
  output += '```';
  return output;
};

const helpMsg = helpMsgBuilder();

const convert = (userId, callback, errorCb) => {
  if (data.getCrowns(userId) >= 1) {
    data.removeCrowns(userId, 1);
    data.addCoins(userId, constants.CONVERSION_RATE);
    if (callback) callback("👑💨 You've gained 100c!");
  } else if (errorCb) errorCb('Not enough crowns to convert to coins.');
};

const handleConvert = (userId, arg, callback, errorCb) => {
  const number = parseInt(arg, 10);
  if (isNullUndefined(arg)) {
    convert(userId, callback, errorCb);
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

const balance = (userId, callback) => {
  callback(`${data.getCrowns(userId)} Crowns; ${data.getCoins(userId)}c`);
};

client.once('ready', () => {
  if (data.getTargetNumber() === undefined
    || data.getTargetNumber() === null
    || Number.isNaN(data.getTargetNumber())) {
    data.setTargetNumber(utils.getRandomInt(constants.WIN, 1));
  }
  console.log('Logged in.');
});

const tokenize = (str) => str.toLowerCase().trim().split(' ');

const bind = (messageObj, callback, errorCb) => {
  const tokens = tokenize(messageObj.content);
  if (messageObj.member.hasPermission('MANAGE_GUILD') && tokens.length > 1) {
    const channelId = tokens[1].trim().replace(/\D/g, '');
    client.channels
      .fetch(channelId)
      .catch((e) => {
        if (errorCb) {
          errorCb(e);
        } else {
          console.error(e);
        }
      })
      .then(() => {
        data.setChannelId(channelId);
      });
    if (callback) callback();
  } else if (errorCb) errorCb();
};

client.on('message', (message) => {
  try {
    const { author } = message;
    if (author.bot) return; // message from bot
    if (!message.guild) return; // DM
    const userId = author.id;
    if (!data.hasUser(userId)) {
      data.createUser(userId);
    }
    const tokens = tokenize(message.content);

    // #region command
    // check for bind
    if (message.content.startsWith(prefix)) {
      const command = tokens[0].substr(prefix.length);
      if (command === 'bind') {
        bind(message);
      }
      if (!data.getChannelId()) {
        // unbound
        message.channel.send(
          `Bot must be bound to a channel with \`${prefix}bind #<channel-name>\`.`,
        );
        return;
      }
      // wrong channel, allows bind first though
      if (message.channel.id !== data.getChannelId()) return;

      // heavy-lifting for commands
      switch (command) {
        case 'h':
        case '?':
        case 'help':
          message.channel.send(helpMsg);
          return;
        case 'target':
        case 'current':
        case 'i':
        case 'info':
          message.channel.send(
            `Current number is ${data.getCurrentNumber()}. Target: ±${data.getTargetNumber()}.`,
          );
          return;
        case 'u':
        case 'stats':
        case 'stat':
        case 'user':
          message.channel.send(
            `${author}: ${data.getCount(userId)} numbers counted, ${data.getWins(userId)} wins, ${data.getMiscount(userId)} goofs.`,
          );
          return;
        case 's':
        case 'store':
        case 'shop':
          message.channel.send(shop.contents);
          return;
        case '$':
        case 'buy':
          shop.buy(
            userId,
            tokens.length > 1 ? tokens[1] : '',
            (msg) => {
              message.channel.send(`${author}: ${msg}`);
            },
            (errorMsg) => {
              message.channel.send(`${author}: ${errorMsg}`);
            },
          );
          return;
        case 'convert':
          handleConvert(
            userId,
            tokens[1],
            (msg) => {
              message.channel.send(`${author}: ${msg}`);
            },
            (errorMsg) => {
              message.channel.send(`${author}: ${errorMsg}`);
            },
          );
          return;
        case 'e':
        case 'equip':
          setReactEmoji(
            userId,
            tokens[1],
            (msg) => {
              message.channel.send(`${author}: ${msg}`);
            },
            (err) => {
              message.channel.send(`${author}: ${err}`);
            },
          );
          return;
        case 'inv':
        case 'inventory':
          message.channel.send(`${author}: ${getUserReactions(userId)}`);
          return;
        case 'b':
        case 'bal':
        case 'balance':
          balance(userId, (msg) => { message.channel.send(`${author}: ${msg}`); });
          return;
        default:
          return;
      }
    }
    // #endregion

    const number = parseInt(tokens[0], 10);

    if (data.getChannelId() === message.channel.id && !Number.isNaN(number)) {
      if (data.getLastUserId() === userId) {
        message.react('⏳');
        data.incrementMiscount(userId);
        data.removeCoins(userId, constants.COIN_LOSS);
        return;
      }
      if (Math.abs(number - data.getCurrentNumber()) === 1) {
        // increment user count
        data.incrementCount(userId);

        // check if win
        data.setCurrentNumber(number);
        if (Math.abs(number) === data.getTargetNumber()) {
          console.log('Winner. Resetting number.');
          data.incrementWins(userId);
          data.addCrowns(userId, 1);
          data.setTargetNumber(utils.getRandomInt(constants.WIN, 1));
          message.react('👑');
          message.channel.send(
            `🤴 Congrats ${author}! New target: ±${data.getTargetNumber()}.`,
          );
          data.clearLastUserId();
        } else {
          if (Math.abs(Math.abs(number) - data.getTargetNumber()) > 1) {
            data.setLastUserId(userId);
          } else {
            data.clearLastUserId();
          }
          if (Math.random() <= constants.COIN_RATE) {
            const gain = utils.getRandomInt(100, 10);
            data.addCoins(userId, gain);
            message.react('💰');
          } else if (Math.abs(data.getCurrentNumber()) === 69) {
            message.react('😎');
          } else {
            message.react(data.getReaction(userId)).catch((err) => {
              message.react(constants.REACT_CORRECT);
              console.error(err);
            });
          }
        }
      } else {
        data.setLastUserId(userId);
        data.incrementMiscount(userId);
        data.removeCoins(userId, constants.COIN_LOSS);
        message.react('❌');
      }
    }
  } catch (err) {
    console.error(err);
  }
});

// ensures data write when server killed
process.on('SIGINT', () => {
  data.persistData();
  process.exit(0);
});

client.login(token);
