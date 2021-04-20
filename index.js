// #region imports
import Discord from 'discord.js';

import utils from './util/utils';
import constants from './util/constants';
import data from './util/data';
import commands from './util/commands';
import { token, prefix } from './config';
import Boss from './util/bosses';
// #endregion

// #region constants
// #endregion

// Discord client
const client = new Discord.Client();
client.commands = commands;

client.once('ready', () => {
  if (
    data.getTargetNumber() === undefined
    || data.getTargetNumber() === null
    || Number.isNaN(data.getTargetNumber())
  ) {
    data.setTargetNumber(utils.getRandomInt(0, constants.WIN));
  }
  Boss.load();
  console.log('Logged in.');
  client.user.setActivity(`${prefix}help`, { type: 'LISTENING' });
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
    if (message.content.toLowerCase() === "blaze it" && !data.hasReaction(userId, 'blazeit')) {
      data.selectReaction(userId, 'blazeit');
    }
    // #region command
    // explicity check for bind first
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
        if (Boss.instance) {
          const isBossDead = Boss.instance.hit(message.author.id, () => {
            message.react('‼'); // crit
          });
          if (isBossDead) {
            message.react('⚔');
            message.channel.send('Boss defeated! Paying rewards to everyone who helped...');
            const user = data.getUser(userId);
            user.boss += 1;
          } else if (Boss.instance.health % Boss.HEALTH_MULTIPLIER === 0) {
            message.channel.send(Boss.instance.embed);
          }
        } else if (Math.random() < constants.BOSS_SPAWN_RATE) {
          Boss.instantiate();
          message.channel.send(Boss.instance.embed);
        }
        // increment user count
        data.incrementCount(userId);

        // check if win
        data.setCurrentNumber(number);
        if (Math.abs(number) === data.getTargetNumber()) {
          console.log('Winner. Resetting number.');
          data.incrementWins(userId);
          data.addCrowns(userId, constants.CROWN_MULTIPLIER);
          data.setTargetNumber(utils.getRandomInt(0, constants.WIN));
          message.react('👑');
          message.channel.send(
            `🤴 Congrats ${author}! New target: ±${data.getTargetNumber()}.`,
          );
          data.clearLastUserId();
        } else {
          if (Math.random() <= constants.ACROBATICS_RATE
              * ((data.getAcrobatics(userId) ?? 0) ** 1.5)) {
            message.react(constants.ACROBATICS_EMOJI);
            data.clearLastUserId();
          } else if (Math.abs(Math.abs(number) - data.getTargetNumber()) > 1) {
            data.setLastUserId(userId);
          } else {
            data.clearLastUserId();
          }

          if (Math.random() <= constants.COIN_RATE) {
            // const gain = constants.COIN_GAIN * utils.getRandomInt(2, 10);
            const gain = 420;
            data.addCoins(userId, gain);
            // message.react('💰');
            message.react('🔥');
          }
          if (Math.abs(data.getCurrentNumber()) === 69) {
            message.react('😎');
          } else if (Math.abs(data.getCurrentNumber()) === 100) {
            message.react('💯');
          }
          message.react(data.getReaction(userId)).catch((err) => {
            message.react(constants.REACT_CORRECT);
            console.error(err);
          });
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
  data.persistBoss(Boss.instance);
  data.persistData();
  process.exit(0);
});

client.login(token);
