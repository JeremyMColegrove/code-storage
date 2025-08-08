import { describe, expect, it } from 'vitest';
import { createBlankScript, filenameFor, nowIso, uid, type ScriptItem } from '../vault';

describe('vault helpers', () => {
  it('nowIso returns an ISO string', () => {
    const iso = nowIso();
    expect(() => new Date(iso)).not.toThrow();
    expect(iso).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('uid returns a non-empty string', () => {
    const id = uid();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('filenameFor builds safe filename with correct extension', () => {
    const item: ScriptItem = {
      id: '1',
      name: 'Hello: World/\\Test',
      description: '',
      language: 'python',
      content: '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    expect(filenameFor(item)).toBe('Hello_-World__Test.py');
  });

  it('createBlankScript returns initialized script', () => {
    const s = createBlankScript();
    expect(s.id).toBeTruthy();
    expect(s.name).toBe('Untitled Script');
    expect(s.language).toBe('javascript');
    expect(s.content).toContain('// Start typing');
    expect(new Date(s.createdAt).toString()).not.toBe('Invalid Date');
    expect(new Date(s.updatedAt).toString()).not.toBe('Invalid Date');
  });
});


