import constants from './constants.js';
import { skins } from './shop/items/skins.js';
import {
  UserData, DataSchema, Callback, ErrorCallback,
} from './types.js';

const hasProperty = (obj: object, prop: string): boolean => Object.prototype.hasOwnProperty.call(obj, prop);

// max is the only required argument. 0 < min < max
const getRandomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min) + min);

const getDataSchema = (): DataSchema => ({
  number: 0,
  users: {},
  last: null,
  channel: null,
  win: getRandomInt(0, constants.WIN),
  correctEmoji: constants.REACT_CORRECT,
  incorrectEmoji: constants.REACT_INCORRECT,
  timeoutEmoji: constants.REACT_TIMEOUT,
  boss: null,
});

const createUser = (): UserData => ({
  count: 0,
  wins: 0,
  crowns: 0,
  coins: 0,
  miscount: 0,
  boss: 0,
  reactions: { default: true },
});

const getEmoji = (
  reactionId: string,
  callback: Callback = () => {},
  errorCallback: ErrorCallback = () => {},
): string | undefined => {
  const emoji = skins[reactionId]?.emoji;
  if (emoji) callback(`Emoji found for ${reactionId}`);
  else errorCallback(`Emoji not found for ${reactionId}.`);
  return emoji;
};

const userIdToMention = (userId: string): string => `<@${userId}>`;

const tokenize = (str: string): string[] => str.toLowerCase().trim().split(/ +/);

const sortedListByProp = (
  dict: Record<string, UserData>,
  prop: keyof UserData,
  maxLength = 5,
): [string, UserData[keyof UserData]][] => Object.keys(dict).map((key) => ([
  key, dict[key][prop],
] as [string, UserData[keyof UserData]])).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, maxLength);

const generateLeaderboard = (
  users: Record<string, UserData>,
  sortingOption: keyof UserData = 'wins',
): [string, UserData[keyof UserData]][] => {
  const mentionAndScores = sortedListByProp(users, sortingOption).map(
    ([userId, value]) => [userIdToMention(userId), value] as [string, UserData[keyof UserData]],
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
  userIdToMention,
};
