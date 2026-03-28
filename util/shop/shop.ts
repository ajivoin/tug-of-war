import enabledPowerups from './items/powerups.js';
import enabledSkins from './items/skins.js';
import utils from '../utils.js';
import data from '../data.js';
import constants from '../constants.js';
import Boss from '../bosses.js';
import { Callback, ErrorCallback } from '../types.js';

const teleport = (cb: Callback = () => {}): void => {
  let distance = utils.getRandomInt(constants.TP_MIN, constants.TP_MAX);
  if (Math.random() < 0.5) {
    distance = -distance;
  }
  data.addToNumber(distance);
  cb(`🧙‍♂️ Teleport! Current number is now ${data.getCurrentNumber()}.`);
};

const reroll = (cb: Callback = () => {}): void => {
  data.setTargetNumber(utils.getRandomInt(0, constants.WIN));
  cb(`🎲 Reroll! Target number is now ±${data.getTargetNumber()}.`);
};

const zeroOut = (cb: Callback = () => {}): void => {
  data.setCurrentNumber(0);
  cb('💩 Zero! The current number is now 0.');
};

const fliparoo = (callback: Callback = () => {}): void => {
  const currentNum = data.getCurrentNumber();
  const currentTarget = data.getTargetNumber();
  data.setCurrentNumber(Math.sign(currentNum) * currentTarget);
  data.setTargetNumber(Math.abs(currentNum));
  callback('😵 Fliparoo! Current number and target are now swapped!');
};

const buyReactSkin = (
  userId: string,
  reactionId: string,
  callback: Callback = () => {},
  errorCallback: ErrorCallback = () => {},
): void => {
  if (
    !data.hasReaction(userId, reactionId)
    && utils.hasProperty(enabledSkins, reactionId)
  ) {
    data.selectReaction(userId, reactionId);
    const emoji = utils.getEmoji(reactionId);
    callback(`${emoji} You bought a reaction skin!`);
  } else {
    errorCallback("You already have this reaction or it doesn't exist.");
  }
};

const sneak = (callback: Callback = () => {}): void => {
  data.clearLastUserId();
  const direction = Math.sign(data.getTargetNumber() - data.getCurrentNumber());
  data.addToNumber(direction);
  callback(`🤫 Sneaked! Current number is now ${data.getCurrentNumber()}.`);
};

const deposit = (userId: string, callback: Callback = () => {}, quantity = 1): void => {
  data.addCrowns(userId, quantity);
  callback(`💳 You have purchased a Crown Gift Card! (+${quantity} 👑)`);
};

const sqrt = (callback: Callback = () => {}): void => {
  let num = data.getCurrentNumber();
  const sign = Math.sign(num);
  num = sign * Math.floor(Math.sqrt(Math.abs(num)));
  data.setCurrentNumber(num);
  callback(`👩‍🏫 Square Root! The current number is now ${num}.`);
};

const bomb = (
  userId: string,
  callback: Callback = () => {},
  errorCallback: ErrorCallback = () => {},
): void => {
  if (Boss.instance) {
    const name = Boss.instance.bossName;
    const isDead = Boss.instance.bomb(userId);
    if (isDead) {
      callback(`⚔ ${name} defeated!`);
    } else {
      callback(`💣 ${name} was bombed!`);
    }
    return;
  }
  errorCallback('There is no active boss right now.');
};

const crit = (userId: string, callback: Callback): boolean => {
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

const acrobatics = (userId: string, callback: Callback): boolean => {
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

const royalty = (userId: string, callback: Callback): boolean => {
  const currentRoyalty = data.getRoyalty(userId);
  if (!currentRoyalty) {
    data.setRoyalty(userId, 1);
    callback('Your royalty level is now 1.');
    return true;
  }
  if (currentRoyalty < constants.MAX_ROYALTY_LEVEL) {
    data.setRoyalty(userId, currentRoyalty + 1);
    callback(`Your royalty level is now ${currentRoyalty + 1}.`);
    return true;
  }
  callback('You already have the maximum royalty level!');
  return false;
};

const buy = (
  userId: string,
  item: string,
  quant: string | undefined,
  callback: Callback = () => {},
  errorCallback: ErrorCallback = () => {},
): void => {
  if (utils.hasProperty(enabledPowerups, item)) {
    let { price } = enabledPowerups[item];
    let quantity = 1;
    if (enabledPowerups[item].quantified) {
      if (quant && quant.toLowerCase() === 'max') {
        quantity = Math.floor((data.getCoins(userId) ?? 0) / price);
        if (quantity === 0) quantity = 1;
      } else if (!Number.isNaN(Number.parseInt(quant ?? '', 10))) {
        quantity = Number.parseInt(quant ?? '1', 10);
      }
      price *= quantity;
    }
    if ((data.getCoins(userId) ?? 0) < price) {
      errorCallback("You don't have enough coins.");
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
        deposit(userId, callback, quantity);
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
      case 'royalty':
        if (!royalty(userId, callback)) data.addCoins(userId, price);
        break;
      default:
        console.error(`ERROR: Unexpected default case: ${userId} buys ${item}.`);
    }
  } else if (utils.hasProperty(enabledSkins, item)) {
    const { price } = enabledSkins[item];
    if ((data.getCoins(userId) ?? 0) < price) {
      errorCallback("You don't have enough coins.");
      return;
    }
    data.removeCoins(userId, price);
    buyReactSkin(userId, item, callback, errorCallback);
  }
};

export default { buy };
