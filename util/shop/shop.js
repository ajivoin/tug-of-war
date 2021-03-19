import enabledPowerups from './items/powerups';
import enabledSkins from './items/skins';
import utils from '../utils';
import data from '../data';
import constants from '../constants';

const teleport = (guildId, cb) => {
  let distance = utils.getRandomInt(constants.TP_MIN, constants.TP_MAX);
  if (Math.random() < 0.5) {
    distance = -distance;
  }
  data.addToNumber(guildId, distance);
  if (cb) cb(`🧙‍♂️ Teleport! Current number is now ${data.getCurrentNumber(guildId)}.`);
};

const reroll = (guildId, cb) => {
  data.setTargetNumber(guildId, utils.getRandomInt(0, constants.WIN));
  if (cb) cb(`🎲 Reroll! Target number is now ±${data.getTargetNumber(guildId)}.`);
};

const zeroOut = (guildId, cb) => {
  data.setCurrentNumber(guildId, 0);
  if (cb) cb('💩 Zero! The current number is now 0.');
};

const fliparoo = (guildId, callback) => {
  const currentNum = data.getCurrentNumber(guildId);
  const currentTarget = data.getTargetNumber(guildId);
  data.setCurrentNumber(guildId, Math.sign(currentNum) * currentTarget);
  data.setTargetNumber(guildId, Math.abs(currentNum));
  if (callback) callback('😵 Fliparoo! Current number and target are now swapped!');
};

const buyReactSkin = (guildId, userId, reactionId, callback, errorCallback) => {
  // check if user owns react
  if (
    !data.hasReaction(guildId, userId, reactionId)
    && utils.hasProperty(enabledSkins, reactionId)
  ) {
    data.selectReaction(guildId, userId, reactionId);
    const emoji = utils.getEmoji(reactionId);
    if (callback) callback(`${emoji} You bought a reaction skin!`);
  } else if (errorCallback) errorCallback("You already have this reaction or it doesn't exist.");
};

const sneak = (guildId, callback) => {
  data.clearLastUserId(guildId);
  callback('🤫');
};

const deposit = (guildId, userId, callback) => {
  data.addCrowns(guildId, userId, 1);
  if (callback) callback('💳 You have purchased a Crown Gift Card! (+1 👑)');
};

const sqrt = (guildId, callback) => {
  let num = data.getCurrentNumber(guildId);
  const sign = Math.sign(num);
  num = sign * Math.floor(Math.sqrt(Math.abs(num)));
  data.setCurrentNumber(guildId, num);
  if (callback) callback(`👩‍🏫 Square Root! The current number is now ${num}.`);
};

const buy = (guildId, userId, item, callback, errorCallback) => {
  if (utils.hasProperty(enabledPowerups, item)) {
    const { price } = enabledPowerups[item];
    if (data.getCoins(guildId, userId) < price) {
      if (errorCallback) errorCallback("You don't have enough coins.");
      return;
    }
    data.removeCoins(guildId, userId, price);
    switch (item) {
      case 'reroll':
        data.clearLastUserId(guildId);
        reroll(callback);
        break;
      case 'zero':
        data.clearLastUserId(guildId);
        zeroOut(callback);
        break;
      case 'teleport':
        data.clearLastUserId(guildId);
        teleport(callback);
        break;
      case 'fliparoo':
        data.clearLastUserId(guildId);
        fliparoo(callback);
        break;
      case 'nice':
        data.setCurrentNumber(guildId, 69);
        data.clearLastUserId(guildId);
        callback('Nice 😎.');
        break;
      case 'sneak':
        sneak(guildId, callback);
        break;
      case 'crowncard':
        deposit(guildId, userId, callback);
        break;
      case 'sqrt':
        data.clearLastUserId(guildId);
        sqrt(guildId, callback);
        break;
      default:
        console.error(`ERROR: Unexpected default case: ${userId} buys ${item}.`);
    }
  } else if (utils.hasProperty(enabledSkins, item)) {
    // handle skins
    const { price } = enabledSkins[item];
    if (data.getCoins(guildId, userId) < price) {
      if (errorCallback) errorCallback("You don't have enough coins.");
      return;
    }
    data.removeCoins(guildId, userId, price);
    buyReactSkin(guildId, userId, item, callback, errorCallback);
  }
};

export default { buy };
