// Builds src/data/gen6.json from PokeAPI. Runtime never calls the network.
import { writeFile } from "node:fs/promises";

const MIN = 650;
const MAX = 721;

const FALLBACK_EVO_LEVEL = {
  671: 35, // florges
  681: 45, // aegislash
  683: 32, // aromatisse
  685: 32, // slurpuff
  695: 32, // heliolisk
  706: 50, // goodra
  709: 30, // trevenant
  711: 32, // gourgeist
};

async function getJson(url) {
  let last = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    last = `${res.status} ${url}`;
    if (res.status === 404) throw new Error(last);
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  throw new Error(last);
}

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return out;
}

function koName(entry) {
  return entry.names.find((n) => n.language.name === "ko")?.name ?? entry.name;
}

const ids = Array.from({ length: MAX - MIN + 1 }, (_, i) => MIN + i);

console.log(`fetching ${ids.length} pokemon...`);
const rows = await pool(ids, 8, async (id) => {
  const [pokemon, species] = await Promise.all([
    getJson(`https://pokeapi.co/api/v2/pokemon/${id}`),
    getJson(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
  ]);
  const learnset = [];
  for (const entry of pokemon.moves) {
    const details = entry.version_group_details.filter(
      (d) =>
        d.move_learn_method.name === "level-up" &&
        (d.version_group.name === "x-y" || d.version_group.name === "omega-ruby-alpha-sapphire"),
    );
    const xy = details.find((d) => d.version_group.name === "x-y");
    const chosen = xy ?? details[0];
    if (!chosen || chosen.level_learned_at <= 0) continue;
    learnset.push({ level: chosen.level_learned_at, move: entry.move.name });
  }
  learnset.sort((a, b) => a.level - b.level || a.move.localeCompare(b.move));
  const dedup = [];
  const seen = new Set();
  for (const row of learnset) {
    if (seen.has(row.move)) continue;
    seen.add(row.move);
    dedup.push(row);
  }
  const stats = {};
  for (const stat of pokemon.stats) {
    const key = { hp: "hp", attack: "atk", defense: "def", "special-attack": "spa", "special-defense": "spd", speed: "spe" }[
      stat.stat.name
    ];
    stats[key] = stat.base_stat;
  }
  return {
    id,
    key: pokemon.name,
    name: koName(species),
    genus: species.genera.find((g) => g.language.name === "ko")?.genus ?? "",
    types: pokemon.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
    stats,
    abilities: pokemon.abilities.map((a) => ({
      id: a.ability.name,
      hidden: a.is_hidden,
      url: a.ability.url,
    })),
    captureRate: species.capture_rate,
    growth: species.growth_rate.name,
    baseExp: pokemon.base_experience,
    height: pokemon.height,
    weight: pokemon.weight,
    evolutionChain: species.evolution_chain.url,
    learnset: dedup,
  };
});

const chainUrls = [...new Set(rows.map((r) => r.evolutionChain))];
console.log(`fetching ${chainUrls.length} evolution chains...`);
const chains = await pool(chainUrls, 6, (url) => getJson(url));

const evoByFrom = new Map();
function walk(node) {
  const fromId = Number(node.species.url.split("/").filter(Boolean).pop());
  for (const next of node.evolves_to) {
    const toId = Number(next.species.url.split("/").filter(Boolean).pop());
    const detail = next.evolution_details[0];
    let level = detail?.min_level ?? null;
    if (level == null) level = FALLBACK_EVO_LEVEL[toId] ?? null;
    if (fromId >= MIN && fromId <= MAX && toId >= MIN && toId <= MAX) {
      if (level == null) {
        console.warn(`no level for ${fromId} -> ${toId} (${detail?.trigger?.name})`);
        level = 36;
      }
      evoByFrom.set(fromId, { into: toId, level, trigger: detail?.trigger?.name ?? "level-up" });
    }
    walk(next);
  }
}
for (const chain of chains) walk(chain.chain);

const moveNames = new Set();
for (const row of rows) for (const learn of row.learnset) moveNames.add(learn.move);
moveNames.add("struggle");
console.log(`fetching ${moveNames.size} moves...`);
const moveList = await pool([...moveNames], 8, async (name) => {
  const move = await getJson(`https://pokeapi.co/api/v2/move/${name}`);
  return {
    id: move.name,
    name: koName(move),
    type: move.type.name,
    category: move.damage_class.name,
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
console.log(`fetching ${abilityUrls.size} abilities...`);
const abilityList = await pool([...abilityUrls.entries()], 8, async ([id, url]) => {
  const ability = await getJson(url);
  return { id, name: koName(ability) };
});

const categories = new Map();
for (const move of moveList) categories.set(move.metaCategory, (categories.get(move.metaCategory) ?? 0) + 1);
console.log("move categories", Object.fromEntries([...categories.entries()].sort((a, b) => b[1] - a[1])));

const growths = new Map();
for (const row of rows) growths.set(row.growth, (growths.get(row.growth) ?? 0) + 1);
console.log("growth", Object.fromEntries(growths));

const species = rows.map((row) => {
  const evo = evoByFrom.get(row.id) ?? null;
  const abilities = row.abilities.map(({ url: _url, ...rest }) => rest);
  const { evolutionChain: _chain, ...rest } = row;
  return { ...rest, abilities, evo };
});

const payload = {
  species,
  moves: Object.fromEntries(moveList.map((m) => [m.id, m])),
  abilities: Object.fromEntries(abilityList.map((a) => [a.id, { id: a.id, name: a.name }])),
};

const missing = species.filter((s) => s.learnset.length === 0).map((s) => s.id);
if (missing.length) console.warn("no learnset", missing);

await writeFile(new URL("../src/data/gen6.json", import.meta.url), JSON.stringify(payload));
console.log(`wrote ${species.length} species, ${moveList.length} moves`);
