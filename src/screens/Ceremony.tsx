import { play } from "@/audio.ts";
import { TypeBadge } from "@/components/Bars.tsx";
import { Portrait } from "@/visual/Portrait.tsx";
import { Button } from "@/components/ui/button.tsx";
import { getMove, getSpecies } from "@/data/dex.ts";
import { useGame } from "@/game/store.tsx";
import { withJosa } from "@/lib/korean.ts";

export function LearnScreen() {
  const { state, dispatch } = useGame();
  if (state.phase.name !== "learn" || !state.game) return null;
  const phase = state.phase;
  const mon = state.game.party.find((entry) => entry.uid === phase.uid) ?? state.game.box.find((entry) => entry.uid === phase.uid);
  const move = getMove(phase.moveId);
  const species = mon ? getSpecies(mon.speciesId) : null;
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6">
      <p className="text-xs tracking-[0.18em] text-gold/80">새 기술</p>
      <h2 className="font-display text-3xl text-gold">{move.name}</h2>
      <div className="flex items-center gap-2">
        <TypeBadge type={move.type} />
        <span className="text-sm text-muted-foreground">{move.power > 0 ? `위력 ${move.power}` : "변화 기술"} · PP {move.pp}</span>
      </div>
      <p className="text-sm leading-relaxed">
        {species ? `${species.name}에게 ${withJosa(move.name, "을/를")} 가르칠 자리를 고른다.` : "가르칠 자리를 고른다."} 빼낼 기술을 누르거나, 이번엔 거절한다.
      </p>
      <div className="grid gap-2">
        {mon?.moves.map((slot, index) => {
          const known = getMove(slot.id);
          return (
            <Button
              key={slot.id}
              variant="secondary"
              onClick={() => {
                play("ui");
                dispatch({ type: "learn", slot: index });
              }}
            >
              {known.name} 대신 익힌다
            </Button>
          );
        })}
        <Button
          variant="ghost"
          onClick={() => {
            play("ui");
            dispatch({ type: "learn", slot: null });
          }}
        >
          익히지 않는다
        </Button>
      </div>
    </div>
  );
}

export function EvolveScreen() {
  const { state, dispatch } = useGame();
  if (state.phase.name !== "evolve" || !state.game) return null;
  const phase = state.phase;
  const mon = state.game.party.find((entry) => entry.uid === phase.uid) ?? state.game.box.find((entry) => entry.uid === phase.uid);
  const before = mon ? getSpecies(mon.speciesId) : null;
  const after = getSpecies(phase.into);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-6 text-center">
      <p className="text-xs tracking-[0.18em] text-gold/80">진화</p>
      <div className="flex items-center gap-4">
        {before && mon ? <Portrait speciesId={before.id} form={mon.form} size={110} /> : null}
        <span className="text-gold">→</span>
        <Portrait speciesId={after.id} size={110} />
      </div>
      <h2 className="font-display text-3xl">{before ? `${before.name} → ${after.name}` : after.name}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">빛이 잦아든 뒤의 모습을 받아들일까.</p>
      <div className="flex w-full max-w-sm gap-2">
        <Button
          className="flex-1"
          variant="ghost"
          onClick={() => {
            play("ui");
            dispatch({ type: "evolve", accept: false });
          }}
        >
          그만둔다
        </Button>
        <Button
          className="flex-1"
          onClick={() => {
            play("level");
            dispatch({ type: "evolve", accept: true });
          }}
        >
          진화한다
        </Button>
      </div>
    </div>
  );
}
