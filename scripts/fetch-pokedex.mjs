// Builds src/data/pokedex.json from PokeAPI. The game itself stays offline.
import { writeFile } from "node:fs/promises";

const LUMIOSE = [
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
];

const CAVE = [
  144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251, 377, 378, 379, 382, 383, 384, 385, 386, 480, 481, 482, 483, 484,
  486, 487, 489, 490, 491, 492, 493, 494, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649, 716, 717, 719, 720,
  721, 894, 895, 650, 653, 656,
];

const FORM_KO = {
  "zygarde-10": "지가르데 10%",
  "zygarde-complete": "지가르데 컴플리트",
  "kyurem-white": "화이트큐레무",
  "kyurem-black": "블랙큐레무",
  "shaymin-sky": "쉐이미 스카이폼",
  "deoxys-attack": "테오키스 어택폼",
  "deoxys-defense": "테오키스 디펜스폼",
  "deoxys-speed": "테오키스 스피드폼",
  "giratina-origin": "기라티나 오리진폼",
  "hoopa-unbound": "굴레를 벗어난 후파",
  "tornadus-therian": "토네로스 영물폼",
  "thundurus-therian": "볼트로스 영물폼",
  "landorus-therian": "랜드로스 영물폼",
  "meloetta-pirouette": "메로엣타 스텝폼",
  "keldeo-resolute": "케르디오 각오폼",
  "mewtwo-mega-x": "메가뮤츠X",
  "mewtwo-mega-y": "메가뮤츠Y",
  "charizard-mega-x": "메가리자몽X",
  "charizard-mega-y": "메가리자몽Y",
  "rayquaza-mega": "메가레쿠쟈",
  "diancie-mega": "메가디안시",
};

const KEEP_FORM = /mega|therian|origin|unbound|complete|kyurem-black|kyurem-white|shaymin-sky|deoxys-|resolute|pirouette|zygarde-10/;

const lumiose = [...new Set(LUMIOSE)];
const cave = [...new Set(CAVE)];
const beyond = cave.filter((id) => !lumiose.includes(id));
const ids = [...new Set([...lumiose, ...beyond])];

async function getJson(url) {
  let last = "";
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    last = `${res.status} ${url}`;
    if (res.status === 404) throw new Error(last);
    await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
  }
  throw new Error(last);
}

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

function koName(entry) {
  return entry.names?.find((n) => n.language.name === "ko")?.name ?? entry.name;
}

function statsOf(pokemon) {
  const stats = {};
  for (const stat of pokemon.stats) {
    const key = { hp: "hp", attack: "atk", defense: "def", "special-attack": "spa", "special-defense": "spd", speed: "spe" }[
      stat.stat.name
    ];
    stats[key] = stat.base_stat;
  }
  return stats;
}

function learnsetOf(pokemon) {
  const groups = new Map();
  for (const entry of pokemon.moves) {
    for (const detail of entry.version_group_details) {
      if (detail.move_learn_method.name !== "level-up" || detail.level_learned_at <= 0) continue;
      const list = groups.get(detail.version_group.name) ?? [];
      list.push({ level: detail.level_learned_at, move: entry.move.name });
      groups.set(detail.version_group.name, list);
    }
  }
  let best = [];
  for (const list of groups.values()) if (list.length > best.length) best = list;
  best.sort((a, b) => a.level - b.level || a.move.localeCompare(b.move));
  const seen = new Set();
  const dedup = [];
  for (const row of best) {
    if (seen.has(row.move)) continue;
    seen.add(row.move);
    dedup.push(row);
  }
  return dedup;
}

