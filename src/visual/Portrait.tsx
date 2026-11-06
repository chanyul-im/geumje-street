import { useEffect, useRef } from "react";
import { combatProfile } from "@/data/dex.ts";
import { drawMon, drawPlayer } from "./sprites.ts";

export function Portrait({
  speciesId,
  form = null,
  aspect = null,
  size = 64,
}: {
  speciesId: number;
  form?: string | null;
  aspect?: string | null;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const look = combatProfile({ speciesId, form, aspect });
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.max(2, Math.floor(size / 18));
    drawMon(ctx, speciesId, aspect ?? form, look.types, 2, 2, scale);
  }, [speciesId, form, aspect, size, look.types, look.name]);
  return <canvas ref={ref} width={size} height={size} className="pixel" aria-label={look.name} />;
}

export function PlayerPortrait({ gender, size = 56 }: { gender: "m" | "f"; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPlayer(ctx, gender, 4, 2, 3, 0);
  }, [gender, size]);
  return <canvas ref={ref} width={size} height={size} className="pixel" aria-label={gender === "m" ? "남자 주인공" : "여자 주인공"} />;
}
