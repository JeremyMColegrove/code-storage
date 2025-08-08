import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, ZapIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Textarea } from "./ui/textarea";

type GenerateWithAIDialogProps = {
  currentKey?: string | null;
  currentLanguage?: string | null;
  currentScriptText?: string;
  onResponse: (script: string) => void;
  trigger?: React.ReactNode;
};

export default function GenerateWithAIDialog({ currentKey, currentLanguage, currentScriptText, onResponse, trigger }: GenerateWithAIDialogProps) {
  const [generating, startTransition] = useTransition();
  const [open, setOpen] = useState<boolean>(false);
  const [request, setRequest] = useState<string>("");
  const [includeCurrentScript, setIncludeCurrentScript] = useState<boolean>(true);
  const [apiKey, setApiKey] = useState<string>(currentKey ?? "");

  const generateCode = () => {
    if (!apiKey) {
      toast.error("Please provide a valid Gemini API key");
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

        const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": apiKey,
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
          throw new Error(text || `Request failed with ${res.status}`);
        }
        const data: {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        } = await res.json();
        // Parse Gemini response: candidates[0].content.parts[].text
        const candidate = data?.candidates?.[0];
        const parts: Array<{ text?: string }> = candidate?.content?.parts || [];
        const textOut = parts.map((p) => p.text ?? "").filter(Boolean).join("\n").trim();
        if (!textOut) throw new Error("No response text received from Gemini");

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
            Provide a short description of what you want. Optionally include the current script as context. Your Gemini API key is required to run the request.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="gemini-key">Gemini API Key</Label>
            <Input id="gemini-key" type="password" placeholder="GEMINI_API_KEY" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
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
              <Button onClick={generateCode} disabled={generating || !apiKey}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ZapIcon className="h-4 w-4" />} 
                {generating ? "Generating..." : "Generate"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Generate code using Gemini</TooltipContent>
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

}