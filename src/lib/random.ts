/** Random integer in the range [min, max). */
export const getRandomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min) + min);

export const sample = <T>(items: readonly T[]): T | undefined => items[Math.floor(Math.random() * items.length)];
