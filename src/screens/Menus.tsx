import { useEffect, useRef, useState } from "react";
import { BOND_BADGES, CAVE_IDS, LUMIOSE_IDS, ZYGARDE_ID } from "@/data/catalog.ts";
import { TYPE_KO } from "@/data/chart.ts";
import { ABILITY_TEXT, abilityName, combatProfile, formsOf, getMove, getSpecies, speciesBlurb } from "@/data/dex.ts";
import { ITEM_IDS, ITEMS, type ItemId } from "@/data/items.ts";
import { LANDMARKS, MAP_H, MAP_W, SHOP_ITEMS, TILE, tileAt, tileChar } from "@/game/city.ts";
import { maxHp } from "@/game/mon.ts";
import { battleStats, expForLevel } from "@/game/stats.ts";
import { bondCount, useGame, type Panel } from "@/game/store.tsx";
import { play } from "@/audio.ts";
import { Meter, TypeBadge } from "@/components/Bars.tsx";
import { STAT_KO, STATUS_KO } from "@/components/labels.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog } from "@/components/ui/dialog.tsx";
import { Portrait } from "@/visual/Portrait.tsx";

export function Menus({ panel, summaryUid }: { panel: Panel; summaryUid?: string }) {
  const { dispatch } = useGame();
  const back = (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => {
        play("ui");
        dispatch({ type: "panel", panel: "play" });
      }}
    >
      거리로
    </Button>
  );
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-3xl text-gold">{titleOf(panel)}</h2>
        {back}
      </div>
      {panel === "party" ? <Party /> : null}
      {panel === "bag" ? <Bag /> : null}
      {panel === "dex" ? <Dex /> : null}
      {panel === "summary" ? <Summary uid={summaryUid} /> : null}
      {panel === "shop" ? <Shop /> : null}
      {panel === "box" ? <Box /> : null}
      {panel === "map" ? <WorldMap /> : null}
      {panel === "fuse" ? <Fusion /> : null}
      {panel === "help" ? <Help /> : null}
    </div>
  );
}

function titleOf(panel: Panel): string {
  const names: Record<Panel, string> = {
    play: "거리",
    party: "파티",
    bag: "가방",
    dex: "도감",
    shop: "프렌들리숍",
    box: "박스",
    summary: "상태",
    help: "도움말",
    map: "미르시티",
    fuse: "합체 공방",
  };
  return names[panel];
}

