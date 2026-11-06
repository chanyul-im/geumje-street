import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from "react";
import { BOND_BADGES, CAVE_LEVEL, ZYGARDE_ID, isSeoulSaturday, nextSeoulSaturdayLabel, rollCave } from "@/data/catalog.ts";
import { getMove, getSpecies } from "@/data/dex.ts";
import { emptyBag, type Bag, type ItemId } from "@/data/items.ts";
import { SHOP_ITEMS, START, TILE, resolveTrainer, spots } from "./city.ts";
import { advance, perform, sendReplacement, startTrainerBattle, startWildBattle, type Battle, type BattleCommand } from "./battle.ts";
import { createMon, evolveMon, healMon, maxHp, type Mon } from "./mon.ts";

const KEY = "kalos-empire-v1";

export type Panel = "play" | "party" | "bag" | "dex" | "shop" | "box" | "summary" | "help" | "map" | "fuse";

export type Phase =
  | { name: "title" }
  | { name: "create" }
  | { name: "overworld"; panel: Panel; summaryUid?: string }
  | { name: "battle" }
  | { name: "learn"; uid: string; moveId: string }
  | { name: "evolve"; uid: string; into: number };

export type ScriptEffect = { op: "zygarde" } | { op: "flag"; id: string };

export type Script = {
  lines: { speaker?: string; text: string }[];
  index: number;
  then: ScriptEffect[];
};

export type Game = {
  version: 2;
  name: string;
  gender: "m" | "f";
  x: number;
  y: number;
  party: Mon[];
  box: Mon[];
  bag: Bag;
  money: number;
  badges: string[];
  flags: string[];
  dex: Record<string, "seen" | "caught">;
  cave: number[];
};

export type Account = {
  id: string;
  name: string;
  gender: "m" | "f";
  updatedAt: number;
  save: Persisted;
};

type Persisted = {
  game: Game;
  phase: Phase;
  script: Script | null;
  battle: Battle | null;
  learnQueue: { uid: string; moveId: string }[];
  evolveQueue: { uid: string; into: number }[];
  afterScript: Script | null;
};

export type State = Omit<Persisted, "game"> & {
  game: Game | null;
  accounts: Account[];
  accountId: string | null;
  notice: string | null;
};

export type GameAction =
  | { type: "create"; name: string; gender: "m" | "f" }
  | { type: "pick"; id: string }
  | { type: "delete-account"; id: string }
  | { type: "logout" }
  | { type: "script" }
  | { type: "panel"; panel: Panel; summaryUid?: string }
  | { type: "place"; x: number; y: number }
  | { type: "wild"; speciesId: number; level: number; legendary?: boolean }
  | { type: "challenge"; trainerId: string }
  | { type: "cave" }
  | { type: "talk"; lines: { speaker?: string; text: string }[] }
  | { type: "notice"; text: string | null }
  | { type: "battle"; command: BattleCommand }
  | { type: "advance-battle" }
  | { type: "send"; index: number }
  | { type: "finish-battle" }
  | { type: "buy"; item: ItemId }
  | { type: "heal" }
  | { type: "use"; item: ItemId; uid: string }
  | { type: "move"; uid: string; dir: -1 | 1 }
  | { type: "deposit"; uid: string }
  | { type: "withdraw"; uid: string }
  | { type: "learn"; slot: number | null }
  | { type: "evolve"; accept: boolean }
  | { type: "form"; uid: string; form: string | null }
  | { type: "fuse"; form: "kyurem-white" | "kyurem-black" }
  | { type: "unfuse"; uid: string };

function blankPlay(): Omit<Persisted, "game"> & { game: null } {
  return { game: null, phase: { name: "title" }, script: null, battle: null, learnQueue: [], evolveQueue: [], afterScript: null };
}

function loadAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as { accounts?: Account[] };
    return (data.accounts ?? []).filter((account) => account.save?.game?.version === 2 && Array.isArray(account.save.game.party));
  } catch {
    return [];
  }
}

export const initialState: State = { ...blankPlay(), accounts: loadAccounts(), accountId: null, notice: null };

function syncAccounts(state: State): Account[] {
  if (!state.accountId || !state.game) return state.accounts;
  return state.accounts.map((account) =>
    account.id === state.accountId ? { ...account, name: state.game!.name, gender: state.game!.gender, updatedAt: Date.now(), save: persisted(state) } : account,
  );
}

