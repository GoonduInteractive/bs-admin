"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { verifySchema } from "@/lib/schemas";
import { resendAction, verifyAction } from "../actions";

const RESEND_COOLDOWN = 30;

export function VerifyForm({ next }: { next?: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [verifying, startVerify] = useTransition();
  const [resending, startResend] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  function submit(value: string) {
    const parsed = verifySchema.safeParse({ code: value });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter the code");
      return;
    }
    setError(null);
    startVerify(async () => {
      const result = await verifyAction(parsed.data, next);
      if (result?.error) {
        setError(result.error);
        setCode("");
      }
    });
  }

  function resend() {
    startResend(async () => {
      const result = await resendAction();
      if (result?.error) return void toast.error(result.error);
      setCooldown(RESEND_COOLDOWN);
      toast.success("A new code is on its way");
    });
  }

  return (
    <form
      className="mt-8"
      onSubmit={(e) => {
        e.preventDefault();
        submit(code);
      }}
    >
      <label htmlFor="otp" className="sr-only">
        Verification code
      </label>
      <InputOTP
        id="otp"
        maxLength={6}
        value={code}
        onChange={(v) => {
          setCode(v);
          if (error) setError(null);
        }}
        onComplete={submit}
        disabled={verifying}
        autoFocus
        aria-invalid={!!error}
        containerClassName="justify-between"
      >
        <InputOTPGroup>
          {[0, 1, 2].map((i) => (
            <InputOTPSlot key={i} index={i} aria-invalid={!!error} className="size-12 text-lg" />
          ))}
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          {[3, 4, 5].map((i) => (
            <InputOTPSlot key={i} index={i} aria-invalid={!!error} className="size-12 text-lg" />
          ))}
        </InputOTPGroup>
      </InputOTP>

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" size="xl" className="mt-6 w-full" disabled={verifying || code.length < 6}>
        {verifying && <Loader2 className="animate-spin" />}
        Verify and sign in
      </Button>

      <div className="mt-6 flex items-center justify-between text-sm">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Use another account
        </Link>
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-signal"
          disabled={cooldown > 0 || resending}
          onClick={resend}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </Button>
      </div>
    </form>
  );
}
