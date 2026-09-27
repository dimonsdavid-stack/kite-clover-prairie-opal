import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "idle",
  children,
}: {
  className?: string;
  tone?: "ok" | "warn" | "bad" | "idle";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-sm px-2 text-[10px] font-medium uppercase tracking-[0.12em]",
        tone === "ok" && "bg-signal/15 text-signal",
        tone === "warn" && "bg-warn/15 text-warn",
        tone === "bad" && "bg-destructive/15 text-destructive",
        tone === "idle" && "bg-secondary text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
