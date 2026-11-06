import { effectiveness, type PType } from "@/data/chart.ts";
import { combatProfile, getMove, getSpecies, type MoveData } from "@/data/dex.ts";
import { ballMod, type ItemId } from "@/data/items.ts";
import { withJosa } from "@/lib/korean.ts";
import { createMon, gainExp, maxHp, type Mon, type StatusName } from "./mon.ts";
import { battleStats, calcDamage, stageMod, type StageName, type StatName } from "./stats.ts";

export type Side = "player" | "foe";
export type WeatherName = "sun" | "rain" | "sand" | "hail";
export type Sfx = "hit" | "super" | "weak" | "faint" | "catch" | "level" | "heal" | "status";

export type Stages = Record<StageName, number>;

export type Volatile = {
  stages: Stages;
  protect: number;
  guarding: string | null;
  flinch: boolean;
  recharge: boolean;
  confused: number;
  seeded: boolean;
  rooted: boolean;
  infatuated: number;
  form: "shield" | "blade" | null;
  lastMove: string | null;
  locked: { move: string; turns: number } | null;
  turns: number;
  zArmed: boolean;
};

export type SideCond = {
  reflect: number;
  light: number;
  tailwind: number;
  rocks: boolean;
  spikes: number;
};

export type BattleResult = "win" | "lose" | "flee" | "catch";

export type Patch = {
  party: Mon[];
  foeTeam: Mon[];
  active: number;
  foeActive: number;
  pVol: Volatile;
  fVol: Volatile;
  weather: WeatherName | null;
  weatherTurns: number;
  pSide: SideCond;
  fSide: SideCond;
  caught: Mon | null;
  result: BattleResult | null;
  foeNeedsSend: boolean;
  learnQueue: { uid: string; moveId: string }[];
  money: number;
};

export type BattleEvent = { text: string; patch: Patch; sfx?: Sfx };

export type BattleCommand =
  | { kind: "fight"; index: number; mega?: string | null; z?: boolean }
  | { kind: "switch"; index: number }
  | { kind: "item"; item: ItemId; target: number }
  | { kind: "run" };

export type Rng = () => number;

export type Battle = {
  kind: "wild" | "trainer";
  trainerId: string | null;
  trainerName: string | null;
  legendary: boolean;
  softLoss: boolean;
  badge: string | null;
  gift: Partial<Record<ItemId, number>> | null;
  moneyReward: number;
  party: Mon[];
  active: number;
  foeTeam: Mon[];
  foeActive: number;
  pVol: Volatile;
  fVol: Volatile;
  weather: WeatherName | null;
  weatherTurns: number;
  pSide: SideCond;
  fSide: SideCond;
  queue: BattleEvent[];
  cursor: number;
  phase: "playback" | "action" | "switch" | "done";
  after: "action" | "switch" | "done";
  result: BattleResult | null;
  caught: Mon | null;
  foeNeedsSend: boolean;
  learnQueue: { uid: string; moveId: string }[];
  fleeAttempts: number;
  turn: number;
  money: number;
  megaUsed: boolean;
  zUsed: boolean;
};

const STAT_KO: Record<StageName, string> = {
  atk: "공격",
  def: "방어",
  spa: "특수공격",
  spd: "특수방어",
  spe: "스피드",
  acc: "명중률",
  eva: "회피율",
};

const STAT_API: Record<string, StageName> = {
  attack: "atk",
  defense: "def",
  "special-attack": "spa",
  "special-defense": "spd",
  speed: "spe",
  accuracy: "acc",
  evasion: "eva",
};

const NON_CONTACT = new Set([
  "earthquake", "bulldoze", "magnitude", "rock-slide", "stone-edge", "rock-tomb", "rollout",
  "smack-down", "ancient-power", "petal-blizzard", "rock-blast", "sand-tomb",
]);
const PULSE = new Set(["aura-sphere", "dark-pulse", "dragon-pulse", "water-pulse", "origin-pulse", "heal-pulse", "terrain-pulse"]);
const BITE = new Set(["bite", "crunch", "fire-fang", "ice-fang", "thunder-fang", "poison-fang", "psychic-fangs", "hyper-fang"]);
const PUNCH = new Set(["thunder-punch", "fire-punch", "ice-punch", "mach-punch", "drain-punch", "mega-punch", "dynamic-punch", "hammer-arm", "power-up-punch", "comet-punch", "dizzy-punch"]);
const BALL = new Set(["aura-sphere", "shadow-ball", "energy-ball", "sludge-bomb", "seed-bomb", "focus-blast", "weather-ball", "electro-ball", "rock-blast", "mud-bomb", "octazooka"]);
const PROTECT = new Set(["protect", "detect", "kings-shield", "spiky-shield", "baneful-bunker"]);
const RECHARGE = new Set(["hyper-beam", "giga-impact", "blast-burn", "frenzy-plant", "hydro-cannon", "prismatic-laser", "roar-of-time"]);
const LOCK = new Set(["outrage", "thrash", "petal-dance"]);
const PHAZE = new Set(["roar", "whirlwind", "dragon-tail", "circle-throw"]);
const SETUP = new Set(["swords-dance", "calm-mind", "dragon-dance", "nasty-plot", "agility", "iron-defense", "bulk-up", "work-up", "coil", "quiver-dance", "shell-smash", "hone-claws"]);

export function emptyStages(): Stages {
  return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };
}

export function freshVol(speciesId: number): Volatile {
  return {
    stages: emptyStages(),
    protect: 0,
    guarding: null,
    flinch: false,
    recharge: false,
    confused: 0,
    seeded: false,
    rooted: false,
    infatuated: 0,
    form: speciesId === 681 ? "shield" : null,
    lastMove: null,
    locked: null,
    turns: 0,
    zArmed: false,
  };
}

function emptySide(): SideCond {
  return { reflect: 0, light: 0, tailwind: 0, rocks: false, spikes: 0 };
}

function firstHealthy(team: Mon[]): number {
  const index = team.findIndex((mon) => mon.hp > 0);
  return index < 0 ? 0 : index;
}

function baseBattle(party: Mon[], foeTeam: Mon[], kind: Battle["kind"]): Battle {
  const active = firstHealthy(party);
  const foeActive = firstHealthy(foeTeam);
  return {
    kind,
    trainerId: null,
    trainerName: null,
    legendary: false,
    softLoss: false,
    badge: null,
    gift: null,
    moneyReward: 0,
    party: party.map((mon) => ({ ...mon, moves: mon.moves.map((move) => ({ ...move })) })),
    active,
    foeTeam: foeTeam.map((mon) => ({ ...mon, moves: mon.moves.map((move) => ({ ...move })) })),
    foeActive,
    pVol: freshVol(party[active].speciesId),
    fVol: freshVol(foeTeam[foeActive].speciesId),
    weather: null,
    weatherTurns: 0,
    pSide: emptySide(),
    fSide: emptySide(),
    queue: [],
    cursor: 0,
    phase: "playback",
    after: "action",
    result: null,
    caught: null,
    foeNeedsSend: false,
    learnQueue: [],
    fleeAttempts: 0,
    turn: 1,
    money: 0,
    megaUsed: false,
    zUsed: false,
  };
}

