import { beforeEach, describe, expect, it } from 'vitest';
import { loadState, saveState, STORAGE_KEY } from '../storage';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadState returns default when missing', () => {
    const s = loadState();
    expect(s).toEqual({ scripts: [], selectedId: null, settings: { preferredProvider: 'gemini', geminiApiKey: null, openaiApiKey: null, claudeApiKey: null } });
  });

  it('loadState returns default on parse error', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    const s = loadState();
    expect(s).toEqual({ scripts: [], selectedId: null, settings: { preferredProvider: 'gemini', geminiApiKey: null, openaiApiKey: null, claudeApiKey: null } });
  });

  it('loadState patches missing settings', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scripts: [], selectedId: null }));
    const s = loadState();
    expect(s.settings).toEqual({ preferredProvider: 'gemini', geminiApiKey: null, openaiApiKey: null, claudeApiKey: null });
  });

  it('saveState writes to localStorage', () => {
    const state = { scripts: [], selectedId: null, settings: { preferredProvider: 'openai', geminiApiKey: null, openaiApiKey: 'key', claudeApiKey: null } };
    saveState(state as any);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(state);
  });
});


