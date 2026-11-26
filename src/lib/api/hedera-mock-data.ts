import "server-only";
import type {
  HederaJob,
  HederaNetwork,
  LinkedWallet,
  PrizePayout,
  StoreItem,
  TournamentHederaPrize,
  TreasuryMovement,
} from "@/types/hedera";

/**
 * THE MOCK'S STARTING DATA - NOT REAL, read only while the Hedera screens run
 * on mocks (`lib/hedera/mode.ts`). Every date is relative to when the server
 * started, so "this month" and "3 hours ago" read sensibly on any day.
 *
 * Matched to the website's mock (`beyond-service-hedera`,
 * `lib/api/hedera-mock-data.ts`) where both show the same thing: the same
 * eight exclusives with the same IDs, prices and editions, the same three
 * collections, the same treasury account and HBAR rate, and the website mock
 * player's three prizes (`prz-eastern-cup-2`, `prz-lagos-weekly-5`,
 * `prz-abuja-open-3`), here as Chiamaka's. The rest is invented to put every
 * state on screen. The art is the admin's own four character files; the two
 * exclusives with no matching art here show the empty picture.
 */

export const MOCK_NETWORK: HederaNetwork = "testnet";

/** One collection per asset family (the doc), on testnet. */
export const MOCK_COLLECTIONS = { skin: "0.0.5104201", weapon: "0.0.5104202", character: "0.0.5104203" } as const;

/** Goondu's treasury: receives HBAR payments, pays prizes and refunds. */
export const MOCK_TREASURY = "0.0.5104100";

/** Naira and dollars per HBAR, as the website's mock has it. Live, the gateway quotes. */
export const MOCK_RATE = { NGN: 260, USD: 0.18 } as const;

export const GAME = "Beyond Service: Trial of the Gods";

export type MockState = {
  items: StoreItem[];
  payouts: PrizePayout[];
  jobs: HederaJob[];
  treasury: { network: HederaNetwork; accountId: string; alertBelow: number; identityThreshold: number; hbarDiscountPct: number; updatedAt: string };
  movements: TreasuryMovement[];
  /** Keyed by the tournament's id. */
  prizes: Record<string, TournamentHederaPrize>;
  /** For unique ids and transaction nanoseconds. */
  seq: number;
};

/** A Hedera transaction ID: the payer's account, then the second and nanosecond it was made. */
export function txIdAt(payer: string, at: number, n: number): string {
  return `${payer}@${Math.floor(at / 1000)}.${String((n * 7919 + 104729) % 1_000_000_000).padStart(9, "0")}`;
}