function snapshot(sim: Battle): Patch {
  return {
    party: structuredClone(sim.party),
    foeTeam: structuredClone(sim.foeTeam),
    active: sim.active,
    foeActive: sim.foeActive,
    pVol: structuredClone(sim.pVol),
    fVol: structuredClone(sim.fVol),
    weather: sim.weather,
    weatherTurns: sim.weatherTurns,
    pSide: structuredClone(sim.pSide),
    fSide: structuredClone(sim.fSide),
    caught: sim.caught ? structuredClone(sim.caught) : null,
    result: sim.result,
    foeNeedsSend: sim.foeNeedsSend,
    learnQueue: structuredClone(sim.learnQueue),
    money: sim.money,
  };
}

function applyEvent(battle: Battle, event: BattleEvent): Battle {
  return { ...battle, ...event.patch, queue: battle.queue, cursor: battle.cursor, phase: battle.phase, after: battle.after };
}

export function advance(battle: Battle): Battle {
  if (battle.phase !== "playback") return battle;
  if (battle.cursor >= battle.queue.length - 1) return { ...battle, phase: battle.after };
  const cursor = battle.cursor + 1;
  const event = battle.queue[cursor];
  return { ...applyEvent({ ...battle, cursor }, event), cursor, phase: "playback" };
}

function openQueue(sim: Battle, events: BattleEvent[], after: Battle["after"]): Battle {
  const next: Battle = { ...sim, queue: events, cursor: 0, phase: "playback", after };
  if (events.length === 0) return { ...next, phase: after };
  return { ...applyEvent(next, events[0]), queue: events, cursor: 0, phase: "playback", after };
}

export function startWildBattle(party: Mon[], foe: Mon, legendary = false): Battle {
  const sim = baseBattle(party, [foe], "wild");
  sim.legendary = legendary;
  const name = getSpecies(foe.speciesId).name;
  const events: BattleEvent[] = [];
  const push = (text: string, sfx?: Sfx) => events.push({ text, patch: snapshot(sim), sfx });
  push(legendary ? `${withJosa(name, "이/가")} 모습을 드러냈다!` : `야생의 ${withJosa(name, "이/가")} 나타났다!`);
  return openQueue(sim, events, "action");
}

export function startTrainerBattle(
  party: Mon[],
  foeTeam: Mon[],
  meta: {
    trainerId: string;
    trainerName: string;
    reward: number;
    badge?: string | null;
    gift?: Partial<Record<ItemId, number>> | null;
    softLoss?: boolean;
  },
): Battle {
  const sim = baseBattle(party, foeTeam, "trainer");
  sim.trainerId = meta.trainerId;
  sim.trainerName = meta.trainerName;
  sim.moneyReward = meta.reward;
  sim.badge = meta.badge ?? null;
  sim.gift = meta.gift ?? null;
  sim.softLoss = meta.softLoss ?? false;
  const lead = getSpecies(foeTeam[sim.foeActive].speciesId).name;
  const events: BattleEvent[] = [];
  const push = (text: string, sfx?: Sfx) => events.push({ text, patch: snapshot(sim), sfx });
  push(`${withJosa(meta.trainerName, "이/가")} 승부를 걸어 왔다!`);
  push(`${meta.trainerName}의 ${withJosa(lead, "이/가")} 나왔다!`);
  return openQueue(sim, events, "action");
}

function monOf(sim: Battle, side: Side): Mon {
  return side === "player" ? sim.party[sim.active] : sim.foeTeam[sim.foeActive];
}

function volOf(sim: Battle, side: Side): Volatile {
  return side === "player" ? sim.pVol : sim.fVol;
}

function sideOf(sim: Battle, side: Side): SideCond {
  return side === "player" ? sim.pSide : sim.fSide;
}

function ability(mon: Mon): string {
  return combatProfile(mon).ability;
}

function nameOf(mon: Mon): string {
  return combatProfile(mon).name;
}

function typesOf(mon: Mon): PType[] {
  return combatProfile(mon).types;
}

function rawStats(mon: Mon, form: Volatile["form"]) {
  return battleStats(combatProfile(mon).stats, mon.level, mon.iv, form);
}

function zPower(power: number): number {
  if (power <= 55) return 100;
  if (power <= 65) return 120;
  if (power <= 75) return 140;
  if (power <= 85) return 160;
  if (power <= 95) return 175;
  if (power <= 100) return 180;
  if (power <= 110) return 185;
  if (power <= 120) return 190;
  if (power <= 130) return 195;
  return 200;
}

function megavolve(sim: Battle, side: Side, megaId: string, push: Push) {
  const mon = monOf(sim, side);
  if (mon.aspect || (side === "player" && sim.megaUsed)) return;
  const known = getSpecies(mon.speciesId).forms.find((entry) => entry.id === megaId && entry.kind === "mega");
  if (!known) return;
  const before = maxHp(mon, volOf(sim, side).form);
  mon.aspect = megaId;
  const after = maxHp(mon, volOf(sim, side).form);
  mon.hp = Math.max(1, Math.min(after, mon.hp + (after - before)));
  if (side === "player") sim.megaUsed = true;
  push(`메가진화! ${known.name}!`, "level");
}

function effectiveStat(mon: Mon, vol: Volatile, stat: Exclude<StatName, "hp">): number {
  const base = rawStats(mon, vol.form)[stat];
  const staged = Math.max(1, Math.floor(base * stageMod(vol.stages[stat])));
  if (stat === "def" && ability(mon) === "fur-coat") return staged * 2;
  return staged;
}

function speedOf(sim: Battle, side: Side): number {
  const mon = monOf(sim, side);
  let speed = effectiveStat(mon, volOf(sim, side), "spe");
  if (mon.status === "par") speed = Math.floor(speed * 0.25);
  if (sideOf(sim, side).tailwind > 0) speed *= 2;
  return speed;
}

function isContact(move: MoveData): boolean {
  return move.category === "physical" && !NON_CONTACT.has(move.id);
}

function mapStatus(ailment: string, moveId: string): StatusName | null {
  if (moveId === "toxic") return "tox";
  if (ailment === "burn") return "brn";
  if (ailment === "freeze") return "frz";
  if (ailment === "paralysis") return "par";
  if (ailment === "poison") return "psn";
  if (ailment === "sleep") return "slp";
  return null;
}

function blocksStatus(mon: Mon, status: StatusName): boolean {
  const id = ability(mon);
  const types = typesOf(mon);
  if (status === "brn" && (types.includes("fire") || id === "water-veil")) return true;
  if ((status === "psn" || status === "tox") && (types.includes("poison") || types.includes("steel") || id === "immunity")) return true;
  if (status === "par" && (types.includes("electric") || id === "limber")) return true;
  if (status === "frz" && types.includes("ice")) return true;
  if (status === "slp" && id === "sweet-veil") return true;
  return false;
}

function statBlocks(mon: Mon, stat: StageName, drop: boolean): boolean {
  if (!drop) return false;
  const id = ability(mon);
  const types = typesOf(mon);
  if (id === "clear-body") return true;
  if (id === "big-pecks" && stat === "def") return true;
  if (id === "keen-eye" && stat === "acc") return true;
  if (id === "flower-veil" && types.includes("grass")) return true;
  return false;
}

function shiftStage(vol: Volatile, mon: Mon, stat: StageName, delta: number): { applied: number; text: string } {
  let change = delta;
  if (ability(mon) === "contrary") change = -change;
  const before = vol.stages[stat];
  const after = Math.max(-6, Math.min(6, before + change));
  vol.stages[stat] = after;
  const applied = after - before;
  const label = withJosa(STAT_KO[stat], "이/가");
  if (applied === 0) return { applied, text: change > 0 ? `${label} 더 올라가지 않는다!` : `${label} 더 떨어지지 않는다!` };
  const big = Math.abs(applied) >= 2 ? "크게 " : "";
  return { applied, text: applied > 0 ? `${label} ${big}올랐다!` : `${label} ${big}떨어졌다!` };
}

