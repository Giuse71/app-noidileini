import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<typeof Input>, "type"> & { "data-testid": string; strength?: boolean };

const LEVELS = [
  { label: "Troppo corta", color: "bg-destructive", text: "text-destructive" },
  { label: "Debole", color: "bg-destructive", text: "text-destructive" },
  { label: "Discreta", color: "bg-amber-500", text: "text-amber-600" },
  { label: "Buona", color: "bg-lime-500", text: "text-lime-700" },
  { label: "Forte", color: "bg-emerald-600", text: "text-emerald-700" },
];

export function passwordScore(pw: string): number {
  if (pw.length < 6) return 0;
  let s = 1;
  if (pw.length >= 10) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  else if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s += pw.length >= 8 ? 0.5 : 0;
  return Math.min(4, Math.floor(s));
}

/** Password field with a show/hide eye; `strength` adds a live strength bar for new passwords. */
export default function PasswordInput({ className, "data-testid": testId, strength, ...props }: Props) {
  const [show, setShow] = useState(false);
  const value = String(props.value ?? "");
  const score = passwordScore(value);
  const level = LEVELS[score];
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input {...props} type={show ? "text" : "password"} className={cn("pr-11", className)} data-testid={testId}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Nascondi password" : "Mostra password"}
          aria-pressed={show}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid={`${testId}-toggle`}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {strength && value && (
        <div className="space-y-1" aria-live="polite" data-testid={`${testId}-strength`} data-score={score}>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={cn("h-1.5 flex-1 rounded-full bg-muted transition-colors duration-200", i <= score && level.color)} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            <span className={cn("font-semibold", level.text)} data-testid={`${testId}-strength-label`}>{level.label}</span>
            {score < 4 && " · usa almeno 10 caratteri con maiuscole, numeri e un simbolo"}
          </p>
        </div>
      )}
    </div>
  );
}
