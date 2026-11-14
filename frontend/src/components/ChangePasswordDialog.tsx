import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import PasswordInput from "@/components/PasswordInput";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ProfileFields";
import { apiPost } from "@/lib/api";
import { errMsg } from "@/lib/format";
import type { ChangePasswordIn } from "@/lib/types";

const EMPTY = { current: "", next: "", confirm: "" };

export default function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const save = useMutation({
    mutationFn: (b: ChangePasswordIn) => apiPost<{ ok: boolean }>("/auth/change-password", b),
    onSuccess: () => {
      toast.success("Password aggiornata");
      setForm(EMPTY);
      setOpen(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} data-testid="change-password-open-button">
        <KeyRound className="size-4" />
        <span className="hidden sm:inline">Password</span>
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setForm(EMPTY);
        }}
      >
        <DialogContent className="sm:max-w-md" data-testid="change-password-dialog">
          <DialogHeader>
            <DialogTitle>Cambia la tua password</DialogTitle>
            <DialogDescription>Inserisci la password attuale e scegline una nuova (almeno 6 caratteri).</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (form.next !== form.confirm) return toast.error("Le due nuove password non coincidono");
              save.mutate({ current_password: form.current, new_password: form.next });
            }}
          >
            <Field label="Password attuale" htmlFor="cp-current">
              <PasswordInput id="cp-current" required autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} data-testid="change-password-current-input" />
            </Field>
            <Field label="Nuova password" htmlFor="cp-new">
              <PasswordInput id="cp-new" required minLength={6} autoComplete="new-password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} data-testid="change-password-new-input" />
            </Field>
            <Field label="Ripeti la nuova password" htmlFor="cp-confirm">
              <PasswordInput id="cp-confirm" required minLength={6} autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} data-testid="change-password-confirm-input" />
            </Field>
            <Button type="submit" className="w-full" disabled={save.isPending} data-testid="change-password-submit-button">
              {save.isPending && <Loader2 className="size-4 animate-spin" />} Aggiorna password
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
