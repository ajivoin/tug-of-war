import fs from 'fs';
import utils from './utils';
import { prefix } from '../config';

const FIVE_MINUTES = 1000 * 60 * 5;

let data;
fs.stat('./data.json', (err) => {
  if (err) {
    data = utils.getDataSchema();
    console.log('Using new data base.');
  } else {
    data = JSON.parse(fs.readFileSync('./data.json'));
    console.log('Read in data');
  }
});

const persistBoss = (boss) => {
  data.boss = boss;
};

const getBoss = () => data.boss;

/**
 * Writes data to disk.
 */
const persistData = () => {
  fs.writeFileSync('data.json', JSON.stringify(data));
  console.log('Data saved.');
};

setInterval(persistData, FIVE_MINUTES);

/**
 * @returns {Number} Target number
 */
const getTargetNumber = () => data.win;

/**
 * @returns {Number} Current number
 */
const getCurrentNumber = () => data.number;

/**
 * @returns {string} Correct answer emoji
 */
const getCorrectEmoji = () => data.correctEmoji;

/**
 * @returns {string} Incorrect answer emoji
 */
const getIncorrectEmoji = () => data.incorrectEmoji;

/**
 * @returns {string} Timeout emoji
 */
const getTimeoutEmoji = () => data.timeoutEmoji;

/**
 * @param {string} userId
 * @returns {boolean} `true` if database has `userId`.
 */
const hasUser = (userId) => utils.hasProperty(data.users, userId);

/**
 * @param {string} userId
 * @param {function?} errorCallback
 * @returns {object} Read-only user object
 */

const getUserWritable = (userId) => data.users[userId];

const getUser = (userId) => getUserWritable(userId);

const getCount = (userId) => getUser(userId).count;

const getWins = (userId) => getUser(userId).wins;

const getMiscount = (userId) => getUser(userId).miscount;

const getCritBonus = (userId) => getUser(userId).critBonus ?? 0;

const setCritBonus = (userId, value) => { getUser(userId).critBonus = value; };

const getAcrobatics = (userId) => getUser(userId).acrobatics ?? 0;

const setAcrobatics = (userId, value) => { getUser(userId).acrobatics = value; };

const getRoyalty = (userId) => getUser(userId).royalty ?? 0;

const setRoyalty = (userId, value) => { getUser(userId).royalty = value; };

/**
 * @param {string} userId
 * @param {function?} errorCallback
 * @returns {Number} Coins
 */
const getCoins = (userId, errorCallback) => {
  const user = getUser(userId, errorCallback);
  if (user) {
    return user.coins;
  }
  if (errorCallback) errorCallback(`User with ID ${userId} has no coins attribute.`);
  return undefined;
};

/**
 * @param {string} userId
 * @param {function?} errorCallback
 * @returns {Number} Crowns
 */
const getCrowns = (userId, errorCallback) => {
  const user = getUser(userId, errorCallback);
  if (user) {
    return user.crowns;
  }
  if (errorCallback) errorCallback(`User with ID ${userId} has no crowns attribute.`);
  return undefined;
};

/**
 * @param {string} userId
 * @param {Number} nCoins
 * @param {function?} callback
 * @param {function?} errorCallback
 */
const addCoins = (userId, nCoins, callback, errorCallback) => {
  const user = getUserWritable(userId);
  if (user) {
    const coins = Math.max(0, nCoins);
    user.coins += coins;
    if (callback) callback(`Added ${coins}c to user with ID ${userId}.`);
  } else if (errorCallback) {
    errorCallback(`User with ID ${userId} not found.`);
  }
};

/**
 * @param {string} userId
 * @param {Number} nCrowns
 * @param {function?} callback
 * @param {function?} errorCallback
 */
const addCrowns = (userId, nCrowns, callback, errorCallback) => {
  const user = getUserWritable(userId);
  if (user) {
    const crowns = Math.max(0, nCrowns);
    user.crowns += crowns;
    if (callback) callback(`Added ${crowns}c to user with ID ${userId}.`);
  } else if (errorCallback) {
    errorCallback(`User with ID ${userId} not found.`);
  }
};

/**
 * @param {string} userId
 * @param {Number} nCoins
 * @param {function?} callback
 * @param {function?} errorCallback
 */
const removeCoins = (userId, nCoins, callback, errorCallback) => {
  const user = getUserWritable(userId);
  if (user) {
    const coins = Math.max(0, nCoins);
    user.coins -= coins;
    if (user.coins < 0) user.coins = 0;
    if (callback) callback(`Removed ${coins}c to user with ID ${userId}.`);
  } else if (errorCallback) {
    errorCallback(`User with ID ${userId} not found.`);
  }
};

/**
 * @param {string} userId
 * @param {Number} nCrowns
 * @param {function?} callback
 * @param {function?} errorCallback
 */
const removeCrowns = (userId, nCrowns, callback, errorCallback) => {
  const user = getUserWritable(userId);
  if (user) {
    const crowns = Math.max(0, nCrowns);
    user.crowns -= crowns;
    if (callback) callback(`Removed ${crowns}c to user with ID ${userId}.`);
  } else if (errorCallback) {
    errorCallback(`User with ID ${userId} not found.`);
  }
};

/**
 * @param {Number} newTarget
 * @param {function?} callback
 * @param {function?} errorCallback
 */
const setTargetNumber = (newTarget, callback, errorCallback) => {
  if (Number.isInteger) {
    data.win = newTarget;
    if (callback) callback(`Target updated to ${newTarget}`);
  } else if (errorCallback) {
    errorCallback(`Could not set target to ${newTarget}`);
  }
};