function persisted(state: State): Persisted {
  if (!state.game) throw new Error("no game");
  return {
    game: state.game,
    phase: state.phase,
    script: state.script,
    battle: state.battle,
    learnQueue: state.learnQueue,
    evolveQueue: state.evolveQueue,
    afterScript: state.afterScript,
  };
}

function see(game: Game, speciesId: number): Game {
  const key = String(speciesId);
  if (game.dex[key] === "caught") return game;
  return { ...game, dex: { ...game.dex, [key]: "seen" } };
}

function markCaught(game: Game, speciesId: number): Game {
  return { ...game, dex: { ...game.dex, [String(speciesId)]: "caught" } };
}

function addItem(bag: Bag, item: ItemId, count: number): Bag {
  return { ...bag, [item]: (bag[item] ?? 0) + count };
}

function replaceMon(game: Game, mon: Mon): Game {
  if (game.party.some((member) => member.uid === mon.uid)) return { ...game, party: game.party.map((member) => (member.uid === mon.uid ? mon : member)) };
  return { ...game, box: game.box.map((member) => (member.uid === mon.uid ? mon : member)) };
}

function findMon(game: Game, uid: string): Mon | undefined {
  return game.party.find((mon) => mon.uid === uid) ?? game.box.find((mon) => mon.uid === uid);
}

function stripAspect(mon: Mon): Mon {
  return mon.aspect ? { ...mon, aspect: null, hp: Math.min(mon.hp, maxHp({ ...mon, aspect: null })) } : mon;
}

function freshGame(name: string, gender: "m" | "f"): Game {
  const bag = emptyBag();
  bag.pokeball = 10;
  bag.potion = 5;
  return {
    version: 2,
    name,
    gender,
    x: START.x * TILE,
    y: START.y * TILE,
    party: [],
    box: [],
    bag,
    money: 3000,
    badges: [],
    flags: [],
    dex: {},
    cave: [],
  };
}

function intro(name: string): Script {
  return {
    index: 0,
    then: [{ op: "zygarde" }],
    lines: [
      { speaker: "마리", text: `${name}. 잘 왔어. 황제 샤를로가 배틀을 금하고, 포켓몬을 미르시티 밖으로 내쫓고 있어.` },
      { speaker: "마리", text: "반란군은 포켓몬과 함께 경비를 뚫으려 해. 네가 그 길에 서 줬으면 한다." },
      { speaker: "마리", text: "이 아이는 지가르데의 10% 폼이야. 레벨이 오를 때마다 유대가 깊어지고, 제국의 봉인이 하나씩 풀린다." },
      { speaker: "마리", text: "다치면 북서쪽의 빨간 지붕 포켓몬센터로 가. 문 앞 노란 간판이 보여. 동쪽 노란 지붕은 상점이다." },
    ],
  };
}

function applyEffect(state: State, effect: ScriptEffect): State {
  const game = state.game;
  if (!game) return state;
  if (effect.op === "flag") return { ...state, game: { ...game, flags: game.flags.includes(effect.id) ? game.flags : [...game.flags, effect.id] } };
  if (effect.op === "zygarde") {
    if (game.party.some((mon) => mon.speciesId === ZYGARDE_ID)) return state;
    const mon = createMon(ZYGARDE_ID, 10, 31, "zygarde-10");
    return { ...state, game: markCaught({ ...game, party: [mon, ...game.party].slice(0, 6) }, ZYGARDE_ID) };
  }
  return state;
}

function queueFromParty(party: Mon[], learnQueue: State["learnQueue"]): { learnQueue: State["learnQueue"]; evolveQueue: State["evolveQueue"] } {
  const evolveQueue = party.filter((mon) => mon.pendingEvo && getSpecies(mon.speciesId).evo).map((mon) => ({ uid: mon.uid, into: getSpecies(mon.speciesId).evo!.into }));
  return { learnQueue, evolveQueue };
}

function presentQueue(state: State): State {
  if (state.learnQueue.length > 0) {
    const [head, ...rest] = state.learnQueue;
    return { ...state, learnQueue: rest, phase: { name: "learn", uid: head.uid, moveId: head.moveId }, battle: null };
  }
  if (state.evolveQueue.length > 0) {
    const [head, ...rest] = state.evolveQueue;
    return { ...state, evolveQueue: rest, phase: { name: "evolve", uid: head.uid, into: head.into }, battle: null };
  }
  if (state.afterScript) return { ...state, script: state.afterScript, afterScript: null, phase: { name: "overworld", panel: "play" }, battle: null };
  return { ...state, phase: { name: "overworld", panel: "play" }, battle: null };
}

