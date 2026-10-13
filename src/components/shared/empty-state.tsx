import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** The inspiration's empty state: an outlined icon, a line of display type, one action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <Icon className="size-16 stroke-[1.25] text-foreground" aria-hidden />
      <p className="mt-5 font-display text-4xl leading-none font-medium uppercase">{title}</p>
      {description && <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
