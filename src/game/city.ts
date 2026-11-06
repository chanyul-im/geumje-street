import type { ItemId } from "@/data/items.ts";

export const TILE = 32;

export type Tile = "wall" | "road" | "plaza" | "grass" | "door" | "water";

const ROWS = [
  "##########################################",
  "##PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP##",
  "##PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP##",
  "##PPPPPPPPPPPPPPPPPdPPPPPPPPPPPPPPPPPPPP##",
  "###################.######################",
  "###################.######################",
  "###################.######################",
  "###################.######################",
  "##........CCCC........,,........SSSS..~~##",
  "##........CCCC........,,........SSSS..~~##",
  "##........dCCC........,,........dSSS..~~##",
  "##..................,,,,..............~~##",
  "##gggggggggggg......,,,,......gggggggg..##",
  "##gggggggggggg......,,,,......gggggggg..##",
  "##gggggggggggg......,,,,......gggggggg..##",
  "##gggggggggggg......,,,,......gggggggg..##",
  "##..................,,,,................##",
  "##..FFFF..........................KKKK..##",
  "##..FFFF..........................KKKK..##",
  "##..Fd............................dKKK..##",
  "##......................................##",
  "##RRRR..............,,,,................##",
  "##RRRR..............,,,,................##",
  "##d.....................................##",
  "##......................................##",
  "##########################################",
];

const WIDTH = ROWS[0].length;
if (ROWS.some((row) => row.length !== WIDTH)) {
  throw new Error("미르시티 맵 가로가 맞지 않는다");
}

const KIND: Record<string, Tile> = {
  "#": "wall",
  P: "wall",
  C: "wall",
  S: "wall",
  F: "wall",
  K: "wall",
  R: "wall",
  "~": "water",
  ".": "road",
  ",": "plaza",
  g: "grass",
  d: "door",
};

export const MAP_W = WIDTH;
export const MAP_H = ROWS.length;

export function tileAt(tx: number, ty: number): Tile {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return "wall";
  return KIND[ROWS[ty][tx]] ?? "wall";
}

export function walkable(tx: number, ty: number): boolean {
  const tile = tileAt(tx, ty);
  return tile === "road" || tile === "plaza" || tile === "grass" || tile === "door";
}

export function tileChar(tx: number, ty: number): string {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return "#";
  return ROWS[ty][tx];
}

export type TrainerDef = {
  id: string;
  name: string;
  title: string;
  reward: number;
  intro: string;
  win: string;
  lose: string;
  party: { speciesId: number; level: number; iv?: number; aspect?: string | null }[];
};

export const trainers: Record<string, TrainerDef> = {
  guard1: {
    id: "guard1",
    name: "남문 경비",
    title: "제국 경비",
    reward: 1200,
    intro: "배틀은 금지다. 포켓몬을 데리고 이 골목을 지날 수 없다.",
    win: "금제를 어긴 자를 막지 못했다. 위로 가라. 다음 검문이 기다린다.",
    lose: "포켓몬은 성 밖으로. 그게 황제의 법이다.",
    party: [
      { speciesId: 661, level: 16, iv: 18 },
      { speciesId: 504, level: 17, iv: 18 },
      { speciesId: 659, level: 18, iv: 20 },
    ],
  },
  guard2: {
    id: "guard2",
    name: "중문 경비",
    title: "제국 경비",
    reward: 2400,
    intro: "반란군의 표식이로군. 포켓몬을 거두고 돌아가라.",
    win: "길이 열렸다. 마지막 문은 더 거세다.",
    lose: "황제의 금제는 아직 서 있다.",
    party: [
      { speciesId: 18, level: 26, iv: 22 },
      { speciesId: 310, level: 27, iv: 22 },
      { speciesId: 334, level: 28, iv: 24 },
    ],
  },
  guard3: {
    id: "guard3",
    name: "내문 경비",
    title: "제국 근위",
    reward: 4000,
    intro: "여기까지 온 자는 포켓몬과 함께 법을 부순 자다.",
    win: "성문이 열린다. 황제께서 직접 보시겠다.",
    lose: "근위 앞에서 무릎을 꿇어라.",
    party: [
      { speciesId: 373, level: 34, iv: 26 },
      { speciesId: 445, level: 35, iv: 26 },
      { speciesId: 6, level: 36, iv: 28, aspect: "charizard-mega-x" },
    ],
  },
  emperor: {
    id: "emperor",
    name: "샤를로",
    title: "칼로스 제국의 황제",
    reward: 12000,
    intro: "{name}. 포켓몬은 질서를 어지럽힌다. 내가 거리를 조용히 하겠다.",
    win: "금제를 푼다. 미르시티여, 다시 숨 쉬어라.",
    lose: "법은 남는다. 포켓몬을 거두고 성 밖으로 가라.",
    party: [
      { speciesId: 248, level: 40, iv: 28 },
      { speciesId: 130, level: 40, iv: 28, aspect: "gyarados-mega" },
      { speciesId: 445, level: 41, iv: 30 },
      { speciesId: 6, level: 42, iv: 30, aspect: "charizard-mega-y" },
      { speciesId: 376, level: 42, iv: 30, aspect: "metagross-mega" },
      { speciesId: 150, level: 44, iv: 31, aspect: "mewtwo-mega-y" },
    ],
  },
};

