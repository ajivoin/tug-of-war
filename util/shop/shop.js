import powerups from './items/powerups.js'
import skins from './items/skins.js';
import utils from '../utils.js';

import data from '../data.js';
import constants from '../constants.js';

const teleport = (cb) => {
  let distance = utils.getRandomInt(constants.TP_MAX, constants.TP_MIN);
  if (Math.random() < 0.5) {
    distance = -distance;
  }
  data.addToNumber(distance);
  if (cb) cb(`🧙‍♂️ Teleport! Current number is now ${data.getCurrentNumber()}.`);
};

const reroll = (cb) => {
  data.setTargetNumber(utils.getRandomInt(constants.WIN, 1));
  if (cb) cb(`🎲 Reroll! Target number is now ±${data.getTargetNumber()}.`);
};

const zeroOut = (cb) => {
  data.setCurrentNumber(0);
  if (cb) cb('💩 Zero! The current number is now 0.');
};

const fliparoo = (callback) => {
  const currentNum = data.getCurrentNumber();
  const currentTarget = data.getTargetNumber();
  data.setCurrentNumber(Math.sign(currentNum) * currentTarget);
  data.setTargetNumber(Math.abs(currentNum));
  if (callback) callback('😵 Fliparoo! Current number and target are now swapped!');
};

const buyReactSkin = (userId, reactionId, callback, errorCallback) => {
  // check if user owns react
  if (
    !data.hasReaction(userId, reactionId)
    && utils.hasProperty(skins, reactionId)
  ) {
    data.selectReaction(userId, reactionId);
    const emoji = utils.getEmoji(reactionId);
    if (callback) callback(`${emoji} You bought a reaction skin!`);
  } else if (errorCallback) errorCallback("You already have this reaction or it doesn't exist.");
};

const sneak = (callback) => {
  data.clearLastUserId();
  callback('🤫');
};

const deposit = (userId, callback) => {
  data.addCrowns(userId, 1);
  if (callback) callback('💳 You have purchased a Crown Gift Card! (+1 👑)');
};

const sqrt = (callback) => {
  let num = data.getCurrentNumber();
  const sign = Math.sign(num);
  num = sign * Math.floor(Math.sqrt(Math.abs(num)));
  data.setCurrentNumber(num);
  if (callback) callback(`👩‍🏫 Square Root! The current number is now ${num}.`);
};

const buy = (userId, item, callback, errorCallback) => {
  if (utils.hasProperty(powerups, item)) {
    const { price } = powerups[item];
    if (data.getCoins(userId) < price) {
      if (errorCallback) errorCallback("You don't have enough coins.");
      return;
    }
    data.removeCoins(userId, price);
    switch (item) {
      case 'reroll':
        data.clearLastUserId();
        reroll(callback);
        break;
      case 'zero':
        data.clearLastUserId();
        zeroOut(callback);
        break;
      case 'teleport':
        data.clearLastUserId();
        teleport(callback);
        break;
      case 'fliparoo':
        data.clearLastUserId();
        fliparoo(callback);
        break;
      case 'nice':
        data.setCurrentNumber(69);
        data.clearLastUserId();
        callback('Nice 😎.');
        break;
      case 'sneak':
        sneak(callback);
        break;
      case 'crowncard':
        deposit(userId, callback);
        break;
      case 'sqrt':
        data.clearLastUserId();
        sqrt(callback);
        break;
      default:
        console.error(`ERROR: Unexpected default case: ${userId} buys ${item}.`);
    }
  } else if (utils.hasProperty(skins, item)) {
    // handle skins
    const { price } = skins[item];
    if (data.getCoins(userId) < price) {
      if (errorCallback) errorCallback("You don't have enough coins.");
      return;
    }
    data.removeCoins(userId, price);
    buyReactSkin(userId, item, callback, errorCallback);
  }
};

export default { buy };
