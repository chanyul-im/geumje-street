import { useEffect, useRef, useState } from "react";
import { BOND_BADGES } from "@/data/catalog.ts";
import { getSpecies, speciesList } from "@/data/dex.ts";
import { STREET_BAN, LUMIOSE_IDS, nextSeoulSaturdayLabel, isSeoulSaturday } from "@/data/catalog.ts";
import { play } from "@/audio.ts";
import { BadgeRow } from "@/components/Bars.tsx";
import { Button } from "@/components/ui/button.tsx";
import { LANDMARKS, MAP_H, MAP_W, START, TILE, ZONE_RULE, spotReachable, spots, tileAt, tileChar, walkable, zoneAt, type Zone } from "@/game/city.ts";
import { bondCount, useGame, type Game } from "@/game/store.tsx";
import { drawMon, drawNpc, drawPlayer } from "@/visual/sprites.ts";
import { Menus } from "./Menus.tsx";

type Wild = { key: number; speciesId: number; level: number; x: number; y: number; zone: Zone["id"] };

const GUARDS = [spots.guard1, spots.guard2, spots.guard3] as const;

function bst(id: number): number {
  const stats = getSpecies(id).stats;
  return stats.hp + stats.atk + stats.def + stats.spa + stats.spd + stats.spe;
}

const WILD_POOL: Record<Zone["id"], number[]> = (() => {
  const list = LUMIOSE_IDS.filter((id) => !STREET_BAN.has(id) && speciesList.some((species) => species.id === id));
  const sorted = [...list].sort((a, b) => bst(a) - bst(b));
  const cut = Math.ceil(sorted.length / 3);
  return { street: sorted.slice(0, cut), park: sorted.slice(cut, cut * 2), north: sorted.slice(cut * 2) };
})();

function tilesOf(zone: Zone["id"]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < MAP_H; y += 1) {
    for (let x = 0; x < MAP_W; x += 1) if (zoneAt(x, y) === zone) out.push({ x, y });
  }
  return out;
}

const GUARD_KEYS = new Set<string>([spots.guard1, spots.guard2, spots.guard3].map((guard) => `${guard.x},${guard.y}`));

const TILES: Record<Zone["id"], { x: number; y: number }[]> = {
  street: tilesOf("street"),
  park: tilesOf("park"),
  north: tilesOf("north").filter((tile) => !GUARD_KEYS.has(`${tile.x},${tile.y}`)),
};

let wildKey = 1;

function paintTile(ctx: CanvasRenderingContext2D, tx: number, ty: number) {
  const ch = tileChar(tx, ty);
  const tile = tileAt(tx, ty);
  const color =
    ch === "P"
      ? "#5a2238"
      : ch === "R"
        ? "#1f4f8a"
        : ch === "C"
          ? "#f2f4f8"
          : ch === "S"
            ? "#2b5fa8"
            : ch === "F"
              ? "#4a2f78"
              : ch === "K"
                ? "#1a2848"
                : tile === "grass"
                  ? "#1d4a32"
                  : tile === "water"
                    ? "#16385c"
                    : tile === "plaza"
                      ? "#4a4468"
                      : tile === "road"
                        ? "#35314f"
                        : tile === "door"
                          ? "#8a7040"
                          : "#120e18";
  ctx.fillStyle = color;
  ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
  if (ch === "C") {
    ctx.fillStyle = "#e23b4a";
    ctx.fillRect(tx * TILE, ty * TILE, TILE, 10);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(tx * TILE + 12, ty * TILE + 2, 8, 6);
    ctx.fillRect(tx * TILE + 14, ty * TILE, 4, 10);
  }
  if (ch === "S") {
    ctx.fillStyle = "#f0c14a";
    ctx.fillRect(tx * TILE, ty * TILE, TILE, 8);
    ctx.fillStyle = "#1a2440";
    ctx.fillRect(tx * TILE + 8, ty * TILE + 14, 16, 10);
  }
  if (ch === "R") {
    ctx.fillStyle = "#6ec5ff";
    ctx.fillRect(tx * TILE, ty * TILE, TILE, 8);
  }
  if (tile === "road" || tile === "plaza") {
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(tx * TILE, ty * TILE, TILE, 2);
  }
  if (tile === "grass") {
    ctx.fillStyle = "#2f6b3c";
    ctx.fillRect(tx * TILE + 6, ty * TILE + 18, 4, 8);
    ctx.fillRect(tx * TILE + 16, ty * TILE + 10, 4, 10);
  }
  if (tile === "door") {
    ctx.fillStyle = "#e6c36a";
    ctx.fillRect(tx * TILE + 8, ty * TILE + 6, 16, 20);
    ctx.fillStyle = "#2a2108";
    ctx.fillRect(tx * TILE + 14, ty * TILE + 14, 4, 4);
  }
}

