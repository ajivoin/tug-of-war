import fs from 'fs';
import utils from './utils.js';
import { prefix } from '../config.js';
import {
  UserData, DataSchema, PersistedBoss, Callback, ErrorCallback,
} from './types.js';

const FIVE_MINUTES = 1000 * 60 * 5;

// Definite assignment: data.json is read synchronously before any event fires
let data!: DataSchema;
fs.stat('./data.json', (err) => {
  if (err) {
    data = utils.getDataSchema();
    console.log('Using new data base.');
  } else {
    data = JSON.parse(fs.readFileSync('./data.json').toString()) as DataSchema;
    console.log('Read in data');
  }
});

const persistBoss = (boss: PersistedBoss | null): void => {
  data.boss = boss;
};

const getBoss = (): PersistedBoss | null => data.boss;

const persistData = (): void => {
  fs.writeFileSync('data.json', JSON.stringify(data));
  console.log('Data saved.');
};

setInterval(persistData, FIVE_MINUTES);

const getTargetNumber = (): number => data.win;

const getCurrentNumber = (): number => data.number;

const getCorrectEmoji = (): string => data.correctEmoji;

const getIncorrectEmoji = (): string => data.incorrectEmoji;

const getTimeoutEmoji = (): string => data.timeoutEmoji;

const hasUser = (userId: string): boolean => utils.hasProperty(data.users, userId);

const getUserWritable = (userId: string): UserData => data.users[userId];

const getUser = (userId: string): UserData => getUserWritable(userId);

const getCount = (userId: string): number => getUser(userId).count;

const getWins = (userId: string): number => getUser(userId).wins;

const getMiscount = (userId: string): number => getUser(userId).miscount;

const getCritBonus = (userId: string): number => getUser(userId).critBonus ?? 0;

const setCritBonus = (userId: string, value: number): void => { getUser(userId).critBonus = value; };

const getAcrobatics = (userId: string): number => getUser(userId).acrobatics ?? 0;

const setAcrobatics = (userId: string, value: number): void => { getUser(userId).acrobatics = value; };

const getRoyalty = (userId: string): number => getUser(userId).royalty ?? 0;

const setRoyalty = (userId: string, value: number): void => { getUser(userId).royalty = value; };

const getCoins = (userId: string, errorCallback: ErrorCallback = () => {}): number | undefined => {
  const user = getUser(userId);
  if (user) return user.coins;
  errorCallback(`User with ID ${userId} has no coins attribute.`);
  return undefined;
};

const getCrowns = (userId: string, errorCallback: ErrorCallback = () => {}): number | undefined => {
  const user = getUser(userId);
  if (user) return user.crowns;
  errorCallback(`User with ID ${userId} has no crowns attribute.`);
  return undefined;
};

const addCoins = (
  userId: string,
  nCoins: number,
  callback: Callback = () => {},
  errorCallback: ErrorCallback = () => {},
): void => {
  const user = getUserWritable(userId);
  if (user) {
    const coins = Math.max(0, nCoins);
    user.coins += coins;
    callback(`Added ${coins}c to user with ID ${userId}.`);
  } else {
    errorCallback(`User with ID ${userId} not found.`);
  }
};

const addCrowns = (
  userId: string,
  nCrowns: number,
  callback: Callback = () => {},
  errorCallback: ErrorCallback = () => {},
): void => {
  const user = getUserWritable(userId);
  if (user) {
    const crowns = Math.max(0, nCrowns);
    user.crowns += crowns;
    callback(`Added ${crowns}c to user with ID ${userId}.`);
  } else {
    errorCallback(`User with ID ${userId} not found.`);
  }
};

const removeCoins = (
  userId: string,
  nCoins: number,
  callback: Callback = () => {},
  errorCallback: ErrorCallback = () => {},
): void => {
  const user = getUserWritable(userId);
  if (user) {
    const coins = Math.max(0, nCoins);
    user.coins -= coins;
    if (user.coins < 0) user.coins = 0;
    callback(`Removed ${coins}c to user with ID ${userId}.`);
  } else {
    errorCallback(`User with ID ${userId} not found.`);
  }
};

const removeCrowns = (
  userId: string,
  nCrowns: number,
  callback: Callback = () => {},
  errorCallback: ErrorCallback = () => {},
): void => {
  const user = getUserWritable(userId);
  if (user) {
    const crowns = Math.max(0, nCrowns);
    user.crowns -= crowns;
    callback(`Removed ${crowns}c to user with ID ${userId}.`);
  } else {
    errorCallback(`User with ID ${userId} not found.`);
  }
};

