import type { Species } from "@/data/dex.ts";

export type StatName = "hp" | "atk" | "def" | "spa" | "spd" | "spe";
export type StageName = "atk" | "def" | "spa" | "spd" | "spe" | "acc" | "eva";

export function expForLevel(growth: string, level: number): number {
  if (level <= 1) return 0;
  const n = level;
  let value = 0;
  switch (growth) {
    case "slow":
      value = Math.floor((5 * n * n * n) / 4);
      break;
    case "medium":
      value = n * n * n;
      break;
    case "fast":
      value = Math.floor((4 * n * n * n) / 5);
      break;
    case "medium-slow":
      value = Math.floor((6 * n * n * n) / 5) - 15 * n * n + 100 * n - 140;
      break;
    case "slow-then-very-fast":
      // PokeAPI name for erratic.
      if (n < 50) value = Math.floor((n * n * n * (100 - n)) / 50);
      else if (n < 68) value = Math.floor((n * n * n * (150 - n)) / 100);
      else if (n < 98) value = Math.floor((n * n * n * Math.floor((1911 - 10 * n) / 3)) / 500);
      else value = Math.floor((n * n * n * (160 - n)) / 100);
      break;
    case "fast-then-very-slow":
      // PokeAPI name for fluctuating.
      if (n < 15) value = Math.floor((n * n * n * (Math.floor((n + 1) / 3) + 24)) / 50);
      else if (n < 36) value = Math.floor((n * n * n * (n + 14)) / 50);
      else value = Math.floor((n * n * n * (Math.floor(n / 2) + 32)) / 50);
      break;
    case "erratic":
      if (n < 50) value = Math.floor((n * n * n * (100 - n)) / 50);
      else if (n < 68) value = Math.floor((n * n * n * (150 - n)) / 100);
      else if (n < 98) value = Math.floor((n * n * n * Math.floor((1911 - 10 * n) / 3)) / 500);
      else value = Math.floor((n * n * n * (160 - n)) / 100);
      break;
    case "fluctuating":
      if (n < 15) value = Math.floor((n * n * n * (Math.floor((n + 1) / 3) + 24)) / 50);
      else if (n < 36) value = Math.floor((n * n * n * (n + 14)) / 50);
      else value = Math.floor((n * n * n * (Math.floor(n / 2) + 32)) / 50);
      break;
    default:
      value = n * n * n;
  }
  return Math.max(0, value);
}

export function stageMod(stage: number): number {
  const clamped = Math.max(-6, Math.min(6, stage));
  return clamped >= 0 ? (2 + clamped) / 2 : 2 / (2 - clamped);
}

export function calcStat(base: number, level: number, iv: number, stat: StatName): number {
  if (stat === "hp") return Math.floor(((2 * base + iv) * level) / 100) + level + 10;
  return Math.floor(((2 * base + iv) * level) / 100) + 5;
}

type StatBlock = Species["stats"];

export function battleStats(stats: StatBlock, level: number, iv: number, form: "shield" | "blade" | null): Record<StatName, number> {
  const base = { ...stats };
  if (form === "blade") {
    base.atk = 140;
    base.def = 50;
    base.spa = 140;
    base.spd = 50;
  }
  return {
    hp: calcStat(base.hp, level, iv, "hp"),
    atk: calcStat(base.atk, level, iv, "atk"),
    def: calcStat(base.def, level, iv, "def"),
    spa: calcStat(base.spa, level, iv, "spa"),
    spd: calcStat(base.spd, level, iv, "spd"),
    spe: calcStat(base.spe, level, iv, "spe"),
  };
}

export type DamageInput = {
  level: number;
  power: number;
  attack: number;
  defense: number;
  stab: boolean;
  effect: number;
  crit: boolean;
  burn: boolean;
  random: number;
  weather: number;
  screen: boolean;
  sniper: boolean;
  aura: number;
};

export function calcDamage(input: DamageInput): number {
  if (input.power <= 0 || input.effect === 0) return 0;
  const attack = Math.max(1, input.attack);
  const defense = Math.max(1, input.defense);
  let base = Math.floor(Math.floor((Math.floor((2 * input.level) / 5) + 2) * input.power * attack / defense) / 50) + 2;
  if (input.weather !== 1) base = Math.max(1, Math.floor(base * input.weather));
  if (input.crit) base = Math.max(1, Math.floor(base * (input.sniper ? 2.25 : 1.5)));
  base = Math.max(1, Math.floor((base * input.random) / 100));
  if (input.stab) base = Math.max(1, Math.floor(base * 1.5));
  base = Math.floor(base * input.effect);
  if (base <= 0) return 0;
  if (input.aura !== 1) base = Math.max(1, Math.floor(base * input.aura));
  if (input.burn) base = Math.max(1, Math.floor(base * 0.5));
  if (input.screen) base = Math.max(1, Math.floor(base * 0.5));
  return Math.max(1, base);
}
