import fs from 'fs';
import utils from './utils';
import { prefix } from '../config';
import constants from './constants';

const FIVE_MINUTES = 1000 * 60 * 5;

let data;
fs.stat('./data.json', (err) => {
  if (err) {
    data = {};
    console.log('Using new data base.');
  } else {
    data = JSON.parse(fs.readFileSync('./data.json'));
    console.log('Read in data');
  }
});

const addGuildToData = (guildId) => {
  if (!utils.hasProperty(data, guildId)) {
    data[guildId] = utils.getDataSchema();
  }
};

const guildContext = (guildId) => data[guildId];

const persistBoss = (guildId, boss) => {
  const guild = guildContext(guildId);
  guild.boss = boss;
  console.log(`Boss added to data for guild ${guildId}`);
};

const getBoss = (guildId) => guildContext(guildId)?.boss;

const getBosses = () => {
  const results = {};
  Object.keys(data).forEach((guildId) => {
    results[guildId] = { boss: data[guildId].boss };
  });
  return results;
};

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
const getTargetNumber = (guildId) => guildContext(guildId)?.win;

/**
 * @returns {Number} Current number
 */
const getCurrentNumber = (guildId) => guildContext(guildId)?.number;

/**
 * @returns {string} Correct answer emoji
 */
const getCorrectEmoji = (guildId) => guildContext(guildId)?.correctEmoji;

/**
 * @returns {string} Incorrect answer emoji
 */
const getIncorrectEmoji = (guildId) => guildContext(guildId)?.incorrectEmoji;

/**
 * @returns {string} Timeout emoji
 */
const getTimeoutEmoji = (guildId) => guildContext(guildId)?.timeoutEmoji;

/**
 * @param {string} userId
 * @returns {boolean} `true` if database has `userId`.
 */
const hasUser = (guildId, userId) => utils.hasProperty(guildContext(guildId)?.users, userId);

/**
 * @param {string} userId
 * @param {function?} errorCallback
 * @returns {object} Read-only user object
 */

const getUserWritable = (guildId, userId) => guildContext(guildId)?.users[userId];

const getUser = (guildId, userId) => getUserWritable(guildId, userId);

const getCount = (guildId, userId) => getUser(guildId, userId).count;

const getWins = (guildId, userId) => getUser(guildId, userId).wins;

const getMiscount = (guildId, userId) => getUser(guildId, userId).miscount;

/**
 * @param {string} userId
 * @param {function?} errorCallback
 * @returns {Number} Coins
 */
