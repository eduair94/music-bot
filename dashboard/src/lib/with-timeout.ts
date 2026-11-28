/**
 * Resolves to the promise's value, or null when it rejects or takes longer
 * than `ms`. Used by the public pages' server reads so a slow Redis, Mongo or
 * GitHub can never hold up or break a render.
 */
export function withTimeout<T>(promise: Promise<T>, ms = 1500): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.catch(() => null),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
