"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailPlus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Panel } from "@/components/shared/panel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatDate, initials } from "@/lib/format";
import { inviteSchema, storeSettingsSchema } from "@/lib/schemas";
import type { AdminRole, AdminUser, NotificationSettings, StoreSettings, TeamMember } from "@/types";
import {
  inviteMemberAction,
  removeMemberAction,
  saveNotificationSettingsAction,
  saveStoreSettingsAction,
  setMemberRoleAction,
} from "./actions";

const ROLE_LABEL: Record<AdminRole, string> = { owner: "Owner", admin: "Admin", support: "Support" };
const ROLE_HELP: Record<AdminRole, string> = {
  owner: "Everything, including billing and the team.",
  admin: "Store, comics, tournaments and players.",
  support: "Orders and players, read-only elsewhere.",
};

/* ---- Profile ---------------------------------------------------------- */

/** Read-only: the API has no way to change an admin's name or email yet. */
export function ProfilePanel({ admin }: { admin: AdminUser }) {
  return (
    <Panel title="Your profile" description="How you appear to the rest of the team.">
      <div className="max-w-lg">
        <div className="mb-6 flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarFallback className="bg-primary text-lg text-primary-foreground">{initials(admin.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{admin.name}</p>
            <p className="text-sm text-muted-foreground">{ROLE_LABEL[admin.role]}</p>
          </div>
        </div>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[6rem_1fr]">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{admin.name}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="break-all">{admin.email}</dd>
        </dl>
        <p className="mt-6 text-xs text-muted-foreground">Changing your name or email isn&apos;t available yet.</p>
      </div>
    </Panel>
  );
}

/* ---- Team ------------------------------------------------------------- */

/**
 * The team, from the API: invite people, change their roles, remove them. The
 * spec doesn't say which roles may, so the controls are offered to everyone and
 * the API's refusal, if any, is shown. Nobody changes or removes themselves here.
 */
export function TeamPanel({ admin, members, error }: { admin: AdminUser; members: TeamMember[] | null; error: string | null }) {
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [busy, start] = useTransition();
  const form = useForm({
    resolver: zodResolver(inviteSchema),
    defaultValues: { firstName: "", lastName: "", email: "", role: "admin" as const },
  });
  const { errors } = form.formState;
  const role = useWatch({ control: form.control, name: "role" });
  const isMe = (m: TeamMember) => m.email.toLowerCase() === admin.email.toLowerCase();

  const invite = form.handleSubmit(async (v) => {
    const result = await inviteMemberAction(v);
    if ("error" in result) return void toast.error(result.error);
    toast.success(`Invite sent to ${v.email}`);
    form.reset();
    setOpen(false);
  });

  const changeRole = (m: TeamMember, next: AdminRole) =>
    start(async () => {
      const result = await setMemberRoleAction(m.id, next);
      if ("error" in result) toast.error(result.error);
      else toast.success(`${m.name} is now ${ROLE_LABEL[next]}`);
    });

  const remove = (m: TeamMember) =>
    start(async () => {
      const result = await removeMemberAction(m.id);
      if ("error" in result) toast.error(result.error);
      else toast.success(`${m.name} was removed from the team`);
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
                <DialogDescription>They&apos;ll get an email with a link to set their password.</DialogDescription>
              </DialogHeader>
              <FieldGroup className="my-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field data-invalid={!!errors.firstName}>
                    <FieldLabel htmlFor="inv-first">First name</FieldLabel>
                    <Input id="inv-first" className="h-10" autoComplete="off" aria-invalid={!!errors.firstName} {...form.register("firstName")} />
                    <FieldError errors={[errors.firstName]} />
                  </Field>
                  <Field data-invalid={!!errors.lastName}>
                    <FieldLabel htmlFor="inv-last">Last name</FieldLabel>
                    <Input id="inv-last" className="h-10" autoComplete="off" aria-invalid={!!errors.lastName} {...form.register("lastName")} />
                    <FieldError errors={[errors.lastName]} />
                  </Field>
                </div>
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
      {error || !members ? (
        <p role="alert" className="px-5 py-6 text-sm text-muted-foreground">
          {error ?? "Couldn't load the team."}
        </p>
      ) : (
        <ul className="divide-y">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-5 py-3.5">
              <Avatar className="size-9">
                <AvatarFallback className="bg-paper text-xs">{initials(m.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.name}
                  {isMe(m) && <span className="ml-2 text-xs font-normal text-muted-foreground">You</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              <span className="hidden text-xs text-muted-foreground sm:block">
                {m.lastSeen ? `Seen ${formatDate(m.lastSeen)}` : m.lastSeen === null ? "Not signed in yet" : ""}
              </span>
              {!isMe(m) ? (
                <>
                  <Select value={m.role} onValueChange={(v) => changeRole(m, v as AdminRole)} disabled={busy}>
                    <SelectTrigger aria-label={`${m.name}'s role`} className="w-28">
                      <SelectValue>{(v: AdminRole) => ROLE_LABEL[v]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(["owner", "admin", "support"] as const).map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" aria-label={`Remove ${m.name}`} disabled={busy} onClick={() => setRemoving(m)}>
                    <Trash2 />
                  </Button>
                </>
              ) : (
                <>
                  {/* Lined up with the role pickers and remove buttons on the other rows. */}
                  <span className="w-28 pl-2.5 text-sm">{ROLE_LABEL[m.role]}</span>
                  <span aria-hidden className="size-8" />
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.name ?? "them"} from the team?`}
        description="They'll no longer be able to sign in to the admin. You can invite them again later."
        confirmLabel="Remove"
        destructive
        onConfirm={() => removing && remove(removing)}
      />
    </Panel>
  );
}

/* ---- Store ------------------------------------------------------------ */

export function StoreForm({ settings }: { settings: StoreSettings }) {
  const [saving, start] = useTransition();
  const form = useForm({ resolver: zodResolver(storeSettingsSchema), defaultValues: { lowStockAt: settings.lowStockAt } });
  const { errors } = form.formState;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((v) =>
        start(async () => {
          const result = await saveStoreSettingsAction(v);
          if ("error" in result) toast.error(result.error);
          else toast.success("Store settings saved");
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
            <Input id="s-low" type="number" min={1} className="h-10" aria-invalid={!!errors.lowStockAt} {...form.register("lowStockAt")} />
            <FieldDescription>Units left, per product.</FieldDescription>
            <FieldError errors={[errors.lowStockAt]} />
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

/** Each switch saves as it's flipped, and flips back if the save fails. */
export function NotificationsForm({ settings }: { settings: NotificationSettings }) {
  const [on, setOn] = useState(settings);
  const [saving, start] = useTransition();

  const flip = (id: keyof NotificationSettings, label: string, value: boolean) => {
    const before = on;
    const next = { ...on, [id]: value };
    setOn(next);
    start(async () => {
      const result = await saveNotificationSettingsAction(next);
      if ("error" in result) {
        setOn(before);
        toast.error(result.error);
      } else {
        toast.success(`${label} ${value ? "on" : "off"}`);
      }
    });
  };

  return (
    <Panel title="Email notifications" description="Sent to your admin email." bodyClassName="p-0">
      <ul className="divide-y">
        {NOTIFY.map((n) => (
          <li key={n.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <label htmlFor={`n-${n.id}`} className="cursor-pointer">
              <span className="block text-sm font-medium">{n.label}</span>
              <span className="block text-xs text-muted-foreground">{n.body}</span>
            </label>
            <Switch id={`n-${n.id}`} checked={on[n.id]} disabled={saving} onCheckedChange={(v) => flip(n.id, n.label, v)} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
