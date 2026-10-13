import type { Champion, Player, PlayerStatus, RegionId } from "@/types";
import { createRandom, daysAgo } from "./random";

/**
 * Players. The first handles are the ones the public site's bracket and
 * leaderboard already use (somamain, chihunter, ...), so the two apps agree.
 */

const PEOPLE: readonly [handle: string, name: string][] = [
  ["somamain", "Chidubem Okafor"],
  ["chihunter", "Chiamaka Eze"],
  ["kairaking", "Tunde Adeyemi"],
  ["spiritwolf", "Emeka Nwosu"],
  ["nzeforce", "Ifeanyi Nze"],
  ["bashir_ad", "Bashir Adamu"],
  ["ngozi_ok", "Ngozi Okonkwo"],
  ["tamunob", "Tamuno Briggs"],
  ["kwame_m", "Kwame Mensah"],
  ["amaraeze", "Amara Eze"],
  ["obi_flame", "Obinna Uche"],
  ["lagoslegend", "Seun Balogun"],
  ["ada_ascend", "Adaeze Obi"],
  ["zik_blade", "Nnamdi Azikiwe"],
  ["efe_storm", "Efe Omoregie"],
  ["yemi_x", "Oluwayemi Afolabi"],
  ["nkem_rise", "Nkemdirim Ibe"],
  ["abuja_ace", "Musa Ibrahim"],
  ["kofi_arena", "Kofi Asante"],
  ["ebuka_chi", "Ebuka Onyema"],
  ["tobi_trial", "Tobiloba Ojo"],
  ["ugo_spear", "Ugochukwu Mbah"],
  ["halima_k", "Halima Kabir"],
  ["dayo_dark", "Dayo Ogunleye"],
  ["ama_ghost", "Ama Owusu"],
  ["kene_god", "Kenechukwu Ani"],
  ["fola_fury", "Folasade Coker"],
  ["ikenna_x", "Ikenna Obi"],
  ["zara_moon", "Zainab Yusuf"],
  ["chuks_one", "Chukwuemeka Igwe"],
];

const REGIONS: readonly (readonly [RegionId, number])[] = [
  ["lagos", 9],
  ["southEast", 7],
  ["abuja", 4],
  ["rivers", 3],
  ["ghana", 2],
];

const CHAMPIONS: readonly Champion[] = ["soma", "kaira", "ogbunabali"];

const rand = createRandom(7);

export const PLAYERS: Player[] = PEOPLE.map(([handle, name], i) => {
  const joined = rand.int(20, 240);
  const status: PlayerStatus =
    i === 12 ? "suspended" : i === 21 || i === 27 ? "unverified" : "active";
  const region = handle.startsWith("kofi") || handle.startsWith("kwame") || handle.startsWith("ama_")
    ? "ghana"
    : rand.weighted(REGIONS);

  return {
    id: `plr_${String(i + 1).padStart(4, "0")}`,
    handle,
    name,
    email: `${name.split(" ")[0].toLowerCase()}.${name.split(" ")[1].toLowerCase()}@${rand.pick(["gmail.com", "yahoo.com", "outlook.com"])}`,
    region,
    level: Math.max(3, 48 - i + rand.int(-4, 4)),
    winRate: Math.max(22, 78 - i * 1.4 + rand.int(-5, 5)),
    gamePoints: Math.max(400, 12_000 - i * 360 + rand.int(-300, 300)),
    main: CHAMPIONS[i % 3],
    status,
    joinedAt: daysAgo(joined, rand.int(8, 22)),
    lastActiveAt: daysAgo(rand.int(0, Math.min(joined, 14)), rand.int(8, 23)),
    tournamentsPlayed: Math.max(0, 9 - Math.floor(i / 4) + rand.int(-1, 1)),
    totalSpend: rand.int(0, 12) * 10_000,
  };
});
