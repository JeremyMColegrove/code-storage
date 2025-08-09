import type { VaultState } from "./vault";

export const STORAGE_KEY = "scriptVault.v1" as const;

export function loadState(): VaultState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { scripts: [], selectedId: null, settings: { preferredProvider: "gemini", geminiApiKey: null, openaiApiKey: null, claudeApiKey: null } };
    const parsed: VaultState = JSON.parse(raw);
    if (!parsed.settings) parsed.settings = { preferredProvider: "gemini", geminiApiKey: null, openaiApiKey: null, claudeApiKey: null }
    // Backfill any missing new fields for forward-compat
    parsed.settings.preferredProvider = parsed.settings.preferredProvider ?? "gemini";
    parsed.settings.geminiApiKey = parsed.settings.geminiApiKey ?? null;
    parsed.settings.openaiApiKey = parsed.settings.openaiApiKey ?? null;
    parsed.settings.claudeApiKey = parsed.settings.claudeApiKey ?? null;
    return parsed;
  } catch {
    return { scripts: [], selectedId: null, settings: { preferredProvider: "gemini", geminiApiKey: null, openaiApiKey: null, claudeApiKey: null } };
  }
}

export function saveState(state: VaultState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}