function movePower(move: MoveData, user: Mon, foe: Mon, weather: WeatherName | null): { power: number; type: PType } {
  let power = move.power;
  let type = move.type;
  const id = ability(user);
  if ((id === "pixilate" || id === "refrigerate") && type === "normal" && move.category !== "status") {
    type = id === "pixilate" ? "fairy" : "ice";
    power = Math.floor(power * 1.2);
  }
  if (move.id === "weather-ball" && weather) {
    power = 100;
    type = weather === "sun" ? "fire" : weather === "rain" ? "water" : weather === "sand" ? "rock" : "ice";
  }
  if (move.id === "acrobatics") power = 110;
  if (move.id === "facade" && user.status) power *= 2;
  if (move.id === "flail" || move.id === "reversal") {
    const ratio = user.hp / maxHp(user);
    power = ratio > 0.7 ? 20 : ratio > 0.35 ? 40 : ratio > 0.2 ? 80 : ratio > 0.1 ? 100 : ratio > 0.04 ? 150 : 200;
  }
  if (move.id === "grass-knot") {
    const kg = getSpecies(foe.speciesId).weight / 10;
    power = kg < 10 ? 20 : kg < 25 ? 40 : kg < 50 ? 60 : kg < 100 ? 80 : kg < 200 ? 100 : 120;
  }
  if (power <= 0 && move.category !== "status" && move.metaCategory !== "ohko") power = 50;
  if (id === "overgrow" && type === "grass" && user.hp * 3 <= maxHp(user)) power = Math.floor(power * 1.5);
  if (id === "blaze" && type === "fire" && user.hp * 3 <= maxHp(user)) power = Math.floor(power * 1.5);
  if (id === "torrent" && type === "water" && user.hp * 3 <= maxHp(user)) power = Math.floor(power * 1.5);
  if (id === "mega-launcher" && PULSE.has(move.id) && power > 0) power = Math.floor(power * 1.5);
  if (id === "strong-jaw" && BITE.has(move.id)) power = Math.floor(power * 1.5);
  if (id === "iron-fist" && PUNCH.has(move.id)) power = Math.floor(power * 1.2);
  if (id === "tough-claws" && isContact(move)) power = Math.floor(power * 1.3);
  return { power, type };
}

function auraFor(sim: Battle, type: PType): number {
  const ids = [sim.party[sim.active], sim.foeTeam[sim.foeActive]]
    .filter((mon) => mon.hp > 0)
    .map((mon) => ability(mon));
  const boosted = (type === "fairy" && ids.includes("fairy-aura")) || (type === "dark" && ids.includes("dark-aura"));
  if (!boosted) return 1;
  return ids.includes("aura-break") ? 0.75 : 4 / 3;
}

function weatherFor(weather: WeatherName | null, type: PType): number {
  if (weather === "sun" && type === "fire") return 1.5;
  if (weather === "sun" && type === "water") return 0.5;
  if (weather === "rain" && type === "water") return 1.5;
  if (weather === "rain" && type === "fire") return 0.5;
  return 1;
}

function hazardDamage(mon: Mon, side: SideCond): number {
  if (mon.hp <= 0) return 0;
  const types = typesOf(mon);
  let damage = 0;
  if (side.rocks) damage += Math.floor((maxHp(mon) * effectiveness("rock", types)) / 8);
  const flying = types.includes("flying") || ability(mon) === "levitate";
  if (side.spikes > 0 && !flying) {
    const denom = side.spikes === 1 ? 8 : side.spikes === 2 ? 6 : 4;
    damage += Math.floor(maxHp(mon) / denom);
  }
  return damage;
}

type Push = (text: string, sfx?: Sfx) => void;

function sendOut(sim: Battle, side: Side, index: number, push: Push, call: boolean) {
  const team = side === "player" ? sim.party : sim.foeTeam;
  const mon = team[index];
  if (side === "player") {
    const previous = sim.party[sim.active];
    if (previous && ability(previous) === "natural-cure" && previous.uid !== mon.uid) {
      previous.status = null;
      previous.sleep = 0;
      previous.toxic = 0;
    }
    sim.active = index;
    sim.pVol = freshVol(mon.speciesId);
  } else {
    sim.foeActive = index;
    sim.fVol = freshVol(mon.speciesId);
    sim.foeNeedsSend = false;
  }
  const who = nameOf(mon);
  if (call) push(side === "player" ? `가랏, ${who}!` : `${withJosa(who, "이/가")} 나왔다!`);
  const chip = hazardDamage(mon, sideOf(sim, side));
  if (chip > 0) {
    mon.hp = Math.max(0, mon.hp - chip);
    push("발밑의 함정에 다쳤다!", "hit");
    if (mon.hp === 0) push(`${withJosa(who, "은/는")} 쓰러졌다!`, "faint");
  }
}

function awardExp(sim: Battle, push: Push) {
  const foe = sim.foeTeam[sim.foeActive];
  const species = getSpecies(foe.speciesId);
  // Generous pacing: bond badges come from Zygarde levels, so street battles need to feed them.
  let exp = Math.max(1, Math.floor((species.baseExp * foe.level) / 4));
  if (sim.kind === "trainer") exp = Math.floor(exp * 1.5);
  if (sim.legendary) exp = Math.floor(exp * 1.35);
  exp = Math.max(1, Math.floor(exp * 2.4));
  const activeUid = sim.party[sim.active]?.uid;
  const notes: string[] = [];
  let shared = false;
  sim.party = sim.party.map((mon) => {
    if (mon.hp <= 0) return mon;
    const amount = mon.speciesId === 718 ? Math.floor(exp * 1.35) : exp;
    const gained = gainExp(mon, Math.max(1, amount));
    for (const moveId of gained.queued) sim.learnQueue.push({ uid: gained.mon.uid, moveId });
    if (mon.uid === activeUid) notes.push(...gained.notes);
    else {
      shared = true;
      notes.push(...gained.notes.filter((note) => note.includes("레벨이") || note.includes("배웠") || note.includes("싶어")));
    }
    return gained.mon;
  });
  if (shared) notes.splice(Math.min(1, notes.length), 0, "쓰러지지 않은 동료도 경험치를 나누어 받았다.");
  for (const note of notes) push(note, note.includes("레벨이") ? "level" : undefined);
}

function checkFaints(sim: Battle, push: Push, fromAttack: boolean): "stop" | "go" {
  const player = sim.party[sim.active];
  const foe = sim.foeTeam[sim.foeActive];
  const playerDead = player.hp <= 0;
  const foeDead = foe.hp <= 0;
  if (foeDead && fromAttack) awardExp(sim, push);
  const playerAlive = sim.party.some((mon) => mon.hp > 0);
  const foeAlive = sim.foeTeam.some((mon) => mon.hp > 0);
  if (!playerAlive) {
    sim.result = "lose";
    sim.after = "done";
    push("쓸 수 있는 포켓몬이 없다!");
    return "stop";
  }
  if (!foeAlive) {
    sim.result = sim.caught ? "catch" : "win";
    sim.after = "done";
    if (sim.kind === "trainer") push(`${sim.trainerName}에게 이겼다!`);
    else if (!sim.caught) push(`${withJosa(nameOf(foe), "을/를")} 쓰러뜨렸다!`);
    if (sim.moneyReward && sim.kind === "trainer") {
      sim.money += sim.moneyReward;
      push(`상금으로 ${sim.moneyReward.toLocaleString("ko-KR")}원을 받았다!`);
    }
    return "stop";
  }
  if (playerDead) {
    sim.after = "switch";
    sim.foeNeedsSend = foeDead;
    push("다음 포켓몬을 골라라!");
    return "stop";
  }
  if (foeDead) {
    const index = sim.foeTeam.findIndex((mon) => mon.hp > 0);
    if (sim.trainerName) push(`${withJosa(sim.trainerName, "은/는")} 다음 포켓몬을 내보냈다!`);
    sendOut(sim, "foe", index, push, true);
    return "stop";
  }
  return "go";
}

