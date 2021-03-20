// #region imports
import Discord from 'discord.js';

import utils from './util/utils';
import constants from './util/constants';
import data from './util/data';
import commands from './util/commands';
import { token, prefix } from './config';
import Boss from './util/bosses';
import BossManager from './util/bossman';
// #endregion

// #region constants
// #endregion

// Discord client
const client = new Discord.Client();
client.commands = commands;

client.once('ready', () => {
  BossManager.load();
  console.log('Logged in.');
  client.user.setActivity(`${prefix}help`, { type: 'LISTENING' });
});

const bind = (messageObj, callback, errorCb) => {
  const tokens = utils.tokenize(messageObj.content);
  if (messageObj.member.hasPermission('MANAGE_GUILD') && tokens.length > 1) {
    const guildId = messageObj.guild.id;
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
        data.setChannelId(guildId, channelId);
      });
    if (callback) callback();
  } else if (errorCb) errorCb();
};

client.on('message', (message) => {
  try {
    const { author } = message;
    if (author.bot) return; // message from bot
    if (!message.guild) return; // DM
    const guildId = message.guild.id;
    if (!utils.hasProperty(data, guildId)) {
      data.addGuildToData(guildId);
    }
    const userId = author.id;
    if (!data.hasUser(guildId, userId)) {
      data.createUser(guildId, userId);
    }
    const tokens = utils.tokenize(message.content);

    // #region command
    // explicity check for bind first
    if (message.content.startsWith(prefix)) {
      const command = tokens[0].substr(prefix.length);
      if (command === 'bind' && tokens.length > 1) {
        bind(message);
      }
      if (!data.getChannelId(guildId)) {
        // unbound
        message.channel.send(
          `Bot must be bound to a channel with \`${prefix}bind #<channel-name>\`.`,
        );
        return;
      }
      // wrong channel, allows bind first though
      if (message.channel.id !== data.getChannelId(guildId)) return;

      // heavy-lifting for commands
      client.commands.get(command)?.execute(message);
    }
    // #endregion

    const number = parseInt(tokens[0], 10);

    if (data.getChannelId(guildId) === message.channel.id && !Number.isNaN(number)) {
      if (data.getLastUserId(guildId) === userId) {
        message.react('⏳');
        data.incrementMiscount(guildId, userId);
        data.removeCoins(guildId, userId, constants.COIN_LOSS);
        return;
      }
      if (Math.abs(number - data.getCurrentNumber(guildId)) === 1) {
        const boss = BossManager.get(guildId);
        if (boss) {
          const isBossDead = boss.hit(message.author.id);
          if (isBossDead) {
            message.react('⚔');
            message.channel.send('Boss defeated! Paying rewards to everyone who helped...');
            const user = data.getUser(guildId, userId);
            user.boss += 1;
          } else if (boss.health % Boss.HEALTH_MULTIPLIER === 0) {
            message.channel.send(boss.embed);
          }
        } else if (Math.random() < constants.BOSS_SPAWN_RATE) {
          const boss2 = BossManager.add(guildId);
          message.channel.send(boss2.embed);
        }
        // increment user count
        data.incrementCount(guildId, userId);

        // check if win
        data.setCurrentNumber(guildId, number);
        if (Math.abs(number) === data.getTargetNumber(guildId)) {
          console.log('Winner. Resetting number.');
          data.incrementWins(guildId, userId);
          data.addCrowns(guildId, userId, constants.CROWN_MULTIPLIER);
          data.setTargetNumber(guildId, utils.getRandomInt(0, constants.WIN));
          message.react('👑');
          message.channel.send(
            `🤴 Congrats ${author}! New target: ±${data.getTargetNumber(guildId)}.`,
          );
          data.clearLastUserId(guildId);
        } else {
          if (Math.abs(Math.abs(number) - data.getTargetNumber(guildId)) > 1) {
            data.setLastUserId(guildId, userId);
          } else {
            data.clearLastUserId(guildId);
          }
          if (Math.random() <= constants.COIN_RATE) {
            const gain = constants.COIN_GAIN * 5 * utils.getRandomInt(2, 10);
            data.addCoins(guildId, userId, gain);
            message.react('💰');
          } else if (Math.abs(data.getCurrentNumber(guildId)) === 69) {
            message.react('😎');
          } else if (Math.abs(data.getCurrentNumber(guildId)) === 100) {
            message.react('💯');
          } else {
            message.react(data.getReaction(guildId, userId)).catch((err) => {
              message.react(constants.REACT_CORRECT);
              console.error(err);
            });
          }
        }
      } else {
        data.setLastUserId(guildId, userId);
        data.incrementMiscount(guildId, userId);
        data.removeCoins(guildId, userId, constants.COIN_LOSS);
        message.react('❌');
      }
    }
  } catch (err) {
    console.error(err);
  }
});

// ensures data write when server killed
process.on('SIGINT', () => {
  BossManager.persist();
  data.persistData();
  process.exit(0);
});

client.login(token);