/**
 * @param {Number} amount
 * @param {function?} callback
 * @param {function?} errorCallback
 */
const addToNumber = (amount, callback, errorCallback) => {
  if (Number.isInteger(amount)) {
    data.number += amount;
    if (callback) callback(`Added ${amount} to the current number.`);
  } else if (errorCallback) {
    errorCallback(`Could not add ${amount} to the current number.`);
  }
};

/**
 * @param {function?} callback
 */
const incrementNumber = (callback) => {
  data.number += 1;
  if (callback) callback(`Incremented number to ${data.number}.`);
};

/**
 * @param {function?} callback
 */
const decrementNumber = (callback) => {
  data.number -= 1;
  if (callback) callback(`Decremented number to ${data.number}.`);
};

/**
 * @param {Number} number
 * @param {function?} callback
 * @param {function?} errorCallback
 */
const setCurrentNumber = (number, callback, errorCallback) => {
  if (Number.isInteger(number)) {
    data.number = number;
    if (callback) callback(`Number set to ${number}.`);
  } else if (errorCallback) {
    errorCallback(`Could not set number to ${number}.`);
  }
};

/**
 * @param {string} userId
 * @param {function?} callback
 * @param {function?} errorCallback
 */
const setLastUserId = (userId, callback, errorCallback) => {
  if (userId !== null && userId !== undefined) {
    data.last = userId;
    if (callback) callback(`Last user set to ${userId}.`);
  } else if (errorCallback) {
    errorCallback(`Could not set last user to ${userId}.`);
  }
};

const clearLastUserId = () => { data.last = null; };

/**
 * @returns {string}
 */
const getLastUserId = () => data.last;

/**
 * @param {string} channelId
 * @param {function?} callback
 * @param {function?} errorCallback
 */
const setChannelId = (channelId, callback, errorCallback) => {
  if (channelId !== null && channelId !== undefined) {
    data.channel = channelId;
    if (callback) callback(`Channel set to ${channelId}.`);
  } else if (errorCallback) {
    errorCallback(`Could not set channel to ${channelId}.`);
  }
};

/**
 * @param {string} userId
 */
const disableReactions = (userId) => {
  const user = getUserWritable(userId);
  Object.keys(user.reactions).forEach((reaction) => { user.reactions[reaction] = false; });
};

/**
 * @param {string} userId
 * @param {string} reactionId
 */
const enableReaction = (userId, reactionId) => {
  const user = getUserWritable(userId);
  user.reactions[reactionId] = true;
};

const selectReaction = (userId, reactionId) => {
  disableReactions(userId);
  enableReaction(userId, reactionId);
};

const getUserReactionsMessage = (userId) => {
  let output = 'Your reactions:\n```\n';
  const user = getUser(userId);
  output += Object.keys(user.reactions).reduce((acc, react) => `${acc}${react}: ${utils.getEmoji(react)}\n`, '');
  output += `Select a skin with ${prefix}equip <item>\n`;
  output += '```';
  return output;
};

/**
 * @param {string} userId
 * @returns {string} Emoji
 */
const getReaction = (userId) => {
  const user = getUser(userId);
  const found = Object.keys(user.reactions).find((reaction) => user.reactions[reaction]);
  return utils.getEmoji(found) || data.correctEmoji;
};

const hasReaction = (userId, reactionId) => utils.hasProperty(
  getUser(userId).reactions, reactionId,
);

/**
 * @returns {string}
 */
const getChannelId = () => data.channel;

/**
 * @param {string} userId
 */
const incrementCount = (userId) => {
  const user = getUserWritable(userId);
  user.count += 1;
};

/**
 * @param {string} userId
 */
const incrementMiscount = (userId) => {
  const user = getUserWritable(userId);
  user.miscount += 1;
};

/**
 * @param {string} userId
 */
const incrementWins = (userId) => {
  const user = getUserWritable(userId);
  user.wins += 1;
};

/**
 * @param {string} userId
 * @param {function?} callback
 * @param {function?} errorCallback
 */
const createUser = (userId, callback, errorCallback) => {
  if (!utils.hasProperty(data.users, userId)) {
    data.users[userId] = utils.createUser();
    if (callback) callback(`New user with ID ${userId}.`);
  } else if (errorCallback) {
    errorCallback(`User with ID ${userId} already exists.`);
  }
};

const getAllUsers = () => data.users ?? {};

export default {
  // getters
  getUser,
  getTargetNumber,
  getCurrentNumber,
  getCorrectEmoji,
  getIncorrectEmoji,
  getTimeoutEmoji,
  getCoins,
  getLastUserId,
  getChannelId,
  getReaction,
  hasUser,
  getCrowns,
  getWins,
  getCount,
  getMiscount,
  hasReaction,
  getUserReactionsMessage,
  getBoss,
  getCritBonus,
  getAcrobatics,
  getRoyalty,
  getAllUsers,
  // modifiers
  addCoins,
  addCrowns,
  removeCoins,
  removeCrowns,
  setTargetNumber,
  addToNumber,
  incrementNumber,
  decrementNumber,
  setLastUserId,
  clearLastUserId,
  setChannelId,
  setCurrentNumber,
  disableReactions,
  enableReaction,
  incrementCount,
  incrementMiscount,
  incrementWins,
  createUser,
  selectReaction,
  persistBoss,
  setCritBonus,
  setAcrobatics,
  setRoyalty,
  // data utils
  persistData,
};
