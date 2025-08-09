import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScriptItem, VaultState } from '../vault';
import { copyCurrentToClipboard, deleteScriptEverywhere, openFolderAndImport, saveAllToDiskOrLocal, syncFromFolder, updateCurrentScript } from '../vault-actions';

vi.mock('../fs-sync', () => ({
  importFromFolder: vi.fn(async (_h: any) => [
    { id: '1', name: 'a', description: '', language: 'javascript', content: '1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), filePath: 'a.js' },
  ]),
  writeAllToDisk: vi.fn(async (_h: any, s: ScriptItem[]) => s.map(x => ({ ...x, filePath: x.filePath || 'a.js' }))),
  writeScriptsToDisk: vi.fn(async (_h: any, s: ScriptItem[]) => s.map(x => ({ ...x, filePath: x.filePath || 'a.js' }))),
  mergeScripts: vi.fn((a: ScriptItem[], b: ScriptItem[]) => [...a, ...b]),
  importChangesSince: vi.fn(async (_h: any, _e: any) => ({ changed: [], onDiskFilenames: new Set() })),
}));

vi.mock('../storage', () => ({ saveState: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

describe('vault-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('openFolderAndImport sets state when permission granted', async () => {
    const handle: any = { name: 'Folder', requestPermission: vi.fn(async () => 'granted') };
    (window as any).showDirectoryPicker = vi.fn(async () => handle);
    const setDirectory = vi.fn();
    const setFolderName = vi.fn();
    const setState = vi.fn();
    await openFolderAndImport(setDirectory, setFolderName, setState);
    expect(setDirectory).toHaveBeenCalledWith(handle);
    expect(setFolderName).toHaveBeenCalledWith('Folder');
    expect(setState).toHaveBeenCalled();
  });

  it('syncFromFolder merges and saves', async () => {
    const handle: any = {};
    const state: VaultState = { scripts: [], selectedId: null, settings: { preferredProvider: 'gemini', geminiApiKey: null, openaiApiKey: null, claudeApiKey: null } } as any;
    const setState = vi.fn();
    await syncFromFolder(handle, state, setState);
    expect(setState).toHaveBeenCalled();
  });

  it('copyCurrentToClipboard writes content', async () => {
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    await copyCurrentToClipboard({ id: '1', name: '', description: '', language: 'javascript', content: 'abc', createdAt: '', updatedAt: '' });
    expect(writeText).toHaveBeenCalledWith('abc');
  });

  it('saveAllToDiskOrLocal with directory writes to disk', async () => {
    const state: VaultState = { scripts: [{ id: '1', name: 'a', description: '', language: 'javascript', content: '1', createdAt: '', updatedAt: '' }], selectedId: '1', settings: { preferredProvider: 'gemini', geminiApiKey: null, openaiApiKey: null, claudeApiKey: null } } as any;
    const setState = vi.fn();
    await saveAllToDiskOrLocal(state, {} as any, setState);
    expect(setState).toHaveBeenCalled();
  });

  it('deleteScriptEverywhere updates state without directory', async () => {
    const state: VaultState = { scripts: [{ id: '1', name: 'a', description: '', language: 'javascript', content: '1', createdAt: '', updatedAt: '' }], selectedId: '1', settings: { preferredProvider: 'gemini', geminiApiKey: null, openaiApiKey: null, claudeApiKey: null } } as any;
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const setState = vi.fn();
    await deleteScriptEverywhere('1', state, null, setState);
    expect(setState).toHaveBeenCalled();
  });

  it('updateCurrentScript applies patch through setState updater', () => {
    const current: ScriptItem = { id: '1', name: 'a', description: '', language: 'javascript', content: '1', createdAt: '', updatedAt: '' };
    const setState = vi.fn((updater) => {
      const prev: VaultState = { scripts: [current], selectedId: '1', settings: { preferredProvider: 'gemini', geminiApiKey: null, openaiApiKey: null, claudeApiKey: null } } as any;
      const next = updater(prev);
      expect(next.scripts[0].name).toBe('b');
    });
    updateCurrentScript(current, { name: 'b' }, setState as any);
    expect(setState).toHaveBeenCalled();
  });
});


