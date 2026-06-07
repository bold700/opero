import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  className,
  label,
}: {
  className?: string;
  label: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 p-4 text-center text-sm text-zinc-500",
        className,
      )}
    >
      <Inbox className="size-5 text-zinc-400" />
      <span>{label}</span>
    </div>
  );
}
