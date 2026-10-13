"use client";

import { useId, useState, type ReactElement, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * Confirm before anything destructive or hard to undo. Closes itself on confirm.
 *
 * With `confirmText`, the admin must type it exactly (like deleting a GitHub
 * repository) before the confirm button works: for actions against a person,
 * where one mis-click lands on someone else. `onConfirm` receives what was typed.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  confirmText,
  onConfirm,
  open: controlledOpen,
  onOpenChange,
}: {
  /**
   * The trigger element, e.g. `<Button variant="outline" />`. Its children go in `children`.
   * Leave it out and pass `open` to open the dialog from elsewhere, e.g. a menu item
   * (a menu closes on click, taking any dialog inside it along).
   */
  trigger?: ReactElement;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Text the admin must type to confirm, e.g. a player's handle. Case-sensitive. */
  confirmText?: string;
  onConfirm: (typed: string) => void;
  /** Controlled mode, alongside `onOpenChange`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setOwnOpen(next);
    onOpenChange?.(next);
    // Every opening starts blank: a handle typed for one person never carries to the next.
    if (!next) setTyped("");
  };
  const [typed, setTyped] = useState("");
  const inputId = useId();
  const matches = confirmText === undefined || typed.trim() === confirmText;

  function confirm() {
    if (!matches) return;
    setOpen(false);
    onConfirm(typed.trim());
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger && <AlertDialogTrigger render={trigger} />}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {confirmText !== undefined && (
          <Field>
            <FieldLabel htmlFor={inputId} className="block font-normal text-muted-foreground">
              To confirm, type{" "}
              <code className="rounded bg-paper px-1.5 py-0.5 font-mono text-[0.8rem] font-semibold text-foreground select-all">
                {confirmText}
              </code>{" "}
              below.
            </FieldLabel>
            <Input
              id={inputId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirm();
                }
              }}
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              // Red only once it's as long as the target and still wrong, not while it's half typed.
              aria-invalid={!matches && typed.trim().length >= confirmText.length}
              className="h-10 font-mono"
            />
          </Field>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? "destructive" : "default"} disabled={!matches} onClick={confirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
