const constants = require('./constants');

const hasProperty = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);

// max is the only required argument. 0 < min < max
/**
 * Behavior only guaranteed if max > min.
 * 
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

module.exports = {
  getRandomInt, hasProperty, getDataSchema, createUser,
};