function grantBond(game: Game, beforeLevel: number, lines: Script["lines"]): Game {
  const after = game.party.find((mon) => mon.speciesId === ZYGARDE_ID)?.level ?? beforeLevel;
  const gained = Math.max(0, after - beforeLevel);
  const badges = game.badges.slice();
  for (let i = 0; i < gained && badges.length < BOND_BADGES; i += 1) badges.push(`bond-${badges.length + 1}`);
  const flags = game.flags.slice();
  if (badges.length >= 4 && !flags.includes("mega-ring")) {
    flags.push("mega-ring");
    lines.push({ speaker: "마리", text: "유대가 메가링에 닿았다. 배틀마다 한 번, 메가진화를 쓸 수 있다. 지가르데는 이제 50% 폼으로도 설 수 있어." });
  }
  if (badges.length >= 6 && !flags.includes("z-ring")) {
    flags.push("z-ring");
    lines.push({ speaker: "마리", text: "Z링이다. 한 배틀에 한 번, 기술을 Z기술로 끌어올려." });
  }
  if (badges.length >= BOND_BADGES && !flags.includes("zygarde-complete")) {
    flags.push("zygarde-complete");
    lines.push({ speaker: "마리", text: "세포가 모였다. 지가르데는 컴플리트 폼으로 모습을 바꿀 수 있다. 성문이 너를 알아본다." });
  } else if (gained > 0 && badges.length < BOND_BADGES) {
    lines.push({ text: `지가르데와의 유대가 깊어졌다. 봉인 ${badges.length}/${BOND_BADGES}.` });
  }
  return { ...game, badges, flags };
}

function finishBattle(state: State): State {
  const battle = state.battle;
  const game = state.game;
  if (!battle || !game || battle.phase !== "done") return state;
  const beforeBond = game.party.find((mon) => mon.speciesId === ZYGARDE_ID)?.level ?? 0;
  let next: Game = {
    ...game,
    party: battle.party.map((mon) => stripAspect({ ...mon, moves: mon.moves.map((move) => ({ ...move })) })),
    money: game.money + battle.money,
    cave: game.cave.slice(),
  };
  const lines: Script["lines"] = [];
  if (battle.caught) {
    const mon = stripAspect(battle.caught);
    if (next.party.length < 6) next.party = [...next.party, mon];
    else {
      next.box = [...next.box, mon];
      lines.push({ text: "파티가 가득해서 박스로 보냈다." });
    }
    next = markCaught(next, mon.speciesId);
  }
  if (battle.result === "win" && battle.trainerId) {
    if (!next.flags.includes(`beat:${battle.trainerId}`)) next.flags = [...next.flags, `beat:${battle.trainerId}`];
    const resolved = resolveTrainer(battle.trainerId);
    lines.push({ speaker: resolved.name, text: resolved.win.replaceAll("{name}", next.name) });
    if (battle.trainerId === "emperor") lines.push({ speaker: "마리", text: "금제가 풀렸다. 토요일마다, 프리즘 너머의 동굴이 이차원으로 열린다." });
  } else if (battle.result === "lose") {
    next.money = Math.floor(next.money / 2);
    next.party = next.party.map(healMon);
    next.cave = [];
    next.x = spots.center.x * TILE;
    next.y = (spots.center.y + 1) * TILE;
    lines.push({ text: "눈앞이 캄캄해졌다. 포켓몬센터로 옮겨졌다." });
    if (battle.trainerId) lines.push({ speaker: resolveTrainer(battle.trainerId).name, text: resolveTrainer(battle.trainerId).lose.replaceAll("{name}", next.name) });
  } else if (battle.result === "flee") next.cave = [];
  next = grantBond(next, beforeBond, lines);
  const queued = queueFromParty(next.party, battle.learnQueue);
  const continueCave = (battle.result === "win" || battle.result === "catch") && next.cave.length > 0;
  if (continueCave) {
    const [speciesId, ...cave] = next.cave;
    next = see({ ...next, cave }, speciesId);
    const foe = createMon(speciesId, CAVE_LEVEL, 31);
    const started = startWildBattle(next.party, foe, true);
    return { ...state, game: next, battle: started, phase: { name: "battle" }, learnQueue: queued.learnQueue, evolveQueue: [...state.evolveQueue, ...queued.evolveQueue], afterScript: lines.length ? { lines, index: 0, then: [] } : state.afterScript };
  }
  const afterScript = lines.length ? { lines, index: 0, then: [] } : null;
  return presentQueue({ ...state, game: next, learnQueue: queued.learnQueue, evolveQueue: queued.evolveQueue, afterScript, battle: null });
}

