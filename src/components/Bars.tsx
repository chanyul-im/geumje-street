import { TYPE_COLOR, TYPE_KO, type PType } from "@/data/chart.ts";
import { cn } from "@/lib/utils.ts";

export function TypeBadge({ type, small = false }: { type: PType; small?: boolean }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full font-semibold text-white", small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs")}
      style={{ background: TYPE_COLOR[type] }}
    >
      {TYPE_KO[type]}
    </span>
  );
}

export function Meter({ value, max, tone = "hp" }: { value: number; max: number; tone?: "hp" | "exp" }) {
  const ratio = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  const color = tone === "exp" ? "#5aa7e6" : ratio > 0.5 ? "#67c45a" : ratio > 0.2 ? "#e2b340" : "#d4534a";
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-black/40" role="meter" aria-valuenow={value} aria-valuemax={max}>
      <div className="hp-fill h-full rounded-full" style={{ width: `${ratio * 100}%`, background: color }} />
    </div>
  );
}

export function BadgeRow({ owned }: { owned: string[] }) {
  return (
    <div className="flex gap-1" aria-label="봉인">
      {Array.from({ length: 8 }, (_, index) => {
        const have = index < owned.length;
        return (
          <span key={index} className={cn("grid size-5 place-items-center rounded-full border text-[9px] font-bold", have ? "border-gold bg-gold text-ink" : "border-white/20 text-white/30")}>
            {index + 1}
          </span>
        );
      })}
    </div>
  );
}
