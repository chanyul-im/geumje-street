import { useEffect, useState } from "react";
import { play } from "@/audio.ts";
import { withJosa } from "@/lib/korean.ts";
import { Meter, TypeBadge } from "@/components/Bars.tsx";
import { STATUS_KO } from "@/components/labels.ts";
import { Button } from "@/components/ui/button.tsx";
import { combatProfile, getMove, getSpecies, megasOf } from "@/data/dex.ts";
import { ITEMS, ITEM_IDS, type ItemId } from "@/data/items.ts";
import type { Battle } from "@/game/battle.ts";
import { maxHp, type Mon } from "@/game/mon.ts";
import { useGame } from "@/game/store.tsx";
import { Portrait } from "@/visual/Portrait.tsx";

type Menu = "root" | "fight" | "bag" | "party";

function usable(item: ItemId, mon: Mon, kind: Battle["kind"]): boolean {
  const info = ITEMS[item];
  if (info.kind === "ball") return kind === "wild";
  if (info.kind === "revive") return mon.hp <= 0;
  if (info.kind === "status") return mon.hp > 0 && Boolean(mon.status);
  if (info.kind === "heal") return mon.hp > 0 && mon.hp < maxHp(mon);
  return false;
}

function Plate({ mon, align, mood }: { mon: Mon; align: "left" | "right"; mood: "idle" | "hit" | "faint" }) {
  const look = combatProfile(mon);
  const cap = maxHp(mon);
  const art = <Portrait speciesId={mon.speciesId} form={mon.form} aspect={mon.aspect} size={96} />;
  return (
    <div className={align === "right" ? "ml-auto w-full max-w-lg" : "w-full max-w-lg"}>
      <div className={mood === "faint" ? "flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 opacity-50" : "flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-4"}>
        {align === "left" ? art : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate font-display text-2xl">{look.name}</p>
            <p className="text-base text-gold">Lv.{mon.level}</p>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Meter value={mon.hp} max={cap} />
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {Math.max(0, mon.hp)}/{cap}
            </span>
          </div>
          <div className="mt-1 flex gap-1">
            {look.types.map((type) => (
              <TypeBadge key={type} type={type} small />
            ))}
            {mon.status ? <span className="text-[11px] text-crimson">{STATUS_KO[mon.status]}</span> : null}
          </div>
        </div>
        {align === "right" ? art : null}
      </div>
    </div>
  );
}

export function BattleView() {
  const { state, dispatch } = useGame();
  const battle = state.battle;

  function step() {
    if (!battle) return;
    const upcoming = battle.queue[battle.cursor + 1];
    play(upcoming?.sfx ?? "ui");
    dispatch({ type: "advance-battle" });
  }

  useEffect(() => {
    if (!battle || battle.phase !== "playback") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const upcoming = battle.queue[battle.cursor + 1];
      play(upcoming?.sfx ?? "ui");
      dispatch({ type: "advance-battle" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [battle, dispatch]);

  if (!battle || !state.game) {
    return <p className="p-6 text-muted-foreground">배틀 정보를 찾지 못했다.</p>;
  }

  const foe = battle.foeTeam[battle.foeActive];
  const mine = battle.party[battle.active];
  const line = battle.queue[battle.cursor]?.text ?? "";
  const foeMood = foe && foe.hp <= 0 ? "faint" : battle.queue[battle.cursor]?.sfx === "hit" || battle.queue[battle.cursor]?.sfx === "super" ? "hit" : "idle";
  const weather =
    battle.weather === "sun" ? "쾌청" : battle.weather === "rain" ? "비" : battle.weather === "sand" ? "모래바람" : battle.weather === "hail" ? "싸라기눈" : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 pt-3 text-xs text-muted-foreground">
        <span>{battle.trainerName ?? (battle.legendary ? "전설" : "야생")}</span>
        {weather ? <span>{weather}</span> : <span />}
      </div>
      <div className="flex flex-1 flex-col justify-center gap-6 px-3 py-4">
        {foe ? <Plate mon={foe} align="right" mood={foeMood} /> : null}
        {mine ? <Plate mon={mine} align="left" mood={mine.hp <= 0 ? "faint" : "idle"} /> : null}
      </div>
      <div className="border-t border-white/10 bg-black/35 p-4">
        <button type="button" className="w-full rounded-xl px-1 py-3 text-left" onClick={() => battle.phase === "playback" && step()}>
          <p className="min-h-14 text-lg leading-relaxed">{line}</p>
          {battle.phase === "playback" ? <p className="text-right text-xs text-gold">탭해서 계속</p> : null}
        </button>
        {battle.phase === "done" ? (
          <Button
            className="mt-2 w-full"
            onClick={() => {
              play("ui");
              dispatch({ type: "finish-battle" });
            }}
          >
            배틀을 마친다
          </Button>
        ) : null}
        {battle.phase === "switch" ? (
          <PartyPick
            battle={battle}
            forced
            onPick={(index) => {
              play("ui");
              dispatch({ type: "send", index });
            }}
          />
        ) : null}
        {battle.phase === "action" && mine ? (
          <ActionMenu key={battle.turn} battle={battle} mine={mine} bag={state.game.bag} />
        ) : null}
      </div>
    </div>
  );
}

function ActionMenu({ battle, mine, bag }: { battle: Battle; mine: Mon; bag: Record<ItemId, number> }) {
  const { state, dispatch } = useGame();
  const [menu, setMenu] = useState<Menu>("root");
  const [pending, setPending] = useState<ItemId | null>(null);
  const megas = megasOf(mine.speciesId);
  const [megaId, setMegaId] = useState<string | null>(null);
  const [zOn, setZOn] = useState(false);
  const flags = state.game?.flags ?? [];
  const canMega = flags.includes("mega-ring") && !battle.megaUsed && !mine.aspect && megas.length > 0;
  const canZ = flags.includes("z-ring") && !battle.zUsed;

  if (pending) {
    return (
      <div className="mt-2 grid gap-2">
        <p className="text-sm text-muted-foreground">{withJosa(ITEMS[pending].name, "을/를")} 쓸 포켓몬</p>
        {battle.party.map((mon, index) => {
          const ok = usable(pending, mon, battle.kind);
          return (
            <button
              key={mon.uid}
              type="button"
              disabled={!ok}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-left disabled:opacity-40"
              onClick={() => {
                play("ui");
                dispatch({ type: "battle", command: { kind: "item", item: pending, target: index } });
              }}
            >
              <span>
                {getSpecies(mon.speciesId).name} Lv.{mon.level}
              </span>
              <span className="text-xs text-muted-foreground">
                HP {mon.hp}/{maxHp(mon)}
              </span>
            </button>
          );
        })}
        <Button variant="ghost" onClick={() => setPending(null)}>
          돌아가기
        </Button>
      </div>
    );
  }

  if (menu === "fight") {
    return (
      <div className="mt-2 grid grid-cols-2 gap-2">
        {mine.moves.map((slot, index) => {
          const move = getMove(slot.id);
          return (
            <button
              key={`${slot.id}-${index}`}
              type="button"
              disabled={slot.pp <= 0}
              className="min-h-16 rounded-2xl border border-border bg-card px-3 py-3 text-left disabled:opacity-40"
              onClick={() => {
                play("ui");
                dispatch({ type: "battle", command: { kind: "fight", index, mega: canMega ? megaId : null, z: canZ && zOn } });
              }}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-base font-semibold">{move.name}</span>
                <TypeBadge type={move.type} small />
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                PP {slot.pp}/{move.pp}
                {move.power > 0 ? ` · 위력 ${move.power}` : ""}
              </span>
            </button>
          );
        })}
        <Button className="col-span-2" variant="ghost" onClick={() => setMenu("root")}>
          돌아가기
        </Button>
      </div>
    );
  }

  if (menu === "bag") {
    const owned = ITEM_IDS.filter((id) => (bag[id] ?? 0) > 0);
    return (
      <div className="mt-2 grid max-h-52 gap-2 overflow-y-auto">
        {owned.map((id) => (
          <button
            key={id}
            type="button"
            className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-left"
            onClick={() => {
              if (ITEMS[id].kind === "ball") {
                if (battle.kind !== "wild") {
                  dispatch({ type: "notice", text: "남의 포켓몬에게는 공을 던질 수 없다." });
                  return;
                }
                play("ui");
                dispatch({ type: "battle", command: { kind: "item", item: id, target: 0 } });
                return;
              }
              setPending(id);
            }}
          >
            <span>
              <span className="block text-sm font-semibold">{ITEMS[id].name}</span>
              <span className="block text-[11px] text-muted-foreground">{ITEMS[id].desc}</span>
            </span>
            <span className="text-sm text-gold">×{bag[id]}</span>
          </button>
        ))}
        {owned.length === 0 ? <p className="text-sm text-muted-foreground">가방이 비어 있다.</p> : null}
        <Button variant="ghost" onClick={() => setMenu("root")}>
          돌아가기
        </Button>
      </div>
    );
  }

  if (menu === "party") {
    return (
      <PartyPick
        battle={battle}
        onBack={() => setMenu("root")}
        onPick={(index) => {
          play("ui");
          dispatch({ type: "battle", command: { kind: "switch", index } });
        }}
      />
    );
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      {canMega ? (
        <button
          type="button"
          className={megaId ? "col-span-2 min-h-12 rounded-2xl border border-gold bg-gold/20 px-3 py-3 text-base" : "col-span-2 min-h-12 rounded-2xl border border-border px-3 py-3 text-base"}
          onClick={() => {
            if (!megaId) {
              setMegaId(megas[0].id);
              return;
            }
            const index = megas.findIndex((form) => form.id === megaId);
            setMegaId(megas[index + 1]?.id ?? null);
          }}
        >
          {megaId ? `메가진화 · ${megas.find((form) => form.id === megaId)?.name}` : "메가진화 준비"}
        </button>
      ) : null}
      {canZ ? (
        <button type="button" className={zOn ? "col-span-2 min-h-12 rounded-2xl border border-gold bg-gold/20 px-3 py-3 text-base" : "col-span-2 min-h-12 rounded-2xl border border-border px-3 py-3 text-base"} onClick={() => setZOn((value) => !value)}>
          {zOn ? "Z기술 켜짐" : "Z기술 준비"}
        </button>
      ) : null}
      <Button size="lg" onClick={() => setMenu("fight")}>
        싸움
      </Button>
      <Button size="lg" variant="secondary" onClick={() => setMenu("bag")}>
        가방
      </Button>
      <Button size="lg" variant="secondary" onClick={() => setMenu("party")}>
        포켓몬
      </Button>
      <Button
        size="lg"
        variant="outline"
        onClick={() => {
          if (battle.kind === "trainer") {
            dispatch({ type: "notice", text: "트레이너전에서는 도망칠 수 없다." });
            return;
          }
          play("ui");
          dispatch({ type: "battle", command: { kind: "run" } });
        }}
      >
        도망
      </Button>
    </div>
  );
}

function PartyPick({
  battle,
  forced = false,
  onPick,
  onBack,
}: {
  battle: Battle;
  forced?: boolean;
  onPick: (index: number) => void;
  onBack?: () => void;
}) {
  return (
    <div className="mt-2 grid gap-2">
      <p className="text-sm text-muted-foreground">{forced ? "내보낼 포켓몬을 고른다" : "교대할 포켓몬"}</p>
      {battle.party.map((mon, index) => {
        const active = index === battle.active;
        const fainted = mon.hp <= 0;
        return (
          <button
            key={mon.uid}
            type="button"
            disabled={fainted || active}
            className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-left disabled:opacity-40"
            onClick={() => onPick(index)}
          >
            <span>
              {getSpecies(mon.speciesId).name} Lv.{mon.level}
              {active ? " · 배틀 중" : ""}
              {fainted ? " · 기절" : ""}
            </span>
            <span className="text-xs text-muted-foreground">
              {mon.hp}/{maxHp(mon)}
            </span>
          </button>
        );
      })}
      {onBack ? (
        <Button variant="ghost" onClick={onBack}>
          돌아가기
        </Button>
      ) : null}
    </div>
  );
}
