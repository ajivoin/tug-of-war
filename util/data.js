const fs = require('fs');
const utils = require('./utils');
const skins = require('./skins.json');

const FIVE_MINUTES = 1000 * 60 * 5;

let data;
fs.stat('data.json', (err) => {
  if (err) {
    data = utils.getDataSchema();
    console.log('Using new data base.');
  } else {
    data = JSON.parse(fs.readFileSync('data.json'));
    console.log('Read in data');
  }
});

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
const getUser = (userId, errorCallback) => {
  const user = data.users[userId];
  if (user) return Object.freeze(user);
  if (errorCallback) errorCallback(`User with ID ${userId} not found.`);
  return undefined;
};

const getUserWritable = (userId) => data.users[userId] || undefined;

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
const removeCrowns = (userId, nCrowns, callback, errorCallback) => {
  const user = getUserWritable(userId);
  if (user) {
    const crowns = Math.max(0, nCrowns);
    user.crowns -= crowns;
    if (callback) callback(`Added ${crowns}c to user with ID ${userId}.`);
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

/**
 * @param {string} userId
 * @returns {string} Emoji
 */
const getReaction = (userId) => {
  const user = getUser(userId);
  const found = Object.keys(user.reactions).find((reaction) => user.reactions[reaction]);
  return skins[found] || data.correctEmoji;
};

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

/**
 * @param {string} reactionId
 * @param {function?} callback
 * @param {function?} errorCallback
 * @returns {string} Emoji
 */
const getEmojiForReactionId = (reactionId, callback, errorCallback) => {
  const emoji = skins[reactionId];
  if (!emoji) errorCallback(`Emoji not found for ${reactionId}.`);
  return emoji;
};

module.exports = {
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
  getEmojiForReactionId,
  getCrowns,
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
  // data utils
  persistData,
};