function applyStats(sim: Battle, userSide: Side, move: MoveData, push: Push, rng: Rng, self: boolean) {
  if (move.statChanges.length === 0) return;
  const foeSide: Side = userSide === "player" ? "foe" : "player";
  let target: Side = foeSide;
  if (move.metaCategory === "damage-raise") target = userSide;
  else if (move.metaCategory === "damage-lower" || move.metaCategory === "swagger") target = foeSide;
  else if (move.target === "user" || move.target === "users-field" || move.target === "user-and-allies") target = userSide;
  else if (move.statChanges.every((change) => change.change < 0)) target = foeSide;
  else if (move.statChanges.every((change) => change.change > 0)) target = userSide;
  if (self !== (target === userSide)) return;
  const chance = move.category === "status" || move.statChance === 0 ? 1 : move.statChance / 100;
  if (move.category !== "status" && move.statChance === 0) return;
  if (rng() > chance) return;
  const targetMon = monOf(sim, target);
  if (targetMon.hp <= 0) return;
  const dust = ability(targetMon) === "shield-dust" && move.category !== "status" && target !== userSide;
  if (dust) return;
  for (const change of move.statChanges) {
    const stat = STAT_API[change.stat];
    if (!stat) continue;
    const fromFoe = target !== userSide;
    if (fromFoe && statBlocks(targetMon, stat, change.change < 0)) {
      push(`${withJosa(nameOf(targetMon), "은/는")} 능력이 떨어지지 않는다!`);
      continue;
    }
    const vol = volOf(sim, target);
    const shifted = shiftStage(vol, targetMon, stat, change.change);
    push(`${nameOf(targetMon)}의 ${shifted.text}`);
  }
}

function inflictAilment(sim: Battle, targetSide: Side, move: MoveData, push: Push, rng: Rng) {
  const target = monOf(sim, targetSide);
  if (target.hp <= 0) return;
  if (ability(target) === "shield-dust" && move.category !== "status") return;
  if (move.ailment === "leech-seed") {
    if (typesOf(target).includes("grass") || volOf(sim, targetSide).seeded) {
      if (move.category === "status") push("그러나 실패했다!");
      return;
    }
    volOf(sim, targetSide).seeded = true;
    push(`${nameOf(target)}에게 씨앗을 심었다!`);
    return;
  }
  if (move.ailment === "confusion" || move.metaCategory === "swagger") {
    if (ability(target) === "own-tempo") {
      push(`${withJosa(nameOf(target), "은/는")} 혼란에 빠지지 않는다!`);
      return;
    }
    volOf(sim, targetSide).confused = 2 + Math.floor(rng() * 3);
    push(`${withJosa(nameOf(target), "은/는")} 혼란에 빠졌다!`);
    if (move.metaCategory !== "swagger" && move.ailment === "confusion") return;
  }
  const status = mapStatus(move.ailment, move.id);
  if (!status) return;
  const chance = move.category === "status" ? 1 : move.ailmentChance > 0 ? move.ailmentChance / 100 : 0;
  if (chance === 0 || rng() > chance) return;
  if (target.status) {
    if (move.category === "status") push("그러나 실패했다!");
    return;
  }
  if (blocksStatus(target, status)) {
    if (move.category === "status") push("효과가 없었다!");
    return;
  }
  target.status = status;
  if (status === "slp") target.sleep = 1 + Math.floor(rng() * 3);
  if (status === "tox") target.toxic = 1;
  const label = { brn: "화상을 입었다", par: "마비되었다", psn: "독에 걸렸다", tox: "맹독에 걸렸다", slp: "잠들었다", frz: "얼어붙었다" }[status];
  push(`${withJosa(nameOf(target), "은/는")} ${label}!`, "status");
}

function healTarget(mon: Mon, ratio: number, push: Push) {
  const amount = Math.max(1, Math.floor((maxHp(mon) * ratio) / 100));
  const before = mon.hp;
  mon.hp = Math.min(maxHp(mon), mon.hp + amount);
  const gained = mon.hp - before;
  if (gained <= 0) push("HP가 이미 가득하다!");
  else push(`${nameOf(mon)}의 HP가 ${gained} 회복되었다!`, "heal");
}

function phaze(sim: Battle, targetSide: Side, push: Push, rng: Rng): "end" | "go" {
  const target = monOf(sim, targetSide);
  if (ability(target) === "suction-cups") {
    push("달라붙어서 움직이지 않는다!");
    return "go";
  }
  if (targetSide === "foe" && sim.kind === "wild") {
    push(`${withJosa(nameOf(target), "을/를")} 날려 버렸다!`);
    sim.result = "flee";
    sim.after = "done";
    return "end";
  }
  const team = targetSide === "player" ? sim.party : sim.foeTeam;
  const current = targetSide === "player" ? sim.active : sim.foeActive;
  const options = team.map((_, index) => index).filter((index) => index !== current && team[index].hp > 0);
  if (options.length === 0) {
    push("그러나 실패했다!");
    return "go";
  }
  const index = options[Math.floor(rng() * options.length)];
  sendOut(sim, targetSide, index, push, true);
  return "go";
}

