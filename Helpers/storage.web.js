const storagePrefix = 'budgetbuddy:';

function getBrowserStorage() {
  if (typeof globalThis.localStorage === 'undefined') {
    throw new Error('Browser storage is unavailable.');
  }
  return globalThis.localStorage;
}

export const storage = {
  getString(key) {
    return getBrowserStorage().getItem(`${storagePrefix}${key}`) ?? undefined;
  },
  set(key, value) {
    getBrowserStorage().setItem(`${storagePrefix}${key}`, String(value));
  },
  remove(key) {
    getBrowserStorage().removeItem(`${storagePrefix}${key}`);
  },
  getAllKeys() {
    const browserStorage = getBrowserStorage();
    return Object.keys(browserStorage)
      .filter((key) => key.startsWith(storagePrefix))
      .map((key) => key.slice(storagePrefix.length));
  },
};