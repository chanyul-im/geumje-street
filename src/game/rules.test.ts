import { describe, expect, it } from "vitest";
import { effectiveness } from "@/data/chart.ts";
import { BEYOND_IDS, CAVE_IDS, LUMIOSE_IDS, isSeoulSaturday, rollCave } from "@/data/catalog.ts";
import { combatProfile, getSpecies, megasOf, speciesList } from "@/data/dex.ts";
import { trainers } from "./city.ts";
import { advance, perform, startTrainerBattle, startWildBattle } from "./battle.ts";
import { createMon, gainExp } from "./mon.ts";
import { calcDamage, expForLevel } from "./stats.ts";

describe("미르도감과 이차원도감", () => {
  it("미르도감은 232마리다", () => {
    expect(new Set(LUMIOSE_IDS).size).toBe(232);
    for (const id of LUMIOSE_IDS) expect(speciesList.some((species) => species.id === id)).toBe(true);
  });

  it("이차원 동굴의 손님은 도감에 있고 레벨 재료가 된다", () => {
    expect(CAVE_IDS).toContain(650);
    expect(CAVE_IDS).toContain(653);
    expect(CAVE_IDS).toContain(656);
    expect(CAVE_IDS).toContain(144);
    expect(CAVE_IDS).toContain(493);
    for (const id of CAVE_IDS) expect(speciesList.some((species) => species.id === id)).toBe(true);
    for (const id of BEYOND_IDS) expect(LUMIOSE_IDS).not.toContain(id);
  });

  it("진화는 도감 안의 포켓몬만 가리킨다", () => {
    const ids = new Set(speciesList.map((species) => species.id));
    for (const species of speciesList) {
      if (!species.evo) continue;
      expect(ids.has(species.evo.into)).toBe(true);
      expect(species.evo.level).toBeGreaterThan(1);
    }
  });

  it("지가르데 10%와 메가진화가 있다", () => {
    const mon = createMon(718, 10, 31, "zygarde-10");
    expect(combatProfile(mon).name).toBe("지가르데 10%");
    expect(megasOf(6).map((form) => form.id)).toContain("charizard-mega-x");
    expect(megasOf(150).map((form) => form.id)).toContain("mewtwo-mega-y");
  });

  it("토요일만 동굴이 열리고 한 번에 최대 세 마리다", () => {
    expect(isSeoulSaturday(new Date("2026-11-07T03:00:00Z"))).toBe(true);
    expect(isSeoulSaturday(new Date("2026-11-04T03:00:00Z"))).toBe(false);
    for (let i = 0; i < 20; i += 1) {
      const rolled = rollCave(() => i / 20);
      expect(rolled.length).toBeGreaterThanOrEqual(1);
      expect(rolled.length).toBeLessThanOrEqual(3);
      for (const id of rolled) expect(CAVE_IDS).toContain(id);
    }
  });

  it("경비와 황제 파티는 도감 안에 있다", () => {
    const ids = new Set(speciesList.map((species) => species.id));
    for (const trainer of Object.values(trainers)) {
      for (const slot of trainer.party) expect(ids.has(slot.speciesId)).toBe(true);
    }
  });
});

describe("상성", () => {
  it("페어리와 땅, 고스트의 대표 상성이 맞다", () => {
    expect(effectiveness("fire", ["grass"])).toBe(2);
    expect(effectiveness("water", ["fire"])).toBe(2);
    expect(effectiveness("electric", ["ground"])).toBe(0);
    expect(effectiveness("ghost", ["normal"])).toBe(0);
    expect(effectiveness("dragon", ["fairy"])).toBe(0);
    expect(effectiveness("fairy", ["dragon"])).toBe(2);
    expect(effectiveness("poison", ["fairy"])).toBe(2);
    expect(effectiveness("fighting", ["ghost"])).toBe(0);
    expect(effectiveness("steel", ["fairy"])).toBe(2);
  });

  it("효과가 굉장한 기술이 더 세다", () => {
    const base = { level: 50, power: 80, attack: 120, defense: 100, stab: true, crit: false, burn: false, random: 100, weather: 1, screen: false, sniper: false, aura: 1 };
    expect(calcDamage({ ...base, effect: 2 })).toBeGreaterThan(calcDamage({ ...base, effect: 0.5 }));
    expect(calcDamage({ ...base, effect: 0 })).toBe(0);
  });
});

