import fs from 'node:fs';
import { loadState } from './json-file.ts';
import { openDatabase, withTransaction } from './sqlite.ts';
import type { GameState } from './schema.ts';

const writeLegacyState = (dbFile: string, state: GameState): void => {
  const db = openDatabase(dbFile);
  try {
    withTransaction(db, () => {
      db.prepare(`
        INSERT INTO game_state (id, number, win, last, channel, correct_emoji, incorrect_emoji, timeout_emoji)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        state.number, state.win, state.last, state.channel,
        state.correctEmoji, state.incorrectEmoji, state.timeoutEmoji,
      );

      const insertUser = db.prepare(`
        INSERT INTO users (id, count, wins, crowns, coins, miscount, boss, crit_bonus, acrobatics, royalty)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertReaction = db.prepare(
        'INSERT INTO user_reactions (user_id, reaction_id, selected) VALUES (?, ?, ?)',
      );
      Object.entries(state.users).forEach(([id, user]) => {
        insertUser.run(
          id, user.count, user.wins, user.crowns, user.coins,
          user.miscount, user.boss, user.critBonus, user.acrobatics, user.royalty,
        );
        Object.entries(user.reactions).forEach(([reactionId, selected]) => {
          insertReaction.run(id, reactionId, selected ? 1 : 0);
        });
      });

      if (state.boss) {
        db.prepare(`
          INSERT INTO boss_state
            (id, level, health, total_health, reward_crowns, reward_coins, image_path, image_name, boss_name)
          VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          state.boss.level, state.boss.health, state.boss.totalHealth,
          state.boss.rewards.crowns, state.boss.rewards.coins,
          state.boss.imagePath, state.boss.imageName, state.boss.bossName,
        );
        const insertParticipant = db.prepare('INSERT INTO boss_participants (user_id, damage) VALUES (?, ?)');
        Object.entries(state.boss.participants).forEach(([userId, damage]) => {
          insertParticipant.run(userId, damage);
        });
      }
    });
  } finally {
    db.close();
  }
};

/**
 * One-time migration from the legacy JSON save file to the SQLite database.
 * Runs only when `dbFile` does not exist yet and `legacyFile` does - every
 * boot after the first finds the SQLite file already there and returns
 * immediately, so this is safe to call unconditionally on every startup.
 * On success the old JSON is renamed to `<legacyFile>.migrated` so a
 * container restart can never re-import it.
 */
export const migrateLegacyStateIfNeeded = (legacyFile: string, dbFile: string): void => {
  if (fs.existsSync(dbFile) || !fs.existsSync(legacyFile)) return;

  console.log(`No ${dbFile} yet; importing legacy state from ${legacyFile}...`);
  const state = loadState(legacyFile);
  writeLegacyState(dbFile, state);
  fs.renameSync(legacyFile, `${legacyFile}.migrated`);
  console.log(`Migrated ${legacyFile} -> ${dbFile} (old file kept as ${legacyFile}.migrated).`);
};
