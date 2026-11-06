import type { PType } from "@/data/chart.ts";

const PALETTE: Record<PType, [string, string, string, string]> = {
  normal: ["#2a241c", "#8a7560", "#e6d2b8", "#fff6ea"],
  fire: ["#2a120c", "#a33b22", "#f08a3c", "#ffe1a8"],
  water: ["#10243a", "#2a6eab", "#79c7f2", "#e7f6ff"],
  grass: ["#102616", "#2f6b32", "#7dce63", "#e7f5c8"],
  electric: ["#2a2408", "#c9a227", "#ffe56a", "#fff8d2"],
  ice: ["#163038", "#7eb8c8", "#d5f4f8", "#ffffff"],
  fighting: ["#2a1214", "#a33b3b", "#e07a62", "#ffd8c8"],
  poison: ["#241232", "#6a3a86", "#b06ad4", "#f0d4ff"],
  ground: ["#2a1c10", "#8a6232", "#d2a15a", "#f3e0b8"],
  flying: ["#1a2440", "#6a88c8", "#d5e4ff", "#ffffff"],
  psychic: ["#321428", "#c45a8a", "#f2a0c4", "#ffe4f2"],
  bug: ["#1a2410", "#6a8a28", "#c6d45a", "#f4f8c8"],
  rock: ["#241c14", "#7a6854", "#c4b49a", "#f4ecdf"],
  ghost: ["#1a1430", "#4a3a78", "#9a86d4", "#e4dcff"],
  dragon: ["#1a1438", "#3a4a9a", "#7a8ae0", "#e4e8ff"],
  dark: ["#100e14", "#3a3548", "#7a748c", "#d8d4e4"],
  steel: ["#1c2228", "#6a7888", "#c5d0dc", "#f4f7fb"],
  fairy: ["#321820", "#d4789a", "#f4b4cc", "#fff0f6"],
};

type Glyph = { pixels: string[]; colors: string[] };

const PLAYER: Record<"m" | "f", [Glyph, Glyph]> = {
  m: [
    {
      colors: ["#1a120c", "#3a2a22", "#e6c36a", "#3d6ea8", "#f0d2b4", "#f6f1e6"],
      pixels: [
        "..11111111..",
        ".1111111111.",
        ".1155555511.",
        ".1155555511.",
        "..15555551..",
        "...222222...",
        "..33333333..",
        ".3333333333.",
        ".3333333333.",
        "..33333333..",
        "...33..33...",
        "...44..44...",
        "...44..44...",
        "...11..11...",
      ],
    },
    {
      colors: ["#1a120c", "#3a2a22", "#e6c36a", "#3d6ea8", "#f0d2b4", "#f6f1e6"],
      pixels: [
        "..11111111..",
        ".1111111111.",
        ".1155555511.",
        ".1155555511.",
        "..15555551..",
        "...222222...",
        "..33333333..",
        ".3333333333.",
        ".3333333333.",
        "..33333333..",
        "..33....33..",
        "..44....44..",
        "..11....11..",
        ".11......11.",
      ],
    },
  ],
  f: [
    {
      colors: ["#2a1018", "#6a3038", "#e6c36a", "#a33b48", "#f0d2b4", "#fff0f4"],
      pixels: [
        ".1111111111.",
        "111111111111",
        "115555555111",
        ".1155555511.",
        "..15555551..",
        "...222222...",
        "..33333333..",
        ".3333333333.",
        ".3333333333.",
        "..33333333..",
        "...33..33...",
        "...44..44...",
        "...11..11...",
        "...11..11...",
      ],
    },
    {
      colors: ["#2a1018", "#6a3038", "#e6c36a", "#a33b48", "#f0d2b4", "#fff0f4"],
      pixels: [
        ".1111111111.",
        "111111111111",
        "115555555111",
        ".1155555511.",
        "..15555551..",
        "...222222...",
        "..33333333..",
        ".3333333333.",
        ".3333333333.",
        "..33333333..",
        "..33....33..",
        "..44....44..",
        "..11....11..",
        ".11......11.",
      ],
    },
  ],
};

