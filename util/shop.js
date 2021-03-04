let shop = require('./shop.json');
const skins = require('./skins.json');
const { prefix } = require('../config.json');
const data = require('./data');
const utils = require('./utils');
const constants = require('./constants');

const shopListBuilder = () => {
  let output = '```\n';
  output += Object.keys(shop).reduce((acc, item) => `${acc}${item}${item.startsWith('skin-') && item.indexOf('flex') < 0 ? ` (${skins[item]})` : ''} costs ${shop[item]}c\n`, '');
  output += `Purchase and use an item with ${prefix}buy <item>\n`;
  output += '```';
  return output;
};

const contents = shopListBuilder();
Object.freeze(contents);

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
    && utils.hasProperty(shop, reactionId)
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

const buy = (userId, item, callback, errorCallback) => {
  if (!utils.hasProperty(shop, item)) {
    return;
  }
  if (data.getCoins(userId) >= shop[item]) {
    const price = shop[item];
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
      case 'crown-card':
        deposit(userId, callback);
        break;
      case 'skin-default':
      case 'skin-flex':
      case 'skin-koala':
      case 'skin-kiss':
      case 'skin-ufo':
      case 'skin-megaflex':
      case 'skin-ultraflex':
      case 'skin-hyperflex':
        buyReactSkin(userId, item, callback, errorCallback);
        break;
      default:
        if (errorCallback) {
          errorCallback(
            `${item} is not in the shop. This shouldn't have happened.`,
          );
          data.addCoins(userId, price);
        }
    }
  } else if (errorCallback) errorCallback("You don't have enough coins.");
};

const reload = () => {
  // eslint-disable-next-line global-require
  shop = require('./shop.json');
};

module.exports = {
  buy,
  contents,
  reload,
};