const getCoins = (guildId, userId, errorCallback) => {
  const user = getUser(guildId, userId);
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
const getCrowns = (guildId, userId, errorCallback) => {
  const user = getUser(guildId, userId, errorCallback);
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
const addCoins = (guildId, userId, nCoins, callback, errorCallback) => {
  const user = getUserWritable(guildId, userId);
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
const addCrowns = (guildId, userId, nCrowns, callback, errorCallback) => {
  const user = getUserWritable(guildId, userId);
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
const removeCoins = (guildId, userId, nCoins, callback, errorCallback) => {
  const user = getUserWritable(guildId, userId);
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
const removeCrowns = (guildId, userId, nCrowns, callback, errorCallback) => {
  const user = getUserWritable(guildId, userId);
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
const setTargetNumber = (guildId, newTarget, callback, errorCallback) => {
  if (Number.isInteger) {
    guildContext(guildId).win = newTarget;
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
const addToNumber = (guildId, amount, callback, errorCallback) => {
  if (Number.isInteger(amount)) {
    guildContext(guildId).number += amount;
    if (callback) callback(`Added ${amount} to the current number.`);
  } else if (errorCallback) {
    errorCallback(`Could not add ${amount} to the current number.`);
  }
};

/**
 * @param {function?} callback
 */
const incrementNumber = (guildId, callback) => {
  guildContext(guildId).number += 1;
  if (callback) callback(`Incremented number to ${data.number}.`);
};

/**
 * @param {function?} callback
 */
const decrementNumber = (guildId, callback) => {
  guildContext(guildId).number -= 1;
  if (callback) callback(`Decremented number to ${data.number}.`);
};

/**
 * @param {Number} number
 * @param {function?} callback
 * @param {function?} errorCallback
 */
const setCurrentNumber = (guildId, number, callback, errorCallback) => {
  if (Number.isInteger(number)) {
    guildContext(guildId).number = number;
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
const setLastUserId = (guildId, userId, callback, errorCallback) => {
  if (userId !== null && userId !== undefined) {
    guildContext(guildId).last = userId;
    if (callback) callback(`Last user set to ${userId}.`);
  } else if (errorCallback) {
    errorCallback(`Could not set last user to ${userId}.`);
  }
};

const clearLastUserId = (guildId) => { guildContext(guildId).last = null; };

/**
 * @returns {string}
 */
const getLastUserId = (guildId) => guildContext(guildId).last;

/**
 * @param {string} channelId
 * @param {function?} callback
 * @param {function?} errorCallback
 */
const setChannelId = (guildId, channelId, callback, errorCallback) => {
  if (channelId !== null && channelId !== undefined) {
    guildContext(guildId).channel = channelId;
    if (callback) callback(`Channel set to ${channelId}.`);
  } else if (errorCallback) {
    errorCallback(`Could not set channel to ${channelId}.`);
  }
};

/**
 * @param {string} userId
 */
const disableReactions = (guildId, userId) => {
  const user = getUserWritable(guildId, userId);
  Object.keys(user.reactions).forEach((reaction) => { user.reactions[reaction] = false; });
};

/**
 * @param {string} userId
 * @param {string} reactionId
 */
const enableReaction = (guildId, userId, reactionId) => {
  const user = getUserWritable(guildId, userId);
  user.reactions[reactionId] = true;
};

const selectReaction = (guildId, userId, reactionId) => {
  disableReactions(guildId, userId);
  enableReaction(guildId, userId, reactionId);
};

const getUserReactionsMessage = (guildId, userId) => {
  let output = 'Your reactions:\n```\n';
  const user = getUser(guildId, userId);
  output += Object.keys(user.reactions).reduce((acc, react) => `${acc}${react}: ${utils.getEmoji(react)}\n`, '');
  output += `Select a skin with ${prefix}equip <item>\n`;
  output += '```';
  return output;
};

/**
 * @param {string} userId
 * @returns {string} Emoji
 */
const getReaction = (guildId, userId) => {
  const user = getUser(guildId, userId);
  const found = Object.keys(user.reactions).find((reaction) => user.reactions[reaction]);
  return utils.getEmoji(found) || constants.REACT_CORRECT;
};

const hasReaction = (guildId, userId, reactionId) => utils.hasProperty(
  getUser(guildId, userId).reactions, reactionId,
);

/**
 * @returns {string}
 */
const getChannelId = (guildId) => guildContext(guildId)?.channel;

/**
 * @param {string} userId
 */
const incrementCount = (guildId, userId) => {
  const user = getUserWritable(guildId, userId);
  user.count += 1;
};

/**
 * @param {string} userId
 */
const incrementMiscount = (guildId, userId) => {
  const user = getUserWritable(guildId, userId);
  user.miscount += 1;
};

/**
 * @param {string} userId
 */
const incrementWins = (guildId, userId) => {
  const user = getUserWritable(guildId, userId);
  user.wins += 1;
};

/**
 * @param {string} userId
 * @param {function?} callback
 * @param {function?} errorCallback
 */
const createUser = (guildId, userId, callback, errorCallback) => {
  if (!utils.hasProperty(guildContext(guildId).users, userId)) {
    guildContext(guildId).users[userId] = utils.createUser();
    if (callback) callback(`New user with ID ${userId}.`);
  } else if (errorCallback) {
    errorCallback(`User with ID ${userId} already exists.`);
  }
};

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
  getBosses,
  // modifiers
  addCoins,
  addCrowns,
  addGuildToData,
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
  // data utils
  persistData,
};
