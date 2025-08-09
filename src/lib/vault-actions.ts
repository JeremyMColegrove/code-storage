import { toast } from "sonner";
import { importFromFolder as fsImportFromFolder, writeAllToDisk as fsWriteAllToDisk, writeScriptsToDisk as fsWriteScriptsToDisk, importChangesSince, mergeScripts, type DirectoryScanResult } from "./fs-sync";
import { HANDLE_KEY, idbSet } from "./idb";
import { saveState } from "./storage";
import { filenameFor, nowIso, type ScriptItem, type VaultState } from "./vault";

export async function openFolderAndImport(setDirectory: (h: FileSystemDirectoryHandle) => void, setFolderName: (n: string) => void, setState: (s: VaultState) => void) {
  const directoryPicker = (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> });
  const handle = await directoryPicker.showDirectoryPicker();
  type DirectoryWithPermission = FileSystemDirectoryHandle & { requestPermission?: (options?: { mode?: "read" | "readwrite" }) => Promise<PermissionState> };
  const withPerm = handle as DirectoryWithPermission;
  const perm = withPerm.requestPermission ? await withPerm.requestPermission({ mode: "readwrite" }) : ("granted" as PermissionState);
  if (perm && perm !== "granted") {
    toast.error("Permission to access folder was denied");
    return;
  }
  setDirectory(handle);
  setFolderName(handle.name);
  // Persist handle so it can be restored on refresh
  try { await idbSet(HANDLE_KEY, handle); } catch { /* ignore */ }
  const imported = await fsImportFromFolder(handle);
  const newState: VaultState = {
    scripts: imported,
    selectedId: imported[0]?.id || null,
    settings: {
      preferredProvider: "gemini",
      geminiApiKey: null,
      openaiApiKey: null,
      claudeApiKey: null,
      lastSyncAt: nowIso(),
    },
  };
  setState(newState);
  saveState(newState);
  toast.success("Folder linked and imported");
}

export async function syncFromFolder(handle: FileSystemDirectoryHandle, state: VaultState, setState: (s: VaultState) => void) {
  // Only read files changed since last sync
  const { changed: changedOrNew, onDiskFilenames }: DirectoryScanResult = await importChangesSince(handle, state.scripts, state.settings?.lastSyncAt ?? null);

  // If nothing changed (and no deletions), just bump lastSyncAt
  const hasDeletions = !!onDiskFilenames && state.scripts.some(s => s.filePath && !onDiskFilenames.has(s.filePath));
  if (changedOrNew.length === 0 && !hasDeletions) {
    const next: VaultState = { ...state, settings: { ...state.settings, lastSyncAt: nowIso() } } as VaultState;
    setState(next);
    saveState(next);
    toast.message("No changes detected");
    return;
  }

  // Remove anything not present on disk (including local-only items without a filePath)
  let base = state.scripts;
  if (onDiskFilenames) {
    base = base.filter((s) => s.filePath && onDiskFilenames.has(s.filePath));
  }

  const merged = mergeScripts(base, changedOrNew);
  const selectedId = state.selectedId ?? (merged[0]?.id || null);
  const next: VaultState = { scripts: merged, selectedId, settings: { ...state.settings, lastSyncAt: nowIso() } } as VaultState;
  setState(next);
  saveState(next);
  toast.message(`Synced ${changedOrNew.length} file(s)`);
}

export async function copyCurrentToClipboard(current: ScriptItem | null) {
  if (!current) return;
  await navigator.clipboard.writeText(current.content);
  toast.success("Copied to clipboard");
}

export async function saveAllToDiskOrLocal(state: VaultState, directoryHandle: FileSystemDirectoryHandle | null, setState: (s: VaultState) => void) {
  if (directoryHandle) {
    try {
      const updated = await fsWriteAllToDisk(directoryHandle, state.scripts, state.settings);
      if (updated) {
        const next = { ...state, scripts: updated, settings: { ...state.settings, lastSyncAt: nowIso() } } as VaultState;
        setState(next);
        saveState(next);
      } else {
        saveState({ ...state, settings: { ...state.settings, lastSyncAt: nowIso() } } as VaultState);
      }
      toast.success("Saved to disk");
    } catch {
      saveState(state);
      toast.error("Failed saving to disk; changes kept locally");
    }
  } else {
    saveState(state);
    toast.success("Saved");
  }
}

export async function deleteScriptEverywhere(id: string, state: VaultState, directoryHandle: FileSystemDirectoryHandle | null, setState: (s: VaultState) => void) {
  const src = state.scripts.find((s: ScriptItem) => s.id === id);
  if (!src) return;
  const confirmDelete = window.confirm(
    `Delete "${src.name || "Untitled"}"?\n\n` +
    (directoryHandle ? "This will also delete the file from the linked folder." : "This will remove it from the app.")
  );
  if (!confirmDelete) return;

  const remaining = state.scripts.filter((s: ScriptItem) => s.id !== id);

  if (directoryHandle) {
    try {
      type DirWithApi = FileSystemDirectoryHandle & { removeEntry?: (name: string, options?: { recursive?: boolean }) => Promise<void> };
      const dir = directoryHandle as DirWithApi;
      const filename = src.filePath || filenameFor(src);
      if (dir.removeEntry) {
        await dir.removeEntry(filename);
      }
    } catch {
      // ignore
    }
    try {
      const updated = await fsWriteScriptsToDisk(directoryHandle, remaining, state.settings);
      const next: VaultState = { scripts: updated, selectedId: updated[0]?.id || null, settings: state.settings };
      setState(next);
      saveState(next);
      toast.success("Deleted from disk");
      return;
    } catch {
      // fall back
    }
  }

  const next: VaultState = { scripts: remaining, selectedId: remaining[0]?.id || null, settings: state.settings };
  setState(next);
  saveState(next);
  toast.message("Script deleted");
}

export function updateCurrentScript(current: ScriptItem | null, patch: Partial<ScriptItem>, setState: (updater: (prev: VaultState) => VaultState) => void) {
  if (!current) return;
  setState(prev => ({
    ...prev,
    scripts: prev.scripts.map((s: ScriptItem) => s.id === current.id ? { ...s, ...patch, updatedAt: nowIso() } : s)
  }));
}


