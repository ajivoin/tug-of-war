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

const persistData = () => {
  fs.writeFileSync('data.json', JSON.stringify(data));
  console.log('Data saved.');
};

setInterval(persistData, FIVE_MINUTES);

const getTargetNumber = () => data.win;

const getCurrentNumber = () => data.number;

const getCorrectEmoji = () => data.correctEmoji;

const getIncorrectEmoji = () => data.incorrectEmoji;

const getTimeoutEmoji = () => data.timeoutEmoji;

const hasUser = (userId) => utils.hasProperty(data.users, userId);

const getUser = (userId, errorCallback) => {
  const user = data.users[userId];
  if (user) return Object.freeze(user);
  if (errorCallback) errorCallback(`User with ID ${userId} not found.`);
  return undefined;
};

const getUserWritable = (userId) => data.users[userId] || undefined;

const getCoins = (userId, errorCallback) => {
  const user = getUser(userId, errorCallback);
  if (user) {
    return user.coins;
  }
  if (errorCallback) errorCallback(`User with ID ${userId} has no coins attribute.`);
  return undefined;
};

const getCrowns = (userId, errorCallback) => {
  const user = getUser(userId, errorCallback);
  if (user) {
    return user.crowns;
  }
  if (errorCallback) errorCallback(`User with ID ${userId} has no crowns attribute.`);
  return undefined;
};


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

const setTargetNumber = (newTarget, callback, errorCallback) => {
  if (Number.isInteger) {
    data.win = newTarget;
    if (callback) callback(`Target updated to ${newTarget}`);
  } else if (errorCallback) {
    errorCallback(`Could not set target to ${newTarget}`);
  }
};

const addToNumber = (amount, callback, errorCallback) => {
  if (Number.isInteger(amount)) {
    data.number += amount;
    if (callback) callback(`Added ${amount} to the current number.`);
  } else if (errorCallback) {
    errorCallback(`Could not add ${amount} to the current number.`);
  }
};

const incrementNumber = (callback) => {
  data.number += 1;
  if (callback) callback(`Incremented number to ${data.number}.`);
};

const decrementNumber = (callback) => {
  data.number -= 1;
  if (callback) callback(`Decremented number to ${data.number}.`);
};

const setCurrentNumber = (number, callback, errorCallback) => {
  if (Number.isInteger(number)) {
    data.number = number;
    if (callback) callback(`Number set to ${number}.`);
  } else if (errorCallback) {
    errorCallback(`Could not set number to ${number}.`);
  }
};

const setLastUserId = (userId, callback, errorCallback) => {
  if (userId !== null && userId !== undefined) {
    data.last = userId;
    if (callback) callback(`Last user set to ${userId}.`);
  } else if (errorCallback) {
    errorCallback(`Could not set last user to ${userId}.`);
  }
};

const clearLastUserId = () => { data.last = null; };

const getLastUserId = () => data.last;

const setChannelId = (channelId, callback, errorCallback) => {
  if (channelId !== null && channelId !== undefined) {
    data.channel = channelId;
    if (callback) callback(`Channel set to ${channelId}.`);
  } else if (errorCallback) {
    errorCallback(`Could not set channel to ${channelId}.`);
  }
};

const disableReactions = (userId) => {
  const user = getUserWritable(userId);
  Object.keys(user.reactions).forEach((reaction) => { user.reactions[reaction] = false; });
};

const enableReaction = (userId, reactionId) => {
  const user = getUserWritable(userId);
  user.reactions[reactionId] = true;
};

const getReaction = (userId) => {
  const user = getUser(userId);
  const found = Object.keys(user.reactions).find((reaction) => user.reactions[reaction]);
  return skins[found] || data.correctEmoji;
};

const getChannelId = () => data.channel;

const incrementCount = (userId) => {
  const user = getUserWritable(userId);
  user.count += 1;
};

const incrementMiscount = (userId) => {
  const user = getUserWritable(userId);
  user.miscount += 1;
};

const incrementWins = (userId) => {
  const user = getUserWritable(userId);
  user.wins += 1;
};

const createUser = (userId, callback, errorCallback) => {
  if (!utils.hasProperty(data.users, userId)) {
    data.users[userId] = utils.createUser();
    if (callback) callback(`New user with ID ${userId}.`);
  } else if (errorCallback) {
    errorCallback(`User with ID ${userId} already exists.`);
  }
};

const getEmojiForReactionId = (reactionId, callback, errorCallback) => {
  const emoji = skins[reactionId];
  if (!emoji) errorCallback(`Emoji not found for ${reactionId}.`);
  return emoji;
}

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
