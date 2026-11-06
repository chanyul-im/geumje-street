import { getMove, getSpecies, hasMove } from "@/data/dex.ts";
import { withJosa } from "@/lib/korean.ts";
import { combatProfile } from "@/data/dex.ts";
import { battleStats, expForLevel } from "./stats.ts";

export type StatusName = "brn" | "par" | "psn" | "tox" | "slp" | "frz";

export type Mon = {
  uid: string;
  speciesId: number;
  level: number;
  exp: number;
  iv: number;
  hp: number;
  moves: { id: string; pp: number }[];
  status: StatusName | null;
  sleep: number;
  toxic: number;
  pendingEvo: boolean;
  /** Persistent form id, such as zygarde-10 or kyurem-white. */
  form: string | null;
  /** Battle-only mega id. Cleared when the battle ends. */
  aspect: string | null;
  /** Species absorbed by fusion, so it can be separated later. */
  fusedId: number | null;
};

let seq = 0;
export function uid(): string {
  seq += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `m${seq.toString(36)}${rand}`;
}

export function movesForLevel(speciesId: number, level: number): { id: string; pp: number }[] {
  const species = getSpecies(speciesId);
  const known = species.learnset.filter((row) => row.level <= level && hasMove(row.move));
  const damaging = known.filter((row) => {
    const move = getMove(row.move);
    return move.category !== "status" || move.power > 0;
  });
  const status = known.filter((row) => getMove(row.move).category === "status" && getMove(row.move).power <= 0);
  const picked: { level: number; move: string }[] = [];
  for (const row of damaging.slice().reverse()) {
    if (picked.length >= 3) break;
    if (!picked.some((item) => item.move === row.move)) picked.push(row);
  }
  const statusPick = status.at(-1);
  if (statusPick && !picked.some((item) => item.move === statusPick.move)) picked.push(statusPick);
  for (const row of known.slice().reverse()) {
    if (picked.length >= 4) break;
    if (!picked.some((item) => item.move === row.move)) picked.push(row);
  }
  if (picked.length === 0 && hasMove("tackle")) picked.push({ level: 1, move: "tackle" });
  picked.sort((a, b) => a.level - b.level || a.move.localeCompare(b.move));
  return picked.slice(-4).map((row) => ({ id: row.move, pp: getMove(row.move).pp }));
}

export function maxHp(mon: Mon, stance: "shield" | "blade" | null = null): number {
  return battleStats(combatProfile(mon).stats, mon.level, mon.iv, stance).hp;
}

export function createMon(speciesId: number, level: number, iv = 15, form: string | null = null): Mon {
  const species = getSpecies(speciesId);
  const safeLevel = Math.max(1, Math.min(100, level));
  const mon: Mon = {
    uid: uid(),
    speciesId,
    level: safeLevel,
    exp: expForLevel(species.growth, safeLevel),
    iv: Math.max(0, Math.min(31, iv)),
    hp: 1,
    moves: movesForLevel(speciesId, safeLevel),
    status: null,
    sleep: 0,
    toxic: 0,
    pendingEvo: false,
    form,
    aspect: null,
    fusedId: null,
  };
  mon.hp = maxHp(mon);
  return mon;
}

export function healMon(mon: Mon): Mon {
  return { ...mon, hp: maxHp(mon), status: null, sleep: 0, toxic: 0, moves: mon.moves.map((move) => ({ id: move.id, pp: getMove(move.id).pp })) };
}

export type ExpResult = {
  mon: Mon;
  notes: string[];
  queued: string[];
};

export function gainExp(mon: Mon, amount: number): ExpResult {
  const species = getSpecies(mon.speciesId);
  const name = species.name;
  let level = mon.level;
  let exp = mon.exp + amount;
  const notes = [`${withJosa(name, "은/는")} ${amount} 경험치를 얻었다!`];
  const queued: string[] = [];
  const next: Mon = { ...mon, moves: mon.moves.map((move) => ({ ...move })), pendingEvo: mon.pendingEvo };
  const known = new Set(next.moves.map((move) => move.id));
  while (level < 100) {
    const need = expForLevel(species.growth, level + 1);
    const prev = expForLevel(species.growth, level);
    if (need <= prev || exp < need) break;
    const before = maxHp({ ...next, level });
    level += 1;
    next.level = level;
    const after = maxHp(next);
    next.hp = Math.min(after, next.hp + (after - before));
    notes.push(`${name}의 레벨이 ${level}이(가) 되었다!`);
    for (const row of species.learnset) {
      if (row.level !== level || known.has(row.move) || !hasMove(row.move)) continue;
      known.add(row.move);
      const move = getMove(row.move);
      if (next.moves.length < 4) {
        next.moves.push({ id: row.move, pp: move.pp });
        notes.push(`${withJosa(name, "은/는")} ${withJosa(move.name, "을/를")} 배웠다!`);
      } else {
        queued.push(row.move);
        notes.push(`${withJosa(name, "은/는")} ${withJosa(move.name, "을/를")} 배우고 싶어 한다!`);
      }
    }
    if (species.evo && level >= species.evo.level) next.pendingEvo = true;
  }
  next.exp = level >= 100 ? expForLevel(species.growth, 100) : exp;
  next.level = level;
  return { mon: next, notes, queued };
}

export function evolveMon(mon: Mon): { mon: Mon; queued: string[] } {
  const from = getSpecies(mon.speciesId);
  if (!from.evo) return { mon, queued: [] };
  const into = from.evo.into;
  const species = getSpecies(into);
  const ratio = maxHp(mon) === 0 ? 1 : mon.hp / maxHp(mon);
  const next: Mon = { ...mon, speciesId: into, pendingEvo: false, moves: mon.moves.map((move) => ({ ...move })) };
  const hp = maxHp(next);
  next.hp = Math.max(1, Math.min(hp, Math.round(hp * ratio)));
  const queued: string[] = [];
  const known = new Set(next.moves.map((move) => move.id));
  for (const row of species.learnset) {
    if (row.level > mon.level || known.has(row.move) || !hasMove(row.move)) continue;
    const move = getMove(row.move);
    const signature = row.level === 1 && move.power >= 70;
    const learnedNow = row.level >= from.evo.level;
    if (!signature && !learnedNow) continue;
    known.add(row.move);
    queued.push(row.move);
  }
  return { mon: next, queued };
}
