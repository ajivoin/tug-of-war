import path from 'node:path';

// Resolved from this module rather than the working directory, so the bot no
// longer depends on being launched from the repository root.
export const BOSS_IMAGE_DIR = path.join(import.meta.dirname, '..', '..', 'assets', 'boss-images');

export const bossImage = (name: string): string => path.join(BOSS_IMAGE_DIR, name);

/**
 * Rebases a persisted image path onto the current asset directory. Saves
 * written before the art moved out of `util/boss_images/` store a path that no
 * longer resolves; discord.js then throws ENOENT while resolving the
 * attachment, which took down `t?info` for as long as that boss stayed alive.
 */
export const resolveBossImage = (stored: string): string => bossImage(path.basename(stored));

export const bossImageName = (stored: string): string => path.basename(stored);
