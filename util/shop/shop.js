import enabledPowerups from './items/powerups';
import enabledSkins from './items/skins';
import utils from '../utils';
import data from '../data';
import constants from '../constants';
import Boss from '../bosses';

const teleport = (cb) => {
  let distance = utils.getRandomInt(constants.TP_MIN, constants.TP_MAX);
  if (Math.random() < 0.5) {
    distance = -distance;
  }
  data.addToNumber(distance);
  if (cb) cb(`🧙‍♂️ Teleport! Current number is now ${data.getCurrentNumber()}.`);
};

const reroll = (cb) => {
  data.setTargetNumber(utils.getRandomInt(0, constants.WIN));
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
    && utils.hasProperty(enabledSkins, reactionId)
  ) {
    data.selectReaction(userId, reactionId);
    const emoji = utils.getEmoji(reactionId);
    if (callback) callback(`${emoji} You bought a reaction skin!`);
  } else if (errorCallback) errorCallback("You already have this reaction or it doesn't exist.");
};

const sneak = (callback) => {
  data.clearLastUserId();
  const direction = Math.sign(data.getTargetNumber() - data.getCurrentNumber());
  data.addToNumber(direction);
  callback();
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

const bomb = (userId, callback, errorCallback) => {
  if (Boss.instance) {
    const name = Boss.instance.bossName;
    const isDead = Boss.instance.bomb(userId);
    if (isDead) {
      if (callback) callback(`⚔ ${name} defeated!`);
    } else if (callback) {
      callback(`💣 ${name} was bombed!`);
    }
  }
  if (errorCallback) errorCallback('There is no active boss right now.');
};

const crit = (userId, callback) => {
  const currentCritBonus = data.getCritBonus(userId);
  if (!currentCritBonus) {
    data.setCritBonus(userId, 1);
    callback('Your crit level is now 1.');
    return true;
  }
  if (currentCritBonus < constants.MAX_CRIT_LEVEL) {
    data.setCritBonus(userId, currentCritBonus + 1);
    callback(`Your crit level is now ${currentCritBonus + 1}.`);
    return true;
  }
  callback('You already have the maximum crit level!');
  return false;
};

const acrobatics = (userId, callback) => {
  const currentAcrobatics = data.getAcrobatics(userId);
  if (!currentAcrobatics) {
    data.setAcrobatics(userId, 1);
    callback('Your acrobatics level is now 1.');
    return true;
  }
  if (currentAcrobatics < constants.MAX_ACRO_LEVEL) {
    data.setAcrobatics(userId, currentAcrobatics + 1);
    callback(`Your acrobatics level is now ${currentAcrobatics + 1}.`);
    return true;
  }
  callback('You already have the maximum acrobatics level!');
  return false;
};

const buy = (userId, item, callback, errorCallback) => {
  if (utils.hasProperty(enabledPowerups, item)) {
    const { price } = enabledPowerups[item];
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
      case 'bomb':
        bomb(userId, callback);
        break;
      case 'crit':
        if (!crit(userId, callback)) data.addCoins(userId, price);
        break;
      case 'acrobatics':
        if (!acrobatics(userId, callback)) data.addCoins(userId, price);
        break;
      default:
        console.error(`ERROR: Unexpected default case: ${userId} buys ${item}.`);
    }
  } else if (utils.hasProperty(enabledSkins, item)) {
    // handle skins
    const { price } = enabledSkins[item];
    if (data.getCoins(userId) < price) {
      if (errorCallback) errorCallback("You don't have enough coins.");
      return;
    }
    data.removeCoins(userId, price);
    buyReactSkin(userId, item, callback, errorCallback);
  }
};

export default { buy };
