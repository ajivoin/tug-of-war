const constants = require('./constants');
const skins = require('./skins.json');
const commands = require('./commands.json');
const { prefix } = require('../config.json');

const hasProperty = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);

// max is the only required argument. 0 < min < max
/**
 * Behavior only guaranteed if max > min.
 * @param {Number} max
 * @param {Number?} min
 */
const getRandomInt = (max, min) => {
  let minVal = min;
  if (Number.isNaN(min)) {
    minVal = -1;
  }
  return Math.max(minVal, Math.floor(Math.random() * Math.floor(max)));
};

/**
 * @returns {object}
 */
const getDataSchema = () => ({
  number: 0,
  users: {},
  last: null,
  channel: null,
  win: getRandomInt(constants.WIN, 1),
  correctEmoji: constants.REACT_CORRECT,
  incorrectEmoji: constants.REACT_INCORRECT,
  timeoutEmoji: constants.REACT_TIMEOUT,
});

/**
 * @returns {Object}
 */
const createUser = () => ({
  count: 0,
  wins: 0,
  crowns: 0,
  coins: 0,
  miscount: 0,
  reactions: {},
  powerups: {
    reroll: 0,
    teleport: 0,
    fliparoo: 0,
    zero: 0,
  },
});

/**
 * @param {string} reactionId
 * @param {function?} callback
 * @param {function?} errorCallback
 * @returns {string} Emoji
 */
const getEmoji = (reactionId, callback, errorCallback) => {
  const emoji = skins[reactionId];
  if (!emoji && errorCallback) errorCallback(`Emoji not found for ${reactionId}.`);
  return emoji;
};

const helpMsgBuilder = () => {
  let output = 'Command info:\n```\n';
  output += Object.keys(commands).reduce((acc, cmd) => `${acc}${prefix}${cmd}: ${commands[cmd]}\n`, '');
  output += '```';
  return output;
};

const helpMsg = helpMsgBuilder();
Object.freeze(helpMsg);

const tokenize = (str) => str.toLowerCase().trim().split(/ +/);

module.exports = {
  getRandomInt, hasProperty, getDataSchema, createUser, getEmoji, helpMsg, tokenize,
};