function drawSign(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.font = "bold 12px 'IBM Plex Sans KR', sans-serif";
  const width = Math.ceil(ctx.measureText(text).width) + 12;
  const left = Math.floor(x - width / 2);
  const top = Math.floor(y);
  ctx.fillStyle = "rgba(10, 8, 18, 0.82)";
  ctx.fillRect(left, top, width, 18);
  ctx.fillStyle = color;
  ctx.fillRect(left, top, 3, 18);
  ctx.fillStyle = "#fff6ea";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, left + 7, top + 10);
}

function nearestLandmark(tx: number, ty: number) {
  let best: (typeof LANDMARKS)[number] | null = null;
  let bestDist = 99;
  for (const spot of LANDMARKS) {
    if (!spotReachable(spot, tx, ty)) continue;
    const dist = Math.min(Math.abs(spot.x - tx) + Math.abs(spot.y - ty), Math.abs(spot.npcX - tx) + Math.abs(spot.npcY - ty));
    if (dist < bestDist) {
      best = spot;
      bestDist = dist;
    }
  }
  return best;
}

function nearestGuard(tx: number, ty: number, flags: string[]) {
  let best: (typeof GUARDS)[number] | null = null;
  let bestDist = 99;
  for (const guard of GUARDS) {
    if (flags.includes(`beat:${guard.id}`)) continue;
    if (!spotReachable(guard, tx, ty)) continue;
    const dist = Math.abs(guard.x - tx) + Math.abs(guard.y - ty);
    if (dist < bestDist) {
      best = guard;
      bestDist = dist;
    }
  }
  return best;
}

export function Overworld() {
  const { state } = useGame();
  if (state.phase.name !== "overworld" || !state.game) return null;
  const panel = state.phase.panel;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {panel === "play" ? <City /> : <Menus panel={panel} summaryUid={state.phase.summaryUid} />}
    </div>
  );
}

