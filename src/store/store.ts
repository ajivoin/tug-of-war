import type { BossState, GameState, User } from './schema.ts';
import { openDatabase, withTransaction } from './sqlite.ts';

export interface StoreOptions { file?: string }

interface GameStateRow {
  number: number; win: number; last: string | null; channel: string | null;
  correct_emoji: string; incorrect_emoji: string; timeout_emoji: string;
}
interface UserRow {
  id: string; count: number; wins: number; crowns: number; coins: number;
  miscount: number; boss: number; crit_bonus: number; acrobatics: number; royalty: number;
}
interface BossRow {
  level: number; health: number; total_health: number;
  reward_crowns: number; reward_coins: number;
  image_path: string; image_name: string; boss_name: string;
}
interface ReactionRow { reaction_id: string; selected: number }
interface ParticipantRow { user_id: string; damage: number }

export const createStore = (initialState: GameState, opts: StoreOptions = {}) => {
  const db = openDatabase(opts.file ?? ':memory:');

  const selectGameState = db.prepare('SELECT * FROM game_state WHERE id = 1');
  const insertGameState = db.prepare(`
    INSERT INTO game_state (id, number, win, last, channel, correct_emoji, incorrect_emoji, timeout_emoji)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateNumber = db.prepare('UPDATE game_state SET number = ? WHERE id = 1');
  const updateWin = db.prepare('UPDATE game_state SET win = ? WHERE id = 1');
  const updateLast = db.prepare('UPDATE game_state SET last = ? WHERE id = 1');
  const updateChannel = db.prepare('UPDATE game_state SET channel = ? WHERE id = 1');

  const selectUser = db.prepare('SELECT * FROM users WHERE id = ?');
  const selectAllUsers = db.prepare('SELECT * FROM users');
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)');
  const insertDefaultReaction = db.prepare(
    'INSERT OR IGNORE INTO user_reactions (user_id, reaction_id, selected) VALUES (?, ?, 1)',
  );
  const updateCoins = db.prepare('UPDATE users SET coins = ? WHERE id = ?');
  const updateCrowns = db.prepare('UPDATE users SET crowns = ? WHERE id = ?');
  const updateCount = db.prepare('UPDATE users SET count = count + 1 WHERE id = ?');
  const updateMiscount = db.prepare('UPDATE users SET miscount = miscount + 1 WHERE id = ?');
  const updateWins = db.prepare('UPDATE users SET wins = wins + 1 WHERE id = ?');
  const updateBossKills = db.prepare('UPDATE users SET boss = boss + 1 WHERE id = ?');
  const updateCritBonus = db.prepare('UPDATE users SET crit_bonus = ? WHERE id = ?');
  const updateAcrobatics = db.prepare('UPDATE users SET acrobatics = ? WHERE id = ?');
  const updateRoyalty = db.prepare('UPDATE users SET royalty = ? WHERE id = ?');

  const selectReactions = db.prepare('SELECT reaction_id, selected FROM user_reactions WHERE user_id = ?');
  const upsertReaction = db.prepare(`
    INSERT INTO user_reactions (user_id, reaction_id, selected) VALUES (?, ?, 1)
    ON CONFLICT (user_id, reaction_id) DO UPDATE SET selected = 1
  `);
  const deselectOtherReactions = db.prepare(
    'UPDATE user_reactions SET selected = 0 WHERE user_id = ? AND reaction_id != ?',
  );

  const selectBoss = db.prepare('SELECT * FROM boss_state WHERE id = 1');
  const deleteBoss = db.prepare('DELETE FROM boss_state WHERE id = 1');
  const deleteBossParticipants = db.prepare('DELETE FROM boss_participants');
  const insertBoss = db.prepare(`
    INSERT INTO boss_state
      (id, level, health, total_health, reward_crowns, reward_coins, image_path, image_name, boss_name)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertParticipant = db.prepare('INSERT INTO boss_participants (user_id, damage) VALUES (?, ?)');
  const selectParticipants = db.prepare('SELECT user_id, damage FROM boss_participants');

  // First boot against a brand-new database file: seed the single game_state
  // row from the caller's default state. A database that already has this
  // row (every boot after the first, and every post-migration boot) is left
  // untouched - the database is the source of truth, `initialState` is only
  // the fresh-install seed.
  if (!selectGameState.get()) {
    insertGameState.run(
      initialState.number, initialState.win, initialState.last, initialState.channel,
      initialState.correctEmoji, initialState.incorrectEmoji, initialState.timeoutEmoji,
    );
  }

  const getGameStateRow = (): GameStateRow => selectGameState.get() as unknown as GameStateRow;
  const getUserRow = (id: string): UserRow | undefined => selectUser.get(id) as unknown as UserRow | undefined;

  const reactionsFor = (id: string): Record<string, boolean> => Object.fromEntries(
    (selectReactions.all(id) as unknown as ReactionRow[]).map((r) => [r.reaction_id, r.selected === 1]),
  );

  const rowToUser = (row: UserRow): User => ({
    count: row.count,
    wins: row.wins,
    crowns: row.crowns,
    coins: row.coins,
    miscount: row.miscount,
    boss: row.boss,
    critBonus: row.crit_bonus,
    acrobatics: row.acrobatics,
    royalty: row.royalty,
    reactions: reactionsFor(row.id),
  });

  const rowToBoss = (row: BossRow): BossState => ({
    level: row.level,
    health: row.health,
    totalHealth: row.total_health,
    rewards: { crowns: row.reward_crowns, coins: row.reward_coins },
    participants: Object.fromEntries(
      (selectParticipants.all() as unknown as ParticipantRow[]).map((p) => [p.user_id, p.damage]),
    ),
    imagePath: row.image_path,
    imageName: row.image_name,
    bossName: row.boss_name,
  });

  const ensureUserRow = (id: string): void => {
    insertUser.run(id);
    insertDefaultReaction.run(id, 'default');
  };

  const adjustBalance = (id: string, field: 'coins' | 'crowns', delta: number, floorAtZero: boolean): void => {
    const row = getUserRow(id);
    if (!row) return;
    const next = row[field] + delta;
    const clamped = floorAtZero ? Math.max(0, next) : next;
    if (field === 'coins') updateCoins.run(clamped, id);
    else updateCrowns.run(clamped, id);
  };

  return {
    getUser: (id: string): Readonly<User> | undefined => {
      const row = getUserRow(id);
      return row ? Object.freeze(rowToUser(row)) : undefined;
    },
    ensureUser: (id: string): Readonly<User> => {
      withTransaction(db, () => ensureUserRow(id));
      return Object.freeze(rowToUser(getUserRow(id) as UserRow));
    },
    hasUser: (id: string): boolean => getUserRow(id) !== undefined,
    getAllUsers: (): Readonly<Record<string, User>> => Object.freeze(
      Object.fromEntries((selectAllUsers.all() as unknown as UserRow[]).map((row) => [row.id, rowToUser(row)])),
    ),

    // B3: a missing user yields 0, and the dead errorCallback parameter is gone.
    getCoins: (id: string): number => getUserRow(id)?.coins ?? 0,
    getCrowns: (id: string): number => getUserRow(id)?.crowns ?? 0,
    addCoins: (id: string, n: number): void => adjustBalance(id, 'coins', Math.max(0, n), true),
    removeCoins: (id: string, n: number): void => adjustBalance(id, 'coins', -Math.max(0, n), true),
    addCrowns: (id: string, n: number): void => adjustBalance(id, 'crowns', Math.max(0, n), false),
    removeCrowns: (id: string, n: number): void => adjustBalance(id, 'crowns', -Math.max(0, n), false),

    incrementCount: (id: string): void => { if (getUserRow(id)) updateCount.run(id); },
    incrementMiscount: (id: string): void => { if (getUserRow(id)) updateMiscount.run(id); },
    incrementWins: (id: string): void => { if (getUserRow(id)) updateWins.run(id); },
    incrementBossKills: (id: string): void => { if (getUserRow(id)) updateBossKills.run(id); },

    getCritBonus: (id: string): number => getUserRow(id)?.crit_bonus ?? 0,
    setCritBonus: (id: string, n: number): void => { if (getUserRow(id)) updateCritBonus.run(n, id); },
    getAcrobatics: (id: string): number => getUserRow(id)?.acrobatics ?? 0,
    setAcrobatics: (id: string, n: number): void => { if (getUserRow(id)) updateAcrobatics.run(n, id); },
    getRoyalty: (id: string): number => getUserRow(id)?.royalty ?? 0,
    setRoyalty: (id: string, n: number): void => { if (getUserRow(id)) updateRoyalty.run(n, id); },

    getNumber: (): number => getGameStateRow().number,
    // B1: the guard is actually invoked now.
    setNumber: (n: number): void => { if (Number.isInteger(n)) updateNumber.run(n); },
    addToNumber: (n: number): void => {
      if (!Number.isInteger(n)) return;
      updateNumber.run(getGameStateRow().number + n);
    },
    getTarget: (): number => getGameStateRow().win,
    setTarget: (n: number): void => { if (Number.isInteger(n)) updateWin.run(n); },

    getLastUserId: (): string | null => getGameStateRow().last,
    setLastUserId: (id: string): void => { updateLast.run(id); },
    clearLastUserId: (): void => { updateLast.run(null); },
    getChannelId: (): string | null => getGameStateRow().channel,
    setChannelId: (id: string): void => { updateChannel.run(id); },

    getBoss: (): Readonly<BossState> | null => {
      const row = selectBoss.get() as unknown as BossRow | undefined;
      return row ? Object.freeze(rowToBoss(row)) : null;
    },
    setBoss: (boss: BossState | null): void => {
      withTransaction(db, () => {
        deleteBoss.run();
        deleteBossParticipants.run();
        if (!boss) return;
        insertBoss.run(
          boss.level, boss.health, boss.totalHealth, boss.rewards.crowns, boss.rewards.coins,
          boss.imagePath, boss.imageName, boss.bossName,
        );
        Object.entries(boss.participants).forEach(([userId, damage]) => insertParticipant.run(userId, damage));
      });
    },

    hasReaction: (id: string, reactionId: string): boolean => Object.hasOwn(reactionsFor(id), reactionId),
    getReactions: (id: string): Readonly<Record<string, boolean>> => Object.freeze(reactionsFor(id)),
    selectReaction: (id: string, reactionId: string): void => {
      withTransaction(db, () => {
        upsertReaction.run(id, reactionId);
        deselectOtherReactions.run(id, reactionId);
      });
    },

    snapshot: (): GameState => {
      const g = getGameStateRow();
      const bossRow = selectBoss.get() as unknown as BossRow | undefined;
      return {
        number: g.number,
        win: g.win,
        last: g.last,
        channel: g.channel,
        users: Object.fromEntries((selectAllUsers.all() as unknown as UserRow[]).map((row) => [row.id, rowToUser(row)])),
        boss: bossRow ? rowToBoss(bossRow) : null,
        correctEmoji: g.correct_emoji,
        incorrectEmoji: g.incorrect_emoji,
        timeoutEmoji: g.timeout_emoji,
      };
    },

    // No flush() - every mutator above writes through immediately, so there
    // is no buffered state left to flush. stop() only needs to close the
    // handle cleanly on shutdown.
    stop: (): void => { db.close(); },
  };
};

export type Store = ReturnType<typeof createStore>;
