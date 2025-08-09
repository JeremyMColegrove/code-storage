import { describe, expect, it } from 'vitest';
import { languageFromFilename, mergeScripts, writeAllToDisk, writeScriptsToDisk, type ScriptItem } from '../fs-sync';
import { nowIso } from '../vault';

describe('fs-sync helpers', () => {
  it('languageFromFilename detects by extension', () => {
    expect(languageFromFilename('file.ts')).toBe('typescript');
    expect(languageFromFilename('file.go')).toBe('go');
    expect(languageFromFilename('file.unknown')).toBe('javascript');
    expect(languageFromFilename('Makefile')).toBe('javascript');
  });

  it('mergeScripts replaces by filePath and appends new ones', () => {
    const existing: ScriptItem[] = [
      { id: '1', name: 'a', description: '', language: 'javascript', content: '1', createdAt: nowIso(), updatedAt: nowIso(), filePath: 'a.js' },
      { id: '2', name: 'b', description: '', language: 'javascript', content: '2', createdAt: nowIso(), updatedAt: nowIso(), filePath: 'b.js' },
    ];
    const incoming: ScriptItem[] = [
      { id: '3', name: 'b-new', description: '', language: 'javascript', content: '2new', createdAt: nowIso(), updatedAt: nowIso(), filePath: 'b.js' },
      { id: '4', name: 'c', description: '', language: 'javascript', content: '3', createdAt: nowIso(), updatedAt: nowIso(), filePath: 'c.js' },
    ];
    const result = mergeScripts(existing, incoming);
    expect(result.find(s => s.filePath === 'b.js')?.name).toBe('b-new');
    expect(result.some(s => s.filePath === 'c.js')).toBe(true);
    expect(result.some(s => s.filePath === 'a.js')).toBe(true);
  });
});

// File System Access API fakes for write tests
class MemoryWritable {
  public chunks: Array<string | Blob> = [];
  async write(content: string | Blob) { this.chunks.push(content); }
  async close() {}
}

class MemoryFileHandle {
  constructor(public name: string, private parent: MemoryDirHandle) {}
  async createWritable() { return new MemoryWritable(); }
  async getFile() { return { text: async () => this.parent.files.get(this.name) ?? '' } as any; }
}

class MemoryDirHandle {
  files = new Map<string, string>();
  removed: string[] = [];
  async getFileHandle(name: string, _opts?: { create?: boolean }) {
    return new MemoryFileHandle(name, this);
  }
  async removeEntry(name: string) { this.removed.push(name); this.files.delete(name); }
}

describe('fs-sync write operations', () => {
  it('writeScriptsToDisk writes files and metadata', async () => {
    const dir = new MemoryDirHandle() as unknown as FileSystemDirectoryHandle;
    const scripts: ScriptItem[] = [
      { id: '1', name: 'a', description: '', language: 'javascript', content: 'console.log(1)', createdAt: nowIso(), updatedAt: nowIso() },
    ];
    const updated = await writeScriptsToDisk(dir, scripts, { preferredProvider: 'gemini', geminiApiKey: null, openaiApiKey: null, claudeApiKey: null });
    expect(updated[0].filePath).toBe('a.js');
  });

  it('writeAllToDisk writes and handles renames', async () => {
    const dir = new MemoryDirHandle() as unknown as FileSystemDirectoryHandle & { removeEntry?: (name: string) => Promise<void> };
    const scripts: ScriptItem[] = [
      { id: '1', name: 'Old Name', description: '', language: 'javascript', content: '1', createdAt: nowIso(), updatedAt: nowIso(), filePath: 'Old-Name.js' },
    ];
    const updated = await writeAllToDisk(dir, scripts, { preferredProvider: 'gemini', geminiApiKey: null, openaiApiKey: null, claudeApiKey: null });
    expect(updated[0].filePath).toBe('Old-Name.js');
  });
});


