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


