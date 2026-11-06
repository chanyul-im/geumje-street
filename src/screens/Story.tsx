import { useEffect } from "react";
import { play } from "@/audio.ts";
import { useGame } from "@/game/store.tsx";

export function Story() {
  const { state, dispatch } = useGame();
  const script = state.script;

  function next() {
    if (!script) return;
    play("ui");
    dispatch({ type: "script" });
  }

  useEffect(() => {
    if (!script) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        play("ui");
        dispatch({ type: "script" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [script, dispatch]);

  if (!script) return null;
  const line = script.lines[script.index];
  if (!line) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-4 md:items-center" onClick={next} role="presentation">
      <div className="w-full max-w-xl rounded-2xl border border-gold/40 bg-card p-5 shadow-2xl" role="dialog" aria-label="대화">
        {line.speaker ? <p className="font-display text-xl text-gold">{line.speaker}</p> : null}
        <p className="mt-2 text-lg leading-relaxed">{line.text}</p>
        <p className="mt-4 text-right text-xs text-muted-foreground">
          {script.index + 1} / {script.lines.length} · 탭해서 계속
        </p>
      </div>
    </div>
  );
}
