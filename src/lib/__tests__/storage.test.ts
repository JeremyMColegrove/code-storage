import { beforeEach, describe, expect, it } from 'vitest';
import { loadState, saveState, STORAGE_KEY } from '../storage';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadState returns default when missing', () => {
    const s = loadState();
    expect(s).toEqual({ scripts: [], selectedId: null, settings: { geminiApiKey: null } });
  });

  it('loadState returns default on parse error', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    const s = loadState();
    expect(s).toEqual({ scripts: [], selectedId: null, settings: { geminiApiKey: null } });
  });

  it('loadState patches missing settings', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scripts: [], selectedId: null }));
    const s = loadState();
    expect(s.settings).toEqual({ geminiApiKey: null });
  });

  it('saveState writes to localStorage', () => {
    const state = { scripts: [], selectedId: null, settings: { geminiApiKey: 'key' } };
    saveState(state as any);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(state);
  });
});