describe("성장", () => {
  it("경험치는 레벨이 오를수록 늘어난다", () => {
    for (const growth of ["slow", "medium", "fast", "medium-slow", "slow-then-very-fast"]) {
      let prev = 0;
      for (let level = 2; level <= 100; level += 1) {
        const exp = expForLevel(growth, level);
        expect(exp).toBeGreaterThan(prev);
        prev = exp;
      }
    }
  });

  it("지가르데는 경험치를 받으면 레벨이 오른다", () => {
    const mon = createMon(718, 10, 31, "zygarde-10");
    const need = expForLevel(getSpecies(718).growth, 11) - mon.exp;
    const result = gainExp(mon, need);
    expect(result.mon.level).toBe(11);
    expect(result.notes.some((note) => note.includes("레벨이"))).toBe(true);
  });

  it("잡으면 경험치를 받고 배틀이 끝난다", () => {
    const player = createMon(718, 10, 31, "zygarde-10");
    player.moves = [{ id: "tackle", pp: 35 }];
    const foe = createMon(16, 12, 10);
    foe.hp = 1;
    let battle = startWildBattle([player], foe);
    battle = drain(battle);
    battle = perform(battle, { kind: "item", item: "masterball", target: 0 }, () => 0);
    battle = drain(battle);
    expect(battle.result).toBe("catch");
    expect(battle.party[0].exp).toBeGreaterThan(player.exp);
  });
});

describe("배틀", () => {
  it("공격하면 상대 HP가 줄어든다", () => {
    const player = createMon(653, 12, 31);
    const foe = createMon(659, 8, 10);
    let battle = startWildBattle([player], foe);
    battle = drain(battle);
    const ember = battle.party[0].moves.findIndex((move) => move.id === "ember");
    expect(ember).toBeGreaterThanOrEqual(0);
    battle = perform(battle, { kind: "fight", index: ember }, () => 0);
    battle = drain(battle);
    expect(battle.foeTeam[0].hp).toBeLessThan(maxOf(foe));
  });

  it("트레이너 이름은 한 번만 나온다", () => {
    const player = createMon(650, 5, 31);
    const foe = createMon(653, 5, 31);
    const battle = startTrainerBattle([player], [foe], { trainerId: "rival1", trainerName: "루이", reward: 500 });
    expect(battle.queue[0]?.text).toBe("루이가 승부를 걸어 왔다!");
    expect(battle.queue[1]?.text).toBe("루이의 푸호꼬가 나왔다!");
  });

  it("심술꾸러기는 능력이 떨어지는 기술을 반대로 받는다", () => {
    const player = createMon(686, 25, 31);
    player.moves = [{ id: "tail-whip", pp: 30 }];
    const foe = createMon(659, 5, 5);
    foe.moves = [{ id: "growl", pp: 40 }];
    let battle = startWildBattle([player], foe);
    battle = drain(battle);
    battle = perform(battle, { kind: "fight", index: 0 }, () => 0.99);
    battle = drain(battle);
    expect(battle.pVol.stages.atk).toBeGreaterThan(0);
  });
});

function drain(battle: ReturnType<typeof startWildBattle>) {
  let next = battle;
  let guard = 0;
  while (next.phase === "playback" && guard < 40) {
    next = advance(next);
    guard += 1;
  }
  return next;
}

function maxOf(mon: ReturnType<typeof createMon>) {
  return mon.hp;
}
