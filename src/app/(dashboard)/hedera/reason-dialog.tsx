"use client";

import { Loader2 } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

/**
 * Ask for a sentence before doing something to a person's money: why a payout
 * is held, what a winner should fix in their identity check. The server
 * action checks the text again; its refusal shows under the field.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  hint,
  placeholder,
  confirmLabel,
  destructive = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  hint?: string;
  placeholder?: string;
  confirmLabel: string;
  destructive?: boolean;
  /** Resolves with an error to show, or nothing when it's done. */
  onSubmit: (text: string) => Promise<string | undefined>;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fieldId = useId();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) {
          setText("");
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
              const problem = await onSubmit(text);
              if (problem) setError(problem);
              else onOpenChange(false);
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
            <Textarea
              id={fieldId}
              autoFocus
              rows={3}
              maxLength={300}
              value={text}
              placeholder={placeholder}
              aria-invalid={!!error}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
            />
            {hint && <FieldDescription>{hint}</FieldDescription>}
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
