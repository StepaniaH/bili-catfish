// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { isExtensionContextValid } from '../src/content/index';

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error test cleanup
  delete globalThis.chrome;
});

describe('isExtensionContextValid', () => {
  it('returns true when chrome.runtime.id exists', () => {
    vi.stubGlobal('chrome', { runtime: { id: 'abc' } });
    expect(isExtensionContextValid()).toBe(true);
  });

  it('returns false when chrome.runtime is missing (stale context)', () => {
    vi.stubGlobal('chrome', { storage: {} });
    expect(isExtensionContextValid()).toBe(false);
  });

  it('returns false when runtime.id is empty', () => {
    vi.stubGlobal('chrome', { runtime: { id: '' } });
    expect(isExtensionContextValid()).toBe(false);
  });

  it('returns false when chrome is undefined', () => {
    // @ts-expect-error test setup
    delete globalThis.chrome;
    expect(isExtensionContextValid()).toBe(false);
  });
});
