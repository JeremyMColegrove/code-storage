import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { VaultSettings } from "@/lib/vault";
import { Loader2, ZapIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Textarea } from "./ui/textarea";

type Provider = "gemini" | "openai" | "claude";

type GenerateWithAIDialogProps = {
  currentProvider?: Provider;
  currentGeminiKey?: string | null;
  currentOpenAIKey?: string | null;
  currentClaudeKey?: string | null;
  currentLanguage?: string | null;
  currentScriptText?: string;
  onResponse: (script: string) => void;
  onSaveSettings?: (partial: Partial<VaultSettings>) => void;
  trigger?: React.ReactNode;
};

export default function GenerateWithAIDialog({ currentProvider, currentGeminiKey, currentOpenAIKey, currentClaudeKey, currentLanguage, currentScriptText, onResponse, onSaveSettings, trigger }: GenerateWithAIDialogProps) {
  const [generating, startTransition] = useTransition();
  const [open, setOpen] = useState<boolean>(false);
  const [request, setRequest] = useState<string>("");
  const [includeCurrentScript, setIncludeCurrentScript] = useState<boolean>(true);
  const [provider, setProvider] = useState<Provider>(currentProvider ?? "gemini");
  const [geminiKey, setGeminiKey] = useState<string>(currentGeminiKey ?? "");
  const [openaiKey, setOpenaiKey] = useState<string>(currentOpenAIKey ?? "");
  const [claudeKey, setClaudeKey] = useState<string>(currentClaudeKey ?? "");

  const generateCode = () => {
    const selectedKey = provider === "gemini" ? geminiKey : provider === "openai" ? openaiKey : claudeKey;
    if (!selectedKey) {
      const label = provider === "gemini" ? "Gemini" : provider === "openai" ? "OpenAI" : "Claude";
      toast.error(`Please provide a valid ${label} API key`);
      return;
    }
    if (!request.trim()) {
      toast.error("Please enter a brief description of what to generate");
      return;
    }
    startTransition(async () => {
      try {
        const prompt = includeCurrentScript && currentScriptText
          ? `You are an expert code assistant. Based on the user's request, produce a single complete script in ${currentLanguage}. \nGenerate only the code in plain text with no markdown fences or extra formatting.
Do not include \`\`\`, \`\`\`java, or any explanatory text.\n\nUser request:\n${request}\n\nCurrent script (for context):\n${currentScriptText}`
          : `You are an expert code assistant. Based on the user's request, produce a single complete script in ${currentLanguage}. \nGenerate only the code in plain text with no markdown fences or extra formatting.
Do not include \`\`\`, \`\`\`java, or any explanatory text.\n\nUser request:\n${request}`;

        let textOut = "";
        if (provider === "gemini") {
          const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-goog-api-key": selectedKey,
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: prompt }],
                },
              ],
            }),
          });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `Gemini request failed with ${res.status}`);
          }
          const data: {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string }> };
            }>;
          } = await res.json();
          const candidate = data?.candidates?.[0];
          const parts: Array<{ text?: string }> = candidate?.content?.parts || [];
          textOut = parts.map((p) => p.text ?? "").filter(Boolean).join("\n").trim();
        } else if (provider === "openai") {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${selectedKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: "You are an expert code assistant. Return only the final code as plain text with no markdown fences or explanations." },
                { role: "user", content: prompt },
              ],
              temperature: 0.2,
            }),
          });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `OpenAI request failed with ${res.status}`);
          }
          const data: { choices?: Array<{ message?: { content?: string } }> } = await res.json();
          textOut = (data.choices?.[0]?.message?.content || "").trim();
        } else {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": selectedKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-3-5-sonnet-latest",
              system: "You are an expert code assistant. Return only the final code as plain text with no markdown fences or explanations.",
              max_tokens: 4096,
              messages: [
                { role: "user", content: prompt },
              ],
            }),
          });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `Claude request failed with ${res.status}`);
          }
          const data: { content?: Array<{ type?: string; text?: string }> } = await res.json();
          const blocks = data.content || [];
          textOut = blocks.map((b) => (b.type === "text" ? (b.text || "") : "")).join("\n").trim();
        }
        if (!textOut) throw new Error("No response text received");

        // Persist selected provider/key
        if (onSaveSettings) {
          const partial: Partial<VaultSettings> = { preferredProvider: provider };
          if (provider === "gemini") partial.geminiApiKey = selectedKey;
          if (provider === "openai") partial.openaiApiKey = selectedKey;
          if (provider === "claude") partial.claudeApiKey = selectedKey;
          onSaveSettings(partial);
        }
        onResponse(textOut);
        setOpen(false);
        toast.success("Script generated");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error("Generation failed", { description: message.slice(0, 500) });
      }
    });
  };

  return (
    <Dialog onOpenChange={v=>!generating && setOpen(v)} open={open}>
      <Tooltip>
        <TooltipTrigger asChild>
          {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
        </TooltipTrigger>
        <TooltipContent>Generate with AI</TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate script with AI</DialogTitle>
          <DialogDescription>
            Provide a short description of what you want. Optionally include the current script as context. Select a provider and enter the corresponding API key.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={(v: Provider) => setProvider(v)}>
              <SelectTrigger className="w-[240px]"><SelectValue placeholder="Select provider"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="claude">Claude</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            {provider === "gemini" && (
              <>
                <Label htmlFor="gemini-key">Gemini API Key</Label>
                <Input id="gemini-key" type="password" placeholder="GEMINI_API_KEY" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} />
              </>
            )}
            {provider === "openai" && (
              <>
                <Label htmlFor="openai-key">OpenAI API Key</Label>
                <Input id="openai-key" type="password" placeholder="OPENAI_API_KEY" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} />
              </>
            )}
            {provider === "claude" && (
              <>
                <Label htmlFor="claude-key">Claude API Key</Label>
                <Input id="claude-key" type="password" placeholder="ANTHROPIC_API_KEY" value={claudeKey} onChange={(e) => setClaudeKey(e.target.value)} />
              </>
            )}
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ai-request">Request</Label>
          <Textarea autoFocus id="ai-request" placeholder="e.g., " value={request} onChange={(e) => setRequest(e.target.value)} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input id="include-current" type="checkbox" className="h-4 w-4" checked={includeCurrentScript} onChange={(e) => setIncludeCurrentScript(e.target.checked)} />
          <Label htmlFor="include-current">Include current script as context</Label>
        </div>
        <DialogFooter>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={generateCode} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ZapIcon className="h-4 w-4" />} 
                {generating ? "Generating..." : "Generate"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Generate code using {provider === "gemini" ? "Gemini" : provider === "openai" ? "OpenAI" : "Claude"}</TooltipContent>
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

}