console.log(`fetching ${ids.length} species...`);
const rows = await pool(ids, 10, async (id) => {
  const [pokemon, species] = await Promise.all([
    getJson(`https://pokeapi.co/api/v2/pokemon/${id}`),
    getJson(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
  ]);
  return {
    id,
    key: pokemon.name,
    name: koName(species),
    genus: species.genera.find((g) => g.language.name === "ko")?.genus ?? "",
    types: pokemon.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
    stats: statsOf(pokemon),
    abilities: pokemon.abilities.map((a) => ({ id: a.ability.name, hidden: a.is_hidden, url: a.ability.url })),
    captureRate: species.capture_rate,
    growth: species.growth_rate.name,
    baseExp: pokemon.base_experience ?? 60,
    height: pokemon.height,
    weight: pokemon.weight,
    evolutionChain: species.evolution_chain?.url ?? null,
    varieties: species.varieties.map((v) => v.pokemon.name).filter((name) => name !== pokemon.name && KEEP_FORM.test(name)),
    learnset: learnsetOf(pokemon),
  };
});

const formNames = [...new Set(rows.flatMap((row) => row.varieties))];
console.log(`fetching ${formNames.length} forms...`);
const formRows = await pool(formNames, 8, async (name) => {
  try {
    const pokemon = await getJson(`https://pokeapi.co/api/v2/pokemon/${name}`);
    const ability = pokemon.abilities.find((a) => !a.is_hidden) ?? pokemon.abilities[0];
    const kind = name.includes("mega") ? "mega" : name.includes("kyurem-") ? "fusion" : "form";
    return {
      id: pokemon.name,
      name: FORM_KO[pokemon.name] ?? (kind === "mega" ? `메가${rows.find((row) => row.varieties.includes(pokemon.name))?.name ?? pokemon.name}` : pokemon.name),
      types: pokemon.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
      stats: statsOf(pokemon),
      ability: ability?.ability.name ?? "",
      kind,
      owner: Number(pokemon.species.url.split("/").filter(Boolean).pop()),
    };
  } catch (error) {
    console.warn("form skip", name, error.message);
    return null;
  }
});

const chainUrls = [...new Set(rows.map((row) => row.evolutionChain).filter(Boolean))];
console.log(`fetching ${chainUrls.length} evolution chains...`);
const chains = await pool(chainUrls, 8, (url) => getJson(url));
const idSet = new Set(ids);
const evoByFrom = new Map();
function walk(node) {
  const fromId = Number(node.species.url.split("/").filter(Boolean).pop());
  for (const next of node.evolves_to) {
    const toId = Number(next.species.url.split("/").filter(Boolean).pop());
    const detail = next.evolution_details[0];
    let level = detail?.min_level ?? null;
    if (level == null) level = 32;
    if (idSet.has(fromId) && idSet.has(toId) && fromId !== toId) {
      const prev = evoByFrom.get(fromId);
      if (!prev || level < prev.level) evoByFrom.set(fromId, { into: toId, level, trigger: detail?.trigger?.name ?? "level-up" });
    }
    walk(next);
  }
}
for (const chain of chains) walk(chain.chain);

const moveNames = new Set(["struggle", "tackle", "growl", "tail-whip", "ember"]);
for (const row of rows) for (const learn of row.learnset) moveNames.add(learn.move);
console.log(`fetching ${moveNames.size} moves...`);
const moveList = await pool([...moveNames], 10, async (name) => {
  const move = await getJson(`https://pokeapi.co/api/v2/move/${name}`);
  return {
    id: move.name,
    name: koName(move),
    type: move.type.name,
    category: move.damage_class?.name ?? "status",
    power: move.power ?? 0,
    accuracy: move.accuracy,
    pp: move.pp ?? 1,
    priority: move.priority ?? 0,
    ailment: move.meta?.ailment?.name ?? "none",
    ailmentChance: move.meta?.ailment_chance ?? 0,
    flinchChance: move.meta?.flinch_chance ?? 0,
    statChance: move.meta?.stat_chance ?? 0,
    statChanges: (move.stat_changes ?? []).map((s) => ({ stat: s.stat.name, change: s.change })),
    metaCategory: move.meta?.category?.name ?? "unique",
    drain: move.meta?.drain ?? 0,
    healing: move.meta?.healing ?? 0,
    critRate: move.meta?.crit_rate ?? 0,
    minHits: move.meta?.min_hits ?? null,
    maxHits: move.meta?.max_hits ?? null,
    minTurns: move.meta?.min_turns ?? null,
    maxTurns: move.meta?.max_turns ?? null,
    target: move.target?.name ?? "selected-pokemon",
  };
});

const abilityUrls = new Map();
for (const row of rows) for (const ability of row.abilities) abilityUrls.set(ability.id, ability.url);
for (const form of formRows) if (form?.ability) abilityUrls.set(form.ability, `https://pokeapi.co/api/v2/ability/${form.ability}`);
console.log(`fetching ${abilityUrls.size} abilities...`);
const abilityList = await pool([...abilityUrls.entries()], 10, async ([id, url]) => {
  try {
    const ability = await getJson(url);
    return { id, name: koName(ability) };
  } catch {
    return { id, name: id };
  }
});

const formsByOwner = new Map();
for (const form of formRows) {
  if (!form) continue;
  const { owner, ...rest } = form;
  const list = formsByOwner.get(owner) ?? [];
  list.push(rest);
  formsByOwner.set(owner, list);
}

const species = rows.map((row) => {
  const abilities = row.abilities.map(({ url: _url, ...rest }) => rest);
  const { evolutionChain: _chain, varieties: _varieties, ...rest } = row;
  const learnset = rest.learnset.length ? rest.learnset : [{ level: 1, move: "tackle" }];
  return { ...rest, abilities, learnset, evo: evoByFrom.get(row.id) ?? null, forms: formsByOwner.get(row.id) ?? [] };
});

const payload = {
  lumiose,
  beyond,
  cave,
  species,
  moves: Object.fromEntries(moveList.map((move) => [move.id, move])),
  abilities: Object.fromEntries(abilityList.map((ability) => [ability.id, ability])),
};

await writeFile(new URL("../src/data/pokedex.json", import.meta.url), JSON.stringify(payload));
const mega = species.reduce((sum, row) => sum + row.forms.filter((form) => form.kind === "mega").length, 0);
console.log(`wrote ${species.length} species, ${mega} megas, ${moveList.length} moves, lumiose ${lumiose.length}, beyond ${beyond.length}`);
