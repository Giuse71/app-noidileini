import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StatCard({
  label,
  value,
  icon: Icon,
  accent = false,
  testid,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: boolean;
  testid: string;
}) {
  return (
    <div
      className={cn(
        "animate-fade-up rounded-xl border bg-card p-4",
        accent && "border-gold/40 bg-gold-soft",
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className={cn("size-4", accent ? "text-gold-ink" : "text-primary")} />
        {label}
      </div>
      <p data-testid={testid} className="tnum mt-2 text-2xl font-semibold tracking-tight">
        {value}
      </p>
    </div>
  );
}
