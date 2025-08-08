export type LanguageMap = typeof LANGUAGE_MAP;

export const LANGUAGE_MAP = {
  javascript: { label: "JavaScript", monaco: "javascript", ext: ".js" },
  typescript: { label: "TypeScript", monaco: "typescript", ext: ".ts" },
  python: { label: "Python", monaco: "python", ext: ".py" },
  bash: { label: "Bash", monaco: "shell", ext: ".sh" },
  json: { label: "JSON", monaco: "json", ext: ".json" },
  sql: { label: "SQL", monaco: "sql", ext: ".sql" },
  go: { label: "Go", monaco: "go", ext: ".go" },
  java: { label: "Java", monaco: "java", ext: ".java" },
  csharp: { label: "C#", monaco: "csharp", ext: ".cs" },
  cpp: { label: "C++", monaco: "cpp", ext: ".cpp" },
  html: { label: "HTML", monaco: "html", ext: ".html" },
  css: { label: "CSS", monaco: "css", ext: ".css" },
  yaml: { label: "YAML", monaco: "yaml", ext: ".yml" },
  markdown: { label: "Markdown", monaco: "markdown", ext: ".md" },
  ruby: { label: "Ruby", monaco: "ruby", ext: ".rb" },
  rust: { label: "Rust", monaco: "rust", ext: ".rs" },
  php: { label: "PHP", monaco: "php", ext: ".php" },
} as const;

export type LanguageKey = keyof typeof LANGUAGE_MAP;

export type ScriptItem = {
  id: string;
  name: string;
  description: string;
  language: LanguageKey;
  content: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  filePath?: string; // Relative filename inside selected folder (if linked)
};

export type VaultSettings = {
  geminiApiKey?: string | null;
};

export type VaultState = {
  scripts: ScriptItem[];
  selectedId: string | null;
  settings: VaultSettings;
};

export function nowIso(): string { return new Date().toISOString(); }

export function uid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export function filenameFor(item: ScriptItem): string {
  const safe = item.name.trim().replace(/[^a-z0-9\-_. ]/gi, "_").replace(/\s+/g, "-");
  return `${safe || "script"}${LANGUAGE_MAP[item.language].ext}`;
}

export function createBlankScript(existing?: ScriptItem[]): ScriptItem {
  const id = uid();
  const baseName = "Untitled Script";
  const language: LanguageKey = "javascript";

  let candidateName = baseName;
  if (existing && existing.length > 0) {
    const usedFilenames = new Set(existing.map((s) => filenameFor(s)));
    let index = 1;
    while (usedFilenames.has(
      filenameFor({
        id: "temp",
        name: candidateName,
        description: "",
        language,
        content: "",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })
    )) {
      index += 1;
      candidateName = `${baseName} ${index}`;
    }
  }

  return {
    id,
    name: candidateName,
    description: "",
    language,
    content: "// Start typing...\n",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}


