import { LinkedFolderBadge } from "@/components/linked-folder-badge";
import ThemeToggle from "@/components/mode-toggle";
import { ScriptList } from "@/components/script-list";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sidebar, SidebarContent, SidebarHeader } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { importFromFolder as fsImportFromFolder, mergeScripts } from "@/lib/fs-sync";
import { HANDLE_KEY, idbGet } from "@/lib/idb";
import { loadState, saveState } from "@/lib/storage";
import { createBlankScript, filenameFor, LANGUAGE_MAP, nowIso, type LanguageKey, type ScriptItem, type VaultState } from "@/lib/vault";
import { copyCurrentToClipboard, deleteScriptEverywhere, openFolderAndImport, saveAllToDiskOrLocal } from "@/lib/vault-actions";
import Editor from "@monaco-editor/react";
import { Copy, FileType2, FolderOpen, HardDrive, Maximize2, Minimize2, Plus, RefreshCcw, Save, Search, ZapIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";
import GenerateWithAIDialog from "./components/GenerateWithAIDialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "./components/ui/alert-dialog";

// ------------------ Main Component ------------------
export default function ScriptVault() {
  const [state, setState] = useState<VaultState>(() => loadState());
  const [query, setQuery] = useState("");
  const { theme } = useTheme();


  

  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isEditorFull, setIsEditorFull] = useState<boolean>(false);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [linkedFolderName, setLinkedFolderName] = useState<string | null>(null);
  // settings dialog is self-contained; no local state required here
  const current = useMemo(() => state.scripts.find((s: ScriptItem) => s.id === state.selectedId) || null, [state]);

  const isDark = (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) || theme == "dark"
  
  // Ensure at least one script exists
  useEffect(() => {
    if (state.scripts.length === 0) {
      const first = createBlankScript([]);
      setState({ scripts: [first], selectedId: first.id, settings: state.settings });
    } else if (!state.selectedId) {
      setState((prev: VaultState) => ({ ...prev, selectedId: prev.scripts[0]?.id || null }));
    }
  }, [state.scripts.length, state.selectedId, state.settings]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return state.scripts.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.content.toLowerCase().includes(q)
    );
  }, [state.scripts, query]);

  // ------------------ Actions ------------------
  function addScript() {
    setState((prev: VaultState) => {
      const item = createBlankScript(prev.scripts);
      return { scripts: [item, ...prev.scripts], selectedId: item.id, settings: prev.settings };
    });
    setIsDirty(true);
    toast.success("New script created");
  }

  async function deleteScript(id: string) {
    await deleteScriptEverywhere(id, state, directoryHandle, (next) => setState(next));
    setIsDirty(directoryHandle ? false : true);
  }

  function updateCurrent(patch: Partial<ScriptItem>) {
    if (!current) return;
    setState((prev: VaultState) => ({
      ...prev,
      scripts: prev.scripts.map((s: ScriptItem) => s.id === current.id ? { ...s, ...patch, updatedAt: nowIso() } : s)
    }));
    setIsDirty(true);
  }

  // On mount, try to restore previously granted directory handle
  useEffect(() => {
    (async () => {
      try {
        const stored = await idbGet<FileSystemDirectoryHandle>(HANDLE_KEY);
        if (!stored) return;
        type WithPerm = FileSystemDirectoryHandle & { queryPermission?: (opts?: { mode?: "read" | "readwrite" }) => Promise<PermissionState> };
        const withPerm = stored as WithPerm;
        const perm = await withPerm.queryPermission?.({ mode: "readwrite" });
        if ((perm ?? "granted") === "granted") {
          setDirectoryHandle(stored);
          setLinkedFolderName(stored.name);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  async function openFolder() {
    try {
      await openFolderAndImport((h) => setDirectoryHandle(h), (n) => setLinkedFolderName(n), (next) => setState(next));
      setIsDirty(false);
    } catch {
      // ignore
    }
  }

  async function importFromFolder(handle: FileSystemDirectoryHandle, opts: { replace: boolean }) {
    const imported = await fsImportFromFolder(handle);
    const merged = opts.replace ? imported : mergeScripts(state.scripts, imported);
    setState({ scripts: merged, selectedId: merged[0]?.id || null, settings: state.settings });
    setIsDirty(false);
    saveState({ scripts: merged, selectedId: merged[0]?.id || null, settings: state.settings });
  }

  // mergeScripts imported from fs-sync

  async function syncFromLinkedFolder() {
    if (!directoryHandle) return;
    await importFromFolder(directoryHandle, { replace: true });
    toast.message("Synced from folder");
  }

  // write helpers moved to vault-actions

  async function copyCurrent() { await copyCurrentToClipboard(current); }

  const saveAll = useCallback(async () => {
    await saveAllToDiskOrLocal(state, directoryHandle, (next) => setState(next));
    setIsDirty(false);
  }, [state, directoryHandle]);

  // Duplicate filename detection (same name + extension)
  const hasNameConflict = useMemo(() => {
    if (!current) return false;
    const currentFilename = filenameFor(current);
    return state.scripts.some((s) => s.id !== current.id && filenameFor(s) === currentFilename);
  }, [state.scripts, current]);

  // Warn before leaving the page if there are unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Support Cmd/Ctrl+S to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMeta = navigator.platform.toLowerCase().includes("mac") ? e.metaKey : e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (isDirty && !hasNameConflict) {
          saveAll();
        } else if (hasNameConflict) {
          toast.error("Cannot save: duplicate name and extension.");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDirty, hasNameConflict, saveAll]);

  // Exit full screen on Escape
  useEffect(() => {
    if (!isEditorFull) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsEditorFull(false);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [isEditorFull]);

  // ------------------ UI ------------------
  return (
    <TooltipProvider>
      <Toaster richColors/>
      <div className="h-screen w-full flex gap-4 p-4 bg-background">

          <AlertDialog open={!directoryHandle}>
            <AlertDialogContent>
              <AlertDialogTitle>Folder required</AlertDialogTitle>
              <AlertDialogDescription>To use Script Vault, you must link a folder on your computer. This keeps your scripts safely stored on disk. Click the button below to choose a folder.</AlertDialogDescription>
              <div className="mt-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={openFolder} className="gap-2">
                        <FolderOpen className="h-4 w-4" /> Link a Folder
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Choose a folder to store your scripts</TooltipContent>
                  </Tooltip>
                </div>
            </AlertDialogContent>
          </AlertDialog>

        {/* Sidebar */}
        <Sidebar collapsible="offcanvas">
          <SidebarHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileType2 className="h-4 w-4" /> Script Vault {isDirty && <span className="text-xs text-muted-foreground">• Unsaved</span>}
              </div>
              <div className="flex items-center gap-2">

                <ThemeToggle />
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent className="px-2">
            <div className="flex gap-2">
              <Input
                placeholder="Search scripts..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              
            </div>

            <div className="flex justify-between items-center gap-2 mt-2">
              <div className="flex items-center flex-wrap gap-2">
                {directoryHandle && linkedFolderName && (
                  <LinkedFolderBadge name={linkedFolderName} />
                )}
                {/* <Button variant="secondary" className="gap-2" onClick={exportAll}>
                  <FolderArchive className="h-4 w-4" /> Export All
                </Button> */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" className="flex-1 gap-2" onClick={openFolder}>
                      <FolderOpen className="h-4 w-4" /> Open Folder
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open or change the linked folder</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" className="gap-2 flex-1" onClick={syncFromLinkedFolder} disabled={!directoryHandle}>
                      <RefreshCcw className="h-4 w-4" /> Sync
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Sync scripts from the linked folder</TooltipContent>
                </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button className="w-full" onClick={addScript}><Plus className="h-4 w-4" /> New Script</Button>
                </TooltipTrigger>
                <TooltipContent>New script</TooltipContent>
              </Tooltip>
              </div>
            </div>

            <Separator className="my-3" />
            <ScrollArea className="h-[calc(100vh-200px)] pr-2">
              {filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2"><Search className="h-4 w-4"/>No matches</div>
              ) : (
                <ScriptList
                  scripts={filtered}
                  selectedId={state.selectedId}
                  onSelect={(id) => setState((prev: VaultState) => ({ ...prev, selectedId: id }))}
                  onDelete={deleteScript}
                />
              )}
            </ScrollArea>
          </SidebarContent>
        </Sidebar>

        {/* Editor Panel */}
        <div className="w-full space-y-4">
          <div className="flex flex-row">
              <div className="grid gap-1">
                <Label htmlFor="script-name">Name</Label>
                <Input
                  id="script-name"
                  value={current?.name ?? ""}
                  onChange={(e) => updateCurrent({ name: e.target.value })}
                  placeholder="My Awesome Script"
                  className={`min-w-[240px] ${hasNameConflict ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {hasNameConflict && (
                  <div className="text-xs text-destructive">A script with this name and extension already exists.</div>
                )}
              </div>

              
          </div>
          <div className="flex-1 grid gap-1">
            <Label htmlFor="script-desc">Description</Label>
            <Textarea
              id="script-desc"
              placeholder="What does this script do?"
              value={current?.description ?? ""}
              onChange={(e) => updateCurrent({ description: e.target.value })}
              rows={2}
            />
          </div>
          <div className="flex flex-row items-end gap-2 my-4">
            <div className="grid gap-1">
                <Label>Language</Label>
                <Select value={current?.language} onValueChange={(v: LanguageKey) => updateCurrent({ language: v })}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select language"/></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(LANGUAGE_MAP) as LanguageKey[]).map((key) => (
                      <SelectItem key={key} value={key}>{LANGUAGE_MAP[key].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>


                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button className="gap-2" onClick={saveAll} disabled={!isDirty || hasNameConflict}>
                      {directoryHandle ? <HardDrive className="h-4 w-4"/> : <Save className="h-4 w-4"/>}
                      Save
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {hasNameConflict ? "Resolve duplicate name before saving" : (directoryHandle ? "Save to disk" : "Save changes")}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" className="gap-2" onClick={copyCurrent}>
                      <Copy className="h-4 w-4"/> Copy
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy script to clipboard</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" className="gap-2" onClick={() => setIsEditorFull(true)}>
                      <Maximize2 className="h-4 w-4" /> Full screen
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Expand editor</TooltipContent>
                </Tooltip>


                <GenerateWithAIDialog 
                  currentKey={state.settings?.geminiApiKey}
                  onResponse={(text)=>{
                    // set the current script to this output if successfull
                    updateCurrent({ content: text ?? "" })
                  }}
                  currentScriptText={current?.content ?? ""}
                  currentLanguage={current?.language ?? "python"}
                  trigger={<Button variant="outline"><ZapIcon/>Generate with AI</Button>}
                />
              
              
            </div>
              <Separator />

              <div className={isEditorFull ? "fixed inset-0 z-50 bg-background p-4 flex flex-col" : "h-[calc(100vh-280px)]"}>
                {isEditorFull && (
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-muted-foreground">Editing: {current?.name ?? "Untitled"}</div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsEditorFull(false)}>
                          <Minimize2 className="h-4 w-4" /> Exit full screen
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Return to normal view</TooltipContent>
                    </Tooltip>
                  </div>
                )}
                <div className={isEditorFull ? "flex-1 min-h-0" : "h-full"}>
                  <Editor
                    height="100%"
                    key={current?.id || "editor"}
                    value={current?.content ?? ""}
                    onChange={(v) => updateCurrent({ content: v ?? "" })}
                    defaultLanguage={current ? LANGUAGE_MAP[current.language].monaco : "javascript"}
                    language={current ? LANGUAGE_MAP[current.language].monaco : "javascript"}
                    theme={isDark ? "vs-dark" : "vs"}
                    options={{
                      fontSize: 14,
                      minimap: { enabled: false },
                      wordWrap: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                    }}
                  />
                </div>
              </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
