import raw from "./pokedex.json";
import type { PType } from "./chart.ts";

export type MoveData = {
  id: string;
  name: string;
  type: PType;
  category: "physical" | "special" | "status";
  power: number;
  accuracy: number | null;
  pp: number;
  priority: number;
  ailment: string;
  ailmentChance: number;
  flinchChance: number;
  statChance: number;
  statChanges: { stat: string; change: number }[];
  metaCategory: string;
  drain: number;
  healing: number;
  critRate: number;
  minHits: number | null;
  maxHits: number | null;
  minTurns: number | null;
  maxTurns: number | null;
  target: string;
};

export type FormData = {
  id: string;
  name: string;
  types: PType[];
  stats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  ability: string;
  kind: "form" | "mega" | "fusion";
};

export type Species = {
  id: number;
  key: string;
  name: string;
  genus: string;
  types: PType[];
  stats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  abilities: { id: string; hidden: boolean }[];
  captureRate: number;
  growth: string;
  baseExp: number;
  height: number;
  weight: number;
  learnset: { level: number; move: string }[];
  evo: { into: number; level: number; trigger: string } | null;
  forms: FormData[];
};

type DexFile = {
  species: Species[];
  moves: Record<string, MoveData>;
  abilities: Record<string, { id: string; name: string }>;
};

const data = raw as DexFile;

export const GEN_MIN = 650;
export const GEN_MAX = 721;

export const speciesList: Species[] = data.species;
export const speciesById = new Map(speciesList.map((species) => [species.id, species]));

export function getSpecies(id: number): Species {
  const species = speciesById.get(id);
  if (!species) throw new Error(`도감에 없는 번호: ${id}`);
  return species;
}

export function getMove(id: string): MoveData {
  const move = data.moves[id];
  if (!move) throw new Error(`없는 기술: ${id}`);
  return move;
}

export function hasMove(id: string): boolean {
  return Boolean(data.moves[id]);
}

export function abilityName(id: string): string {
  return data.abilities[id]?.name ?? id;
}

export function primaryAbility(speciesId: number): string {
  const species = getSpecies(speciesId);
  return (species.abilities.find((ability) => !ability.hidden) ?? species.abilities[0])?.id ?? "";
}

export function formsOf(species: Species): FormData[] {
  return species.forms.filter((form) => !form.id.includes("power-construct") && form.name !== form.id);
}

export function megasOf(speciesId: number): FormData[] {
  return formsOf(getSpecies(speciesId)).filter((form) => form.kind === "mega");
}

export function combatProfile(mon: { speciesId: number; form?: string | null; aspect?: string | null }): {
  species: Species;
  name: string;
  types: PType[];
  stats: Species["stats"];
  ability: string;
} {
  const species = getSpecies(mon.speciesId);
  const forms = formsOf(species);
  const picked = (mon.aspect ? forms.find((form) => form.id === mon.aspect) : undefined) ?? (mon.form ? forms.find((form) => form.id === mon.form) : undefined);
  return {
    species,
    name: picked?.name ?? species.name,
    types: picked?.types?.length ? picked.types : species.types,
    stats: picked?.stats ?? species.stats,
    ability: picked?.ability || primaryAbility(mon.speciesId),
  };
}

/** Original short notes for abilities this game actually applies. */
export const ABILITY_TEXT: Record<string, string> = {
  overgrow: "HP가 적으면 풀 기술의 위력이 오른다.",
  blaze: "HP가 적으면 불꽃 기술의 위력이 오른다.",
  torrent: "HP가 적으면 물 기술의 위력이 오른다.",
  "gale-wings": "HP가 가득하면 비행 기술이 먼저 나간다.",
  contrary: "능력 변화가 반대로 적용된다.",
  "no-guard": "서로의 기술이 빗나가지 않는다.",
  prankster: "변화 기술이 조금 빨라진다.",
  "mega-launcher": "파동과 오라 기술의 위력이 오른다.",
  "stance-change": "공격과 방어로 자세를 바꾼다.",
  "water-absorb": "물 기술을 받으면 HP가 회복된다.",
  "sap-sipper": "풀 기술을 받으면 공격이 오른다.",
  "dry-skin": "물에 회복하고, 불꽃에 약하다.",
  "fur-coat": "방어가 두 배가 된다.",
  "tough-claws": "맞닿는 기술의 위력이 오른다.",
  "strong-jaw": "이빨 기술의 위력이 오른다.",
  "iron-fist": "펀치 기술의 위력이 오른다.",
  refrigerate: "노말 기술이 얼음 기술이 된다.",
  pixilate: "노말 기술이 페어리 기술이 된다.",
  "flame-body": "맞닿으면 화상 상태가 될 때가 있다.",
  "poison-point": "맞닿으면 독 상태가 될 때가 있다.",
  "poison-touch": "맞닿는 기술로 독을 퍼뜨릴 때가 있다.",
  limber: "마비되지 않는다.",
  "own-tempo": "혼란에 빠지지 않는다.",
  "sweet-veil": "잠들지 않는다.",
  "clear-body": "상대가 능력을 떨어뜨리지 못한다.",
  "big-pecks": "방어가 떨어지지 않는다.",
  "keen-eye": "명중률이 떨어지지 않는다.",
  "flower-veil": "풀 타입은 능력이 떨어지지 않는다.",
  "natural-cure": "교대하면 상태 이상이 낫는다.",
  "shed-skin": "상태 이상이 저절로 나을 때가 있다.",
  "shield-dust": "기술의 추가 효과를 받지 않는다.",
  "compound-eyes": "기술이 잘 맞는다.",
  sniper: "급소의 위력이 더 세다.",
  "fairy-aura": "페어리 기술의 위력이 오른다.",
  "dark-aura": "악 기술의 위력이 오른다.",
  "aura-break": "오라의 효과를 뒤집는다.",
  "cute-charm": "맞닿으면 상대가 헤롱거릴 때가 있다.",
  "suction-cups": "강제로 교대당하지 않는다.",
  sturdy: "HP가 가득하면 한 방은 버틴다.",
  bulletproof: "폭탄과 구슬 기술을 받지 않는다.",
};

export function speciesBlurb(species: Species): string {
  const meters = (species.height / 10).toFixed(1);
  const kilos = (species.weight / 10).toFixed(1);
  return `${species.genus}. 키 ${meters}m, 몸무게 ${kilos}kg.`;
}
