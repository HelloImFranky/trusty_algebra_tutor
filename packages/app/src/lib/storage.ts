/**
 * Tiny synchronous-feeling key/value storage. Web uses localStorage; native
 * swaps in an AsyncStorage-backed version via storage.native.ts (metro
 * resolves the platform file).
 */
export interface KV {
  get(key: string): string | null | Promise<string | null>;
  set(key: string, value: string): void | Promise<void>;
  remove(key: string): void | Promise<void>;
}

const memory = new Map<string, string>();

export const storage: KV = {
  get(key) {
    if (typeof window === 'undefined' || !('localStorage' in window)) return memory.get(key) ?? null;
    return window.localStorage.getItem(key);
  },
  set(key, value) {
    if (typeof window === 'undefined' || !('localStorage' in window)) {
      memory.set(key, value);
      return;
    }
    window.localStorage.setItem(key, value);
  },
  remove(key) {
    if (typeof window === 'undefined' || !('localStorage' in window)) {
      memory.delete(key);
      return;
    }
    window.localStorage.removeItem(key);
  },
};
