import type { StatusName } from "@/game/mon.ts";

export const STATUS_KO: Record<StatusName, string> = {
  brn: "화상",
  par: "마비",
  psn: "독",
  tox: "맹독",
  slp: "잠듦",
  frz: "얼음",
};

export const STAT_KO = {
  hp: "HP",
  atk: "공격",
  def: "방어",
  spa: "특수공격",
  spd: "특수방어",
  spe: "스피드",
} as const;
