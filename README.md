# Beyond Service Admin

The admin dashboard for **Beyond Service: Trial of the Gods** (Goondu Games Studio): store, comics, tournaments and players.

It reads and writes through a typed API layer (`src/lib/api/*`) against the Beyond Service API. Copy `.env.example` to `.env.local`: `BS_API_URL` is required, and `next.config.ts` stops the admin without it.

```bash
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

## What's in it

| Area | Route | Notes |
|---|---|---|
| Auth | `/login`, `/verify-email` | Password, then emailed 6-digit code. `src/proxy.ts` guards everything else. |
| Dashboard | `/` | KPIs, revenue, revenue by stream, units sold, players by region. One 7/30/90-day range scopes all of it. |
| Orders | `/orders`, `/orders/[id]` | Filter, search, export as CSV or PDF. Move orders paid → processing → in transit → delivered, or cancel. |
| Transactions | `/transactions` | Store sales, store refunds, prize payouts (tournaments are free to enter). Confirm or reject pending bank transfers. |
| Products | `/products`, `/products/new`, `/products/[id]` | Every product in the store (formerly "Merch"; `/merch` links redirect here). A product is one of the backend's two **types**: **Merch** (backend `apparel`: colourways (the standard three, plus any an admin adds and names, with a picked swatch), sizes, stock grid, image) or **Comics** (an issue from Comics, sold online, in print, or both, each with its own price, plus print stock). Type is chosen first when adding and fixed after. Merch variants inherit the product's price unless an admin sets an override under **Variant pricing**; a blank override follows the product's price. |
| Shipping | `/shipping` | Shipping prices by state and local government (`nigeria-lga-data`, all 774): a Home Delivery and a Pickup price per state, and optional per-LGA overrides where a blank follows the state price. Prices must be above ₦0; free shipping comes only from the **Free shipping promotion** on the same page, for campaigns: on or off, a minimum order (items total before points, 0 for every order) and optional start and end dates in Lagos time. While it's live, qualifying orders ship free by either method. Orders record Home Delivery (full address) or Pickup (state and LGA only, sent to a transport company's collection centre there). |
| Comics | `/comics`, `/comics/new`, `/comics/[id]`, `/comics/volumes/new`, `/comics/volumes/[id]` | Organised as **volumes** (the collected edition: number, title, synopsis, optional cover) containing numbered **chapters** (each one comic book: title, cover, pages, release). A chapter's **cover style** sets how the site draws its cover: under the site's torn **title band** (volume tag, cover title, band colour, previewed on the form) or as the **full image**, for art that carries its own title. The page groups chapters under their volume in reading order; the reader offers the next chapter at the end. Chapters are what the store sells: how one is sold is its Comics product in Products (named e.g. "Trial of the Gods Ch. 1: Testing Waters", kept in sync when a chapter or volume is renamed); each card links there, or offers "Add to store". A volume with chapters can't be deleted. **Printed volume** (on the volume's page): once every chapter is published, the whole volume can be sold as one printed book with its own price and stock. If a chapter is later unpublished or a draft chapter is added, it comes off sale automatically and says why. Online, readers only ever buy chapters. |
| Comic reader | `/comics/[id]/read` | Full-screen scroll or page-by-page reader, thumbnails, keyboard (← → J K, Esc). |
| Tournaments | `/tournaments`, `/tournaments/new`, `/tournaments/[slug]` | Lifecycle (draft → registration → stages → complete), bracket with result recording, participants, settings. The region is picked from the Regions list, or Global. Stages: Registration → Qualifiers (a points leaderboard, only when over 32 register; the top 32 go through) → Group stage (32) → Round of 16 → Quarter-finals → Semi-finals → Final; smaller fields skip Qualifiers and start at the smallest round that seats them, empty seats as byes (automatic wins). Admins advance each stage by hand and set its start time; a disqualified or suspended player's opponent advances automatically. Player slots are an even number or unlimited; entry is free (a switch) or at least ₦500; in-game rewards are an on/off switch (items live in the game). The prize split pays as many positions as the admin sets (winner takes all, top 3, top 6…), each a percentage of the pool totalling 100%; naira are derived and always sum to the pool. |
| Players | `/players` | Profiles, suspend/reinstate. |
| Regions | `/regions` | The admin-managed list players choose from at registration, so players and tournaments are counted against one set of names. Add, rename (changes the name everywhere), archive (no longer offered to new players or tournaments; existing ones keep it) or restore; a region can only be deleted while no player or tournament uses it. Region ids match the public site's codes. |
| Notes | `/notes` | Community Wall moderation. Every note players post, the queue first: approve it onto the public wall, reject it (either undoes the other), or the API has no delete. The API records the signed-in admin as the moderator. Pending notes show on the sidebar and in the bell. |
| Settings | `/settings` | Profile (read-only), the team (owners invite, change roles, remove), store (payments note: all through Paystack; low-stock alert level), your email notifications. |
| Accept invite | `/accept-invite?token=` | Signed out: where the invite email's link lands. The new teammate sets a password, then signs in. |

## How it's put together

```
src/
  types/index.ts        Data contracts, the shapes the backend should return
  lib/api/*             Adapters: the ONLY thing pages call
  lib/schemas/          Zod schemas, shared by forms and server actions
  lib/labels.ts         Every enum's display label and badge tone
  app/(auth)            Sign-in screens + server actions
  app/(dashboard)       Everything behind the sidebar
  app/(reader)          The full-screen comic reader
  app/api/uploads       Uploads, passed on to the API's storage
  components/shared     DataTable, StatCard, StatusBadge, Panel, ImageDropzone…
  components/charts     Recharts wrappers (revenue area, share donut, ranked bars)
```

### The real API

Set `BS_API_URL` (in `.env.local`, and in the host's environment when deployed), e.g. `https://backend-a5um.onrender.com`. `src/lib/api/client.ts` holds `apiFetch`: it sends the signed-in admin's token, unwraps the API's `{ success, status, message, data }` envelope, checks `data` with zod, and turns failures into an `ApiError`. A refused token sends the admin back to `/login`.

**Seeing the API calls.** They're made on the server, with the session's token, so the browser's Network tab never shows them (only the page and server-action requests). In development, the terminal running `npm run dev` logs one line per call: `[api] GET /v1/admin/orders → 200 in 412ms`. Add `BS_API_DEBUG=1` to `.env.local` (then restart) to also log what was sent and what came back, cut short, with passwords, tokens and codes blanked. Nothing is logged in production.

| Area | Source |
|---|---|
| Sign-in, verify code, profile | API (`/v1/admin/auth/*`). Codes can't be resent yet: no endpoint. |
| Players | API: list, stats, suspend, reinstate. Its player records have no email, region, game stats or spend yet, so those columns are hidden. A player who signed up on the site has no username until they set one, so the row shows their Gamer ID (or email) instead. |
| Regions | API: list, add, rename, archive or restore, stats. Each region's player count is the API's (`player_count`). Delete has no endpoint yet. The API's Global region is left out: here Global is the "open to every region" choice. |
| Dashboard | API: one call (`/v1/admin/dashboard?range=7d|30d|90d`) for every card, chart and list on it. |
| Orders | API: list, stats, detail with payments, move on (processing, in transit, delivered), cancel. The order page's Progress is the detail's own `timelines`: each stage ticked, with its date, once reached. Lines take their product name and picture from `variant.product`, and whether they ship from `variant.fulfillment` (an order of online comics alone is digital). FLAGGED (2026-10-30): the order list's lines arrive with only their variant (no SKU, price or quantity, which the spec promises), so the list's Items column shows "—"; the order page has them. Delivery details come in parts (`address`, `city`, `state`, `lga`, `zipcode`, `country`). An order from before those were kept, or a digital one, sends `shipping: {}`: a physical order then says its address is missing. |
| Transactions | API: the ledger. The API reports no processor fees. The stat cards still add up the ledger: `/transactions/stats` names its money fields without `_minor`, so its unit is unconfirmed. |
| Shipping | API: prices by state and local government, free shipping promotion, and the cards (`/v1/admin/shipping/stats`: states priced, where the promotion stands). Prices come back in kobo (`*_price_minor`) and are sent in naira. The price-range cards are worked out from the states' own prices, since the stats' ranges state no unit; the minimum shown comes from the promotion itself. |
| Products | API: list (as summaries), stats, create, open and edit. Prices are sent in naira (`price`, since 2026-11-02); replies still give kobo. Deleting waits for the API (no endpoint). A comic product is matched to its chapter through each product's detail (`chapter.id`): the comics endpoint gives a chapter's listing no product id, and the list doesn't name the chapter. A comic's store text is sent as `store_description`. |
| Comics | API: volumes and chapters (list, open, create, edit), stats. A free chapter is sold as `free_to_read`, with no price; each chapter's store listing comes with it. No delete yet, and no printed-volume edition (its panel is hidden). Reads and sales per chapter show "—": the API gives only totals. FLAGGED: the API doesn't store a chapter's cover style yet (asked 2026-10-30); the form sends it on every save and shows its controls once replies carry `cover_style`. |
| Uploads | API, on its public storage (since 2026-10-27), through `src/app/api/uploads/route.ts`: one file to `/v1/files/upload`, several to `/v1/files/multi-uploads` (a chapter's pages, sent in batches of about 4 MB so a request stays under hosts' size caps). Uploaded files are full URLs; `Thumb` skips the image optimiser for them. Files uploaded before the switch sit on the old private storage, which browsers can't load: upload them again. |
| Tournaments | API: list, stats (the prize figures), create, open, edit, players, bracket (with the API's qualifier leaderboard and the rounds to come, before the draw); prize pool sent in naira (`prize_pool`); start, advance, record a result, disqualify, cancel. The API runs the lifecycle (drawing, qualifiers, byes) and the admin shows what it decided. Not sent, no field: the first stage's start time (`/start` has no body), when a qualifier window closes, match scores. Tournaments are created free and single elimination. Prize shares take up to two decimals (Split evenly gives 33.34 / 33.33 / 33.33); the API accepts them since 2026-10-27. |
| Notes | API: list, stats, approve, reject. The API records the moderator from the token. No delete endpoint, so the page doesn't offer Delete; reject keeps a note off the wall. |
| Notifications | API: the bell lists the latest 20 above "Needs attention", with the unread count; opening one marks it read, Mark all read clears them. One about an order, product, note and so on links to its page; the context names aren't documented, so unknown ones show without a link. |
| Settings | API (since 2026-10-28): the team (list, invite, change role, remove, and accepting an invite at `/accept-invite`), the low-stock threshold, your four notification switches. The profile has no role, so the signed-in admin's role is read from the team. The spec doesn't say which roles may manage the team, so everyone gets the controls and the API decides; a refusal shows its message. No endpoint changes your own name or email, so Profile is read-only. FLAGGED: the invite email's link must open `/accept-invite?token=<token>` on this admin. |

To connect another area: write its `src/lib/api/*.ts` function with `apiFetch` (or `apiFetchAll` for a paged list) and a zod schema of the reply, and map the API's fields onto the type in `src/types`. Pages don't change.

Still to do: for large lists, moving `DataTable`'s search, filters and page into the URL and paging on the server.

## Design

**Light, dark or system.** Use the sun/moon button in the top bar. The theme is set by `next-themes` (a `dark` class on `<html>`). Colours that change with the theme are CSS variables in `globals.css` (`:root` and `.dark`). Use `bg-card`, `bg-paper` or `bg-primary`, never `bg-white` or `bg-ink`, for anything that should flip.

**Exports.** Every table with Export offers CSV (raw values, with a UTF-8 BOM so Excel keeps ₦) and PDF (branded, landscape A4, formatted values, the active filters noted under the title). The PDF builder, jsPDF, is loaded only when someone asks for a PDF. Helvetica has no ₦ glyph, so PDFs spell it "NGN". See `src/lib/export.ts`.


The colours come from the public site's `globals.css`, recast for a light workspace. Primary buttons are ink, the brand accent is signal red with a blush fill for active nav, the page ground is paper, and status colours are amber (pending), moss (success) and flare (failed). Teko is used for page titles and Host Grotesk for everything else. Tokens live in `src/app/globals.css`, and there's no `tailwind.config.ts` (Tailwind v4).

The chart palette (crimson → blue → amber → aqua) passes a colour-blindness check. Every chart with more than one series also prints its values, so no reading depends on colour alone.

Components are shadcn/ui on **Base UI**. Compose with the `render` prop (`<Button render={<Link href="…" />}>`), not `asChild`.

## Known gaps

- There's only one comic page image (`c1.png`), so it repeats through every issue.
- Cover art is character renders standing in for real covers.
