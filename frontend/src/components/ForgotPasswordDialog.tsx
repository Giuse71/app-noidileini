import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ProfileFields";
import { apiPost } from "@/lib/api";
import { errMsg } from "@/lib/format";
import type { ForgotPasswordIn } from "@/lib/types";

export default function ForgotPasswordDialog({ initialEmail }: { initialEmail: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const send = useMutation({ mutationFn: (b: ForgotPasswordIn) => apiPost<{ ok: boolean }>("/auth/forgot-password", b) });

  function openDialog() {
    setEmail(initialEmail);
    send.reset();
    setOpen(true);
  }

  return (
    <>
      <button type="button" onClick={openDialog} className="mx-auto block text-sm font-medium text-primary hover:underline" data-testid="forgot-password-link">
        Password dimenticata?
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" data-testid="forgot-password-dialog">
          <DialogHeader>
            <DialogTitle>Recupera la password</DialogTitle>
            <DialogDescription>Ti inviamo via email un link per sceglierne una nuova (valido 60 minuti).</DialogDescription>
          </DialogHeader>
          {send.isSuccess ? (
            <div className="space-y-4" data-testid="forgot-password-sent">
              <p className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                <MailCheck className="mt-0.5 size-4 shrink-0" />
                Se <strong className="mx-1">{email}</strong> è registrata, a breve riceverai l'email con il link. Controlla anche lo spam.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setOpen(false)} data-testid="forgot-password-close">
                Chiudi
              </Button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation(); // React submit events bubble through the portal to the login form
                send.mutate({ email });
              }}
            >
              <Field label="Email di accesso" htmlFor="fp-email">
                <Input id="fp-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="forgot-password-email-input" />
              </Field>
              {send.isError && <p className="text-sm text-destructive">{errMsg(send.error)}</p>}
              <Button type="submit" className="w-full" disabled={send.isPending} data-testid="forgot-password-submit">
                {send.isPending && <Loader2 className="size-4 animate-spin" />} Invia link
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