function Party() {
  const { state, dispatch } = useGame();
  const game = state.game;
  if (!game) return null;
  return (
    <div className="grid gap-2">
      {game.party.map((mon, index) => {
        const look = combatProfile(mon);
        return (
          <div key={mon.uid} className="flex items-center gap-2 rounded-2xl border border-border bg-card/70 p-2">
            <Portrait speciesId={mon.speciesId} form={mon.form} aspect={mon.aspect} size={64} />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between text-sm">
                <span>{look.name}</span>
                <span className="text-gold">Lv.{mon.level}</span>
              </div>
              <Meter value={mon.hp} max={maxHp(mon)} />
              <Meter
                value={Math.max(0, mon.exp - expForLevel(getSpecies(mon.speciesId).growth, mon.level))}
                max={Math.max(1, (mon.level >= 100 ? 1 : expForLevel(getSpecies(mon.speciesId).growth, mon.level + 1) - expForLevel(getSpecies(mon.speciesId).growth, mon.level)))}
                tone="exp"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                HP {mon.hp}/{maxHp(mon)}
                {mon.status ? ` · ${STATUS_KO[mon.status]}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "panel", panel: "summary", summaryUid: mon.uid })}>
                  상태
                </Button>
                <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => dispatch({ type: "move", uid: mon.uid, dir: -1 })}>
                  위
                </Button>
                <Button size="sm" variant="ghost" disabled={index === game.party.length - 1} onClick={() => dispatch({ type: "move", uid: mon.uid, dir: 1 })}>
                  아래
                </Button>
                <Button size="sm" variant="outline" onClick={() => dispatch({ type: "deposit", uid: mon.uid })}>
                  맡기기
                </Button>
              </div>
            </div>
          </div>
        );
      })}
      <Button variant="secondary" onClick={() => dispatch({ type: "panel", panel: "box" })}>
        박스
      </Button>
    </div>
  );
}

function Bag() {
  const { state, dispatch } = useGame();
  const game = state.game;
  const [item, setItem] = useState<ItemId | null>(null);
  if (!game) return null;
  const owned = ITEM_IDS.filter((id) => game.bag[id] > 0);
  return (
    <div className="grid gap-2">
      {owned.length === 0 ? <p className="text-sm text-muted-foreground">가방이 비어 있다.</p> : null}
      {owned.map((id) => (
        <button
          key={id}
          type="button"
          className="flex items-center justify-between rounded-2xl border border-border px-3 py-3 text-left"
          onClick={() => {
            if (ITEMS[id].kind === "ball") {
              dispatch({ type: "notice", text: "공은 거리에서 닿은 배틀에서 던진다." });
              return;
            }
            setItem(id);
          }}
        >
          <span>
            <span className="block font-semibold">{ITEMS[id].name}</span>
            <span className="block text-xs text-muted-foreground">{ITEMS[id].desc}</span>
          </span>
          <span className="text-gold">×{game.bag[id]}</span>
        </button>
      ))}
      <Dialog open={item !== null} onOpenChange={(open) => !open && setItem(null)} title={item ? ITEMS[item].name : "도구"} description="회복할 포켓몬">
        <div className="grid gap-2">
          {game.party.map((mon) => (
            <Button
              key={mon.uid}
              variant="secondary"
              onClick={() => {
                if (!item) return;
                dispatch({ type: "use", item, uid: mon.uid });
                setItem(null);
              }}
            >
              {combatProfile(mon).name} · HP {mon.hp}/{maxHp(mon)}
            </Button>
          ))}
        </div>
      </Dialog>
    </div>
  );
}

function Dex() {
  const { state } = useGame();
  const game = state.game;
  const [book, setBook] = useState<"lumiose" | "beyond">("lumiose");
  const [id, setId] = useState<number | null>(null);
  if (!game) return null;
  const ids = book === "lumiose" ? LUMIOSE_IDS : CAVE_IDS;
  const caught = ids.filter((speciesId) => game.dex[String(speciesId)] === "caught").length;
  const species = id ? getSpecies(id) : null;
  const mark = id ? game.dex[String(id)] : undefined;
  return (
    <div>
      <div className="mb-3 flex gap-2">
        <Button size="sm" variant={book === "lumiose" ? "default" : "secondary"} onClick={() => setBook("lumiose")}>
          미르도감
        </Button>
        <Button size="sm" variant={book === "beyond" ? "default" : "secondary"} onClick={() => setBook("beyond")}>
          이차원도감
        </Button>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        잡음 {caught} / {ids.length}
      </p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {ids.map((speciesId) => {
          const stateMark = game.dex[String(speciesId)];
          const name = getSpecies(speciesId).name;
          return (
            <button key={speciesId} type="button" className="rounded-xl border border-border p-1 text-center" onClick={() => stateMark && setId(speciesId)}>
              {stateMark ? <Portrait speciesId={speciesId} size={52} /> : <div className="mx-auto grid size-12 place-items-center text-muted-foreground">?</div>}
              <span className="block truncate text-[10px]">{stateMark ? name : "???"}</span>
            </button>
          );
        })}
      </div>
      <Dialog open={Boolean(species && mark)} onOpenChange={(open) => !open && setId(null)} title={species && mark ? species.name : "도감"} description={species ? speciesBlurb(species) : undefined}>
        {species && mark ? (
          <div className="grid justify-items-center gap-2 text-sm">
            <Portrait speciesId={species.id} size={96} />
            <div className="flex gap-1">
              {species.types.map((type) => (
                <TypeBadge key={type} type={type} />
              ))}
            </div>
            <p className="text-muted-foreground">{mark === "caught" ? "잡아서 기록했다." : "만나기만 했다."}</p>
            {species.evo ? <p>Lv.{species.evo.level}에 {getSpecies(species.evo.into).name}</p> : <p className="text-muted-foreground">더는 진화하지 않는다.</p>}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function Summary({ uid }: { uid?: string }) {
  const { state, dispatch } = useGame();
  const game = state.game;
  if (!game) return null;
  const mon = game.party.find((entry) => entry.uid === uid) ?? game.box.find((entry) => entry.uid === uid);
  if (!mon) return <p className="text-sm text-muted-foreground">포켓몬을 찾지 못했다.</p>;
  const look = combatProfile(mon);
  const species = look.species;
  const stats = battleStats(look.stats, mon.level, mon.iv, null);
  const floor = expForLevel(species.growth, mon.level);
  const ceil = mon.level >= 100 ? floor : expForLevel(species.growth, mon.level + 1);
  const forms = formsOf(species).filter((form) => form.kind !== "mega");
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <Portrait speciesId={mon.speciesId} form={mon.form} aspect={mon.aspect} size={96} />
        <div>
          <p className="font-display text-2xl">{look.name}</p>
          <p className="text-gold">Lv.{mon.level}</p>
          <div className="mt-1 flex gap-1">
            {look.types.map((type) => (
              <TypeBadge key={type} type={type} />
            ))}
          </div>
          {mon.status ? <p className="text-xs text-crimson">{STATUS_KO[mon.status]}</p> : null}
        </div>
      </div>
      <div>
        <Meter value={Math.max(0, mon.exp - floor)} max={Math.max(1, ceil - floor)} tone="exp" />
        <p className="mt-1 text-xs text-muted-foreground">
          {mon.level >= 100 ? "최대 레벨" : `경험치 ${mon.exp - floor} / ${ceil - floor} · 다음 레벨까지 ${Math.max(0, ceil - mon.exp)}`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {(Object.keys(STAT_KO) as (keyof typeof STAT_KO)[]).map((key) => (
          <div key={key} className="flex justify-between rounded-lg bg-card px-3 py-2">
            <span className="text-muted-foreground">{STAT_KO[key]}</span>
            <span>
              {key === "hp" ? `${mon.hp}/` : ""}
              {stats[key]}
            </span>
          </div>
        ))}
      </div>
      <p className="text-sm">
        {abilityName(look.ability)} · {ABILITY_TEXT[look.ability] ?? "이 이야기에서 드러나는 특별한 효과는 없다."}
      </p>
      <div className="grid gap-1">
        {mon.moves.map((slot) => {
          const move = getMove(slot.id);
          return (
            <div key={slot.id} className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <TypeBadge type={move.type} small />
                {move.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {TYPE_KO[move.type]} · PP {slot.pp}/{move.pp}
              </span>
            </div>
          );
        })}
      </div>
      {mon.speciesId === ZYGARDE_ID ? (
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground">폼체인지 · 봉인 {bondCount(game)}/{BOND_BADGES}</p>
          <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "form", uid: mon.uid, form: "zygarde-10" })}>
            10% 폼
          </Button>
          <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "form", uid: mon.uid, form: null })}>
            50% 폼
          </Button>
          <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "form", uid: mon.uid, form: "zygarde-complete" })}>
            컴플리트 폼
          </Button>
        </div>
      ) : null}
      {forms.length > 0 && mon.speciesId !== ZYGARDE_ID ? (
        <div className="grid gap-2">
          <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "form", uid: mon.uid, form: null })}>
            기본 폼
          </Button>
          {forms.map((form) => (
            <Button key={form.id} size="sm" variant="secondary" onClick={() => dispatch({ type: "form", uid: mon.uid, form: form.id })}>
              {form.name}
            </Button>
          ))}
        </div>
      ) : null}
      {mon.fusedId ? (
        <Button variant="outline" onClick={() => dispatch({ type: "unfuse", uid: mon.uid })}>
          합체를 해제한다
        </Button>
      ) : null}
    </div>
  );
}

function Shop() {
  const { state, dispatch } = useGame();
  const game = state.game;
  if (!game) return null;
  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground">{game.money.toLocaleString("ko-KR")}원</p>
      {SHOP_ITEMS.map((entry) => {
        const info = ITEMS[entry.item];
        const locked = game.badges.length < entry.needBadges;
        return (
          <div key={entry.item} className="flex items-center justify-between gap-2 rounded-2xl border border-border px-3 py-3">
            <div>
              <p className="font-semibold">{info.name}</p>
              <p className="text-xs text-muted-foreground">
                {info.desc} · 보유 {game.bag[entry.item]}
                {locked ? ` · 봉인 ${entry.needBadges}` : ""}
              </p>
            </div>
            <Button size="sm" disabled={locked || game.money < entry.price} onClick={() => dispatch({ type: "buy", item: entry.item })}>
              {entry.price.toLocaleString("ko-KR")}원
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function Box() {
  const { state, dispatch } = useGame();
  const game = state.game;
  if (!game) return null;
  return (
    <div className="grid gap-3">
      <h3 className="text-sm text-muted-foreground">보관 {game.box.length}</h3>
      {game.box.length === 0 ? <p className="text-sm text-muted-foreground">박스가 비어 있다. 센터가 아니어도 파티에서 맡길 수 있다.</p> : null}
      {game.box.map((mon) => (
        <div key={mon.uid} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
          <button type="button" onClick={() => dispatch({ type: "panel", panel: "summary", summaryUid: mon.uid })}>
            {combatProfile(mon).name} Lv.{mon.level}
          </button>
          <Button size="sm" onClick={() => dispatch({ type: "withdraw", uid: mon.uid })}>
            찾는다
          </Button>
        </div>
      ))}
    </div>
  );
}

function WorldMap() {
  const { state } = useGame();
  const ref = useRef<HTMLCanvasElement>(null);
  const game = state.game;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !game) return;
    const scale = Math.max(4, Math.floor(Math.min(640, canvas.parentElement?.clientWidth ?? 320) / MAP_W));
    canvas.width = MAP_W * scale;
    canvas.height = MAP_H * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    for (let y = 0; y < MAP_H; y += 1) {
      for (let x = 0; x < MAP_W; x += 1) {
        const ch = tileChar(x, y);
        const tile = tileAt(x, y);
        ctx.fillStyle =
          ch === "P" ? "#6a3044" : ch === "R" ? "#2a4a78" : ch === "C" ? "#e23b4a" : ch === "S" ? "#f0c14a" : ch === "F" ? "#5a4080" : ch === "K" ? "#244878" : tile === "grass" ? "#2f6b3c" : tile === "water" ? "#245688" : tile === "wall" ? "#22182e" : tile === "door" ? "#e6c36a" : "#4a4468";
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    ctx.font = `bold ${Math.max(10, scale + 4)}px 'IBM Plex Sans KR', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    for (const spot of LANDMARKS) {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(spot.x * scale - 18, spot.y * scale - 16, 36, 14);
      ctx.fillStyle = spot.color;
      ctx.fillText(spot.short, spot.x * scale + scale / 2, spot.y * scale - 4);
    }
    ctx.fillStyle = "#fff";
    const px = Math.floor(game.x / TILE);
    const py = Math.floor(game.y / TILE);
    ctx.fillRect(px * scale, py * scale, scale, scale);
  }, [game]);
  return (
    <div>
      <canvas ref={ref} className="pixel w-full rounded-xl border border-gold/30" />
      <ul className="mt-3 grid gap-2 text-sm leading-relaxed">
        <li>
          <span className="font-semibold text-[#ff5a6a]">빨간 지붕 센터</span> · 북서쪽. 포켓몬을 치료한다.
        </li>
        <li>
          <span className="font-semibold text-[#ffc14a]">노란 지붕 상점</span> · 동쪽. 몬스터볼과 상처약을 산다.
        </li>
        <li>
          <span className="font-semibold text-[#4ea0ff]">파란 지붕 아지트</span> · 남서쪽. 마리가 있다.
        </li>
        <li>풀밭은 와일드존. 길의 포켓몬에게 닿아도 배틀이 된다.</li>
        <li>북쪽 성은 황제 샤를로. 봉인 여덟 개와 세 검문이 필요하다.</li>
        <li>동쪽 어두운 문은 토요일의 이차원 동굴.</li>
      </ul>
    </div>
  );
}

function Fusion() {
  const { state, dispatch } = useGame();
  const game = state.game;
  if (!game) return null;
  const has = (id: number) => game.party.some((mon) => mon.speciesId === id && !mon.fusedId);
  return (
    <div className="grid gap-3 text-sm leading-relaxed">
      <p>큐레무는 레시라무, 또는 제크로무와 하나로 설 수 있다. 둘 다 파티에 있어야 한다.</p>
      <Button disabled={!has(646) || !has(643)} onClick={() => dispatch({ type: "fuse", form: "kyurem-white" })}>
        화이트큐레무
      </Button>
      <Button disabled={!has(646) || !has(644)} onClick={() => dispatch({ type: "fuse", form: "kyurem-black" })}>
        블랙큐레무
      </Button>
      <p className="text-muted-foreground">해제는 큐레무의 상태 화면에서 한다. 다른 폼체인지도 상태 화면에 있다.</p>
    </div>
  );
}

function Help() {
  return (
    <div className="grid gap-3 text-sm leading-relaxed">
      <p>이동은 WASD 또는 방향키, 그리고 화면의 큰 패드. 조사 또는 E로 문과 사람에게 말을 건다.</p>
      <p>빨간 지붕이 포켓몬센터, 노란 지붕이 상점이다. 가까이 가면 위쪽에 이름 안내가 뜬다.</p>
      <p>길과 와일드존의 포켓몬에게 닿으면 배틀이 시작되고, 몬스터볼로 잡을 수 있다.</p>
      <p>지가르데가 레벨업할 때마다 봉인이 하나 풀린다. 여덟 개면 성문이 열린다.</p>
      <p>봉인 넷에 메가링, 여섯에 Z링. 메가진화와 Z기술은 배틀마다 한 번씩이다.</p>
      <p>이차원 동굴은 황제를 이긴 뒤, 실제 시간의 토요일마다 열린다. 한 번에 최대 세 마리가 레벨 70으로 이어 싸운다.</p>
      <p>계정은 첫 화면에서 새로 만들거나 지울 수 있다. 기록은 이 브라우저에 계정별로 남는다.</p>
      <p className="text-xs text-muted-foreground">포켓몬은 Nintendo / Game Freak / Creatures의 상표다. 도트는 이 게임을 위해 새로 그린 것이며 공식 스프라이트가 아니다.</p>
    </div>
  );
}
