import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// Polyfill matchMedia for hooks/components relying on it
if (!window.matchMedia) {
  // @ts-expect-error - test polyfill
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

// Ensure localStorage exists in node environment (jsdom should provide it, but ensure fallback)
if (typeof localStorage === 'undefined') {
  // @ts-expect-error - define polyfill
  global.localStorage = {
    _data: new Map<string, string>(),
    getItem(key: string) { return this._data.get(key) ?? null; },
    setItem(key: string, value: string) { this._data.set(key, value); },
    removeItem(key: string) { this._data.delete(key); },
    clear() { this._data.clear(); },
    key(i: number) { return Array.from(this._data.keys())[i] ?? null; },
    get length() { return this._data.size; },
  } as unknown as Storage;
}

// Provide a basic window.confirm for tests that call it
if (typeof window.confirm === 'undefined') {
  window.confirm = () => true;
}

// Polyfill ResizeObserver for Radix UI in tests
if (typeof (global as any).ResizeObserver === 'undefined') {
  (global as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}


