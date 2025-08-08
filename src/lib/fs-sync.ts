import { filenameFor, LANGUAGE_MAP, nowIso, uid, type LanguageKey, type ScriptItem, type VaultState } from "./vault";

export function languageFromFilename(filename: string): LanguageKey {
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : "";
  const entry = Object.entries(LANGUAGE_MAP).find(([, v]) => v.ext.toLowerCase() === ext);
  return (entry?.[0] as LanguageKey) ?? "javascript";
}

export async function importFromFolder(handle: FileSystemDirectoryHandle): Promise<ScriptItem[]> {
  // Collect files and optional metadata.json
  type ExternalMetaItem = {
    id?: string;
    name?: string;
    description?: string;
    language?: LanguageKey;
    filename?: string;
    createdAt?: string;
    updatedAt?: string;
  };

  let metadata: { items?: ExternalMetaItem[] } | null = null;
  const files: { name: string; handle: FileSystemFileHandle }[] = [];
  const entriesIterable = handle as unknown as { entries: () => AsyncIterable<[string, FileSystemHandle]> };
  for await (const [name, entry] of entriesIterable.entries()) {
    if (entry.kind === "file") {
      if (name.toLowerCase() === "metadata.json") {
        const file = await (entry as FileSystemFileHandle).getFile();
        try { metadata = JSON.parse(await file.text()); } catch { metadata = null; }
      } else {
        files.push({ name, handle: entry as FileSystemFileHandle });
      }
    }
  }

  // Build scripts from metadata if present
  const filenameToFile = new Map<string, { name: string; handle: FileSystemFileHandle }>();
  files.forEach(f => filenameToFile.set(f.name, f));

  const imported: ScriptItem[] = [];

  if (metadata && Array.isArray(metadata.items)) {
    for (const item of metadata.items as ExternalMetaItem[]) {
      const filename: string | undefined = item.filename || item.name;
      if (!filename) continue;
      const fileRec = filenameToFile.get(filename);
      if (!fileRec) continue;
      const file = await fileRec.handle.getFile();
      const content = await file.text();
      const language = (item.language as LanguageKey) || languageFromFilename(filename);
      imported.push({
        id: item.id || uid(),
        name: item.name || filename.replace(/\.[^.]+$/, ""),
        description: item.description || "",
        language,
        content,
        createdAt: item.createdAt || nowIso(),
        updatedAt: item.updatedAt || nowIso(),
        filePath: filename,
      });
    }
  }

  // Add any extra files not present in metadata
  for (const f of files) {
    if (imported.some(s => s.filePath === f.name)) continue;
    const file = await f.handle.getFile();
    const content = await file.text();
    const language = languageFromFilename(f.name);
    imported.push({
      id: uid(),
      name: f.name.replace(/\.[^.]+$/, ""),
      description: "",
      language,
      content,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      filePath: f.name,
    });
  }

  return imported;
}

export function mergeScripts(existing: ScriptItem[], incoming: ScriptItem[]): ScriptItem[] {
  const byPath = new Map<string, ScriptItem>();
  existing.forEach(s => { if (s.filePath) byPath.set(s.filePath, s); });
  const result: ScriptItem[] = [...existing];
  for (const inc of incoming) {
    if (inc.filePath && byPath.has(inc.filePath)) {
      const idx = result.findIndex(s => s.filePath === inc.filePath);
      if (idx >= 0) result[idx] = inc;
    } else {
      result.push(inc);
    }
  }
  return result;
}

export async function writeAllToDisk(dirHandle: FileSystemDirectoryHandle, scripts: ScriptItem[], settings?: VaultState["settings"]): Promise<ScriptItem[]> {
  type DirWithApi = FileSystemDirectoryHandle & {
    getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemFileHandle>;
    removeEntry?: (name: string, options?: { recursive?: boolean }) => Promise<void>;
  };
  const dir = dirHandle as DirWithApi;
  const updated: ScriptItem[] = [];
  for (const s of scripts) {
    const desiredName = filenameFor(s);
    const isRename = s.filePath && s.filePath !== desiredName;
    const fileHandle = await dir.getFileHandle(desiredName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(s.content);
    await writable.close();
    if (isRename && dir.removeEntry) {
      try { await dir.removeEntry(s.filePath as string); } catch { /* ignore */ }
    }
    updated.push({ ...s, filePath: desiredName });
  }
  await writeMetadata(dirHandle, updated, settings);
  return updated;
}

export async function writeScriptsToDisk(dirHandle: FileSystemDirectoryHandle, scripts: ScriptItem[], settings?: VaultState["settings"]): Promise<ScriptItem[]> {
  type DirWithApi = FileSystemDirectoryHandle & { getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemFileHandle> };
  const dir = dirHandle as DirWithApi;
  const updated: ScriptItem[] = [];
  for (const s of scripts) {
    const name = filenameFor(s);
    const fileHandle = await dir.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(s.content);
    await writable.close();
    updated.push({ ...s, filePath: name });
  }
  await writeMetadata(dirHandle, updated, settings);
  return updated;
}

async function writeMetadata(dirHandle: FileSystemDirectoryHandle, scripts: ScriptItem[], settings?: VaultState["settings"]) {
  type DirWithApi = FileSystemDirectoryHandle & { getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemFileHandle> };
  const dir = dirHandle as DirWithApi;
  const metaItems = scripts.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    language: s.language,
    filename: s.filePath || filenameFor(s),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
  const metadata = {
    exportedAt: nowIso(),
    count: scripts.length,
    languages: Array.from(new Set(scripts.map(s => s.language))),
    items: metaItems,
    app: { name: "Script Vault", version: 1 },
    settings: settings ?? undefined,
  };
  const metaHandle = await dir.getFileHandle("metadata.json", { create: true });
  const metaWritable = await metaHandle.createWritable();
  await metaWritable.write(new Blob([JSON.stringify(metadata, null, 2)], { type: "application/json" }));
  await metaWritable.close();
}


