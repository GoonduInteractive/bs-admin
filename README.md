# Beyond Service Admin

The admin dashboard for **Beyond Service: Trial of the Gods** (Goondu Games Studio): store, comics, tournaments and players.

It runs entirely on **mock data** until the backend exists. Every screen already reads and writes through a typed API layer, so hooking up real endpoints only changes `src/lib/api/*`.

```bash
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

**Demo sign-in:** any email with a password of 8+ characters, then the code `123456`.

## What's in it

| Area | Route | Notes |
|---|---|---|
| Auth | `/login`, `/verify-email` | Password, then emailed 6-digit code. `src/proxy.ts` guards everything else. |
| Dashboard | `/` | KPIs, revenue, revenue by stream, units sold, players by region. One 7/30/90-day range scopes all of it. |
| Orders | `/orders`, `/orders/[id]` | Filter, search, export as CSV or PDF. Move orders pending → processing → in transit → delivered, or cancel. |
| Transactions | `/transactions` | Store sales, store refunds, prize payouts (tournaments are free to enter). Confirm or reject pending bank transfers. |
| Products | `/products`, `/products/new`, `/products/[id]` | Every product in the store (formerly "Merch"; `/merch` links redirect here). A product is one of the backend's two **types**: **Merch** (backend `apparel`: colourways (the standard three, plus any an admin adds and names, with a picked swatch), sizes, stock grid, image) or **Comics** (an issue from Comics, sold online, in print, or both, each with its own price, plus print stock). Type is chosen first when adding and fixed after. Merch variants inherit the product's price unless an admin sets an override under **Variant pricing**; a blank override follows the product's price. |
| Shipping | `/shipping` | Shipping prices by state and local government (`nigeria-lga-data`, all 774): a Home Delivery and a Pickup price per state, and optional per-LGA overrides where a blank follows the state price. Prices must be above ₦0; free shipping comes only from the **Free shipping promotion** on the same page, for campaigns: on or off, a minimum order (items total before points, 0 for every order) and optional start and end dates in Lagos time. While it's live, qualifying orders ship free by either method. Orders record Home Delivery (full address) or Pickup (state and LGA only, sent to a transport company's collection centre there). |
| Comics | `/comics`, `/comics/new`, `/comics/[id]`, `/comics/volumes/new`, `/comics/volumes/[id]` | Organised as **volumes** (the collected edition: number, title, synopsis, optional cover) containing numbered **chapters** (each one comic book: title, cover, pages, release). The page groups chapters under their volume in reading order; the reader offers the next chapter at the end. Chapters are what the store sells: how one is sold is its Comics product in Products (named e.g. "Trial of the Gods Ch. 1: Testing Waters", kept in sync when a chapter or volume is renamed); each card links there, or offers "Add to store". A volume with chapters can't be deleted. **Printed volume** (on the volume's page): once every chapter is published, the whole volume can be sold as one printed book with its own price and stock. If a chapter is later unpublished or a draft chapter is added, it comes off sale automatically and says why. Online, readers only ever buy chapters. |
| Comic reader | `/comics/[id]/read` | Full-screen scroll or page-by-page reader, thumbnails, keyboard (← → J K, Esc). |
| Tournaments | `/tournaments`, `/tournaments/new`, `/tournaments/[slug]` | Lifecycle (draft → registration → stages → complete), bracket with result recording, participants, settings. The region is picked from the Regions list, or Global. Stages: Registration → Qualifiers (a points leaderboard, only when over 32 register; the top 32 go through) → Group stage (32) → Round of 16 → Quarter-finals → Semi-finals → Final; smaller fields skip Qualifiers and start at the smallest round that seats them, empty seats as byes (automatic wins). Admins advance each stage by hand and set its start time; a disqualified or suspended player's opponent advances automatically. Player slots are an even number or unlimited; entry is free (a switch) or at least ₦500; in-game rewards are an on/off switch (items live in the game). The prize split pays as many positions as the admin sets (winner takes all, top 3, top 6…), each a percentage of the pool totalling 100%; naira are derived and always sum to the pool. |
| Players | `/players` | Profiles, suspend/reinstate. |
| Regions | `/regions` | The admin-managed list players choose from at registration, so players and tournaments are counted against one set of names. Add, rename (changes the name everywhere), archive (no longer offered to new players or tournaments; existing ones keep it) or restore; a region can only be deleted while no player or tournament uses it. Region ids match the public site's codes. |
| Settings | `/settings` | Profile, team invites, store (payments note: all through Paystack; low-stock alert level), notifications. |

## How it's put together

```
src/
  types/index.ts        Data contracts, the shapes the backend should return
  lib/api/*             Adapters: the ONLY thing pages call. Mock today.
  lib/mock/*            Seeded fixtures (deterministic, anchored to 2026-09-24)
  lib/schemas/          Zod schemas, shared by forms and server actions
  lib/labels.ts         Every enum's display label and badge tone
  app/(auth)            Sign-in screens + server actions
  app/(dashboard)       Everything behind the sidebar
  app/(reader)          The full-screen comic reader
  app/api/uploads       Mock file storage (in memory)
  components/shared     DataTable, StatCard, StatusBadge, Panel, ImageDropzone…
  components/charts     Recharts wrappers (revenue area, share donut, ranked bars)
```

### Going live against the real API

1. Set `BS_API_URL`.
2. In each `src/lib/api/*.ts` function, replace the body that reads `src/lib/mock/*` with `apiFetch(...)` from `src/lib/api/client.ts`, and parse the response with zod.
3. Auth: `signIn` and `verifyCode` in `src/lib/api/auth.ts` become POSTs; store the returned token in the session cookie.
4. Uploads: point `src/app/api/uploads/route.ts` at real storage (S3, Cloudinary, the game CDN). The forms only ever keep the returned URL.
5. For large lists, move `DataTable`'s search, filters and page into the URL and page on the server.

Mock writes (new products, status changes, uploads) live in server memory and reset when the dev server restarts.

## Design

**Light, dark or system.** Use the sun/moon button in the top bar. The theme is set by `next-themes` (a `dark` class on `<html>`). Colours that change with the theme are CSS variables in `globals.css` (`:root` and `.dark`). Use `bg-card`, `bg-paper` or `bg-primary`, never `bg-white` or `bg-ink`, for anything that should flip.

**Exports.** Every table with Export offers CSV (raw values, with a UTF-8 BOM so Excel keeps ₦) and PDF (branded, landscape A4, formatted values, the active filters noted under the title). The PDF builder, jsPDF, is loaded only when someone asks for a PDF. Helvetica has no ₦ glyph, so PDFs spell it "NGN". See `src/lib/export.ts`.


The colours come from the public site's `globals.css`, recast for a light workspace. Primary buttons are ink, the brand accent is signal red with a blush fill for active nav, the page ground is paper, and status colours are amber (pending), moss (success) and flare (failed). Teko is used for page titles and Host Grotesk for everything else. Tokens live in `src/app/globals.css`, and there's no `tailwind.config.ts` (Tailwind v4).

The chart palette (crimson → blue → amber → aqua) passes a colour-blindness check. Every chart with more than one series also prints its values, so no reading depends on colour alone.

Components are shadcn/ui on **Base UI**. Compose with the `render` prop (`<Button render={<Link href="…" />}>`), not `asChild`.

## Known gaps

- There's only one comic page image (`c1.png`), so it repeats through every issue.
- Cover art is character renders standing in for real covers.