export type NpcKind = "marie" | "nurse" | "clerk" | "guard" | "emperor" | "smith";

const NPC: Record<NpcKind, Glyph> = {
  marie: {
    colors: ["#1a1020", "#3a2048", "#e6c36a", "#6a4cff", "#f0d2b4", "#f6f1e6", "#c8b8ff"],
    pixels: [
      "..11111111..",
      ".1166666611.",
      ".1155555511.",
      "..15555551..",
      "...222222...",
      "..33333333..",
      ".3336666333.",
      ".3333333333.",
      "..33333333..",
      "...33..33...",
      "...44..44...",
      "...44..44...",
      "...11..11...",
      "............",
    ],
  },
  nurse: {
    colors: ["#1a120c", "#e23b4a", "#ffffff", "#f0d2b4", "#3a2a22", "#e6c36a"],
    pixels: [
      "..11111111..",
      ".1122222211.",
      ".1125252211.",
      "..12222221..",
      "...333333...",
      "..55555555..",
      ".5222222225.",
      ".5222222225.",
      "..52222225..",
      "...22..22...",
      "...44..44...",
      "...44..44...",
      "...11..11...",
      "............",
    ],
  },
  clerk: {
    colors: ["#1a120c", "#1f4f8a", "#f0c14a", "#f0d2b4", "#2a3a58", "#ffffff"],
    pixels: [
      "..11111111..",
      ".1111111111.",
      ".1133333311.",
      "..13333331..",
      "...222222...",
      "..44444444..",
      ".4455555544.",
      ".4444444444.",
      "..44444444..",
      "...44..44...",
      "...11..11...",
      "...11..11...",
      "...11..11...",
      "............",
    ],
  },
  guard: {
    colors: ["#120e14", "#6a1820", "#c4454a", "#d8c0a8", "#3a3a48", "#e6c36a"],
    pixels: [
      "...555555...",
      "..51111115..",
      ".5116666115.",
      ".5113333115.",
      "..51333315..",
      "...222222...",
      "..44444444..",
      ".4422222244.",
      ".4444444444.",
      "..44444444..",
      "...44..44...",
      "...11..11...",
      "...11..11...",
      "............",
    ],
  },
  emperor: {
    colors: ["#120e14", "#2a1820", "#e6c36a", "#f0d2b4", "#6a2030", "#fff0d0", "#8a2840"],
    pixels: [
      "...222222...",
      "..22555522..",
      ".2253333522.",
      ".2253333522.",
      "..25333352..",
      "...444444...",
      "..66666666..",
      ".6611111166.",
      ".6666666666.",
      "..66666666..",
      "...66..66...",
      "...11..11...",
      "...11..11...",
      "............",
    ],
  },
  smith: {
    colors: ["#1a120c", "#4a2f78", "#b07cff", "#f0d2b4", "#2a1a40", "#e6c36a"],
    pixels: [
      "..11111111..",
      ".1111111111.",
      ".1155555511.",
      "..15555551..",
      "...333333...",
      "..22222222..",
      ".2244444422.",
      ".2222222222.",
      "..22222222..",
      "...22..22...",
      "...44..44...",
      "...11..11...",
      "...11..11...",
      "............",
    ],
  },
};

const ZYGARDE: Record<string, Glyph> = {
  "zygarde-10": {
    colors: ["#10140f", "#1c3a24", "#6fbf45", "#d6f5a2", "#f4f7ea"],
    pixels: [
      ".....33......",
      "....3223.....",
      "...322223....",
      "..32444223...",
      "..32222223...",
      "...222122....",
      "....22122....",
      "...22..22....",
      "..32....23...",
      ".33......33..",
    ],
  },
  "zygarde-complete": {
    colors: ["#10140f", "#1c3a24", "#6fbf45", "#d6f5a2", "#e6c36a"],
    pixels: [
      "....4444.....",
      "...433334....",
      "..43222234...",
      ".4322442234..",
      ".4322222234..",
      "..32211223...",
      "...222222....",
      "..322..223...",
      ".33......33..",
      "44........44.",
    ],
  },
};