const setTargetNumber = (
  newTarget: number,
  callback: Callback = () => {},
  errorCallback: ErrorCallback = () => {},
): void => {
  if (Number.isInteger(newTarget)) {
    data.win = newTarget;
    callback(`Target updated to ${newTarget}`);
  } else {
    errorCallback(`Could not set target to ${newTarget}`);
  }
};

const addToNumber = (
  amount: number,
  callback: Callback = () => {},
  errorCallback: ErrorCallback = () => {},
): void => {
  if (Number.isInteger(amount)) {
    data.number += amount;
    callback(`Added ${amount} to the current number.`);
  } else {
    errorCallback(`Could not add ${amount} to the current number.`);
  }
};

const incrementNumber = (callback: Callback = () => {}): void => {
  data.number += 1;
  callback(`Incremented number to ${data.number}.`);
};

const decrementNumber = (callback: Callback = () => {}): void => {
  data.number -= 1;
  callback(`Decremented number to ${data.number}.`);
};

const setCurrentNumber = (
  number: number,
  callback: Callback = () => {},
  errorCallback: ErrorCallback = () => {},
): void => {
  if (Number.isInteger(number)) {
    data.number = number;
    callback(`Number set to ${number}.`);
  } else {
    errorCallback(`Could not set number to ${number}.`);
  }
};

const setLastUserId = (
  userId: string,
  callback: Callback = () => {},
  errorCallback: ErrorCallback = () => {},
): void => {
  if (userId !== null && userId !== undefined) {
    data.last = userId;
    callback(`Last user set to ${userId}.`);
  } else {
    errorCallback(`Could not set last user to ${userId}.`);
  }
};

const clearLastUserId = (): void => { data.last = null; };

const getLastUserId = (): string | null => data.last;

const setChannelId = (
  channelId: string,
  callback: Callback = () => {},
  errorCallback: ErrorCallback = () => {},
): void => {
  if (channelId !== null && channelId !== undefined) {
    data.channel = channelId;
    callback(`Channel set to ${channelId}.`);
  } else {
    errorCallback(`Could not set channel to ${channelId}.`);
  }
};

const disableReactions = (userId: string): void => {
  const user = getUserWritable(userId);
  Object.keys(user.reactions).forEach((reaction) => { user.reactions[reaction] = false; });
};

const enableReaction = (userId: string, reactionId: string): void => {
  const user = getUserWritable(userId);
  user.reactions[reactionId] = true;
};

const selectReaction = (userId: string, reactionId: string): void => {
  disableReactions(userId);
  enableReaction(userId, reactionId);
};

const getUserReactionsMessage = (userId: string): string => {
  let output = 'Your reactions:\n```\n';
  const user = getUser(userId);
  output += Object.keys(user.reactions).reduce((acc, react) => `${acc}${react}: ${utils.getEmoji(react)}\n`, '');
  output += `Select a skin with ${prefix}equip <item>\n`;
  output += '```';
  return output;
};

const getReaction = (userId: string): string => {
  const user = getUser(userId);
  const found = Object.keys(user.reactions).find((reaction) => user.reactions[reaction]);
  return utils.getEmoji(found ?? '') ?? data.correctEmoji;
};

const hasReaction = (userId: string, reactionId: string): boolean => utils.hasProperty(getUser(userId).reactions, reactionId);

const getChannelId = (): string | null => data.channel;

const incrementCount = (userId: string): void => {
  const user = getUserWritable(userId);
  user.count += 1;
};

const incrementMiscount = (userId: string): void => {
  const user = getUserWritable(userId);
  user.miscount += 1;
};

const incrementWins = (userId: string): void => {
  const user = getUserWritable(userId);
  user.wins += 1;
};

const createUser = (
  userId: string,
  callback: Callback = () => {},
  errorCallback: ErrorCallback = () => {},
): void => {
  if (!utils.hasProperty(data.users, userId)) {
    data.users[userId] = utils.createUser();
    callback(`New user with ID ${userId}.`);
  } else {
    errorCallback(`User with ID ${userId} already exists.`);
  }
};

const getAllUsers = (): Record<string, UserData> => data.users ?? {};

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
