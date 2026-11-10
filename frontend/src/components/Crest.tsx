import { cn } from "@/lib/utils";

export default function Crest({ logo, className, testid }: { logo?: string | null; className?: string; testid?: string }) {
  if (logo) {
    return (
      <img
        src={logo}
        alt="Logo associazione"
        data-testid={testid}
        className={cn("size-10 shrink-0 rounded-lg bg-white object-contain", className)}
      />
    );
  }
  return (
    <div
      data-testid={testid}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-gold",
        className,
      )}
    >
      LV
    </div>
  );
}
