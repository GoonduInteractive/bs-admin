"use client";

import { CloudOff } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

/**
 * A page whose data didn't load: usually the API waking up (it sleeps when
 * idle) or failing. In production the message is redacted, so this says what
 * the admin can do rather than repeating it.
 */
export default function DashboardError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <EmptyState
      icon={CloudOff}
      title="Couldn't load this page"
      description="The server didn't answer properly. It may be waking up, which can take a minute. Try again; if it keeps failing, tell the backend team."
      action={
        <Button size="xl" onClick={() => retry()}>
          Try again
        </Button>
      }
    />
  );
}
