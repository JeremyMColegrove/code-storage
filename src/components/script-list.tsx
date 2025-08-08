import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LANGUAGE_MAP, type ScriptItem } from "@/lib/vault";
import { Trash2 } from "lucide-react";

type Props = {
  scripts: ScriptItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
};

export function ScriptList({ scripts, selectedId, onSelect, onDelete }: Props) {
  return (
    <div className="space-y-1">
      {scripts.map((s) => {
        const isActive = s.id === selectedId;
        return (
          <div key={s.id} className={`group rounded-xl border flex items-center justify-between p-2 ${isActive ? "bg-sidebar-accent/40 border-sidebar-accent" : " hover:bg-sidebar-accent/60  "}`}>
            <button className="flex-1 text-left" onClick={() => onSelect(s.id)}>
              <div className="font-medium line-clamp-1">{s.name || "Untitled"}</div>
              <div className="text-xs text-muted-foreground line-clamp-1">{s.description || "No description"}</div>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{LANGUAGE_MAP[s.language].label}</Badge>
                <span className="text-[10px] text-muted-foreground">{new Date(s.updatedAt).toLocaleString()}</span>
              </div>
            </button>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={() => onDelete(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>
          </div>
        );
      })}
    </div>
  );
}


