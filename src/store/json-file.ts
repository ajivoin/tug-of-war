import fs from 'node:fs';
import { parseState, createState, type GameState } from './schema.ts';

/**
 * Reads game state from disk. Synchronous by design: the legacy implementation
 * assigned state inside an async fs.stat callback, so anything touching state
 * before that callback fired threw (B2).
 */
export const loadState = (file: string): GameState => {
  try {
    return parseState(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException;
    if (code === 'ENOENT') console.log('No save file found; starting fresh.');
    else console.error(`Could not read ${file}, starting fresh:`, error);
    return createState();
  }
};

export const saveState = (file: string, state: GameState): void => {
  fs.writeFileSync(file, JSON.stringify(state));
};