function executeMove(sim: Battle, userSide: Side, move: MoveData, foeCommand: BattleCommand | null, foeMoved: boolean, push: Push, rng: Rng): "stop" | "go" {
  const targetSide: Side = userSide === "player" ? "foe" : "player";
  const user = monOf(sim, userSide);
  const vol = volOf(sim, userSide);
  const foe = monOf(sim, targetSide);
  const foeVol = volOf(sim, targetSide);
  if (vol.zArmed) {
    vol.zArmed = false;
    if (move.power > 0) {
      move = { ...move, power: zPower(move.power) };
      push("Z기술이 작렬한다!", "super");
    } else {
      const heal = Math.max(1, Math.floor(maxHp(user, vol.form) / 2));
      user.hp = Math.min(maxHp(user, vol.form), user.hp + heal);
      push("Z파워가 몸을 감싼다!", "heal");
    }
  }
  vol.lastMove = move.id;
  if (!PROTECT.has(move.id)) vol.protect = 0;

  if (move.id === "sucker-punch") {
    const attacking = foeCommand?.kind === "fight";
    if (!attacking) {
      push("그러나 실패했다!");
      return "go";
    }
  }
  if (move.id === "fake-out" && vol.turns > 0) {
    push("그러나 실패했다!");
    return "go";
  }

  if (ability(user) === "stance-change" && move.category !== "status" && move.power > 0 && vol.form !== "blade") {
    vol.form = "blade";
    push("공격 태세로 자세를 바꿨다!");
  }

  if (PROTECT.has(move.id)) {
    const chance = vol.protect <= 0 ? 1 : 1 / 3 ** vol.protect;
    if (rng() < chance) {
      vol.guarding = move.id;
      vol.protect += 1;
      if (move.id === "kings-shield" && vol.form === "blade") {
        vol.form = "shield";
        push("방어 태세로 돌아왔다!");
      }
      push("지켰다!");
    } else {
      vol.protect = 0;
      push("그러나 실패했다!");
    }
    return "go";
  }

  if (move.id === "rest") {
    user.hp = maxHp(user, vol.form);
    user.status = "slp";
    user.sleep = 3;
    push("HP가 가득 차고 깊이 잠들었다!", "heal");
    return "go";
  }

  const weatherSet: Record<string, WeatherName> = { "sunny-day": "sun", "rain-dance": "rain", sandstorm: "sand", hail: "hail" };
  if (weatherSet[move.id]) {
    sim.weather = weatherSet[move.id];
    sim.weatherTurns = 5;
    const label = { sun: "햇살이 강해졌다!", rain: "비가 내리기 시작했다!", sand: "모래바람이 불기 시작했다!", hail: "싸라기눈이 내리기 시작했다!" }[sim.weather];
    push(label);
    return "go";
  }

  const userSideCond = sideOf(sim, userSide);
  const foeSideCond = sideOf(sim, targetSide);
  if (move.id === "reflect") {
    userSideCond.reflect = 5;
    push("물리 기술을 약하게 만드는 벽이 생겼다!");
    return "go";
  }
  if (move.id === "light-screen") {
    userSideCond.light = 5;
    push("특수 기술을 약하게 만드는 벽이 생겼다!");
    return "go";
  }
  if (move.id === "tailwind") {
    userSideCond.tailwind = 4;
    push("순풍이 등을 밀어 준다!");
    return "go";
  }
  if (move.id === "stealth-rock") {
    if (foeSideCond.rocks) push("그러나 실패했다!");
    else {
      foeSideCond.rocks = true;
      push("상대 주변에 뾰족한 바위가 떠다닌다!");
    }
    return "go";
  }
  if (move.id === "spikes") {
    if (foeSideCond.spikes >= 3) push("그러나 실패했다!");
    else {
      foeSideCond.spikes += 1;
      push("상대의 발밑에 압정이 깔렸다!");
    }
    return "go";
  }
  if (move.id === "haze") {
    sim.pVol.stages = emptyStages();
    sim.fVol.stages = emptyStages();
    push("능력 변화가 원래대로 돌아왔다!");
    return "go";
  }
  if (move.id === "ingrain") {
    vol.rooted = true;
    push("뿌리를 내려 HP를 조금씩 회복한다!");
    return "go";
  }

  if (move.healing > 0 && move.power <= 0 && move.target === "user") {
    let ratio = move.healing;
    if (move.id === "synthesis" || move.id === "moonlight") {
      if (sim.weather === "sun") ratio = 67;
      else if (sim.weather) ratio = 25;
    }
    healTarget(user, ratio, push);
    applyStats(sim, userSide, move, push, rng, true);
    return "go";
  }
  if (move.healing > 0 && move.power <= 0 && move.target !== "user") {
    const ratio = ability(user) === "mega-launcher" && move.id === "heal-pulse" ? 75 : move.healing;
    healTarget(foe, ratio, push);
    return "go";
  }

  if (foeVol.guarding && move.target !== "user") {
    push("막혔다!");
    if (isContact(move) && foeVol.guarding === "kings-shield") {
      const shifted = shiftStage(vol, user, "atk", -1);
      push(shifted.text);
    }
    if (isContact(move) && foeVol.guarding === "spiky-shield") {
      const chip = Math.max(1, Math.floor(maxHp(user, vol.form) / 8));
      user.hp = Math.max(0, user.hp - chip);
      push("가시에 찔렸다!", "hit");
    }
    return user.hp <= 0 ? checkFaints(sim, push, false) : "go";
  }

  const shaped = movePower(move, user, foe, sim.weather);
  const ohko = move.metaCategory === "ohko";
  const damaging = ohko || shaped.power > 0;

  if (!damaging) {
    applyStats(sim, userSide, move, push, rng, true);
    applyStats(sim, userSide, move, push, rng, false);
    inflictAilment(sim, targetSide, move, push, rng);
    if (PHAZE.has(move.id) && foe.hp > 0) return phaze(sim, targetSide, push, rng) === "end" ? "stop" : "go";
    return "go";
  }

  const defenderAbility = ability(foe);
  if (shaped.type === "ground" && defenderAbility === "levitate") {
    push(`${withJosa(nameOf(foe), "은/는")} 떠 있어서 맞지 않는다!`);
    return "go";
  }
  if (shaped.type === "water" && (defenderAbility === "water-absorb" || defenderAbility === "dry-skin")) {
    const heal = Math.max(1, Math.floor(maxHp(foe) / 4));
    foe.hp = Math.min(maxHp(foe), foe.hp + heal);
    push("물을 흡수해 HP가 회복되었다!", "heal");
    return "go";
  }
  if (shaped.type === "grass" && defenderAbility === "sap-sipper") {
    const shifted = shiftStage(foeVol, foe, "atk", 1);
    push(`풀을 먹고 ${shifted.text}`);
    return "go";
  }
  if (defenderAbility === "bulletproof" && BALL.has(move.id)) {
    push("기술을 막아 냈다!");
    return "go";
  }

  const always = move.accuracy == null || ability(user) === "no-guard" || defenderAbility === "no-guard" || move.id === "struggle";
  if (!always) {
    let accuracy = move.accuracy ?? 100;
    if (ability(user) === "compound-eyes") accuracy = Math.floor(accuracy * 1.3);
    accuracy = Math.floor(accuracy * stageMod(vol.stages.acc) / stageMod(foeVol.stages.eva));
    if (ohko) accuracy = Math.min(accuracy, user.level - foe.level + (move.accuracy ?? 30));
    if (rng() * 100 >= accuracy || (ohko && user.level < foe.level)) {
      push("그러나 빗나갔다!");
      if (vol.locked) {
        vol.locked = null;
        vol.confused = 2 + Math.floor(rng() * 2);
        push("현기증이 나기 시작했다!");
      }
      return "go";
    }
  }

  if (ohko) {
    foe.hp = 0;
    push("일격에 쓰러뜨렸다!", "super");
    return checkFaints(sim, push, true);
  }

  let hits = 1;
  if (move.minHits && move.maxHits) {
    if (move.minHits === 2 && move.maxHits === 5) {
      const roll = rng();
      hits = roll < 0.375 ? 2 : roll < 0.75 ? 3 : roll < 0.875 ? 4 : 5;
    } else hits = move.minHits + Math.floor(rng() * (move.maxHits - move.minHits + 1));
  }

  let total = 0;
  let lastEffect = 1;
  for (let hit = 0; hit < hits; hit += 1) {
    if (foe.hp <= 0) break;
    const crit = rng() < (move.critRate > 0 ? 1 / 8 : 1 / 16);
    const category = move.id === "struggle" ? "physical" : move.category;
    const atkStat: StatName = category === "special" ? "spa" : "atk";
    const defStat: StatName = move.id === "psyshock" || move.id === "psystrike" || move.id === "secret-sword" ? "def" : category === "special" ? "spd" : "def";
    let atkStage = vol.stages[atkStat];
    let defStage = foeVol.stages[defStat];
    if (crit) {
      if (atkStage < 0) atkStage = 0;
      if (defStage > 0) defStage = 0;
    }
    const attack = Math.max(1, Math.floor(rawStats(user, vol.form)[atkStat] * stageMod(atkStage)));
    let defense = Math.max(1, Math.floor(rawStats(foe, foeVol.form)[defStat] * stageMod(defStage)));
    if (defStat === "def" && defenderAbility === "fur-coat") defense *= 2;
    if (sim.weather === "sand" && defStat === "spd" && typesOf(foe).includes("rock")) defense = Math.floor(defense * 1.5);
    const effect = move.id === "struggle" ? 1 : effectiveness(shaped.type, typesOf(foe));
    lastEffect = effect;
    if (effect === 0) {
      push("효과가 없는 것 같다…", "weak");
      return "go";
    }
    const stab = move.id !== "struggle" && typesOf(user).includes(shaped.type);
    const screen = category === "physical" ? foeSideCond.reflect > 0 : foeSideCond.light > 0;
    let weather = weatherFor(sim.weather, shaped.type);
    if (defenderAbility === "dry-skin" && shaped.type === "fire") weather *= 1.25;
    let damage = calcDamage({
      level: user.level,
      power: shaped.power,
      attack,
      defense,
      stab,
      effect,
      crit,
      burn: user.status === "brn" && category === "physical" && move.id !== "facade",
      random: 85 + Math.floor(rng() * 16),
      weather,
      screen,
      sniper: ability(user) === "sniper",
      aura: auraFor(sim, shaped.type),
    });
    if (move.id === "psywave") damage = Math.max(1, Math.floor(user.level * (0.5 + rng())));
    if (ability(foe) === "sturdy" && foe.hp === maxHp(foe) && damage >= foe.hp) {
      damage = foe.hp - 1;
      push("버티기로 한 방을 견뎠다!");
    }
    foe.hp = Math.max(0, foe.hp - damage);
    total += damage;
    if (crit) push("급소에 맞았다!", effect > 1 ? "super" : "hit");
    const effectLine = effect > 1 ? "효과가 굉장했다!" : effect < 1 ? "효과가 별로인 듯하다" : null;
    if (effectLine) push(effectLine, effect > 1 ? "super" : "weak");
    if (!crit && !effectLine) push(`${damage}의 데미지!`, "hit");
    else if (crit || effectLine) push(`${damage}의 데미지!`);
  }
  if (hits > 1) push(`${Math.min(hits, total > 0 ? hits : 1)}번 맞았다!`);

  if (move.drain > 0 && total > 0 && user.hp > 0) {
    const heal = Math.max(1, Math.floor((total * move.drain) / 100));
    user.hp = Math.min(maxHp(user, vol.form), user.hp + heal);
    push("입힌 데미지만큼 회복했다!", "heal");
  }
  if (move.id === "struggle" && user.hp > 0) {
    const recoil = Math.max(1, Math.floor(maxHp(user, vol.form) / 4));
    user.hp = Math.max(0, user.hp - recoil);
    push("반동으로 데미지를 입었다!");
  } else if (move.drain < 0 && total > 0 && user.hp > 0) {
    const recoil = Math.max(1, Math.floor((total * Math.abs(move.drain)) / 100));
    user.hp = Math.max(0, user.hp - recoil);
    push("반동으로 데미지를 입었다!");
  }

  if (foe.hp > 0 && !foeMoved && move.flinchChance > 0 && rng() * 100 < move.flinchChance) foeVol.flinch = true;
  if (foe.hp > 0 && isContact(move)) {
    if (ability(foe) === "flame-body" && rng() < 0.3 && !user.status && !blocksStatus(user, "brn")) {
      user.status = "brn";
      push("맞닿은 몸이 뜨거워 화상을 입었다!", "status");
    }
    if (ability(foe) === "poison-point" && rng() < 0.3 && !user.status && !blocksStatus(user, "psn")) {
      user.status = "psn";
      push("독가시에 찔렸다!", "status");
    }
    if (ability(user) === "poison-touch" && rng() < 0.3 && !foe.status && !blocksStatus(foe, "psn")) {
      foe.status = "psn";
      push("독이 묻어 상대가 중독되었다!", "status");
    }
    if (ability(foe) === "cute-charm" && rng() < 0.3) {
      vol.infatuated = 4;
      push("상대에게 마음이 흔들린다!");
    }
  }
  if (foe.hp > 0) inflictAilment(sim, targetSide, move, push, rng);
  applyStats(sim, userSide, move, push, rng, false);
  applyStats(sim, userSide, move, push, rng, true);

  if (RECHARGE.has(move.id)) vol.recharge = true;
  if (LOCK.has(move.id) && foe.hp > 0) {
    if (!vol.locked) vol.locked = { move: move.id, turns: 1 + Math.floor(rng() * 2) };
    else {
      vol.locked.turns -= 1;
      if (vol.locked.turns <= 0) {
        vol.locked = null;
        vol.confused = 2 + Math.floor(rng() * 2);
        push("현기증이 나기 시작했다!");
      }
    }
  } else if (vol.locked && foe.hp <= 0) vol.locked = null;

  if (foe.hp > 0 && PHAZE.has(move.id)) {
    if (phaze(sim, targetSide, push, rng) === "end") return "stop";
  }
  if (lastEffect === 0) return "go";
  return checkFaints(sim, push, true);
}

