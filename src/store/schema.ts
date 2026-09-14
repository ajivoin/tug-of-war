import { constants } from '../game/constants.ts';
import { getRandomInt } from '../lib/random.ts';

export interface User {
  count: number;
  wins: number;
  crowns: number;
  coins: number;
  miscount: number;
  boss: number;
  critBonus: number;
  acrobatics: number;
  royalty: number;
  reactions: Record<string, boolean>;
}

export interface BossState {
  level: number;
  health: number;
  totalHealth: number;
  rewards: { crowns: number; coins: number };
  participants: Record<string, number>;
  imagePath: string;
  imageName: string;
  bossName: string;
}

export interface GameState {
  number: number;
  win: number;
  last: string | null;
  channel: string | null;
  users: Record<string, User>;
  boss: BossState | null;
  correctEmoji: string;
  incorrectEmoji: string;
  timeoutEmoji: string;
}

export const createUser = (): User => ({
  count: 0,
  wins: 0,
  crowns: 0,
  coins: 0,
  miscount: 0,
  boss: 0,
  critBonus: 0,
  acrobatics: 0,
  royalty: 0,
  reactions: { default: true },
});

export const createState = (): GameState => ({
  number: 0,
  win: getRandomInt(0, constants.WIN),
  last: null,
  channel: null,
  users: {},
  boss: null,
  correctEmoji: constants.REACT_CORRECT,
  incorrectEmoji: constants.REACT_INCORRECT,
  timeoutEmoji: constants.REACT_TIMEOUT,
});

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);

const parseUser = (raw: unknown): User => {
  if (!isRecord(raw)) return createUser();
  return {
    count: num(raw.count, 0),
    wins: num(raw.wins, 0),
    crowns: num(raw.crowns, 0),
    coins: num(raw.coins, 0),
    miscount: num(raw.miscount, 0),
    boss: num(raw.boss, 0),
    critBonus: num(raw.critBonus, 0),
    acrobatics: num(raw.acrobatics, 0),
    royalty: num(raw.royalty, 0),
    reactions: isRecord(raw.reactions)
      ? Object.fromEntries(Object.entries(raw.reactions).map(([k, v]) => [k, Boolean(v)]))
      : { default: true },
  };
};

const parseBoss = (raw: unknown): BossState | null => {
  if (!isRecord(raw)) return null;
  const health = num(raw.health, 0);
  // B7 defense: a dead boss must never survive a restart and pay rewards twice.
  if (health <= 0) return null;
  if (typeof raw.bossName !== 'string' || typeof raw.imagePath !== 'string') return null;
  return {
    level: num(raw.level, 1),
    health,
    totalHealth: num(raw.totalHealth, health),
    rewards: isRecord(raw.rewards)
      ? { crowns: num(raw.rewards.crowns, 0), coins: num(raw.rewards.coins, 0) }
      : { crowns: 0, coins: 0 },
    participants: isRecord(raw.participants)
      ? Object.fromEntries(Object.entries(raw.participants).map(([k, v]) => [k, num(v, 0)]))
      : {},
    imagePath: raw.imagePath,
    imageName: str(raw.imageName, ''),
    bossName: raw.bossName,
  };
};

export const parseState = (raw: unknown): GameState => {
  const base = createState();
  if (!isRecord(raw)) return base;
  return {
    number: num(raw.number, base.number),
    win: num(raw.win, base.win),
    last: typeof raw.last === 'string' ? raw.last : null,
    channel: typeof raw.channel === 'string' ? raw.channel : null,
    users: isRecord(raw.users)
      ? Object.fromEntries(Object.entries(raw.users).map(([id, u]) => [id, parseUser(u)]))
      : {},
    boss: parseBoss(raw.boss),
    correctEmoji: str(raw.correctEmoji, base.correctEmoji),
    incorrectEmoji: str(raw.incorrectEmoji, base.incorrectEmoji),
    timeoutEmoji: str(raw.timeoutEmoji, base.timeoutEmoji),
  };
};
