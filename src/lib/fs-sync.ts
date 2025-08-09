import { filenameFor, LANGUAGE_MAP, nowIso, uid, type LanguageKey, type ScriptItem, type VaultState } from "./vault";

// Compute SHA-256 hash of text content and return hex string
export async function hashTextContent(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function languageFromFilename(filename: string): LanguageKey {
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : "";
  const entry = Object.entries(LANGUAGE_MAP).find(([, v]) => v.ext.toLowerCase() === ext);
  return (entry?.[0] as LanguageKey) ?? "javascript";
}

const SUPPORTED_EXTS = new Set<string>(Object.values(LANGUAGE_MAP).map(v => v.ext.toLowerCase()));
function isSupportedCodeFile(name: string): boolean {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  return SUPPORTED_EXTS.has(ext);
}

function isProbablyBinary(content: string): boolean {
  // Heuristic: if contains NUL or a high ratio of non-printable chars
  if (content.includes("\u0000")) return true;
  let nonPrintable = 0;
  const len = Math.min(content.length, 2000);
  for (let i = 0; i < len; i++) {
    const code = content.charCodeAt(i);
    // allow common whitespace and printable ASCII; others count
    const isPrintable = (code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13;
    if (!isPrintable) nonPrintable++;
  }
  return nonPrintable / Math.max(1, len) > 0.2;
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
      } else if (isSupportedCodeFile(name)) {
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
      // Safety: ignore non-text files even if extension looked okay
      const isText = file.type.startsWith("text/") || file.type === ""; // some browsers leave type empty
      if (!isText) { continue; }
      const content = await file.text();
      if (isProbablyBinary(content)) { continue; }
      const contentHash = await hashTextContent(content);
      const diskModifiedAt = new Date(file.lastModified).toISOString();
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
        contentHash,
        diskModifiedAt,
      });
    }
  }

  // Add any extra files not present in metadata
  for (const f of files) {
    if (imported.some(s => s.filePath === f.name)) continue;
    const file = await f.handle.getFile();
    const isText = file.type.startsWith("text/") || file.type === "";
    if (!isText) { continue; }
    const content = await file.text();
    if (isProbablyBinary(content)) { continue; }
    const contentHash = await hashTextContent(content);
    const diskModifiedAt = new Date(file.lastModified).toISOString();
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
      contentHash,
      diskModifiedAt,
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

// Import only files that changed since lastSyncAt. This avoids reading content for unchanged files.
export type DirectoryScanResult = { changed: ScriptItem[]; onDiskFilenames: Set<string> };

export async function importChangesSince(
  handle: FileSystemDirectoryHandle,
  existing: ScriptItem[],
  lastSyncAt?: string | null,
): Promise<DirectoryScanResult> {
  type ExternalMetaItem = {
    id?: string;
    name?: string;
    description?: string;
    language?: LanguageKey;
    filename?: string;
    createdAt?: string;
    updatedAt?: string;
  };

  const byPathExisting = new Map<string, ScriptItem>();
  existing.forEach(s => { if (s.filePath) byPathExisting.set(s.filePath, s); });

  let metadata: { items?: ExternalMetaItem[] } | null = null;
  const files: { name: string; handle: FileSystemFileHandle }[] = [];
  const entriesIterable = handle as unknown as { entries: () => AsyncIterable<[string, FileSystemHandle]> };
  for await (const [name, entry] of entriesIterable.entries()) {
    if (entry.kind === "file") {
      if (name.toLowerCase() === "metadata.json") {
        const file = await (entry as FileSystemFileHandle).getFile();
        try { metadata = JSON.parse(await file.text()); } catch { metadata = null; }
      } else if (isSupportedCodeFile(name)) {
        files.push({ name, handle: entry as FileSystemFileHandle });
      }
    }
  }

  const metaByFilename = new Map<string, ExternalMetaItem>();
  if (metadata?.items && Array.isArray(metadata.items)) {
    for (const item of metadata.items) {
      const filename = item.filename || item.name;
      if (filename) metaByFilename.set(filename, item);
    }
  }

  const lastSyncMs = lastSyncAt ? Date.parse(lastSyncAt) : 0;
  const changed: ScriptItem[] = [];
  const onDiskFilenames = new Set<string>();

  for (const f of files) {
    const file = await f.handle.getFile();
    const isText = file.type.startsWith("text/") || file.type === "";
    if (!isText) { continue; }
    onDiskFilenames.add(f.name);
    const mtimeMs = file.lastModified;
    if (mtimeMs <= lastSyncMs) {
      continue;
    }
    const content = await file.text();
    if (isProbablyBinary(content)) { continue; }
    const contentHash = await hashTextContent(content);
    const diskModifiedAt = new Date(mtimeMs).toISOString();
    const prev = byPathExisting.get(f.name);
    const meta = metaByFilename.get(f.name);
    const language = (meta?.language as LanguageKey) || languageFromFilename(f.name);
    const name = meta?.name || f.name.replace(/\.[^.]+$/, "");
    const description = meta?.description || "";
    const id = meta?.id || prev?.id || uid();
    const createdAt = meta?.createdAt || prev?.createdAt || nowIso();
    const updatedAt = meta?.updatedAt || nowIso();

    // If previous hash exists and matches new one, skip (no real change)
    if (prev?.contentHash && prev.contentHash === contentHash) {
      continue;
    }

    changed.push({
      id,
      name,
      description,
      language,
      content,
      createdAt,
      updatedAt,
      filePath: f.name,
      contentHash,
      diskModifiedAt,
    });
  }

  return { changed, onDiskFilenames };
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
    // After writing, fetch File to record mtime/hash
    const writtenFile = await fileHandle.getFile();
    const lastModifiedMs = (writtenFile)?.lastModified ?? Date.now();
    const diskModifiedAt = new Date(lastModifiedMs).toISOString();
    const contentHash = await hashTextContent(s.content);
    if (isRename && dir.removeEntry) {
      try { await dir.removeEntry(s.filePath as string); } catch { /* ignore */ }
    }
    updated.push({ ...s, filePath: desiredName, diskModifiedAt, contentHash });
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
    const writtenFile = await fileHandle.getFile();
    const lastModifiedMs = (writtenFile)?.lastModified ?? Date.now();
    const diskModifiedAt = new Date(lastModifiedMs).toISOString();
    const contentHash = await hashTextContent(s.content);
    updated.push({ ...s, filePath: name, diskModifiedAt, contentHash });
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
    contentHash: s.contentHash,
    diskModifiedAt: s.diskModifiedAt,
  }));
  const safeSettings = settings
    ? {
        preferredProvider: (settings).preferredProvider,
        lastSyncAt: (settings).lastSyncAt ?? null,
      }
    : undefined;
  const metadata = {
    exportedAt: nowIso(),
    count: scripts.length,
    languages: Array.from(new Set(scripts.map(s => s.language))),
    items: metaItems,
    app: { name: "Script Vault", version: 1 },
    // Do not write API keys to disk
    settings: safeSettings,
  };
  const metaHandle = await dir.getFileHandle("metadata.json", { create: true });
  const metaWritable = await metaHandle.createWritable();
  await metaWritable.write(new Blob([JSON.stringify(metadata, null, 2)], { type: "application/json" }));
  await metaWritable.close();
}