function canAct(sim: Battle, side: Side, push: Push, rng: Rng): boolean {
  const mon = monOf(sim, side);
  const vol = volOf(sim, side);
  if (mon.hp <= 0) return false;
  if (vol.recharge) {
    vol.recharge = false;
    push(`${withJosa(nameOf(mon), "은/는")} 반동으로 움직이지 못한다!`);
    return false;
  }
  if (vol.flinch) {
    vol.flinch = false;
    push("풀이 죽어서 움직일 수 없다!");
    return false;
  }
  if (mon.status === "slp") {
    mon.sleep -= 1;
    if (mon.sleep > 0) {
      push("쿨쿨 잠들어 있다…");
      return false;
    }
    mon.status = null;
    push("눈을 떴다!");
  }
  if (mon.status === "frz") {
    if (rng() < 0.2) {
      mon.status = null;
      push("얼음이 녹았다!");
    } else {
      push("얼어붙어서 움직일 수 없다!");
      return false;
    }
  }
  if (mon.status === "par" && rng() < 0.25) {
    push("몸이 저려서 움직일 수 없다!");
    return false;
  }
  if (vol.infatuated > 0) {
    vol.infatuated -= 1;
    if (rng() < 0.5) {
      push("마음이 흔들려 기술을 쓸 수 없다!");
      return false;
    }
  }
  if (vol.confused > 0) {
    vol.confused -= 1;
    if (rng() < 1 / 3) {
      const chip = Math.max(1, Math.floor(maxHp(mon, vol.form) / 8));
      mon.hp = Math.max(0, mon.hp - chip);
      push("영문도 모른 채 자신을 공격했다!", "hit");
      return false;
    }
    if (vol.confused === 0) push("혼란이 풀렸다!");
  }
  return mon.hp > 0;
}

function chosenMove(mon: Mon, command: BattleCommand, vol: Volatile): MoveData {
  if (vol.locked) return getMove(vol.locked.move);
  if (command.kind !== "fight" || command.index < 0 || !mon.moves[command.index] || mon.moves[command.index].pp <= 0) return getMove("struggle");
  return getMove(mon.moves[command.index].id);
}

function spendPp(mon: Mon, command: BattleCommand, vol: Volatile) {
  if (vol.locked) return;
  if (command.kind !== "fight" || command.index < 0) return;
  const slot = mon.moves[command.index];
  if (!slot || slot.pp <= 0) return;
  slot.pp -= 1;
}