export function seed(now: number): MockState {
  const at = (days: number, hours = 0, minutes = 0) => now - ((days * 24 + hours) * 60 + minutes) * 60_000;
  const iso = (ms: number) => new Date(ms).toISOString();
  const ago = (days: number, hours = 0, minutes = 0) => iso(at(days, hours, minutes));
  const ahead = (days: number) => iso(now + days * 86_400_000);
  let n = 0;
  const tx = (payer: string, ms: number) => txIdAt(payer, ms, ++n);

  /* ---- The catalogue ---- */

  const item = (i: Omit<StoreItem, "games" | "tokenId" | "createdAt" | "updatedAt"> & { createdDaysAgo: number }): StoreItem => {
    const { createdDaysAgo, ...rest } = i;
    return { ...rest, games: [GAME], tokenId: MOCK_COLLECTIONS[i.family], createdAt: ago(createdDaysAgo), updatedAt: ago(Math.max(0, createdDaysAgo - 2)) };
  };
  const live = (days: number) => ({ published: true, publishedAt: ago(days), saleStartsAt: null });
  const items: StoreItem[] = [
    item({
      id: "bs-skin-soma-ember",
      name: "Soma: Ember Robes",
      description: "Soma's robes, dyed in the colour of the shrine fires. A look for the arena, nothing more: it changes no stat.",
      family: "skin",
      rarity: "epic",
      image: "/assets/characters/soma-3d.png",
      imageAlt: "Soma in the Ember Robes skin",
      access: "sale",
      price: { amount: 4500, currency: "NGN" },
      supply: null,
      saleEndsAt: null,
      ...live(3),
      sold: 46,
      createdDaysAgo: 9,
    }),
    item({
      id: "bs-skin-kaira-nightveil",
      name: "Kaira: Nightveil",
      description: "Kaira, veiled for the night hunt. A limited edition of 500.",
      family: "skin",
      rarity: "legendary",
      image: "/assets/characters/kaira-crop.png",
      imageAlt: "Kaira in the Nightveil skin",
      access: "sale",
      price: { amount: 9000, currency: "NGN" },
      supply: { total: 500, remaining: 132 },
      saleEndsAt: null,
      ...live(3),
      sold: 368,
      createdDaysAgo: 9,
    }),
    item({
      id: "bs-skin-nze-harvest",
      name: "Nze Ugwuoke: Harvest Garb",
      description: "The elder's garb from the new yam festival, on sale for a short time.",
      family: "skin",
      rarity: "rare",
      image: "/assets/characters/Nze-Ugwuoke.png",
      imageAlt: "Nze Ugwuoke in the Harvest Garb skin",
      access: "sale",
      price: { amount: 3500, currency: "NGN" },
      supply: null,
      saleEndsAt: "2026-12-05T22:59:00.000Z",
      ...live(3),
      sold: 21,
      createdDaysAgo: 8,
    }),
    item({
      id: "bs-weapon-twinfang",
      name: "Twinfang",
      description: "Omalicha's pistol and blade, finished in black iron.",
      family: "weapon",
      rarity: "rare",
      image: "",
      imageAlt: "Omalicha holding the Twinfang pistol and blade",
      access: "sale",
      price: { amount: 3000, currency: "NGN" },
      supply: null,
      saleEndsAt: null,
      ...live(3),
      sold: 9,
      createdDaysAgo: 8,
    }),
    item({
      id: "bs-character-the-beast",
      name: "The Beast",
      description: "The Beast, as a character in the arena. Like every exclusive, it gives no advantage in a match.",
      family: "character",
      rarity: "epic",
      image: "",
      imageAlt: "The Beast",
      access: "sale",
      price: { amount: 7500, currency: "NGN" },
      supply: null,
      saleEndsAt: null,
      ...live(3),
      sold: 14,
      createdDaysAgo: 8,
    }),
    item({
      id: "bs-character-ogbunabali",
      name: "Ogbun'abali",
      description: "The god of the night, as a character in the arena. A limited edition of 250, with no advantage in a match.",
      family: "character",
      rarity: "legendary",
      image: "/assets/characters/ogbunabali.png",
      imageAlt: "Ogbun'abali",
      access: "sale",
      price: { amount: 12000, currency: "NGN" },
      supply: { total: 250, remaining: 0 },
      saleEndsAt: null,
      ...live(3),
      sold: 250,
      createdDaysAgo: 9,
    }),
    item({
      id: "bs-skin-soma-first-light",
      name: "Soma: First Light",
      description: "Free to every player who links a Hedera wallet.",
      family: "skin",
      rarity: "common",
      image: "/assets/characters/soma-3d.png",
      imageAlt: "Soma in the First Light skin",
      access: "free",
      price: null,
      supply: null,
      saleEndsAt: null,
      ...live(3),
      sold: 212,
      createdDaysAgo: 10,
    }),
    item({
      id: "bs-weapon-founders-staff",
      name: "Founder's Staff",
      description: "Nze's staff from the founding of the shrine. Free to every player who links a Hedera wallet.",
      family: "weapon",
      rarity: "common",
      image: "/assets/characters/Nze-Ugwuoke.png",
      imageAlt: "Nze Ugwuoke holding the Founder's Staff",
      access: "free",
      price: null,
      supply: null,
      saleEndsAt: null,
      ...live(3),
      sold: 187,
      createdDaysAgo: 10,
    }),
    // Admin-only states: a draft, a scheduled sale, one taken off the store, a claim window that closed.
    item({
      id: "bs-skin-kaira-bloodmoon",
      name: "Kaira: Bloodmoon",
      description: "Kaira under the blood moon, for the Christmas hunt. A limited edition of 100.",
      family: "skin",
      rarity: "legendary",
      image: "/assets/characters/kaira-crop.png",
      imageAlt: "Kaira in the Bloodmoon skin",
      access: "sale",
      price: { amount: 15000, currency: "NGN" },
      supply: { total: 100, remaining: 100 },
      saleEndsAt: null,
      published: false,
      publishedAt: null,
      saleStartsAt: null,
      sold: 0,
      createdDaysAgo: 1,
    }),
    item({
      id: "bs-skin-nze-masquerade",
      name: "Nze Ugwuoke: Masquerade",
      description: "The elder in his masquerade dress, for the end-of-year festival.",
      family: "skin",
      rarity: "epic",
      image: "/assets/characters/Nze-Ugwuoke.png",
      imageAlt: "Nze Ugwuoke in the Masquerade skin",
      access: "sale",
      price: { amount: 25, currency: "USD" },
      supply: null,
      saleEndsAt: ahead(19),
      published: true,
      publishedAt: ago(0, 6),
      saleStartsAt: ahead(5),
      sold: 0,
      createdDaysAgo: 2,
    }),
    item({
      id: "bs-skin-soma-harmattan",
      name: "Soma: Harmattan Wrap",
      description: "Soma, wrapped against the dry season wind.",
      family: "skin",
      rarity: "rare",
      image: "/assets/characters/soma-3d.png",
      imageAlt: "Soma in the Harmattan Wrap skin",
      access: "sale",
      price: { amount: 3000, currency: "NGN" },
      supply: null,
      saleEndsAt: null,
      published: false,
      publishedAt: ago(3),
      saleStartsAt: null,
      sold: 4,
      createdDaysAgo: 6,
    }),
    item({
      id: "bs-character-ogbunabali-testnet",
      name: "Ogbun'abali: Testnet Founder",
      description: "For the players who linked a wallet in the first days of testnet. The claim window has closed.",
      family: "character",
      rarity: "rare",
      image: "/assets/characters/ogbunabali.png",
      imageAlt: "Ogbun'abali, the Testnet Founder edition",
      access: "free",
      price: null,
      supply: { total: 300, remaining: 61 },
      saleEndsAt: ago(1),
      published: true,
      publishedAt: ago(3),
      saleStartsAt: null,
      sold: 239,
      createdDaysAgo: 4,
    }),
  ];

  /* ---- Winners and their wallets ---- */

  const player = (id: string, name: string, handle: string) => ({ id: `plr_${id}`, name, handle });
  const P = {
    chiamaka: player("chiamaka", "Chiamaka Eze", "chiamaka_e"),
    ifeanyi: player("ifeanyi", "Ifeanyi Okonkwo", "ify_okk"),
    kelechi: player("kelechi", "Kelechi Obi", "kcobi"),
    tunde: player("tunde", "Tunde Bakare", "tundeB"),
    aisha: player("aisha", "Aisha Bello", "aishab"),
    emeka: player("emeka", "Emeka Nwosu", "emekan"),
    zainab: player("zainab", "Zainab Musa", "zee_musa"),
    funmi: player("funmi", "Funmilayo Adeyemi", "funmi_a"),
    chidi: player("chidi", "Chidi Okafor", "chidiok"),
    bisola: player("bisola", "Bisola Ogunleye", "bisola"),
  };
  const wallet = (accountId: string, door: LinkedWallet["door"], provider: string, days: number): LinkedWallet => ({
    accountId,
    door,
    provider,
    linkedAt: ago(days),
  });
  const W = {
    chiamaka: wallet("0.0.5290114", "embedded", "Google", 3),
    ifeanyi: wallet("0.0.4821937", "existing", "HashPack", 3),
    kelechi: wallet("0.0.4733021", "existing", "HashPack", 2),
    tunde: wallet("0.0.5302276", "embedded", "Email", 3),
    emeka: wallet("0.0.5311840", "embedded", "Google", 2),
    zainab: wallet("0.0.5287765", "embedded", "Email", 3),
    funmi: wallet("0.0.4950132", "existing", "HashPack", 3),
    chidi: wallet("0.0.5299081", "embedded", "Google", 2),
    bisola: wallet("0.0.5318002", "existing", "HashPack", 1),
  };

  const T = {
    eastern: { id: "trn_eastern_province_cup", name: "Eastern Province Cup" },
    lagos: { id: "trn_lagos_weekly_clash", name: "Lagos Weekly Clash" },
    abuja: { id: "trn_abuja_open", name: "Abuja Open" },
  };

  const payout = (p: Omit<PrizePayout, "txId" | "updatedAt"> & { txId?: string | null; updatedAt?: string }): PrizePayout => ({
    txId: null,
    updatedAt: p.createdAt,
    ...p,
  });
  const sentAbuja = at(6, 3);
  const payouts: PrizePayout[] = [
    payout({
      id: "prz-eastern-cup-1",
      tournament: T.eastern,
      place: 1,
      hbar: 3000,
      player: P.ifeanyi,
      wallet: W.ifeanyi,
      identity: {
        state: "submitted",
        details: { fullName: "Ifeanyi Chukwuma Okonkwo", dateOfBirth: "1998-04-12", idType: "nin", idLast4: "4417" },
        submittedAt: ago(0, 5),
      },
      status: "awaitingApproval",
      createdAt: ago(1, 2),
      updatedAt: ago(0, 5),
    }),
    payout({
      id: "prz-eastern-cup-2",
      tournament: T.eastern,
      place: 2,
      hbar: 1500,
      player: P.chiamaka,
      wallet: W.chiamaka,
      identity: { state: "none" },
      status: "awaitingApproval",
      createdAt: ago(1, 2),
    }),
    payout({
      id: "prz-eastern-cup-3",
      tournament: T.eastern,
      place: 3,
      hbar: 800,
      player: P.kelechi,
      wallet: W.kelechi,
      identity: { state: "none" },
      status: "awaitingApproval",
      createdAt: ago(1, 2),
    }),
    payout({
      id: "prz-lagos-weekly-1",
      tournament: T.lagos,
      place: 1,
      hbar: 1200,
      player: P.tunde,
      wallet: W.tunde,
      identity: {
        state: "verified",
        details: { fullName: "Babatunde Olumide Bakare", dateOfBirth: "2001-09-30", idType: "drivers", idLast4: "0832" },
        submittedAt: ago(0, 20),
        reviewedBy: "Sophia Ahuoyiza",
        reviewedAt: ago(0, 18),
      },
      status: "awaitingApproval",
      createdAt: ago(2, 4),
      updatedAt: ago(0, 18),
    }),
    payout({
      id: "prz-lagos-weekly-2",
      tournament: T.lagos,
      place: 2,
      hbar: 600,
      player: P.aisha,
      wallet: null,
      identity: { state: "none" },
      status: "awaitingApproval",
      createdAt: ago(2, 4),
    }),
    payout({
      id: "prz-lagos-weekly-3",
      tournament: T.lagos,
      place: 3,
      hbar: 400,
      player: P.emeka,
      wallet: W.emeka,
      identity: { state: "none" },
      status: "held",
      hold: { reason: "His semi-final opponent reported a disconnect. Waiting for the match review.", by: "Tobi Adeleke", at: ago(1, 20) },
      createdAt: ago(2, 4),
      updatedAt: ago(1, 20),
    }),
    payout({
      id: "prz-lagos-weekly-5",
      tournament: T.lagos,
      place: 5,
      hbar: 200,
      player: P.chiamaka,
      wallet: W.chiamaka,
      identity: { state: "none" },
      status: "awaitingApproval",
      createdAt: ago(2, 4),
    }),
    payout({
      id: "prz-abuja-open-1",
      tournament: T.abuja,
      place: 1,
      hbar: 2000,
      player: P.zainab,
      wallet: W.zainab,
      identity: {
        state: "verified",
        details: { fullName: "Zainab Hauwa Musa", dateOfBirth: "1999-01-17", idType: "passport", idLast4: "5521" },
        submittedAt: ago(7, 2),
        reviewedBy: "Sophia Ahuoyiza",
        reviewedAt: ago(7),
      },
      status: "sent",
      approvedBy: "Sophia Ahuoyiza",
      approvedAt: iso(sentAbuja - 60_000),
      txId: tx(MOCK_TREASURY, sentAbuja),
      sentAt: iso(sentAbuja),
      createdAt: ago(8),
      updatedAt: iso(sentAbuja),
    }),
    payout({
      id: "prz-abuja-open-2",
      tournament: T.abuja,
      place: 2,
      hbar: 1250,
      player: P.funmi,
      wallet: W.funmi,
      identity: {
        state: "rejected",
        details: { fullName: "Funmi Adeyemi", dateOfBirth: "2000-06-03", idType: "voters", idLast4: "7790" },
        submittedAt: ago(7, 6),
        reviewedBy: "Sophia Ahuoyiza",
        reviewedAt: ago(7, 1),
        note: "The name on the ID doesn't match the account. Send it again with your full name as it is on your NIN slip.",
      },
      status: "awaitingApproval",
      createdAt: ago(8),
      updatedAt: ago(7, 1),
    }),
    payout({
      id: "prz-abuja-open-3",
      tournament: T.abuja,
      place: 3,
      hbar: 450,
      player: P.chiamaka,
      wallet: W.chiamaka,
      identity: { state: "none" },
      status: "sent",
      approvedBy: "Sophia Ahuoyiza",
      approvedAt: iso(sentAbuja - 30_000),
      txId: tx(MOCK_TREASURY, sentAbuja + 40_000),
      sentAt: iso(sentAbuja + 40_000),
      createdAt: ago(8),
      updatedAt: iso(sentAbuja + 40_000),
    }),
    payout({
      id: "prz-abuja-open-4",
      tournament: T.abuja,
      place: 4,
      hbar: 300,
      player: P.chidi,
      wallet: W.chidi,
      identity: { state: "none" },
      status: "failed",
      approvedBy: "Sophia Ahuoyiza",
      approvedAt: iso(sentAbuja - 20_000),
      failure: "BUSY: the network was busy, 5 attempts",
      createdAt: ago(8),
      updatedAt: iso(sentAbuja + 600_000),
    }),
  ];

  /* ---- Jobs ---- */

  const job = (j: Omit<HederaJob, "status" | "updatedAt"> & { status?: HederaJob["status"]; updatedAt?: string }): HederaJob => ({
    status: "open",
    updatedAt: j.createdAt,
    ...j,
  });
  const paidNightveil = at(0, 3, 40);
  const paidEmber = at(0, 1, 5);
  const paidTwinfang = at(0, 7);
  const paidHoodie = at(1, 2);
  const jobs: HederaJob[] = [
    job({
      id: "job-mint-ho-20931",
      kind: "mint",
      problem: "mintFailed",
      via: "purchase",
      item: "Kaira: Nightveil",
      reference: "HO-20931",
      idempotencyKey: "order:HO-20931:mint",
      player: P.tunde,
      wallet: W.tunde.accountId,
      hbar: 34.62,
      paidHbar: 34.62,
      txId: tx(W.tunde.accountId, paidNightveil),
      attempts: 5,
      lastError: "TRANSACTION_EXPIRED: the mint wasn't confirmed in time, 5 attempts",
      createdAt: iso(paidNightveil + 120_000),
      updatedAt: ago(0, 2, 50),
    }),
    job({
      id: "job-mint-clm-7781",
      kind: "mint",
      problem: "mintFailed",
      via: "claim",
      item: "Soma: First Light",
      reference: "CLM-7781",
      idempotencyKey: "claim:CLM-7781",
      player: P.ifeanyi,
      wallet: W.ifeanyi.accountId,
      hbar: null,
      txId: null,
      attempts: 3,
      lastError: "TOKEN_NOT_ASSOCIATED_TO_ACCOUNT: the wallet hasn't associated the Skins collection",
      createdAt: ago(0, 9),
      updatedAt: ago(0, 8, 30),
    }),
    job({
      id: "job-mint-clm-7790",
      kind: "mint",
      problem: "mintFailed",
      via: "claim",
      item: "Founder's Staff",
      reference: "CLM-7790",
      idempotencyKey: "claim:CLM-7790",
      player: P.zainab,
      wallet: W.zainab.accountId,
      hbar: null,
      txId: null,
      attempts: 5,
      lastError: "BUSY: the network was busy, 5 attempts",
      createdAt: ago(0, 11),
      updatedAt: ago(0, 10),
    }),
    job({
      id: "job-pay-ho-20944",
      kind: "payment",
      problem: "paymentUnconfirmed",
      item: "Soma: Ember Robes",
      reference: "HO-20944",
      idempotencyKey: "order:HO-20944",
      player: P.bisola,
      wallet: W.bisola.accountId,
      hbar: 17.31,
      paidHbar: 17.31,
      txId: tx(W.bisola.accountId, paidEmber),
      attempts: 0,
      lastError: "The gateway hasn't confirmed it after 40 minutes. The Mirror Node shows the payment with the order's memo.",
      createdAt: iso(paidEmber + 40 * 60_000),
    }),
    job({
      id: "job-pay-ho-20950",
      kind: "payment",
      problem: "underpaid",
      item: "Twinfang",
      reference: "HO-20950",
      idempotencyKey: "order:HO-20950",
      player: P.kelechi,
      wallet: W.kelechi.accountId,
      hbar: 11.54,
      paidHbar: 10,
      txId: tx(W.kelechi.accountId, paidTwinfang),
      attempts: 0,
      lastError: "10 HBAR arrived against a quote of 11.54 HBAR. Nothing was minted.",
      createdAt: iso(paidTwinfang + 60_000),
    }),
    job({
      id: "job-pay-bs-1042",
      kind: "payment",
      problem: "paidAfterExpiry",
      item: "Order BS-1042: Goondu Hoodie",
      reference: "BS-1042",
      idempotencyKey: "order:BS-1042",
      player: P.funmi,
      wallet: W.funmi.accountId,
      hbar: 96.15,
      paidHbar: 96.15,
      txId: tx(W.funmi.accountId, paidHoodie),
      attempts: 0,
      lastError: "Paid 3 minutes after the quote expired, so the order wasn't placed.",
      createdAt: iso(paidHoodie + 60_000),
    }),
    job({
      id: "job-payout-prz-abuja-open-4",
      kind: "payout",
      problem: "payoutFailed",
      item: "Abuja Open, 4th place",
      reference: "prz-abuja-open-4",
      idempotencyKey: "payout:prz-abuja-open-4",
      player: P.chidi,
      wallet: W.chidi.accountId,
      hbar: 300,
      txId: null,
      attempts: 5,
      lastError: "BUSY: the network was busy, 5 attempts",
      createdAt: iso(sentAbuja + 600_000),
    }),
    job({
      id: "job-mint-clm-7702",
      kind: "mint",
      problem: "mintFailed",
      via: "claim",
      item: "Soma: First Light",
      reference: "CLM-7702",
      idempotencyKey: "claim:CLM-7702",
      player: P.emeka,
      wallet: W.emeka.accountId,
      hbar: null,
      txId: null,
      attempts: 6,
      lastError: "BUSY: the network was busy, 5 attempts",
      status: "resolved",
      resolution: { action: "retry", by: "Sophia Ahuoyiza", at: ago(1, 3), txId: tx(MOCK_TREASURY, at(1, 3)) },
      createdAt: ago(1, 6),
      updatedAt: ago(1, 3),
    }),
  ];

  /* ---- The treasury's movements ---- */

  const move = (kind: TreasuryMovement["kind"], hbar: number, label: string, ms: number, payer = MOCK_TREASURY): TreasuryMovement => ({
    id: `mv-${++n}`,
    kind,
    hbar,
    label,
    at: iso(ms),
    txId: kind === "fees" ? null : tx(payer, ms),
  });
  const sale = (name: string, order: string, hbar: number, ms: number, from: string) => move("sale", hbar, `Sale: ${name} (${order})`, ms, from);
  const movements: TreasuryMovement[] = [
    move("topUp", 14_760, "Funded from Goondu's wallet for testnet", at(35), "0.0.5100001"),
    move("payout", -50, "Internal test payout", at(28)),
    move("fees", -0.84, "Network fees: 12 test mints", at(27)),
    sale("Soma: Ember Robes", "HO-20871", 17.31, at(3, 1), W.chiamaka.accountId),
    sale("Kaira: Nightveil", "HO-20874", 34.62, at(3, 0, 30), W.ifeanyi.accountId),
    sale("Soma: Ember Robes", "HO-20880", 17.31, at(2, 20), W.zainab.accountId),
    sale("Nze Ugwuoke: Harvest Garb", "HO-20886", 13.46, at(2, 9), W.funmi.accountId),
    sale("The Beast", "HO-20893", 28.85, at(2, 4), W.kelechi.accountId),
    sale("Kaira: Nightveil", "HO-20902", 34.62, at(2, 2), W.emeka.accountId),
    move("refund", -34.62, "Refund: order HO-20902, the mint failed", at(2)),
    sale("Soma: Ember Robes", "HO-20915", 17.31, at(1, 6), W.bisola.accountId),
    sale("Nze Ugwuoke: Harvest Garb", "HO-20922", 13.46, at(1, 1), W.chidi.accountId),
    sale("Kaira: Nightveil", "HO-20931", 34.62, paidNightveil, W.tunde.accountId),
    sale("Twinfang (10 of 11.54 HBAR)", "HO-20950", 10, paidTwinfang, W.kelechi.accountId),
    sale("Goondu Hoodie, after its quote expired", "BS-1042", 96.15, paidHoodie, W.funmi.accountId),
    sale("Soma: Ember Robes", "HO-20944", 17.31, paidEmber, W.bisola.accountId),
    move("payout", -2000, "Prize: Abuja Open, 1st place, @zee_musa", sentAbuja),
    move("payout", -450, "Prize: Abuja Open, 3rd place, @chiamaka_e", sentAbuja + 40_000),
    move("fees", -1.36, "Network fees: 41 mints, 6 transfers", at(1)),
  ];

  return {
    items,
    payouts,
    jobs,
    treasury: { network: MOCK_NETWORK, accountId: MOCK_TREASURY, alertBelow: 10_000, identityThreshold: 1_000, hbarDiscountPct: 2.5, updatedAt: ago(10) },
    movements,
    prizes: {},
    seq: n,
  };
}
