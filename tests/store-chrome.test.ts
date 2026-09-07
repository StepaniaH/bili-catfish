import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChromeStorage, STORAGE_KEY } from '../src/shared/store';

type Listener = (changes: Record<string, unknown>, areaName: string) => void;

let listeners: Listener[];
const chromeStub = {
  storage: {
    local: {
      get: async (key: string) => ({ [key]: undefined }),
      set: async () => undefined,
      remove: async () => undefined,
    },
    onChanged: {
      addListener: (l: Listener) => listeners.push(l),
      removeListener: (l: Listener) => {
        listeners = listeners.filter((x) => x !== l);
      },
    },
  },
};

function fire(changes: Record<string, unknown>, areaName: string) {
  for (const l of listeners) l(changes, areaName);
}

describe('createChromeStorage onChange filter', () => {
  beforeEach(() => {
    listeners = [];
    vi.stubGlobal('chrome', chromeStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fires only for local area and bcf-state key', () => {
    const s = createChromeStorage();
    const cb = vi.fn();
    const off = s.onChange(cb);

    fire({ [STORAGE_KEY]: { newValue: {} } }, 'local');
    expect(cb).toHaveBeenCalledTimes(1);

    fire({ [STORAGE_KEY]: { newValue: {} } }, 'sync');
    fire({ 'other-key': { newValue: {} } }, 'local');
    expect(cb).toHaveBeenCalledTimes(1);

    off();
    fire({ [STORAGE_KEY]: { newValue: {} } }, 'local');
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