function applyFieldItem(mon: Mon, item: ItemId): Mon | null {
  if (item === "revive") {
    if (mon.hp > 0) return null;
    return { ...mon, hp: Math.max(1, Math.floor(maxHp(mon) / 2)), status: null, sleep: 0, toxic: 0 };
  }
  if (item === "fullheal") {
    if (!mon.status) return null;
    return { ...mon, status: null, sleep: 0, toxic: 0 };
  }
  const amount = item === "potion" ? 20 : item === "superpotion" ? 50 : item === "hyperpotion" ? 200 : 0;
  if (!amount || mon.hp <= 0 || mon.hp >= maxHp(mon)) return null;
  return { ...mon, hp: Math.min(maxHp(mon), mon.hp + amount) };
}

export function reducer(state: State, action: GameAction): State {
  if (action.type !== "notice" && action.type !== "place") state = state.notice ? { ...state, notice: null } : state;
  switch (action.type) {
    case "notice":
      return { ...state, notice: action.text };
    case "logout":
      return { ...blankPlay(), accounts: syncAccounts(state), accountId: null, notice: null };
    case "delete-account": {
      const accounts = syncAccounts(state).filter((account) => account.id !== action.id);
      if (state.accountId === action.id) return { ...blankPlay(), accounts, accountId: null, notice: null };
      return { ...state, accounts };
    }
    case "pick": {
      const accounts = syncAccounts(state);
      const account = accounts.find((entry) => entry.id === action.id);
      if (!account) return { ...state, notice: "계정을 찾지 못했다." };
      return { ...account.save, accounts, accountId: account.id, notice: null };
    }
    case "create": {
      const name = action.name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 8);
      if (!name) return { ...state, notice: "이름을 입력해 줘." };
      const id = `a${Date.now().toString(36)}`;
      const game = freshGame(name, action.gender);
      const next: State = {
        ...blankPlay(),
        accounts: state.accounts,
        accountId: id,
        game,
        phase: { name: "overworld", panel: "play" },
        script: intro(name),
        notice: null,
      };
      const account: Account = { id, name, gender: action.gender, updatedAt: Date.now(), save: persisted(next) };
      return { ...next, accounts: [...state.accounts, account] };
    }
    case "script": {
      if (!state.script) return state;
      if (state.script.index < state.script.lines.length - 1) return { ...state, script: { ...state.script, index: state.script.index + 1 } };
      const then = state.script.then;
      return then.reduce(applyEffect, { ...state, script: null });
    }
    case "panel":
      if (state.phase.name === "battle" || state.script || !state.game) return state;
      return { ...state, phase: { name: "overworld", panel: action.panel, summaryUid: action.summaryUid } };
    case "place":
      if (!state.game) return state;
      return { ...state, game: { ...state.game, x: action.x, y: action.y } };
    case "wild": {
      if (!state.game) return state;
      if (!state.game.party.some((mon) => mon.hp > 0)) return { ...state, notice: "싸울 수 있는 포켓몬이 없다." };
      const foe = createMon(action.speciesId, action.level, action.legendary ? 31 : 8 + Math.floor(Math.random() * 12));
      const game = see(state.game, action.speciesId);
      return { ...state, game, battle: startWildBattle(game.party, foe, Boolean(action.legendary)), phase: { name: "battle" } };
    }
    case "challenge": {
      if (!state.game) return state;
      if (!state.game.party.some((mon) => mon.hp > 0)) return { ...state, notice: "싸울 수 있는 포켓몬이 없다." };
      const resolved = resolveTrainer(action.trainerId);
      const team = resolved.party.map((slot) => {
        const mon = createMon(slot.speciesId, slot.level, slot.iv ?? 20);
        return slot.aspect ? { ...mon, aspect: slot.aspect } : mon;
      });
      let game = state.game;
      for (const mon of team) game = see(game, mon.speciesId);
      const battle = startTrainerBattle(game.party, team, { trainerId: resolved.id, trainerName: resolved.name, reward: resolved.reward });
      return { ...state, game, battle, phase: { name: "battle" } };
    }
    case "talk":
      if (!state.game) return state;
      return { ...state, script: { index: 0, then: [], lines: action.lines } };
    case "cave": {
      if (!state.game) return state;
      if (!state.game.flags.includes("beat:emperor")) return { ...state, notice: "황제를 쓰러뜨린 뒤에 동굴이 숨을 쉰다." };
      if (!isSeoulSaturday()) return { ...state, notice: `이차원 동굴은 토요일에만 열린다. ${nextSeoulSaturdayLabel()}.` };
      if (!state.game.party.some((mon) => mon.hp > 0)) return { ...state, notice: "싸울 수 있는 포켓몬이 없다." };
      const [first, ...rest] = rollCave(Math.random);
      if (!first) return state;
      const game = see({ ...state.game, cave: rest }, first);
      const foe = createMon(first, CAVE_LEVEL, 31);
      return { ...state, game, battle: startWildBattle(game.party, foe, true), phase: { name: "battle" } };
    }
    case "battle": {
      if (!state.battle || !state.game || state.battle.phase !== "action") return state;
      if (action.command.kind === "item") {
        const item = action.command.item;
        if ((state.game.bag[item] ?? 0) <= 0) return { ...state, notice: "도구가 없다." };
        const bag = { ...state.game.bag, [item]: state.game.bag[item] - 1 };
        return { ...state, game: { ...state.game, bag }, battle: perform(state.battle, action.command) };
      }
      return { ...state, battle: perform(state.battle, action.command) };
    }
    case "advance-battle":
      return state.battle ? { ...state, battle: state.battle.phase === "playback" ? advance(state.battle) : state.battle } : state;
    case "send":
      return state.battle ? { ...state, battle: sendReplacement(state.battle, action.index) } : state;
    case "finish-battle":
      return finishBattle(state);
    case "buy": {
      if (!state.game) return state;
      const info = SHOP_ITEMS.find((entry) => entry.item === action.item);
      if (!info) return state;
      if (state.game.badges.length < info.needBadges) return { ...state, notice: "아직 팔지 않는다." };
      if (state.game.money < info.price) return { ...state, notice: "돈이 부족하다." };
      return { ...state, game: { ...state.game, money: state.game.money - info.price, bag: addItem(state.game.bag, action.item, 1) } };
    }
    case "heal":
      if (!state.game) return state;
      return {
        ...state,
        game: { ...state.game, party: state.game.party.map(healMon) },
        script: { index: 0, then: [], lines: [{ speaker: "간호순", text: "빨간 지붕 포켓몬센터야. 포켓몬을 모두 치료했어. 봉인 따위는 여기까지 못 들어와." }] },
      };
    case "use": {
      if (!state.game) return state;
      const mon = findMon(state.game, action.uid);
      if (!mon || (state.game.bag[action.item] ?? 0) <= 0) return state;
      const used = applyFieldItem(mon, action.item);
      if (!used) return { ...state, notice: "지금은 쓸 수 없다." };
      return { ...state, game: replaceMon({ ...state.game, bag: { ...state.game.bag, [action.item]: state.game.bag[action.item] - 1 } }, used) };
    }
    case "move": {
      if (!state.game) return state;
      const index = state.game.party.findIndex((mon) => mon.uid === action.uid);
      const swap = index + action.dir;
      if (index < 0 || swap < 0 || swap >= state.game.party.length) return state;
      const party = state.game.party.slice();
      const [picked] = party.splice(index, 1);
      party.splice(swap, 0, picked);
      return { ...state, game: { ...state.game, party } };
    }
    case "deposit": {
      if (!state.game || state.game.party.length <= 1) return { ...state, notice: "마지막 포켓몬은 맡길 수 없다." };
      const mon = state.game.party.find((member) => member.uid === action.uid);
      if (!mon) return state;
      if (mon.speciesId === ZYGARDE_ID) return { ...state, notice: "지가르데는 곁을 떠나지 않는다." };
      return { ...state, game: { ...state.game, party: state.game.party.filter((member) => member.uid !== action.uid), box: [...state.game.box, mon] } };
    }
    case "withdraw": {
      if (!state.game || state.game.party.length >= 6) return { ...state, notice: "파티가 가득 찼다." };
      const mon = state.game.box.find((member) => member.uid === action.uid);
      if (!mon) return state;
      return { ...state, game: { ...state.game, box: state.game.box.filter((member) => member.uid !== action.uid), party: [...state.game.party, mon] } };
    }
    case "learn": {
      if (state.phase.name !== "learn" || !state.game) return state;
      const { uid, moveId } = state.phase;
      const mon = findMon(state.game, uid);
      let game = state.game;
      if (mon && action.slot !== null && mon.moves[action.slot]) {
        const moves = mon.moves.slice();
        moves[action.slot] = { id: moveId, pp: getMove(moveId).pp };
        game = replaceMon(game, { ...mon, moves });
      }
      return presentQueue({ ...state, game });
    }
    case "evolve": {
      if (state.phase.name !== "evolve" || !state.game) return state;
      const mon = findMon(state.game, state.phase.uid);
      let game = state.game;
      let learnQueue = state.learnQueue;
      if (mon && action.accept) {
        const evolved = evolveMon(mon);
        game = markCaught(replaceMon(game, evolved.mon), evolved.mon.speciesId);
        learnQueue = [...evolved.queued.map((moveId) => ({ uid: mon.uid, moveId })), ...learnQueue];
      } else if (mon) game = replaceMon(game, { ...mon, pendingEvo: false });
      return presentQueue({ ...state, game, learnQueue });
    }
    case "form": {
      if (!state.game) return state;
      const mon = findMon(state.game, action.uid);
      if (!mon) return state;
      if (mon.speciesId === ZYGARDE_ID) {
        const need = action.form === "zygarde-complete" ? 8 : action.form === null ? 4 : 0;
        if (state.game.badges.length < need) return { ...state, notice: `유대 봉인 ${need}개가 필요하다.` };
      }
      const ratio = maxHp(mon) === 0 ? 1 : mon.hp / maxHp(mon);
      const next = { ...mon, form: action.form };
      next.hp = Math.max(1, Math.min(maxHp(next), Math.round(maxHp(next) * ratio)));
      return { ...state, game: replaceMon(state.game, next) };
    }
    case "fuse": {
      if (!state.game) return state;
      const partnerId = action.form === "kyurem-white" ? 643 : 644;
      const kyurem = state.game.party.find((mon) => mon.speciesId === 646);
      const partner = state.game.party.find((mon) => mon.speciesId === partnerId);
      if (!kyurem || !partner) return { ...state, notice: "큐레무와 레시라무, 또는 제크로무가 파티에 있어야 한다." };
      if (kyurem.fusedId) return { ...state, notice: "이미 합체한 큐레무다." };
      const ratio = kyurem.hp / maxHp(kyurem);
      const fused = { ...kyurem, form: action.form, fusedId: partnerId };
      fused.hp = Math.max(1, Math.min(maxHp(fused), Math.round(maxHp(fused) * ratio)));
      return { ...state, game: { ...replaceMon(state.game, fused), party: state.game.party.filter((mon) => mon.uid !== partner.uid).map((mon) => (mon.uid === fused.uid ? fused : mon)) } };
    }
    case "unfuse": {
      if (!state.game) return state;
      const mon = state.game.party.find((entry) => entry.uid === action.uid);
      if (!mon?.fusedId) return state;
      if (state.game.party.length >= 6) return { ...state, notice: "떼어 낼 자리가 없다." };
      const ratio = mon.hp / maxHp(mon);
      const host = { ...mon, form: null, fusedId: null };
      host.hp = Math.max(1, Math.min(maxHp(host), Math.round(maxHp(host) * ratio)));
      const partner = createMon(mon.fusedId, mon.level, mon.iv);
      return { ...state, game: { ...replaceMon(state.game, host), party: state.game.party.map((entry) => (entry.uid === host.uid ? host : entry)).concat(partner) } };
    }
    default:
      return state;
  }
}

const Ctx = createContext<{ state: State; dispatch: Dispatch<GameAction> } | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ accounts: syncAccounts(state) }));
  }, [state]);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useGame() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("게임 상태가 없다");
  return ctx;
}

export function bondCount(game: Game): number {
  return Math.min(BOND_BADGES, game.badges.length);
}