function applyHeldItem(sim: Battle, command: Extract<BattleCommand, { kind: "item" }>, push: Push, rng: Rng): "stop" | "go" {
  const item = command.item;
  if (item === "pokeball" || item === "greatball" || item === "ultraball" || item === "masterball") {
    if (sim.kind !== "wild") {
      push("남의 포켓몬에게는 쓸 수 없다!");
      return "go";
    }
    const foe = sim.foeTeam[sim.foeActive];
    const ballName = item === "masterball" ? "마스터볼" : item === "ultraball" ? "하이퍼볼" : item === "greatball" ? "슈퍼볼" : "몬스터볼";
    push(`${ballName}을 던졌다!`);
    const mod = ballMod(item);
    let caught = mod === "sure";
    let shakes = caught ? 3 : 0;
    if (!caught && typeof mod === "number") {
      const statusMod = foe.status === "slp" || foe.status === "frz" ? 2.5 : foe.status ? 1.5 : 1;
      const max = maxHp(foe);
      let score = Math.floor(((((3 * max - 2 * foe.hp) * getSpecies(foe.speciesId).captureRate * mod) / (3 * max)) * statusMod));
      if (score >= 255) caught = true;
      else {
        const b = Math.floor(65536 / (255 / Math.max(1, score)) ** 0.1875);
        for (let i = 0; i < 4; i += 1) {
          if (Math.floor(rng() * 65536) >= b) break;
          shakes += 1;
        }
        caught = shakes >= 4;
      }
    }
    const shown = Math.min(3, shakes);
    if (shown > 0) push(shown === 1 ? "한 번 흔들린다…" : shown === 2 ? "두 번 흔들린다…" : "세 번 흔들린다…");
    if (caught) {
      const caughtMon = createMon(foe.speciesId, foe.level, foe.iv);
      caughtMon.hp = Math.max(1, foe.hp);
      caughtMon.status = foe.status;
      caughtMon.sleep = foe.sleep;
      caughtMon.toxic = foe.toxic;
      caughtMon.moves = foe.moves.map((move) => ({ ...move }));
      caughtMon.form = foe.form;
      sim.caught = caughtMon;
      foe.hp = 0;
      push(`${withJosa(nameOf(foe), "을/를")} 잡았다!`, "catch");
      sim.result = "catch";
      sim.after = "done";
      awardExp(sim, push);
      return "stop";
    }
    const miss = ["바로 튀어나왔다!", "한 번 흔들리더니 튀어나왔다!", "두 번 흔들렸지만 빠져나왔다!", "세 번이나 흔들리고도 빠져나왔다!"];
    push(miss[Math.min(3, shakes)]);
    return "go";
  }
  const target = sim.party[command.target];
  if (!target) {
    push("대상을 찾지 못했다.");
    return "go";
  }
  if (item === "revive") {
    if (target.hp > 0) {
      push("기절한 포켓몬에게만 쓸 수 있다.");
      return "go";
    }
    target.hp = Math.max(1, Math.floor(maxHp(target) / 2));
    target.status = null;
    push(`${withJosa(nameOf(target), "이/가")} 다시 일어났다!`, "heal");
    return "go";
  }
  if (item === "fullheal") {
    if (!target.status) {
      push("상태 이상이 아니다.");
      return "go";
    }
    target.status = null;
    target.sleep = 0;
    target.toxic = 0;
    push(`${nameOf(target)}의 상태가 돌아왔다!`, "heal");
    return "go";
  }
  const amount = item === "potion" ? 20 : item === "superpotion" ? 50 : item === "hyperpotion" ? 200 : 0;
  if (amount > 0) {
    if (target.hp <= 0) {
      push("쓰러진 포켓몬에게는 상처약이 듣지 않는다.");
      return "go";
    }
    const before = target.hp;
    target.hp = Math.min(maxHp(target), target.hp + amount);
    push(`${nameOf(target)}의 HP가 ${target.hp - before} 회복되었다!`, "heal");
  }
  return "go";
}

function act(sim: Battle, side: Side, command: BattleCommand, other: BattleCommand | null, otherMoved: boolean, push: Push, rng: Rng): "stop" | "go" {
  const mon = monOf(sim, side);
  const vol = volOf(sim, side);
  if (command.kind === "switch") {
    if (mon.hp <= 0) return "go";
    const team = side === "player" ? sim.party : sim.foeTeam;
    const next = team[command.index];
    if (!next || next.hp <= 0 || command.index === (side === "player" ? sim.active : sim.foeActive)) {
      push("교대할 수 없다!");
      return "go";
    }
    push(`${withJosa(nameOf(mon), "은/는")} 돌아왔다!`);
    sendOut(sim, side, command.index, push, true);
    return monOf(sim, side).hp <= 0 ? checkFaints(sim, push, false) : "go";
  }
  if (command.kind === "item" && side === "player") return applyHeldItem(sim, command, push, rng);
  if (!canAct(sim, side, push, rng)) return mon.hp <= 0 ? checkFaints(sim, push, false) : "go";
  if (command.kind === "fight" && side === "player") {
    if (command.mega) megavolve(sim, side, command.mega, push);
    if (command.z && !sim.zUsed) {
      sim.zUsed = true;
      vol.zArmed = true;
      push("Z파워가 모인다!");
    }
  }
  const move = chosenMove(mon, command, vol);
  spendPp(mon, command, vol);
  push(`${nameOf(mon)}의 ${move.name}!`);
  return executeMove(sim, side, move, other, otherMoved, push, rng);
}

function priorityOf(sim: Battle, side: Side, command: BattleCommand): number {
  if (command.kind === "switch" || command.kind === "item") return 6;
  if (command.kind === "run") return 7;
  const mon = monOf(sim, side);
  const vol = volOf(sim, side);
  const move = chosenMove(mon, command, vol);
  let priority = move.priority;
  if (ability(mon) === "prankster" && move.category === "status") priority += 1;
  if (ability(mon) === "gale-wings" && move.type === "flying" && mon.hp === maxHp(mon, vol.form)) priority += 1;
  return priority;
}

function chooseFoe(sim: Battle, rng: Rng): BattleCommand {
  const foe = sim.foeTeam[sim.foeActive];
  const vol = sim.fVol;
  if (vol.locked) return { kind: "fight", index: Math.max(0, foe.moves.findIndex((move) => move.id === vol.locked?.move)) };
  const options = foe.moves.map((slot, index) => ({ slot, index })).filter((option) => option.slot.pp > 0);
  if (options.length === 0) return { kind: "fight", index: -1 };
  const player = sim.party[sim.active];
  const scored = options.map((option) => {
    const move = getMove(option.slot.id);
    if (move.power > 0 || (move.category !== "status" && move.metaCategory !== "unique")) {
      const shaped = movePower(move, foe, player, sim.weather);
      const effect = effectiveness(shaped.type, typesOf(player));
      return { index: option.index, score: shaped.power * Math.max(0, effect) };
    }
    if (move.healing > 0 && foe.hp * 2 < maxHp(foe, vol.form)) return { index: option.index, score: 70 };
    if (SETUP.has(move.id) && foe.hp * 2 > maxHp(foe)) return { index: option.index, score: 46 };
    if (move.category === "status" && move.ailment !== "none" && !player.status) return { index: option.index, score: 36 };
    return { index: option.index, score: 8 };
  });
  scored.sort((a, b) => b.score - a.score);
  if (rng() < 0.8) return { kind: "fight", index: scored[0].index };
  const total = scored.reduce((sum, row) => sum + row.score, 0);
  let roll = rng() * total;
  for (const row of scored) {
    roll -= row.score;
    if (roll <= 0) return { kind: "fight", index: row.index };
  }
  return { kind: "fight", index: scored[0].index };
}

