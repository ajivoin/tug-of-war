import {
  createUser, type BossState, type GameState, type User,
} from './schema.ts';
import { saveState } from './json-file.ts';

const FIVE_MINUTES = 1000 * 60 * 5;

export interface StoreOptions { file?: string; flushMs?: number }

export const createStore = (state: GameState, opts: StoreOptions = {}) => {
  const { file, flushMs = FIVE_MINUTES } = opts;

  const flush = (): void => {
    if (!file) return;
    saveState(file, state);
    console.log('Data saved.');
  };

  // .unref() so the flush timer never holds the event loop open.
  const timer = file ? setInterval(flush, flushMs).unref() : undefined;

  const writable = (id: string): User | undefined => state.users[id];

  const adjust = (id: string, field: 'coins' | 'crowns', delta: number, floorAtZero: boolean): void => {
    const user = writable(id);
    if (!user) return;
    user[field] += delta;
    if (floorAtZero && user[field] < 0) user[field] = 0;
  };

  return {
    getUser: (id: string): Readonly<User> | undefined => {
      const u = writable(id);
      return u ? Object.freeze({ ...u }) : undefined;
    },
    ensureUser: (id: string): Readonly<User> => {
      state.users[id] ??= createUser();
      return Object.freeze({ ...state.users[id] });
    },
    hasUser: (id: string): boolean => writable(id) !== undefined,
    getAllUsers: (): Readonly<Record<string, User>> => Object.freeze({ ...state.users }),

    // B3: a missing user yields 0, and the dead errorCallback parameter is gone.
    getCoins: (id: string): number => writable(id)?.coins ?? 0,
    getCrowns: (id: string): number => writable(id)?.crowns ?? 0,
    addCoins: (id: string, n: number): void => adjust(id, 'coins', Math.max(0, n), true),
    removeCoins: (id: string, n: number): void => adjust(id, 'coins', -Math.max(0, n), true),
    addCrowns: (id: string, n: number): void => adjust(id, 'crowns', Math.max(0, n), false),
    removeCrowns: (id: string, n: number): void => adjust(id, 'crowns', -Math.max(0, n), false),

    incrementCount: (id: string): void => { const u = writable(id); if (u) u.count += 1; },
    incrementMiscount: (id: string): void => { const u = writable(id); if (u) u.miscount += 1; },
    incrementWins: (id: string): void => { const u = writable(id); if (u) u.wins += 1; },
    incrementBossKills: (id: string): void => { const u = writable(id); if (u) u.boss += 1; },

    getCritBonus: (id: string): number => writable(id)?.critBonus ?? 0,
    setCritBonus: (id: string, n: number): void => { const u = writable(id); if (u) u.critBonus = n; },
    getAcrobatics: (id: string): number => writable(id)?.acrobatics ?? 0,
    setAcrobatics: (id: string, n: number): void => { const u = writable(id); if (u) u.acrobatics = n; },
    getRoyalty: (id: string): number => writable(id)?.royalty ?? 0,
    setRoyalty: (id: string, n: number): void => { const u = writable(id); if (u) u.royalty = n; },

    getNumber: (): number => state.number,
    // B1: the guard is actually invoked now.
    setNumber: (n: number): void => { if (Number.isInteger(n)) state.number = n; },
    addToNumber: (n: number): void => { if (Number.isInteger(n)) state.number += n; },
    getTarget: (): number => state.win,
    setTarget: (n: number): void => { if (Number.isInteger(n)) state.win = n; },

    getLastUserId: (): string | null => state.last,
    setLastUserId: (id: string): void => { state.last = id; },
    clearLastUserId: (): void => { state.last = null; },
    getChannelId: (): string | null => state.channel,
    setChannelId: (id: string): void => { state.channel = id; },

    getBoss: (): Readonly<BossState> | null => (state.boss ? Object.freeze({ ...state.boss }) : null),
    setBoss: (boss: BossState | null): void => { state.boss = boss; },

    hasReaction: (id: string, reactionId: string): boolean => Object.hasOwn(writable(id)?.reactions ?? {}, reactionId),
    getReactions: (id: string): Readonly<Record<string, boolean>> => Object.freeze({ ...(writable(id)?.reactions ?? {}) }),
    selectReaction: (id: string, reactionId: string): void => {
      const user = writable(id);
      if (!user) return;
      Object.keys(user.reactions).forEach((k) => { user.reactions[k] = false; });
      user.reactions[reactionId] = true;
    },

    snapshot: (): GameState => structuredClone(state),
    flush,
    stop: (): void => { if (timer) clearInterval(timer); flush(); },
  };
};

export type Store = ReturnType<typeof createStore>;
