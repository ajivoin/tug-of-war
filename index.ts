import {
  Client, GatewayIntentBits, PermissionFlagsBits, ActivityType, Message,
} from 'discord.js';

import utils from './util/utils.js';
import constants from './util/constants.js';
import data from './util/data.js';
import commands from './util/commands.js';
import { token, prefix } from './config.js';
import Boss from './util/bosses.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageReactions],
});

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
  client.user?.setActivity(`${prefix}help`, { type: ActivityType.Listening });
});

const bind = async (messageObj: Message<true>, callback?: () => void, errorCb?: () => void): Promise<void> => {
  const tokens = utils.tokenize(messageObj.content);
  if (messageObj.member?.permissions.has(PermissionFlagsBits.ManageGuild) && tokens.length > 1) {
    const channelId = tokens[1].trim().replace(/\D/g, '');
    await client.channels
      .fetch(channelId)
      .catch((e: unknown) => {
        console.error(e);
      })
      .then(() => {
        data.setChannelId(channelId);
      });
    if (callback) callback();
  } else if (errorCb) errorCb();
};

client.on('messageCreate', async (message) => {
  try {
    const { author } = message;
    if (author.bot) return;
    if (!message.inGuild()) return; // narrows to Message<true>
    const guildMessage = message; // Message<true> after inGuild() guard
    const userId = author.id;
    if (!data.hasUser(userId)) {
      data.createUser(userId);
    }
    const tokens = utils.tokenize(guildMessage.content);
    if (guildMessage.content.toLowerCase() === 'blaze it') {
      data.selectReaction(userId, 'blazeit');
    }
    if (guildMessage.content.startsWith(prefix)) {
      const command = tokens[0].slice(prefix.length);
      if (command === 'bind') {
        await bind(guildMessage);
      }
      if (!data.getChannelId()) {
        guildMessage.channel.send(
          { content: `Bot must be bound to a channel with \`${prefix}bind #<channel-name>\`.` },
        );
        return;
      }
      if (guildMessage.channel.id !== data.getChannelId()) return;

      commands.get(command)?.execute(guildMessage);
    }

    const number = parseInt(tokens[0], 10);

    if (data.getChannelId() === guildMessage.channel.id && !Number.isNaN(number)) {
      if (data.getLastUserId() === userId) {
        guildMessage.react('⏳');
        data.incrementMiscount(userId);
        data.removeCoins(userId, constants.COIN_LOSS);
        return;
      }
      if (Math.abs(number - data.getCurrentNumber()) === 1) {
        data.setCurrentNumber(number);
        if (Math.abs(number) === data.getTargetNumber()) {
          data.incrementWins(userId);
          data.addCrowns(userId, constants.CROWN_MULTIPLIER * (1 + data.getRoyalty(userId)));
          data.setTargetNumber(utils.getRandomInt(0, constants.WIN));
          guildMessage.react(data.getReaction(userId));
          guildMessage.channel.send(
            { content: `👑 Congrats ${author}! New target: ±${data.getTargetNumber()}.` },
          );
          data.clearLastUserId();
        } else {
          let hasReacted = false;
          if (Math.random() <= constants.ACROBATICS_RATE
            * (data.getAcrobatics(userId) ?? 0)) {
            hasReacted = true;
            guildMessage.react(constants.ACROBATICS_EMOJI);
            data.clearLastUserId();
          } else if (Math.abs(Math.abs(number) - data.getTargetNumber()) > 1) {
            data.setLastUserId(userId);
          } else {
            data.clearLastUserId();
          }
          const activeBoss = Boss.instance;
          if (activeBoss) {
            const bossName = `${activeBoss.bossName}`;
            const isBossDead = activeBoss.hit(guildMessage.author.id, () => {
              hasReacted = true;
              guildMessage.react('💓');
            });
            if (isBossDead) {
              guildMessage.channel.send({ content: `${bossName} was calmed down by ${guildMessage.author}! Paying rewards to everyone who helped...` });
              const userRecord = data.getUser(userId);
              userRecord.boss += 1;
            } else if (activeBoss.health % Boss.HEALTH_MULTIPLIER === 0) {
              guildMessage.channel.send({ embeds: [activeBoss.embed.embeds[0]] });
            }
          } else if (Math.random() < constants.BOSS_SPAWN_RATE) {
            const newBoss = Boss.instantiate();
            guildMessage.channel.send(newBoss.embed);
          }
          if (Math.random() <= constants.COIN_RATE) {
            const gain = constants.COIN_GAIN * utils.getRandomInt(2, 10);
            data.addCoins(userId, gain);
            guildMessage.react('💰');
            hasReacted = true;
          }
          if (!hasReacted) {
            if (Math.abs(data.getCurrentNumber()) === 69) {
              guildMessage.react('😎');
            } else if (Math.abs(data.getCurrentNumber()) === 100) {
              guildMessage.react('💯');
            } else {
              guildMessage.react(constants.REACT_CORRECT);
            }
          }
        }
      } else {
        data.setLastUserId(userId);
        data.incrementMiscount(userId);
        data.removeCoins(userId, constants.COIN_LOSS);
        guildMessage.react(constants.REACT_INCORRECT);
      }
    }
  } catch (err) {
    console.error(err);
  }
});

process.on('SIGINT', () => {
  data.persistBoss(Boss.instance ? Boss.instance.toPersisted() : null);
  data.persistData();
  process.exit(0);
});

client.login(token);
