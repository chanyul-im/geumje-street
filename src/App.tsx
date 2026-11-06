import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { loadMute, play, setMuted } from "@/audio.ts";
import { Button } from "@/components/ui/button.tsx";
import { bondCount, GameProvider, useGame } from "@/game/store.tsx";
import { BattleView } from "@/screens/BattleView.tsx";
import { EvolveScreen, LearnScreen } from "@/screens/Ceremony.tsx";
import { Overworld } from "@/screens/Overworld.tsx";
import { Story } from "@/screens/Story.tsx";
import { TitleScreen } from "@/screens/Title.tsx";

export default function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}

function Shell() {
  const { state, dispatch } = useGame();
  const [mute, setMute] = useState(loadMute);
  const game = state.game;
  const playing = state.phase.name === "overworld" || state.phase.name === "battle" || state.phase.name === "learn" || state.phase.name === "evolve";

  return (
    <div className="kalos-sky stars min-h-dvh text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col p-0 sm:p-3 lg:p-5">
        <div className="relative flex min-h-dvh flex-1 flex-col overflow-hidden border-0 bg-ink/90 shadow-2xl sm:min-h-[calc(100dvh-1.5rem)] sm:rounded-[1.75rem] sm:border sm:border-gold/30 lg:min-h-[calc(100dvh-2.5rem)]">
          <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-white/10 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="min-w-0">
              <p className="font-display text-xl leading-none text-gold">금제의 거리</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {game && playing ? `${game.name} · ${game.money.toLocaleString("ko-KR")}원 · 봉인 ${bondCount(game)}/8` : "미르시티"}
              </p>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              {state.phase.name === "overworld" ? (
                <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "panel", panel: "help" })}>
                  도움말
                </Button>
              ) : null}
              {playing ? (
                <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "logout" })}>
                  계정
                </Button>
              ) : null}
              <Button
                size="icon"
                variant="ghost"
                aria-label={mute ? "소리 켜기" : "소리 끄기"}
                onClick={() => {
                  const next = !mute;
                  setMute(next);
                  setMuted(next);
                  if (!next) play("ui");
                }}
              >
                {mute ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </Button>
            </div>
          </header>
          <main className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)]">
            {state.phase.name === "title" || state.phase.name === "create" ? <TitleScreen /> : null}
            {state.phase.name === "overworld" ? <Overworld /> : null}
            {state.phase.name === "battle" ? <BattleView /> : null}
            {state.phase.name === "learn" ? <LearnScreen /> : null}
            {state.phase.name === "evolve" ? <EvolveScreen /> : null}
          </main>
          {state.notice ? (
            <button type="button" className="absolute top-16 right-3 left-3 z-20 rounded-xl border border-gold/40 bg-card px-4 py-3 text-left text-sm shadow-lg" onClick={() => dispatch({ type: "notice", text: null })}>
              {state.notice}
            </button>
          ) : null}
        </div>
      </div>
      <Story />
    </div>
  );
}
