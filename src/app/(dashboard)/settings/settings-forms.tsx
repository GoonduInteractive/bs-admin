"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailPlus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Panel } from "@/components/shared/panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatDate, initials } from "@/lib/format";
import type { AdminRole, AdminUser } from "@/types";

/**
 * MOCK: settings save to nowhere yet - each form validates, pauses like a
 * request would, and confirms. Wire each `onSubmit` to its endpoint later.
 */
const fakeSave = () => new Promise((r) => setTimeout(r, 400));

/* ---- Profile ---------------------------------------------------------- */

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  email: z.email("Enter a valid email"),
});

export function ProfileForm({ admin }: { admin: AdminUser }) {
  const [saving, start] = useTransition();
  const form = useForm({ resolver: zodResolver(profileSchema), defaultValues: { name: admin.name, email: admin.email } });
  const { errors } = form.formState;

  return (
    <Panel title="Your profile" description="How you appear to the rest of the team.">
      <form
        noValidate
        onSubmit={form.handleSubmit(() =>
          start(async () => {
            await fakeSave();
            toast.success("Profile saved");
          }),
        )}
        className="max-w-lg"
      >
        <div className="mb-6 flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarFallback className="bg-primary text-lg text-primary-foreground">{initials(admin.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{admin.name}</p>
            <p className="text-sm text-muted-foreground capitalize">{admin.role}</p>
          </div>
        </div>
        <FieldGroup>
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="p-name">Name</FieldLabel>
            <Input id="p-name" className="h-10" aria-invalid={!!errors.name} {...form.register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="p-email">Email</FieldLabel>
            <Input id="p-email" type="email" className="h-10" aria-invalid={!!errors.email} {...form.register("email")} />
            <FieldDescription>Changing it sends a verification code to the new address.</FieldDescription>
            <FieldError errors={[errors.email]} />
          </Field>
          <div>
            <Button type="submit" size="xl" disabled={saving}>
              Save profile
            </Button>
          </div>
        </FieldGroup>
      </form>
    </Panel>
  );
}

/* ---- Team ------------------------------------------------------------- */

type Member = { id: string; name: string; email: string; role: AdminRole; lastSeen?: string; invited?: boolean };

const ROLE_LABEL: Record<AdminRole, string> = { owner: "Owner", admin: "Admin", support: "Support" };
const ROLE_HELP: Record<AdminRole, string> = {
  owner: "Everything, including billing and the team.",
  admin: "Store, comics, tournaments and players.",
  support: "Orders and players, read-only elsewhere.",
};

const inviteSchema = z.object({ email: z.email("Enter a valid email"), role: z.enum(["admin", "support"]) });

export function TeamPanel({ admin, members: initial }: { admin: AdminUser; members: Member[] }) {
  const [members, setMembers] = useState<Member[]>([{ ...admin, lastSeen: new Date().toISOString() }, ...initial]);
  const [open, setOpen] = useState(false);
  const form = useForm({ resolver: zodResolver(inviteSchema), defaultValues: { email: "", role: "admin" as const } });
  const { errors } = form.formState;
  const role = useWatch({ control: form.control, name: "role" });

  const invite = form.handleSubmit(async (v) => {
    await fakeSave();
    setMembers((m) => [...m, { id: crypto.randomUUID(), name: v.email.split("@")[0], email: v.email, role: v.role, invited: true }]);
    toast.success(`Invite sent to ${v.email}`);
    form.reset();
    setOpen(false);
  });

  return (
    <Panel
      title="Team"
      description="People who can sign in to this admin."
      bodyClassName="p-0"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <MailPlus />
            Invite
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={invite} noValidate>
              <DialogHeader>
                <DialogTitle>Invite a teammate</DialogTitle>
                <DialogDescription>They&apos;ll get an email to set a password and verify their address.</DialogDescription>
              </DialogHeader>
              <FieldGroup className="my-6">
                <Field data-invalid={!!errors.email}>
                  <FieldLabel htmlFor="inv-email">Email</FieldLabel>
                  <Input id="inv-email" type="email" className="h-10" placeholder="name@goondu.games" aria-invalid={!!errors.email} {...form.register("email")} />
                  <FieldError errors={[errors.email]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="inv-role">Role</FieldLabel>
                  <Select value={role} onValueChange={(v) => form.setValue("role", v as "admin" | "support")}>
                    <SelectTrigger id="inv-role" className="w-full data-[size=default]:h-10">
                      <SelectValue>{(v: AdminRole) => ROLE_LABEL[v]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(["admin", "support"] as const).map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>{ROLE_HELP[role]}</FieldDescription>
                </Field>
              </FieldGroup>
              <DialogFooter>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  Send invite
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <ul className="divide-y">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-5 py-3.5">
            <Avatar className="size-9">
              <AvatarFallback className="bg-paper text-xs">{initials(m.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.name}
                {m.id === admin.id && <span className="ml-2 text-xs font-normal text-muted-foreground">You</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">{m.email}</p>
            </div>
            {m.invited ? (
              <StatusBadge label="Invited" tone="warning" />
            ) : (
              <span className="hidden text-xs text-muted-foreground sm:block">{m.lastSeen ? `Seen ${formatDate(m.lastSeen)}` : ""}</span>
            )}
            <span className="w-20 text-right text-sm">{ROLE_LABEL[m.role]}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ---- Store ------------------------------------------------------------ */

const storeSchema = z.object({
  lowStockAt: z.coerce.number<number>().int().min(1),
});

export function StoreForm() {
  const [saving, start] = useTransition();
  const form = useForm({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      lowStockAt: 10,
    },
  });
  const { errors } = form.formState;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(() =>
        start(async () => {
          await fakeSave();
          toast.success("Store settings saved");
        }),
      )}
      className="flex flex-col gap-4"
    >
      {/* The manual bank transfer account is gone (2026-09-30): every payment goes
          through Paystack, which offers transfer, card, USSD and its other channels
          itself, and pays out to the account set in the Paystack dashboard. */}
      <Panel title="Payments">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every order is paid through Paystack, which offers card, bank transfer, USSD and its other channels at
          checkout. Money settles to the bank account set in the Paystack dashboard, not here.
        </p>
      </Panel>

      <Panel
        title="Shipping & stock"
        description={
          <>
            Shipping prices, and any free shipping promotion, are set in{" "}
            <Link href="/shipping" className="font-medium text-signal hover:underline">
              Shipping
            </Link>
            .
          </>
        }
      >
        {/* Free shipping is a promotion, run from the Shipping page (2026-10-01). */}
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.lowStockAt}>
            <FieldLabel htmlFor="s-low">Low-stock alert at</FieldLabel>
            <Input id="s-low" type="number" min={1} className="h-10" {...form.register("lowStockAt")} />
            <FieldDescription>Units left, per product.</FieldDescription>
          </Field>
        </div>
      </Panel>

      <div>
        <Button type="submit" size="xl" disabled={saving}>
          Save store settings
        </Button>
      </div>
    </form>
  );
}

/* ---- Notifications ---------------------------------------------------- */

const NOTIFY = [
  { id: "orders", label: "New orders", body: "An email for every order placed." },
  { id: "stock", label: "Low stock", body: "When a product drops under the alert level." },
  { id: "registrations", label: "Tournament registrations", body: "A daily summary while registration is open." },
  { id: "results", label: "Match results", body: "When a live match needs a result recorded." },
] as const;

export function NotificationsForm() {
  const [on, setOn] = useState<Record<string, boolean>>({ orders: false, stock: true, registrations: true, results: true });
  return (
    <Panel title="Email notifications" description="Sent to your admin email." bodyClassName="p-0">
      <ul className="divide-y">
        {NOTIFY.map((n) => (
          <li key={n.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <label htmlFor={`n-${n.id}`} className="cursor-pointer">
              <span className="block text-sm font-medium">{n.label}</span>
              <span className="block text-xs text-muted-foreground">{n.body}</span>
            </label>
            <Switch
              id={`n-${n.id}`}
              checked={on[n.id]}
              onCheckedChange={(v) => {
                setOn((s) => ({ ...s, [n.id]: v }));
                toast.success(`${n.label} ${v ? "on" : "off"}`);
              }}
            />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