function endTurn(sim: Battle, push: Push, rng: Rng): "stop" | "go" {
  sim.turn += 1;
  for (const side of ["player", "foe"] as const) {
    const mon = monOf(sim, side);
    const vol = volOf(sim, side);
    vol.guarding = null;
    vol.turns += 1;
    if (mon.hp <= 0) continue;
    if (vol.rooted) {
      mon.hp = Math.min(maxHp(mon, vol.form), mon.hp + Math.max(1, Math.floor(maxHp(mon, vol.form) / 16)));
    }
    if (ability(mon) === "dry-skin") {
      if (sim.weather === "rain") mon.hp = Math.min(maxHp(mon), mon.hp + Math.max(1, Math.floor(maxHp(mon) / 8)));
      if (sim.weather === "sun") mon.hp = Math.max(0, mon.hp - Math.max(1, Math.floor(maxHp(mon) / 8)));
    }
    if (ability(mon) === "shed-skin" && mon.status && rng() < 0.33) {
      mon.status = null;
      mon.sleep = 0;
      mon.toxic = 0;
      push("허물을 벗고 상태가 돌아왔다!");
    }
    if (mon.status === "brn" || mon.status === "psn") {
      mon.hp = Math.max(0, mon.hp - Math.max(1, Math.floor(maxHp(mon, vol.form) / 8)));
      push(mon.status === "brn" ? "화상 때문에 데미지를 입었다!" : "독 때문에 데미지를 입었다!");
    } else if (mon.status === "tox") {
      const chip = Math.max(1, Math.floor((maxHp(mon, vol.form) * Math.max(1, mon.toxic)) / 16));
      mon.toxic += 1;
      mon.hp = Math.max(0, mon.hp - chip);
      push("맹독이 몸을 잠식한다!");
    }
    if (vol.seeded && mon.hp > 0) {
      const chip = Math.max(1, Math.floor(maxHp(mon, vol.form) / 8));
      mon.hp = Math.max(0, mon.hp - chip);
      const otherSide: Side = side === "player" ? "foe" : "player";
      const other = monOf(sim, otherSide);
      if (other.hp > 0) other.hp = Math.min(maxHp(other), other.hp + chip);
      push("씨앗이 힘을 빨아들였다!");
    }
    const types = typesOf(mon);
    if (sim.weather === "sand" && mon.hp > 0 && !types.some((type) => type === "rock" || type === "ground" || type === "steel")) {
      mon.hp = Math.max(0, mon.hp - Math.max(1, Math.floor(maxHp(mon) / 16)));
    }
    if (sim.weather === "hail" && mon.hp > 0 && !types.includes("ice")) {
      mon.hp = Math.max(0, mon.hp - Math.max(1, Math.floor(maxHp(mon) / 16)));
    }
  }
  if (sim.weatherTurns > 0) {
    sim.weatherTurns -= 1;
    if (sim.weatherTurns <= 0 && sim.weather) {
      const ended = { sun: "햇살이 원래대로 돌아왔다.", rain: "비가 그쳤다.", sand: "모래바람이 멈췄다.", hail: "싸라기눈이 그쳤다." }[sim.weather];
      sim.weather = null;
      push(ended);
    }
  }
  for (const side of [sim.pSide, sim.fSide]) {
    if (side.reflect > 0) side.reflect -= 1;
    if (side.light > 0) side.light -= 1;
    if (side.tailwind > 0) side.tailwind -= 1;
  }
  return checkFaints(sim, push, false);
}

export function perform(battle: Battle, command: BattleCommand, rng: Rng = Math.random): Battle {
  if (battle.phase !== "action" || battle.result) return battle;
  const sim = structuredClone(battle) as Battle;
  sim.queue = [];
  const events: BattleEvent[] = [];
  const push: Push = (text, sfx) => events.push({ text, patch: snapshot(sim), sfx });
  sim.after = "action";

  if (command.kind === "run") {
    if (sim.kind === "trainer") {
      push("배틀 중에는 도망칠 수 없다!");
    } else {
      sim.fleeAttempts += 1;
      const odds = Math.floor((speedOf(sim, "player") * 128) / Math.max(1, speedOf(sim, "foe"))) + 30 * sim.fleeAttempts;
      if (rng() * 256 < odds) {
        push("무사히 빠져나왔다!");
        sim.result = "flee";
        sim.after = "done";
        return openQueue(sim, events, "done");
      }
      push("빠져나올 수 없다!");
    }
  }

  const foeCommand = chooseFoe(sim, rng);
  const playerCommand = command.kind === "run" ? null : command;
  const actions: { side: Side; command: BattleCommand }[] = [];
  if (playerCommand) actions.push({ side: "player", command: playerCommand });
  if (!sim.result) actions.push({ side: "foe", command: foeCommand });
  actions.sort((a, b) => {
    const diff = priorityOf(sim, b.side, b.command) - priorityOf(sim, a.side, a.command);
    if (diff !== 0) return diff;
    const speed = speedOf(sim, b.side) - speedOf(sim, a.side);
    if (speed !== 0) return speed;
    return rng() < 0.5 ? -1 : 1;
  });

  let stopped = false;
  const done = new Set<Side>();
  for (const action of actions) {
    if (stopped || sim.result) break;
    if (monOf(sim, action.side).hp <= 0) continue;
    const other = actions.find((entry) => entry.side !== action.side)?.command ?? null;
    const otherMoved = [...done].some((side) => side !== action.side);
    const outcome = act(sim, action.side, action.command, other, otherMoved, push, rng);
    done.add(action.side);
    if (outcome === "stop") stopped = true;
  }
  if (!stopped && !sim.result) {
    if (endTurn(sim, push, rng) === "stop") stopped = true;
  }
  return openQueue(sim, events, sim.after);
}

export function sendReplacement(battle: Battle, index: number): Battle {
  if (battle.phase !== "switch") return battle;
  const mon = battle.party[index];
  if (!mon || mon.hp <= 0 || index === battle.active) return battle;
  const sim = structuredClone(battle) as Battle;
  const events: BattleEvent[] = [];
  const push: Push = (text, sfx) => events.push({ text, patch: snapshot(sim), sfx });
  sendOut(sim, "player", index, push, true);
  if (sim.party[sim.active].hp <= 0) {
    const another = sim.party.findIndex((member) => member.hp > 0);
    if (another < 0) {
      sim.result = "lose";
      sim.after = "done";
      push("쓸 수 있는 포켓몬이 없다!");
    } else {
      sim.after = "switch";
      push("그 포켓몬도 쓰러졌다! 다른 포켓몬을 골라라!");
    }
  } else if (sim.foeNeedsSend) {
    const foeIndex = sim.foeTeam.findIndex((member) => member.hp > 0);
    if (foeIndex >= 0) {
      if (sim.trainerName) push(`${withJosa(sim.trainerName, "은/는")} 다음 포켓몬을 내보냈다!`);
      sendOut(sim, "foe", foeIndex, push, true);
    }
    sim.after = "action";
  } else sim.after = "action";
  return openQueue(sim, events, sim.after);
}

export function activeMon(battle: Battle, side: Side): Mon {
  return monOf(battle, side);
}

export function displayStages(battle: Battle, side: Side): Stages {
  return volOf(battle, side).stages;
}
