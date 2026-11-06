/** Lumiose Pokédex order (Legends Z-A, 232). Florges is 671; some public tables misprint it as 669. */
export const LUMIOSE_IDS = [
  152, 153, 154, 498, 499, 500, 158, 159, 160, 661, 662, 663, 659, 660, 664, 665, 666, 13, 14, 15, 16, 17, 18, 179, 180,
  181, 504, 505, 406, 315, 407, 129, 130, 688, 689, 120, 121, 669, 670, 671, 672, 673, 677, 678, 667, 668, 674, 675, 568,
  569, 702, 172, 25, 26, 173, 35, 36, 167, 168, 23, 24, 63, 64, 65, 92, 93, 94, 543, 544, 545, 679, 680, 681, 69, 70, 71,
  511, 512, 513, 514, 515, 516, 307, 308, 309, 310, 280, 281, 282, 475, 228, 229, 333, 334, 531, 682, 683, 684, 685, 133,
  134, 135, 136, 196, 197, 470, 471, 700, 427, 428, 353, 354, 582, 583, 584, 322, 323, 449, 450, 529, 530, 551, 552, 553,
  66, 67, 68, 443, 444, 445, 703, 302, 303, 359, 447, 448, 79, 80, 199, 318, 319, 602, 603, 604, 147, 148, 149, 1, 2, 3, 4,
  5, 6, 7, 8, 9, 618, 676, 686, 687, 690, 691, 692, 693, 704, 705, 706, 225, 361, 362, 478, 459, 460, 712, 713, 123, 212,
  127, 214, 587, 701, 708, 709, 559, 560, 714, 715, 707, 607, 608, 609, 142, 696, 697, 698, 699, 95, 208, 304, 305, 306,
  694, 695, 710, 711, 246, 247, 248, 656, 657, 658, 870, 650, 651, 652, 227, 653, 654, 655, 371, 372, 373, 115, 780, 374,
  375, 376, 716, 717, 718, 719, 150,
] as const;

/** Saturday cave and the interdimensional dex. Starters are also in the Lumiose dex. */
export const CAVE_IDS = [
  144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251, 377, 378, 379, 382, 383, 384, 385, 386, 480, 481, 482, 483, 484,
  486, 487, 489, 490, 491, 492, 493, 494, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649, 716, 717, 719, 720,
  721, 894, 895, 650, 653, 656,
] as const;

const lumioseSet = new Set<number>(LUMIOSE_IDS);
export const BEYOND_IDS = CAVE_IDS.filter((id) => !lumioseSet.has(id));

export const ZYGARDE_ID = 718;
export const CAVE_LEVEL = 70;
export const BOND_BADGES = 8;

/** Not roaming the streets: the partner, and legendaries kept for the cave or the throne. */
export const STREET_BAN = new Set<number>([ZYGARDE_ID, 150, 716, 717, 719, ...BEYOND_IDS]);

export function isSeoulSaturday(date = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "short" }).format(date);
  return weekday === "Sat";
}

export function nextSeoulSaturdayLabel(date = new Date()): string {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "short" }).format(date);
  const order = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const index = order.indexOf(weekday);
  const days = index === 6 ? 0 : 6 - index;
  if (days === 0) return "오늘 토요일, 동굴이 열려 있다";
  return `다음 토요일까지 ${days}일`;
}

export function rollCave(rng: () => number): number[] {
  const pool = [...CAVE_IDS];
  const count = 1 + Math.floor(rng() * 3);
  const out: number[] = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const index = Math.floor(rng() * pool.length);
    out.push(pool.splice(index, 1)[0]);
  }
  return out;
}
