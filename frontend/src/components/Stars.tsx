import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Stars({
  value,
  onChange,
  size = "size-4",
  testid,
}: {
  value: number;
  onChange?: (stars: number) => void;
  size?: string;
  testid?: string;
}) {
  return (
    <span className="inline-flex items-center gap-0.5" data-testid={testid} aria-label={`${value} stelle su 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n - 0.25;
        const icon = <Star className={cn(size, filled ? "fill-gold text-gold" : "text-slate-300")} />;
        return onChange ? (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="rounded transition-transform duration-150 hover:scale-125"
            aria-label={`${n} stelle`}
            data-testid={testid ? `${testid}-${n}` : undefined}
          >
            {icon}
          </button>
        ) : (
          <span key={n}>{icon}</span>
        );
      })}
    </span>
  );
}
