"use client";

import { Loader2, LogOut } from "lucide-react";
import { useTransition } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Confirms before signing out. Signing back in needs a fresh emailed code, so
 * a stray click on "Sign out" costs more than a click.
 *
 * Controlled from outside: the menu item that opens it lives in a dropdown,
 * and a dialog nested in a menu would close with the menu.
 */
export function SignOutDialog({
  open,
  onOpenChange,
  email,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
}) {
  const [pending, start] = useTransition();

  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-flare-soft text-flare">
            <LogOut />
          </AlertDialogMedia>
          <AlertDialogTitle>Sign out?</AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;re signed in as <span className="font-medium text-foreground">{email}</span>. Signing back in
            needs a new code from your email.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Stay signed in</AlertDialogCancel>
          {/* Not AlertDialogAction: it must stay open, showing progress, until the redirect lands. */}
          <Button variant="destructive" disabled={pending} onClick={() => start(() => logoutAction())}>
            {pending && <Loader2 className="animate-spin" />}
            Sign out
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
