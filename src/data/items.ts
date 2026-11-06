export const ITEM_IDS = [
  "pokeball",
  "greatball",
  "ultraball",
  "masterball",
  "potion",
  "superpotion",
  "hyperpotion",
  "revive",
  "fullheal",
] as const;

export type ItemId = (typeof ITEM_IDS)[number];

export type Bag = Record<ItemId, number>;

export type ItemInfo = {
  id: ItemId;
  name: string;
  desc: string;
  price?: number;
  needBadges?: number;
  kind: "ball" | "heal" | "revive" | "status";
};

export const ITEMS: Record<ItemId, ItemInfo> = {
  pokeball: { id: "pokeball", name: "몬스터볼", desc: "야생 포켓몬을 잡는다.", price: 200, kind: "ball" },
  greatball: { id: "greatball", name: "슈퍼볼", desc: "몬스터볼보다 잘 잡힌다.", price: 600, needBadges: 1, kind: "ball" },
  ultraball: { id: "ultraball", name: "하이퍼볼", desc: "포획률이 높다.", price: 1200, needBadges: 3, kind: "ball" },
  masterball: { id: "masterball", name: "마스터볼", desc: "반드시 잡을 수 있다.", kind: "ball" },
  potion: { id: "potion", name: "상처약", desc: "HP를 20 회복한다.", price: 200, kind: "heal" },
  superpotion: { id: "superpotion", name: "좋은상처약", desc: "HP를 50 회복한다.", price: 700, needBadges: 1, kind: "heal" },
  hyperpotion: { id: "hyperpotion", name: "고급상처약", desc: "HP를 200 회복한다.", price: 1500, needBadges: 4, kind: "heal" },
  revive: { id: "revive", name: "기력의조각", desc: "기절한 포켓몬을 절반의 HP로 깨운다.", price: 1500, needBadges: 2, kind: "revive" },
  fullheal: { id: "fullheal", name: "만병통치제", desc: "상태 이상을 회복한다.", price: 400, needBadges: 1, kind: "status" },
};

export const HEAL_AMOUNT: Partial<Record<ItemId, number>> = {
  potion: 20,
  superpotion: 50,
  hyperpotion: 200,
};

export function emptyBag(): Bag {
  return {
    pokeball: 0,
    greatball: 0,
    ultraball: 0,
    masterball: 0,
    potion: 0,
    superpotion: 0,
    hyperpotion: 0,
    revive: 0,
    fullheal: 0,
  };
}

export function ballMod(item: ItemId): number | "sure" {
  if (item === "masterball") return "sure";
  if (item === "ultraball") return 2;
  if (item === "greatball") return 1.5;
  return 1;
}
