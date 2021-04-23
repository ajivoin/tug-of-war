import constants from './constants';
import { skins } from './shop/items/skins';

const hasProperty = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);

// max is the only required argument. 0 < min < max
/**
 * return random int in range [min, max)
 * @param {Number} max
 * @param {Number} min
 */
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min) + min);

/**
 * @returns {object}
 */
const getDataSchema = () => ({
  number: 0,
  users: {},
  last: null,
  channel: null,
  win: getRandomInt(0, constants.WIN),
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
  boss: 0,
  reactions: { default: true },
});

/**
 * @param {string} reactionId
 * @param {function?} callback
 * @param {function?} errorCallback
 * @returns {string} Emoji
 */
const getEmoji = (reactionId, callback, errorCallback) => {
  const emoji = skins[reactionId]?.emoji;
  if (emoji && callback) callback(`Emoji found for ${reactionId}`);
  else if (!emoji && errorCallback) errorCallback(`Emoji not found for ${reactionId}.`);
  return emoji;
};

const userIdToMention = (userId) => `<@${userId}>`;

const tokenize = (str) => str.toLowerCase().trim().split(/ +/);

const sortedListByProp = (dict, prop, maxLength = 5) => Object.keys(dict).map((key) => ([
  key, dict[key][prop],
])).sort((a, b) => b[1] - a[1]).slice(0, maxLength);

const generateLeaderboard = (users, sortingOption = 'wins') => {
  const mentionAndScores = sortedListByProp(users, sortingOption).map(
    ([userId, value]) => [userIdToMention(userId), value],
  );
  return mentionAndScores;
};

export default {
  getRandomInt,
  hasProperty,
  getDataSchema,
  createUser,
  getEmoji,
  tokenize,
  generateLeaderboard,
};