function hash(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

function glyphFor(speciesId: number, form: string | null, types: PType[]): Glyph {
  if (form && ZYGARDE[form]) return ZYGARDE[form];
  if (speciesId === 718 && !form) return ZYGARDE["zygarde-complete"];
  const [ink, body, main, light] = PALETTE[types[0] ?? "normal"];
  const accent = PALETTE[types[1] ?? types[0] ?? "normal"][2];
  const seed = hash(speciesId + (form ? form.length * 97 : 0));
  const kind = seed % 5;
  const rows = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => "."));
  const put = (x: number, y: number, ch: string) => {
    if (x >= 0 && y >= 0 && x < 16 && y < 16) rows[y][x] = ch;
  };
  const blob = (cx: number, cy: number, rx: number, ry: number, ch: string) => {
    for (let y = cy - ry; y <= cy + ry; y += 1) {
      for (let x = cx - rx; x <= cx + rx; x += 1) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        if (nx * nx + ny * ny <= 1) put(x, y, ch);
      }
    }
  };
  if (kind === 0) blob(8, 9, 5, 4, "2");
  else if (kind === 1) {
    blob(8, 6, 3, 3, "2");
    blob(8, 11, 4, 3, "2");
    put(6, 13, "1");
    put(10, 13, "1");
  } else if (kind === 2) {
    blob(5, 8, 2, 2, "2");
    blob(10, 9, 4, 3, "2");
    put(4, 12, "1");
    put(7, 12, "1");
    put(11, 12, "1");
  } else if (kind === 3) {
    blob(7, 8, 3, 2, "2");
    blob(11, 7, 3, 1, "3");
    put(5, 6, "2");
    put(4, 5, "3");
  } else {
    for (let i = 0; i < 8; i += 1) blob(4 + i, 4 + (i % 3), 2, 1, i % 2 ? "2" : "3");
  }
  const eye = 6 + (seed % 3);
  put(eye, 8, "4");
  put(eye + 3, 8, "4");
  if (seed % 2 === 0) {
    put(8, 3, "3");
    put(7, 2, "3");
    put(9, 2, "3");
  }
  if ((seed >> 3) % 3 === 0) put(12, 10, "3");
  return { colors: [ink, body, main, accent, light], pixels: rows.map((row) => row.join("")) };
}

export function drawGlyph(ctx: CanvasRenderingContext2D, glyph: Glyph, x: number, y: number, scale: number, bob = 0) {
  const height = glyph.pixels.length;
  const width = glyph.pixels[0]?.length ?? 0;
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const ch = glyph.pixels[row][col];
      if (ch === ".") continue;
      const index = Number(ch);
      ctx.fillStyle = glyph.colors[index] ?? "#fff";
      ctx.fillRect(Math.round(x + col * scale), Math.round(y + bob + row * scale), scale, scale);
    }
  }
}

export function drawPlayer(ctx: CanvasRenderingContext2D, gender: "m" | "f", x: number, y: number, scale: number, frame: number) {
  drawGlyph(ctx, PLAYER[gender][frame % 2], x, y, scale);
}

export function drawNpc(ctx: CanvasRenderingContext2D, kind: NpcKind, x: number, y: number, scale: number, bob = 0) {
  drawGlyph(ctx, NPC[kind], x, y + bob, scale);
}

export function drawMon(
  ctx: CanvasRenderingContext2D,
  speciesId: number,
  form: string | null,
  types: PType[],
  x: number,
  y: number,
  scale: number,
  frame = 0,
) {
  const glyph = glyphFor(speciesId, form, types);
  drawGlyph(ctx, glyph, x, y, scale, frame % 2 === 0 ? 0 : -scale);
}

export const PLAYER_PIXELS = { w: 12, h: 14 };
