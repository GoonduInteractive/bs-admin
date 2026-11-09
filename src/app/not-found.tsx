import { NotFoundPanel } from "@/components/shared/not-found-panel";

/**
 * A 404 outside the dashboard shell: the comic reader's missing chapter, or
 * anything the dashboard's own 404 doesn't cover. The same panel, full screen.
 */
export default function NotFound() {
  return (
    <main>
      <NotFoundPanel fullScreen />
    </main>
  );
}
