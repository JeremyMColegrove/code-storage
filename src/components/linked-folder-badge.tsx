import { HardDrive } from "lucide-react";

export function LinkedFolderBadge({ name }: { name: string }) {
  return (
    <div className="text-xs text-muted-foreground flex items-center gap-2 px-2 py-1 rounded border">
      <HardDrive className="h-3 w-3" /> Linked: {name}
    </div>
  );
}


