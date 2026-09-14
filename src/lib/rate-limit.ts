/**
 * Leading-edge rate limiter: the first call in each window runs, the rest are
 * dropped. Replaces `_.debounce(fn, ms, true)` from the underscore dependency.
 */
export const rateLimit = <A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): ((...args: A) => void) => {
  let lastCall = Number.NEGATIVE_INFINITY;
  return (...args: A): void => {
    const now = Date.now();
    if (now - lastCall < waitMs) return;
    lastCall = now;
    fn(...args);
  };
};
