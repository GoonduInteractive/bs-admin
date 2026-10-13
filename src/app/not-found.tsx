import { SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <EmptyState
        icon={SearchX}
        title="Not found"
        description="That page, or the record it points to, doesn't exist. It may have been deleted."
        action={
          <Button size="xl" render={<Link href="/" />}>
            Back to the dashboard
          </Button>
        }
      />
    </main>
  );
}
