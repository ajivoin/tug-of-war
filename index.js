// #region imports
import Discord, { Intents } from 'discord.js';

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
const client = new Discord.Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS] });
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

client.on('messageCreate', (message) => {
  try {
    const { author } = message;
    if (author.bot) return; // message from bot
    if (!message.guild) return; // DM
    const userId = author.id;
    if (!data.hasUser(userId)) {
      data.createUser(userId);
    }
    const tokens = utils.tokenize(message.content);
    if (message.content.toLowerCase() === 'blaze it') {
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
          { content: `Bot must be bound to a channel with \`${prefix}bind #<channel-name>\`.` },
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
          data.incrementWins(userId);
          data.addCrowns(userId, constants.CROWN_MULTIPLIER * (1 + data.getRoyalty(userId)));
          data.setTargetNumber(utils.getRandomInt(0, constants.WIN));
          message.react(data.getReaction(userId));
          message.channel.send(
            { content: `👑 Congrats ${author}! New target: ±${data.getTargetNumber()}.` },
          );
          data.clearLastUserId();
        } else {
          let hasReacted = false;
          if (Math.random() <= constants.ACROBATICS_RATE
              * (data.getAcrobatics(userId) ?? 0)) {
            hasReacted = true;
            message.react(constants.ACROBATICS_EMOJI);
            data.clearLastUserId();
          } else if (Math.abs(Math.abs(number) - data.getTargetNumber()) > 1) {
            data.setLastUserId(userId);
          } else {
            data.clearLastUserId();
          }
          if (Boss.instance) {
            const bossName = `${Boss.instance.bossName}`;
            const isBossDead = Boss.instance.hit(message.author.id, () => {
              hasReacted = true;
              message.react('💓'); // crit
            });
            if (isBossDead) {
              message.channel.send({ content: `${bossName} was calmed down by ${message.author}! Paying rewards to everyone who helped...` });
              const user = data.getUser(userId);
              user.boss += 1;
            } else if (Boss.instance.health % Boss.HEALTH_MULTIPLIER === 0) {
              message.channel.send({ embeds: [Boss.instance.embed] });
            }
          } else if (Math.random() < constants.BOSS_SPAWN_RATE) {
            Boss.instantiate();
            message.channel.send({ embeds: [Boss.instance.embed] });
          }
          if (Math.random() <= constants.COIN_RATE) {
            const gain = constants.COIN_GAIN * utils.getRandomInt(2, 10);
            data.addCoins(userId, gain);
            message.react('💰');
            hasReacted = true;
          }
          if (!hasReacted) {
            if (Math.abs(data.getCurrentNumber()) === 69) {
              message.react('😎');
            } else if (Math.abs(data.getCurrentNumber()) === 100) {
              message.react('💯');
            } else {
              message.react(constants.REACT_CORRECT);
            }
          }
        }
      } else {
        data.setLastUserId(userId);
        data.incrementMiscount(userId);
        data.removeCoins(userId, constants.COIN_LOSS);
        message.react(constants.REACT_INCORRECT);
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
