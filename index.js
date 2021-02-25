// #region imports
const Discord = require('discord.js');
const utils = require('./util/utils');
const constants = require('./util/constants');
const data = require('./util/data');
const commands = require('./util/commands');

const { token, prefix } = require('./config.json');
// #endregion

// #region constants
// #endregion

// Discord client
const client = new Discord.Client();
client.commands = commands;

client.once('ready', () => {
  if (data.getTargetNumber() === undefined
    || data.getTargetNumber() === null
    || Number.isNaN(data.getTargetNumber())) {
    data.setTargetNumber(utils.getRandomInt(constants.WIN, 1));
  }
  console.log('Logged in.');
});

const bind = (messageObj, callback, errorCb) => {
  const tokens = utils.tokenize(messageObj.content);
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
    const tokens = utils.tokenize(message.content);

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
      client.commands.get(command)?.execute(message);
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
            const gain = utils.getRandomInt(250, 50);
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