export function resolveTrainer(id: string): TrainerDef {
  const trainer = trainers[id];
  if (!trainer) throw new Error(`없는 상대: ${id}`);
  return trainer;
}

export type Spot = {
  id: string;
  x: number;
  y: number;
  name: string;
  short: string;
  color: string;
  hint: string;
  /** Tile where the NPC stands, usually just south of the door. */
  npcX: number;
  npcY: number;
};

export const spots = {
  marie: { id: "marie", x: 2, y: 23, npcX: 2, npcY: 24, name: "반란 아지트", short: "아지트", color: "#4ea0ff", hint: "마리와 이야기한다" },
  center: { id: "center", x: 10, y: 10, npcX: 10, npcY: 11, name: "포켓몬센터", short: "센터", color: "#ff5a6a", hint: "포켓몬을 모두 치료한다" },
  shop: { id: "shop", x: 32, y: 10, npcX: 32, npcY: 11, name: "프렌들리숍", short: "상점", color: "#ffc14a", hint: "도구를 산다" },
  fusion: { id: "fusion", x: 5, y: 19, npcX: 5, npcY: 20, name: "합체 공방", short: "합체", color: "#b07cff", hint: "큐레무를 합체한다" },
  cave: { id: "cave", x: 34, y: 19, npcX: 34, npcY: 20, name: "이차원 동굴", short: "동굴", color: "#5ad0ff", hint: "토요일에만 열린다" },
  emperor: { id: "emperor", x: 19, y: 3, npcX: 19, npcY: 4, name: "황제의 성", short: "성", color: "#e6c36a", hint: "황제 샤를로" },
  guard1: { id: "guard1", x: 19, y: 7, npcX: 19, npcY: 7, name: "남문 경비", short: "남문", color: "#c4454a", hint: "제국 경비" },
  guard2: { id: "guard2", x: 19, y: 6, npcX: 19, npcY: 6, name: "중문 경비", short: "중문", color: "#c4454a", hint: "제국 경비" },
  guard3: { id: "guard3", x: 19, y: 5, npcX: 19, npcY: 5, name: "내문 경비", short: "내문", color: "#c4454a", hint: "제국 근위" },
} as const;

/** Landmarks drawn on the city and map, without the three corridor guards. */
export const LANDMARKS = [spots.marie, spots.center, spots.shop, spots.fusion, spots.cave, spots.emperor] as const;

export function spotReachable(spot: { x: number; y: number; npcX: number; npcY: number }, tx: number, ty: number): boolean {
  const door = Math.max(Math.abs(spot.x - tx), Math.abs(spot.y - ty));
  const npc = Math.max(Math.abs(spot.npcX - tx), Math.abs(spot.npcY - ty));
  return door <= 3 || npc <= 3;
}

export const START = { x: 6, y: 24 };

export type Zone = { id: "street" | "park" | "north"; min: number; max: number; limit: number };

export function zoneAt(tx: number, ty: number): Zone["id"] | null {
  const tile = tileAt(tx, ty);
  if (tile === "grass") return "park";
  if (tile === "road" && ty <= 6 && tx >= 17 && tx <= 21) return "north";
  if (tile === "road" || tile === "plaza") return "street";
  return null;
}

export const ZONE_RULE: Record<Zone["id"], { min: number; max: number; limit: number }> = {
  street: { min: 8, max: 16, limit: 5 },
  park: { min: 16, max: 30, limit: 7 },
  north: { min: 32, max: 40, limit: 2 },
};

export const SHOP_ITEMS: { item: ItemId; price: number; needBadges: number }[] = [
  { item: "pokeball", price: 200, needBadges: 0 },
  { item: "greatball", price: 600, needBadges: 2 },
  { item: "ultraball", price: 1200, needBadges: 5 },
  { item: "potion", price: 200, needBadges: 0 },
  { item: "superpotion", price: 700, needBadges: 2 },
  { item: "hyperpotion", price: 1500, needBadges: 5 },
  { item: "revive", price: 1500, needBadges: 3 },
  { item: "fullheal", price: 400, needBadges: 2 },
];