function City() {
  const { state, dispatch } = useGame();
  const game = state.game;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: game?.x ?? START.x * TILE, y: game?.y ?? START.y * TILE });
  const keys = useRef(new Set<string>());
  const wilds = useRef<Wild[]>([]);
  const frame = useRef(0);
  const gameRef = useRef(game);
  const scriptRef = useRef(state.script);
  const nearRef = useRef<{ id: string; name: string; color: string; hint: string } | null>(null);
  const [near, setNear] = useState<{ id: string; name: string; color: string; hint: string } | null>(null);
  const interactRef = useRef<() => void>(() => {});
  gameRef.current = game;
  scriptRef.current = state.script;

  useEffect(() => {
    if (!game) return;
    pos.current = { x: game.x, y: game.y };
  }, [game]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        event.preventDefault();
        keys.current.add(event.code);
      }
      if (event.code === "KeyE" || event.code === "Space") {
        event.preventDefault();
        interactRef.current();
      }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      dispatch({ type: "place", x: pos.current.x, y: pos.current.y });
    };
  }, [dispatch]);

  const tick = useRef<(dt: number, now: number) => void>(() => {});
  tick.current = (dt, now) => {
    const current = gameRef.current;
    if (current && !scriptRef.current) step(dt, current);
    draw(now);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tick.current(dt, now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  function blocked(px: number, py: number, current: Game): boolean {
    const points = [
      [px + 8, py + 10],
      [px + 24, py + 10],
      [px + 8, py + 28],
      [px + 24, py + 28],
    ];
    for (const [x, y] of points) {
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      if (!walkable(tx, ty)) return true;
      if (GUARDS.some((guard) => guard.x === tx && guard.y === ty && !current.flags.includes(`beat:${guard.id}`))) return true;
    }
    return false;
  }

  function step(dt: number, current: Game) {
    const pressed = keys.current;
    let dx = 0;
    let dy = 0;
    if (pressed.has("KeyA") || pressed.has("ArrowLeft") || pressed.has("pad-l")) dx -= 1;
    if (pressed.has("KeyD") || pressed.has("ArrowRight") || pressed.has("pad-r")) dx += 1;
    if (pressed.has("KeyW") || pressed.has("ArrowUp") || pressed.has("pad-u")) dy -= 1;
    if (pressed.has("KeyS") || pressed.has("ArrowDown") || pressed.has("pad-d")) dy += 1;
    const speed = 168;
    if (dx !== 0) {
      const nx = pos.current.x + dx * speed * dt;
      if (!blocked(nx, pos.current.y, current)) pos.current.x = nx;
      else bump(nx, pos.current.y, current);
    }
    if (dy !== 0) {
      const ny = pos.current.y + dy * speed * dt;
      if (!blocked(pos.current.x, ny, current)) pos.current.y = ny;
      else bump(pos.current.x, ny, current);
    }
    if (dx !== 0 || dy !== 0) frame.current += dt * 8;
    const tx = Math.floor((pos.current.x + 16) / TILE);
    const ty = Math.floor((pos.current.y + 22) / TILE);
    const next = nearestGuard(tx, ty, current.flags) ?? nearestLandmark(tx, ty);
    if ((next?.id ?? null) !== (nearRef.current?.id ?? null)) {
      nearRef.current = next;
      setNear(next);
    }
    meetWild(current);
    refillWilds();
  }

  function bump(px: number, py: number, current: Game) {
    const tx = Math.floor((px + 16) / TILE);
    const ty = Math.floor((py + 18) / TILE);
    const guard = GUARDS.find((entry) => entry.x === tx && entry.y === ty && !current.flags.includes(`beat:${entry.id}`));
    if (!guard) return;
    dispatch({ type: "place", x: pos.current.x, y: pos.current.y });
    dispatch({ type: "challenge", trainerId: guard.id });
  }

  function meetWild(current: Game) {
    const hit = wilds.current.find((wild) => Math.hypot(wild.x + 16 - (pos.current.x + 16), wild.y + 16 - (pos.current.y + 18)) < 46);
    if (!hit) return;
    if (!current.party.some((mon) => mon.hp > 0)) return;
    wilds.current = wilds.current.filter((wild) => wild.key !== hit.key);
    dispatch({ type: "place", x: pos.current.x, y: pos.current.y });
    dispatch({ type: "wild", speciesId: hit.speciesId, level: hit.level, legendary: false });
  }

  function refillWilds() {
    (Object.keys(ZONE_RULE) as Zone["id"][]).forEach((zone) => {
      const rule = ZONE_RULE[zone];
      const have = wilds.current.filter((wild) => wild.zone === zone).length;
      // Keep the south HQ road clearer so the red-roof center is easier to reach.
      const spotsLeft = TILES[zone].filter((tile) => !(zone === "street" && tile.y >= 20 && tile.x <= 16));
      if (!spotsLeft.length) return;
      for (let i = have; i < rule.limit; i += 1) {
        const pool = WILD_POOL[zone];
        if (!pool.length) return;
        const tile = spotsLeft[Math.floor(Math.random() * spotsLeft.length)];
        const speciesId = pool[Math.floor(Math.random() * pool.length)];
        const level = rule.min + Math.floor(Math.random() * (rule.max - rule.min + 1));
        wilds.current.push({ key: wildKey++, speciesId, level, zone, x: tile.x * TILE, y: tile.y * TILE });
      }
    });
  }

  function draw(now: number) {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const current = gameRef.current;
    if (!canvas || !wrap || !current) return;
    const width = wrap.clientWidth;
    const height = wrap.clientHeight;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const camX = pos.current.x + 16 - width / 2;
    const camY = pos.current.y + 16 - height / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0c0a14";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(-Math.floor(camX), -Math.floor(camY));
    const x0 = Math.max(0, Math.floor(camX / TILE) - 1);
    const y0 = Math.max(0, Math.floor(camY / TILE) - 1);
    const x1 = Math.min(MAP_W, Math.ceil((camX + width) / TILE) + 1);
    const y1 = Math.min(MAP_H, Math.ceil((camY + height) / TILE) + 1);
    for (let ty = y0; ty < y1; ty += 1) for (let tx = x0; tx < x1; tx += 1) paintTile(ctx, tx, ty);
    for (const wild of wilds.current) {
      const species = getSpecies(wild.speciesId);
      drawMon(ctx, wild.speciesId, null, species.types, wild.x + 4, wild.y + 2, 2, Math.floor(now / 280));
    }
    const bob = Math.floor(now / 400) % 2 === 0 ? 0 : -2;
    const npcScale = 3;
    for (const guard of GUARDS) {
      if (current.flags.includes(`beat:${guard.id}`)) continue;
      drawNpc(ctx, "guard", guard.npcX * TILE - 2, guard.npcY * TILE - 8, npcScale);
      ctx.fillStyle = "#c4454a";
      ctx.fillRect(guard.npcX * TILE + 6, guard.npcY * TILE - 14, 20, 5);
      drawSign(ctx, guard.short, guard.npcX * TILE + 16, guard.npcY * TILE - 30, guard.color);
    }
    if (!current.flags.includes("beat:emperor")) {
      drawNpc(ctx, "emperor", spots.emperor.npcX * TILE - 2, spots.emperor.npcY * TILE - 8 + bob, npcScale);
    }
    drawNpc(ctx, "marie", spots.marie.npcX * TILE - 2, spots.marie.npcY * TILE - 8 + bob, npcScale);
    drawNpc(ctx, "nurse", spots.center.npcX * TILE - 2, spots.center.npcY * TILE - 8 + bob, npcScale);
    drawNpc(ctx, "clerk", spots.shop.npcX * TILE - 2, spots.shop.npcY * TILE - 8 + bob, npcScale);
    drawNpc(ctx, "smith", spots.fusion.npcX * TILE - 2, spots.fusion.npcY * TILE - 8 + bob, npcScale);
    drawPlayer(ctx, current.gender, pos.current.x - 4, pos.current.y - 8, npcScale, Math.floor(frame.current));
    for (const spot of LANDMARKS) {
      drawSign(ctx, spot.short, spot.x * TILE + 16, spot.y * TILE - 18, spot.color);
    }
    ctx.restore();
    paintMini(current);
  }

  function paintMini(current: Game) {
    const mini = mapRef.current;
    if (!mini) return;
    const ctx = mini.getContext("2d");
    if (!ctx) return;
    const scale = 4;
    mini.width = MAP_W * scale;
    mini.height = MAP_H * scale;
    for (let ty = 0; ty < MAP_H; ty += 1) {
      for (let tx = 0; tx < MAP_W; tx += 1) {
        const ch = tileChar(tx, ty);
        const tile = tileAt(tx, ty);
        ctx.fillStyle =
          ch === "C" ? "#e23b4a" : ch === "S" ? "#f0c14a" : ch === "R" ? "#4ea0ff" : tile === "grass" ? "#2f6b3c" : tile === "water" ? "#245688" : tile === "wall" ? "#1a1628" : tile === "door" ? "#e6c36a" : "#3a3558";
        ctx.fillRect(tx * scale, ty * scale, scale, scale);
      }
    }
    for (const spot of LANDMARKS) {
      ctx.fillStyle = spot.color;
      ctx.fillRect(spot.x * scale - 1, spot.y * scale - 1, scale + 2, scale + 2);
    }
    ctx.fillStyle = "#fff";
    ctx.fillRect(Math.floor(pos.current.x / TILE) * scale, Math.floor(pos.current.y / TILE) * scale, scale, scale);
    void current;
  }

  function playerTile() {
    const tx = Math.floor((pos.current.x + 16) / TILE);
    const ty = Math.floor((pos.current.y + 22) / TILE);
    return { tx, ty };
  }

  function runSpot(id: string, current: Game) {
    if (id === "marie") {
      play("ui");
      dispatch({ type: "talk", lines: [{ speaker: "마리", text: hint(current) }] });
      return;
    }
    if (id === "center") {
      play("heal");
      dispatch({ type: "heal" });
      return;
    }
    if (id === "shop") {
      play("ui");
      dispatch({ type: "panel", panel: "shop" });
      return;
    }
    if (id === "fusion") {
      play("ui");
      dispatch({ type: "panel", panel: "fuse" });
      return;
    }
    if (id === "cave") {
      play("ui");
      dispatch({ type: "cave" });
      return;
    }
    if (id === "emperor") {
      if (current.flags.includes("beat:emperor")) {
        dispatch({ type: "talk", lines: [{ speaker: "샤를로", text: "금제는 풀렸다. 토요일의 동굴은 네가 연 문이다." }] });
        return;
      }
      if (!GUARDS.every((guard) => current.flags.includes(`beat:${guard.id}`))) {
        dispatch({ type: "talk", lines: [{ speaker: "샤를로", text: "근위가 아직 복도를 막고 있다. 남쪽부터 뚫어라." }] });
        return;
      }
      if (bondCount(current) < BOND_BADGES) {
        dispatch({ type: "talk", lines: [{ speaker: "샤를로", text: `봉인이 ${BOND_BADGES - bondCount(current)}개 남았다. 지가르데가 너를 알아보기 전엔 들이지 않겠다.` }] });
        return;
      }
      play("ui");
      dispatch({ type: "challenge", trainerId: "emperor" });
    }
  }

  function interact() {
    const current = gameRef.current;
    if (!current || scriptRef.current) return;
    const { tx, ty } = playerTile();
    dispatch({ type: "place", x: pos.current.x, y: pos.current.y });
    const guard = nearestGuard(tx, ty, current.flags);
    if (guard) {
      play("ui");
      dispatch({ type: "challenge", trainerId: guard.id });
      return;
    }
    const spot = nearestLandmark(tx, ty);
    if (spot) {
      runSpot(spot.id, current);
      return;
    }
    play("ui");
    dispatch({ type: "notice", text: "주변에 조사할 사람이나 문이 없다. 간판이 보이는 곳까지 가까이 가 봐." });
  }
  interactRef.current = interact;

  function hold(code: string, on: boolean) {
    if (on) keys.current.add(code);
    else keys.current.delete(code);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 px-3 pt-2">
        <p className="text-sm text-gold">미르시티 · 봉인 {game ? bondCount(game) : 0}/{BOND_BADGES}</p>
        {game ? <BadgeRow owned={game.badges} /> : null}
      </div>
      <div ref={wrapRef} className="relative min-h-0 flex-1 touch-none">
        <canvas ref={canvasRef} className="pixel h-full w-full" />
        <div className="absolute top-2 right-2 overflow-hidden rounded-xl border border-gold/50 bg-black/70 shadow-lg">
          <canvas ref={mapRef} className="pixel block" aria-label="미니맵" />
          <p className="px-2 py-1 text-[10px] text-gold">빨강=센터 · 노랑=상점</p>
        </div>
        {near ? (
          <button type="button" className="absolute top-3 left-3 max-w-[70%] rounded-2xl border border-gold/50 bg-ink/90 px-3 py-2 text-left shadow-lg" onClick={interact}>
            <p className="text-sm font-semibold" style={{ color: near.color }}>
              {near.name}
            </p>
            <p className="text-xs text-muted-foreground">{near.hint} · 조사 / E</p>
          </button>
        ) : (
          <div className="absolute top-3 left-3 rounded-2xl border border-white/15 bg-ink/70 px-3 py-2 text-xs text-muted-foreground">
            빨간 지붕 = 포켓몬센터 · 노란 지붕 = 상점
          </div>
        )}
        <Button className="absolute bottom-4 left-4 h-14 min-w-20 text-base" onClick={interact}>
          조사
        </Button>
        <div className="absolute right-4 bottom-4 grid grid-cols-3 gap-2">
          <span />
          <Pad label="▲" code="pad-u" onHold={hold} />
          <span />
          <Pad label="◀" code="pad-l" onHold={hold} />
          <Pad label="▼" code="pad-d" onHold={hold} />
          <Pad label="▶" code="pad-r" onHold={hold} />
        </div>
      </div>
      <div className="grid grid-cols-4 border-t border-white/10 bg-black/25">
        {(
          [
            ["party", "파티"],
            ["bag", "가방"],
            ["dex", "도감"],
            ["map", "지도"],
          ] as const
        ).map(([panel, label]) => (
          <button
            key={panel}
            type="button"
            className="min-h-14 py-3 text-sm font-semibold text-cream"
            onClick={() => {
              play("ui");
              dispatch({ type: "place", x: pos.current.x, y: pos.current.y });
              dispatch({ type: "panel", panel });
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Pad({ label, code, onHold }: { label: string; code: string; onHold: (code: string, on: boolean) => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid h-16 w-16 touch-none place-items-center rounded-2xl border border-gold/50 bg-black/65 text-lg font-bold text-cream select-none active:bg-gold/30"
      onPointerDown={(event) => {
        event.preventDefault();
        onHold(code, true);
      }}
      onPointerUp={() => onHold(code, false)}
      onPointerLeave={() => onHold(code, false)}
      onPointerCancel={() => onHold(code, false)}
    >
      {label}
    </button>
  );
}

function hint(game: Game): string {
  if (!game.flags.includes("beat:guard1")) return "남문 경비가 골목을 막고 있어. 다치면 북서쪽 빨간 지붕 포켓몬센터로 가. 거리의 포켓몬은 닿으면 배틀이 된다.";
  if (!game.flags.includes("beat:guard2")) return "중문이다. 풀밭 와일드존에는 더 강한 포켓몬이 있어. 센터는 여전히 북서쪽 빨간 지붕이다.";
  if (!game.flags.includes("beat:guard3")) return "내문 근위는 메가진화를 쓴다. 메가링이 있다면 배틀에서 같이 써.";
  if (bondCount(game) < BOND_BADGES) return `성문은 봉인 ${BOND_BADGES}개로 잠겨 있어. 지금 ${bondCount(game)}개. 지가르데의 레벨을 올려.`;
  if (!game.flags.includes("beat:emperor")) return "황제 샤를로가 성 안에서 기다린다. 금제를 끝낼 시간이야.";
  return isSeoulSaturday() ? "오늘 토요일이다. 동쪽 동굴이 이차원으로 열렸어." : `동굴은 토요일에 열린다. ${nextSeoulSaturdayLabel()}.`;
}
