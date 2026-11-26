"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatHbar } from "@/lib/format";
import { ordinal } from "@/lib/tournaments";
import type { PrizePayout } from "@/types/hedera";
import { payPayoutManuallyAction } from "../actions";

/**
 * The fallback when the automated payout can't go (the team, 2026-11-23): the
 * admin sends the HBAR from their own wallet, outside this admin, then records
 * the transfer here and the payout is marked sent. The server checks the
 * fields again; its refusal shows under the form.
 */
export function ManualPayoutDialog({
  payout,
  open,
  onOpenChange,
}: {
  payout: PrizePayout;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [txId, setTxId] = useState("");
  const [from, setFrom] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const who = `@${payout.player.handle}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) {
          setTxId("");
          setFrom("");
          setNote("");
          setError(null);
        }
      }}
    >
      <DialogContent>
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await payPayoutManuallyAction(payout.id, { txId, from, note: note.trim() || undefined });
              if ("error" in res) setError(res.error);
              else {
                toast.success(`${who}'s payout is marked as paid by hand`);
                onOpenChange(false);
              }
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Record a payout paid by hand</DialogTitle>
            <DialogDescription>
              For when the automatic payout can&apos;t go. Send {formatHbar(payout.hbar)} from your own wallet to {payout.wallet?.accountId}, {payout.player.name}&apos;s
              verified wallet, for {payout.tournament.name}, {ordinal(payout.place)} place. Then paste the transfer here and it&apos;s marked as sent.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="manual-tx">Transaction ID</FieldLabel>
              <Input
                id="manual-tx"
                autoFocus
                className="h-10 font-mono"
                placeholder="0.0.4521@1732371000.123456789"
                value={txId}
                aria-invalid={!!error}
                onChange={(e) => {
                  setTxId(e.target.value);
                  setError(null);
                }}
              />
              <FieldDescription>From your wallet or HashScan. Either spelling works.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="manual-from">Sent from</FieldLabel>
              <Input
                id="manual-from"
                className="h-10 font-mono"
                placeholder="0.0.4521"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setError(null);
                }}
              />
              <FieldDescription>Your wallet&apos;s account. It goes on the record, so the treasury can pay you back.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="manual-note">Note (optional)</FieldLabel>
              <Textarea
                id="manual-note"
                rows={2}
                maxLength={300}
                value={note}
                placeholder="The Hedera service was down for the weekend"
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Mark as paid
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
