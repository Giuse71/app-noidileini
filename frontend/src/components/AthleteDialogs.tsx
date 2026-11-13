import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { GitMerge, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ProfileFields";
import { apiGet, apiPost } from "@/lib/api";
import { errMsg } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import type { Athlete, AthleteEmailIn, AthleteEmailResult, AthleteFilter, AthleteMergeResult } from "@/lib/types";

const selectCls =
  "h-9 w-full cursor-pointer rounded-lg border border-input bg-background px-2.5 text-base md:text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Merge a duplicate account (dup) into the one the board picks: purchases and family cards move, dup is deactivated. */
export function MergeDialog({ dup, onClose }: { dup: Athlete | null; onClose: () => void }) {
  const [keepId, setKeepId] = useState("");
  const all = useQuery({
    queryKey: ["athletes", "merge-targets"],
    queryFn: () => apiGet<Athlete[]>("/athletes?status=all"),
    enabled: dup !== null,
  });
  const targets = (all.data ?? []).filter((a) => dup && a.id !== dup.id && !a.merged_into);
  const merge = useMutation({
    mutationFn: () => apiPost<AthleteMergeResult>("/admin/athletes/merge", { keep_id: keepId, merge_id: dup?.id }),
    onSuccess: (r) => {
      toast.success(`Unito in ${r.kept.first_name} ${r.kept.last_name}: ${r.transactions} acquisti e ${r.family} familiari spostati`);
      void queryClient.invalidateQueries({ queryKey: ["athletes"] });
      setKeepId("");
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog
      open={dup !== null}
      onOpenChange={(o) => {
        if (!o) {
          setKeepId("");
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md" data-testid="merge-dialog">
        <DialogHeader>
          <DialogTitle>Unisci account doppio</DialogTitle>
          <DialogDescription>
            Gli acquisti e le tessere familiari di <strong>{dup?.first_name} {dup?.last_name}</strong> ({dup?.code}) passano all'account che scegli.
            Questo account verrà disattivato, non cancellato.
          </DialogDescription>
        </DialogHeader>
        <Field label="Account da tenere" htmlFor="merge-keep">
          <select id="merge-keep" value={keepId} onChange={(e) => setKeepId(e.target.value)} className={selectCls} data-testid="merge-keep-select">
            <option value="" disabled>
              {all.isLoading ? "Caricamento…" : "Scegli l'account che resta"}
            </option>
            {targets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.last_name} {a.first_name} · {a.code} · {a.email || "senza email"}
                {a.is_active ? "" : " (disattivato)"}
              </option>
            ))}
          </select>
        </Field>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} data-testid="merge-cancel">Annulla</Button>
          <Button disabled={!keepId || merge.isPending} onClick={() => merge.mutate()} data-testid="merge-confirm">
            {merge.isPending ? <Loader2 className="size-4 animate-spin" /> : <GitMerge className="size-4" />} Unisci
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Emails every athlete matching the current filters, one message each (addresses are never shared). */
export function EmailFilteredDialog({ filter, count, open, onClose }: { filter: AthleteFilter; count: number; open: boolean; onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const send = useMutation({
    mutationFn: () => apiPost<AthleteEmailResult>("/admin/athletes/email", { ...filter, subject, message } satisfies AthleteEmailIn),
    onSuccess: (r) => {
      toast.success(
        r.recipients
          ? `Invio in corso a ${r.recipients} atleti${r.skipped ? ` (${r.skipped} senza email valida esclusi)` : ""}`
          : "Nessun atleta con email valida in questo filtro",
      );
      setSubject("");
      setMessage("");
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="email-filtered-dialog">
        <DialogHeader>
          <DialogTitle>Scrivi agli atleti filtrati</DialogTitle>
          <DialogDescription data-testid="email-filtered-summary">
            {count} atleti
            {filter.category && ` · ${filter.category}`}
            {filter.role && ` · ${filter.role === "__none" ? "senza ruolo" : filter.role}`}
            {filter.q && ` · "${filter.q}"`}. Ognuno riceve un'email personale.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <Field label="Oggetto" htmlFor="ef-subject">
            <Input id="ef-subject" required maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} data-testid="email-filtered-subject-input" />
          </Field>
          <Field label="Messaggio" htmlFor="ef-message">
            <Textarea id="ef-message" required rows={6} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)} data-testid="email-filtered-message-input" />
          </Field>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose} data-testid="email-filtered-cancel">Annulla</Button>
            <Button type="submit" disabled={send.isPending || count === 0} data-testid="email-filtered-send">
              {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Invia a {count}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
