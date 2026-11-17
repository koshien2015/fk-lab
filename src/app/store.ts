/**
 * 最小限の状態置き場。状態は書き換えず、毎回新しいオブジェクトに差し替える。
 */
export interface Store<T> {
  get(): T;
  /** 一部を差し替える */
  set(patch: Partial<T>): void;
  /** 変わるたびに呼ばれる。戻り値で解除する。 */
  subscribe(listener: (state: T, previous: T) => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<(state: T, previous: T) => void>();
  return {
    get: () => state,
    set(patch) {
      const previous = state;
      state = { ...state, ...patch };
      for (const listener of listeners) listener(state, previous);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
