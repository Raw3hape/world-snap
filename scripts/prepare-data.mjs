#!/usr/bin/env node
/**
 * Build public/data/pack-world.json + public/flags/{iso}.svg from Natural Earth.
 * Usage: node scripts/prepare-data.mjs
 * Requires Node 18+ (global fetch).
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "public", "data");
const FLAG_DIR = path.join(ROOT, "public", "flags");
const DOCS_PATH = path.join(ROOT, "docs", "data.md");

const NE_110_URLS = [
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
  "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/cultural/ne_110m_admin_0_countries.json",
];

const NE_50_URLS = [
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson",
  "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/50m/cultural/ne_50m_admin_0_countries.json",
];

const RU_NAME_URLS = [
  "https://raw.githubusercontent.com/umpirsky/country-list/master/data/ru_RU/country.json",
  "https://cdn.jsdelivr.net/npm/i18n-iso-countries@7.14.0/langs/ru.json",
];

const FLAG_URLS = (iso) => {
  const code = iso.toLowerCase();
  return [
    `https://cdn.jsdelivr.net/gh/hampusborgos/country-flags@main/svg/${code}.svg`,
    `https://raw.githubusercontent.com/hampusborgos/country-flags/main/svg/${code}.svg`,
  ];
};

/** Tiny distant overseas scraps only. Nearby islands (Sicily, Tasmania) stay. */
const MIN_AREA_RATIO = 0.004;
const MAX_ISOLATION_DEG = 18;
/** Keep an exclave if it sits among other countries (Kaliningrad, Cabinda). */
const HOLE_NEIGHBOR_DEG = 5;

const CONTINENT_ORDER = [
  "Europe",
  "Asia",
  "Africa",
  "North America",
  "South America",
  "Oceania",
  "Antarctica",
];

const SEVEN_SEAS = "Seven seas (open ocean)";

function warn(msg) {
  console.error(msg);
}

async function fetchBuffer(url, { retries = 1 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (res.status === 404) {
        throw Object.assign(new Error(`HTTP 404 ${url}`), { noRetry: true });
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      return { url, bytes: Buffer.from(await res.arrayBuffer()) };
    } catch (err) {
      lastErr = err;
      if (err?.noRetry) break;
      if (attempt < retries) warn(`retry ${attempt + 1} ${url}: ${err.message}`);
    }
  }
  throw new Error(`${url}: ${lastErr?.message || lastErr}`);
}

async function fetchJsonFrom(urls, label) {
  const errors = [];
  for (const url of urls) {
    try {
      const { bytes } = await fetchBuffer(url, { retries: 1 });
      return { url, json: JSON.parse(bytes.toString("utf8")) };
    } catch (err) {
      errors.push(`${url} — ${err.message}`);
      warn(`${label} source failed: ${err.message}`);
    }
  }
  throw new Error(`All ${label} URLs failed:\n${errors.join("\n")}`);
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  const n = Math.min(Math.max(1, limit), items.length || 1);
  await Promise.all(Array.from({ length: n }, worker));
  return out;
}

function isoOf(props) {
  for (const key of ["ISO_A2", "ISO_A2_EH", "WB_A2"]) {
    const v = String(props?.[key] ?? "")
      .trim()
      .toUpperCase();
    if (/^[A-Z]{2}$/.test(v)) return v;
  }
  return "";
}

function textOf(...values) {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function walkPositions(coords, visit) {
  if (!Array.isArray(coords) || coords.length === 0) return;
  if (typeof coords[0] === "number") {
    visit(coords[0], coords[1]);
    return;
  }
  for (const child of coords) walkPositions(child, visit);
}

function countPositions(coords) {
  let n = 0;
  walkPositions(coords, () => {
    n += 1;
  });
  return n;
}

function unwrapLon(lon, ref) {
  let x = lon;
  while (x - ref > 180) x -= 360;
  while (x - ref < -180) x += 360;
  return x;
}

function wrapLon(lon) {
  let x = lon;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
}

function bboxUnwrapped(coords, refLon) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  walkPositions(coords, (lon, lat) => {
    const x = unwrapLon(lon, refLon);
    if (x < minLon) minLon = x;
    if (lat < minLat) minLat = lat;
    if (x > maxLon) maxLon = x;
    if (lat > maxLat) maxLat = lat;
  });
  return [minLon, minLat, maxLon, maxLat];
}

function signedRingArea(ring) {
  let area = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return area / 2;
}

function ringCentroid(ring, refLon) {
  let ax = 0;
  let ay = 0;
  let crossSum = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    const x0 = unwrapLon(ring[i][0], refLon);
    const y0 = ring[i][1];
    const x1 = unwrapLon(ring[i + 1][0], refLon);
    const y1 = ring[i + 1][1];
    const cross = x0 * y1 - x1 * y0;
    crossSum += cross;
    ax += (x0 + x1) * cross;
    ay += (y0 + y1) * cross;
  }
  if (crossSum === 0) {
    const [minLon, minLat, maxLon, maxLat] = bboxUnwrapped(ring, refLon);
    return {
      x: (minLon + maxLon) / 2,
      y: (minLat + maxLat) / 2,
      area: 0,
    };
  }
  return { x: ax / (3 * crossSum), y: ay / (3 * crossSum), area: crossSum / 2 };
}

function polygonsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function asGeometry(polygons) {
  if (polygons.length === 1) {
    return { type: "Polygon", coordinates: polygons[0] };
  }
  return { type: "MultiPolygon", coordinates: polygons };
}

function polygonAreaAbs(polygon) {
  if (!polygon?.[0]) return 0;
  return Math.abs(signedRingArea(polygon[0]));
}

function polygonCentroidLonLat(polygon) {
  const refLon = polygon[0]?.[0]?.[0] ?? 0;
  let areaSum = 0;
  let xSum = 0;
  let ySum = 0;
  for (const ring of polygon) {
    const c = ringCentroid(ring, refLon);
    xSum += c.x * c.area;
    ySum += c.y * c.area;
    areaSum += c.area;
  }
  if (areaSum === 0) {
    const [minLon, minLat, maxLon, maxLat] = bboxUnwrapped(polygon, refLon);
    return [wrapLon((minLon + maxLon) / 2), (minLat + maxLat) / 2];
  }
  return [wrapLon(xSum / areaSum), ySum / areaSum];
}

function greatCircleDeg(lon1, lat1, lon2, lat2) {
  const r = Math.PI / 180;
  const φ1 = lat1 * r;
  const φ2 = lat2 * r;
  const dλ = (lon2 - lon1) * r;
  const cos =
    Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return Math.acos(Math.min(1, Math.max(-1, cos))) / r;
}

function minDistToPolygons(lon, lat, polygons) {
  let min = Infinity;
  for (const polygon of polygons) {
    walkPositions(polygon, (x, y) => {
      const d = greatCircleDeg(lon, lat, x, y);
      if (d < min) min = d;
    });
  }
  return min;
}

function areaWeightedCentroid(geometry) {
  const polygons = polygonsOf(geometry);
  if (!polygons.length) return [0, 0];
  const areas = polygons.map(polygonAreaAbs);
  const main = polygons[areas.indexOf(Math.max(...areas))];
  const ref = polygonCentroidLonLat(main);
  const refLon = ref[0];
  let areaSum = 0;
  let xSum = 0;
  let ySum = 0;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      const c = ringCentroid(ring, refLon);
      xSum += c.x * c.area;
      ySum += c.y * c.area;
      areaSum += c.area;
    }
  }
  if (areaSum === 0) {
    const [minLon, minLat, maxLon, maxLat] = bboxUnwrapped(
      geometry.coordinates,
      refLon,
    );
    return [wrapLon((minLon + maxLon) / 2), (minLat + maxLat) / 2];
  }
  return [wrapLon(xSum / areaSum), ySum / areaSum];
}

function bboxOfGeometry(geometry, refLon) {
  return bboxUnwrapped(geometry.coordinates, refLon);
}

/**
 * Drop only tiny AND isolated overseas scraps.
 * Distance is to the nearest vertex of already-kept land (not the main centroid),
 * so Hainan / Sakhalin / Kaliningrad / the Canadian Arctic stay.
 * A scrap next to another country is kept so the continent has no hole.
 */
function pruneOverseasScraps(geometry, { iso, continent, neighbors }) {
  const polygons = polygonsOf(geometry);
  if (polygons.length <= 1) {
    return { geometry, dropped: [] };
  }
  if (continent === "Antarctica") {
    return { geometry, dropped: [] };
  }

  const items = polygons.map((polygon, index) => ({
    index,
    polygon,
    area: polygonAreaAbs(polygon),
    centroid: polygonCentroidLonLat(polygon),
  }));
  const maxArea = Math.max(...items.map((it) => it.area));
  const kept = [];
  const undecided = [];
  for (const item of items) {
    if (item.area >= maxArea * MIN_AREA_RATIO) kept.push(item);
    else undecided.push(item);
  }

  let changed = true;
  while (changed) {
    changed = false;
    const still = [];
    const keptPolys = kept.map((k) => k.polygon);
    for (const item of undecided) {
      const dist = minDistToPolygons(
        item.centroid[0],
        item.centroid[1],
        keptPolys,
      );
      if (dist <= MAX_ISOLATION_DEG) {
        kept.push(item);
        changed = true;
      } else still.push(item);
    }
    undecided.length = 0;
    undecided.push(...still);
  }

  const dropped = [];
  for (const item of undecided) {
    let hole = item.centroid[1] < -60;
    if (!hole) {
      for (const other of neighbors) {
        if (other.iso === iso) continue;
        const dist = minDistToPolygons(
          item.centroid[0],
          item.centroid[1],
          other.polygons,
        );
        if (dist <= HOLE_NEIGHBOR_DEG) {
          hole = true;
          break;
        }
      }
    }
    if (hole) kept.push(item);
    else {
      const main = items.find((it) => it.area === maxArea) || items[0];
      dropped.push({
        iso,
        index: item.index,
        label: scrapLabel(iso, item.centroid),
        areaRatio: item.area / maxArea,
        distDeg: minDistToPolygons(
          item.centroid[0],
          item.centroid[1],
          [main.polygon],
        ),
        centroid: item.centroid,
      });
    }
  }

  kept.sort((a, b) => a.index - b.index);
  if (dropped.length === 0) return { geometry, dropped: [] };
  return { geometry: asGeometry(kept.map((k) => k.polygon)), dropped };
}

function scrapLabel(iso, centroid) {
  const [lon, lat] = centroid;
  if (iso === "US" && lon < -150 && lat > 17 && lat < 24) return "Hawaii";
  return "";
}

function continentOf(props, centroid) {
  const c = textOf(props?.CONTINENT);
  if (c && c !== SEVEN_SEAS) return c;
  if (centroid && centroid[1] < -45) return "Antarctica";
  const region = textOf(props?.REGION_UN);
  if (region === "Africa") return "Africa";
  if (region === "Asia") return "Asia";
  if (region === "Europe") return "Europe";
  if (region === "Oceania") return "Oceania";
  if (region === "Antarctica") return "Antarctica";
  if (region === "Americas") {
    const sub = textOf(props?.SUBREGION);
    if (/south/i.test(sub)) return "South America";
    return "North America";
  }
  return c && c !== SEVEN_SEAS ? c : "Oceania";
}

function namesOf(iso, props, ruMap) {
  const nameEn =
    textOf(props?.NAME_EN, props?.NAME, props?.ADMIN, props?.NAME_LONG) || iso;
  const nameRu =
    textOf(props?.NAME_RU, ruMap[iso], ruMap[iso.toLowerCase()]) || nameEn;
  return { nameEn, nameRu };
}

function ruMapFrom(json) {
  const out = {};
  if (!json || typeof json !== "object") return out;
  for (const [k, v] of Object.entries(json)) {
    if (typeof v !== "string" || !v.trim()) continue;
    out[String(k).toUpperCase()] = v.trim();
  }
  return out;
}

function normalizeSvg(raw) {
  let s = raw.replace(/^\uFEFF/, "").trim();
  s = s.replace(/^<\?xml[^>]*>\s*/i, "");
  s = s.replace(/^<!DOCTYPE[^>]*>\s*/i, "");
  s = s.replace(/^<!--[\s\S]*?-->\s*/g, "");
  if (!s.startsWith("<svg")) {
    throw new Error("SVG does not start with <svg");
  }
  return s.endsWith("\n") ? s : `${s}\n`;
}

function validateCountry(country) {
  const issues = [];
  const n = countPositions(country.geometry?.coordinates);
  if (!n) issues.push("empty coordinates");
  const [lon, lat] = country.centroid;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    issues.push("non-finite centroid");
  }
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    issues.push("centroid outside world");
  }
  const [minLon, minLat, maxLon, maxLat] = country.bbox;
  const mid = (minLon + maxLon) / 2;
  const clon = unwrapLon(lon, mid);
  const pad = 0.5;
  if (
    clon + pad < minLon ||
    clon - pad > maxLon ||
    lat + pad < minLat ||
    lat - pad > maxLat
  ) {
    issues.push("centroid outside bbox");
  }
  return { n, issues };
}

function continentRank(c) {
  const i = CONTINENT_ORDER.indexOf(c);
  return i === -1 ? CONTINENT_ORDER.length : i;
}

function isoList(countries) {
  return countries.map((c) => c.isoA2).join(" ");
}

function docsMarkdown(report) {
  const {
    ne110Url,
    ne50Url,
    ruUrl,
    countries,
    skipped,
    patched,
    dropped,
    missingFlags,
    flagOk,
    specials,
    errors,
  } = report;

  const byContinent = CONTINENT_ORDER.map((cont) => {
    const list = countries.filter((c) => c.continent === cont);
    return { cont, list };
  }).filter((g) => g.list.length);

  const extraContinents = [
    ...new Set(countries.map((c) => c.continent)),
  ].filter((c) => !CONTINENT_ORDER.includes(c));
  for (const cont of extraContinents) {
    byContinent.push({
      cont,
      list: countries.filter((c) => c.continent === cont),
    });
  }

  const continentTable = byContinent
    .map(({ cont, list }) => `| ${cont} | ${list.length} |`)
    .join("\n");

  const continentBlocks = byContinent
    .map(
      ({ cont, list }) =>
        `### ${cont} (${list.length})\n\n${isoList(list)}\n`,
    )
    .join("\n");

  const patchedLines =
    patched.length > 0
      ? patched
          .map(
            (p) =>
              `- ${p.iso} ${p.nameEn} / ${p.nameRu} (${p.continent})`,
          )
          .join("\n")
      : "- None.";

  const skippedLines =
    skipped.length > 0
      ? skipped
          .map(
            (s) =>
              `- ${s.name} (ISO_A2=${s.ISO_A2}, ADM0_A3=${s.ADM0_A3}) — no ISO A2, skipped`,
          )
          .join("\n")
      : "- None.";

  const droppedLines =
    dropped.length > 0
      ? dropped
          .map(
            (d) =>
              `- ${d.iso} polygon ${d.index}${d.label ? ` (${d.label})` : ""} at [${d.centroid[0].toFixed(1)}, ${d.centroid[1].toFixed(1)}]: area ${(d.areaRatio * 100).toFixed(2)}% of largest ring, ${d.distDeg.toFixed(1)}° from main land`,
          )
          .join("\n")
      : "- None dropped this run.";

  const missingFlagLines =
    missingFlags.length > 0
      ? missingFlags.map((iso) => `- ${iso}`).join("\n")
      : "- None. Every packed country has \`public/flags/{iso}.svg\`.";

  const specialLines =
    specials.length > 0 ? specials.map((s) => `- ${s}`).join("\n") : "- None.";

  const failBlock = errors
    ? `## Download failed\n\n${errors}\n\nFix the network (or the source URL) and re-run the command above.\n\n`
    : "";

  return `# Geography data

Offline world pack for World Snap.

Re-run:

\`\`\`
node scripts/prepare-data.mjs
\`\`\`

Requires Node 18+ (global \`fetch\`). Writes:

- \`public/data/pack-world.json\`
- \`public/flags/{iso}.svg\` (lowercase ISO A2)

This run: **${countries.length} countries**, **${flagOk} flags**, **${skipped.length} skipped** (no ISO), **${missingFlags.length} flags missing**.

${failBlock}## Sources

### Countries — Natural Earth admin 0

110m (every feature with a real ISO A2):

https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson

50m (tiny sovereign states missing at 110m):

https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson

Used this run:

- 110m: ${ne110Url || "(none)"}
- 50m: ${ne50Url || "(none — tiny states not patched)"}

Upstream: [Natural Earth](https://www.naturalearthdata.com/). License: **public domain** ([terms of use](https://www.naturalearthdata.com/about/terms-of-use/)).

ISO: \`ISO_A2\`, else \`ISO_A2_EH\`, else \`WB_A2\`. Must be two letters. \`-99\` is skipped (no flag path). United Kingdom is \`GB\`, Kosovo is \`XK\`.

Coordinates stay as published. No extra simplification. Mainland and nearby islands that belong to the country stay (Sicily, Sardinia, Tasmania, Hainan, Sakhalin, Crete, French Guiana, Cabinda, Kaliningrad).

### Russian names

1. Natural Earth \`NAME_RU\`
2. [umpirsky/country-list](https://github.com/umpirsky/country-list) \`ru_RU\` (ISO A2 → Russian)
3. \`NAME_EN\`

Used this run: ${ruUrl || "(Natural Earth NAME_RU only)"}

### Flags — country-flags (Wikimedia SVGs)

https://cdn.jsdelivr.net/gh/hampusborgos/country-flags@main/svg/{code}.svg

Repo: [hampusborgos/country-flags](https://github.com/hampusborgos/country-flags) (collection MIT). Drawings from Wikimedia Commons. Stored as \`public/flags/{code}.svg\`.

A missing flag does **not** drop the country.

## Pack \`world\` (${countries.length})

\`id\`: \`world\`. \`titleRu\`: Мир. \`titleEn\`: World.

Sorted by continent (Europe → Asia → Africa → North America → South America → Oceania → Antarctica), then \`nameRu\`.

| Continent | Count |
| --- | ---: |
${continentTable}

${continentBlocks}
Centroids are area-weighted in lon/lat, unwrapped around the largest ring so Fiji / Russia do not jump across the antimeridian. Degenerate area falls back to bbox center. BBox is unwrapped the same way (max lon may exceed 180).

Tiny distant overseas scraps (area &lt; 0.4% of the largest ring **and** more than 18° from already-kept land) are dropped. Distance is to the nearest vertex of kept land, not the main centroid — so a far-from-centroid island that still sits next to the mainland is kept. A scrap within 5° of another country is kept so the continent puzzle has no hole. Antarctica is never pruned.

Dropped this run:

${droppedLines}

## Tiny states from 50m (${patched.length})

Sovereign countries that exist at 50m but not at 110m. Geometry is the 50m feature, unpruned.

${patchedLines}

## Skipped (no ISO A2)

${skippedLines}

## Flags missing

Countries still in the pack, no SVG written:

${missingFlagLines}

## Special cases

${specialLines}

## License short

- Natural Earth geometries: public domain.
- Flag SVGs: public-domain flag designs, via Wikimedia Commons / country-flags.
`;
}

async function writeDocs(report) {
  await mkdir(path.dirname(DOCS_PATH), { recursive: true });
  await writeFile(DOCS_PATH, docsMarkdown(report), "utf8");
}

function collectSkipped(features) {
  const skipped = [];
  for (const f of features) {
    if (isoOf(f.properties)) continue;
    skipped.push({
      name: textOf(f.properties?.NAME, f.properties?.ADMIN) || "(unnamed)",
      ISO_A2: String(f.properties?.ISO_A2 ?? ""),
      ADM0_A3: String(f.properties?.ADM0_A3 ?? ""),
      TYPE: String(f.properties?.TYPE ?? ""),
    });
  }
  return skipped;
}

function indexByIso(features) {
  const map = new Map();
  const dups = [];
  for (const f of features) {
    const iso = isoOf(f.properties);
    if (!iso) continue;
    if (map.has(iso)) {
      dups.push(iso);
      continue;
    }
    map.set(iso, f);
  }
  return { map, dups };
}

async function downloadFlag(iso) {
  const dest = path.join(FLAG_DIR, `${iso.toLowerCase()}.svg`);
  const errors = [];
  for (const url of FLAG_URLS(iso)) {
    try {
      const { bytes } = await fetchBuffer(url, { retries: 0 });
      const svg = normalizeSvg(bytes.toString("utf8"));
      await writeFile(dest, svg, "utf8");
      return { iso, ok: true, bytes: Buffer.byteLength(svg), error: null };
    } catch (err) {
      errors.push(err.message);
    }
  }
  return { iso, ok: false, bytes: 0, error: errors.join(" | ") };
}

async function main() {
  const specials = [];
  const droppedAll = [];
  const patched = [];

  let ne110Url = "";
  let ne50Url = "";
  let ruUrl = "";
  let geo110;
  let geo50 = null;
  let ruMap = {};

  try {
    const ne = await fetchJsonFrom(NE_110_URLS, "Natural Earth 110m");
    ne110Url = ne.url;
    geo110 = ne.json;
    if (!geo110?.features?.length) throw new Error("110m GeoJSON has no features");
  } catch (err) {
    await writeDocs({
      ne110Url: "",
      ne50Url: "",
      ruUrl: "",
      countries: [],
      skipped: [],
      patched: [],
      dropped: [],
      missingFlags: [],
      flagOk: 0,
      specials: [],
      errors: String(err.message || err),
    });
    warn(err.message || err);
    process.exitCode = 1;
    return;
  }

  try {
    const ne50 = await fetchJsonFrom(NE_50_URLS, "Natural Earth 50m");
    ne50Url = ne50.url;
    geo50 = ne50.json;
  } catch (err) {
    warn(`50m patch skipped: ${err.message}`);
    specials.push(`50m download failed; tiny states were not patched. ${err.message}`);
  }

  try {
    const ru = await fetchJsonFrom(RU_NAME_URLS, "Russian country names");
    ruUrl = ru.url;
    ruMap = ruMapFrom(ru.json);
  } catch (err) {
    warn(`Russian name map skipped: ${err.message}`);
    specials.push(
      `umpirsky/i18n name map failed; using Natural Earth NAME_RU / NAME_EN. ${err.message}`,
    );
  }

  const { map: map110, dups: dups110 } = indexByIso(geo110.features);
  if (dups110.length) {
    specials.push(`110m duplicate ISO (kept first): ${[...new Set(dups110)].join(", ")}.`);
  }

  const skipped = collectSkipped(geo110.features);

  const records = [];
  for (const [iso, feature] of map110) {
    records.push({ iso, feature, scale: "110m" });
  }

  if (geo50?.features) {
    const { map: map50 } = indexByIso(geo50.features);
    for (const [iso, feature] of map50) {
      if (map110.has(iso)) continue;
      const type = textOf(feature.properties?.TYPE);
      if (type !== "Sovereign country") continue;
      records.push({ iso, feature, scale: "50m" });
      patched.push({
        iso,
        nameEn: textOf(
          feature.properties?.NAME_EN,
          feature.properties?.NAME,
        ),
        nameRu: textOf(feature.properties?.NAME_RU),
        continent: continentOf(feature.properties, null),
      });
    }
  }

  const neighbors = records.map((r) => ({
    iso: r.iso,
    polygons: polygonsOf(r.feature.geometry),
  }));

  const countries = [];
  for (const rec of records) {
    const { iso, feature, scale } = rec;
    const props = feature.properties || {};
    let geometry = feature.geometry;
    if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) {
      specials.push(`${iso}: unexpected geometry type ${geometry?.type || "none"}.`);
      continue;
    }

    const { nameRu, nameEn } = namesOf(iso, props, ruMap);
    let continent = continentOf(props, polygonCentroidLonLat(polygonsOf(geometry)[0]));

    if (scale === "110m") {
      const pruned = pruneOverseasScraps(geometry, {
        iso,
        continent,
        neighbors,
      });
      geometry = pruned.geometry;
      droppedAll.push(...pruned.dropped);
    }

    const centroid = areaWeightedCentroid(geometry);
    continent = continentOf(props, centroid);
    const bbox = bboxOfGeometry(geometry, centroid[0]);

    if (iso === "GB") {
      specials.push(
        "GB: Natural Earth feature is United Kingdom (Great Britain + Northern Ireland). Ireland is IE.",
      );
    }
    if (iso === "AU") {
      const n = polygonsOf(geometry).length;
      specials.push(
        n >= 2
          ? "AU: Tasmania is present in the 110m feature and was kept."
          : "AU: only one polygon at 110m (Tasmania not a separate ring).",
      );
    }
    if (iso === "FR") {
      specials.push(
        "FR: 110m feature is metropolitan France + Corsica + French Guiana. French Guiana is kept (South America hole otherwise).",
      );
    }
    if (iso === "XK") {
      specials.push(
        "XK: Kosovo uses ISO_A2_EH (ISO_A2 is -99).",
      );
    }
    if (iso === "RU") {
      specials.push(
        "RU: Kaliningrad, Crimea (as drawn by Natural Earth), Sakhalin and Arctic islands are kept.",
      );
    }
    if (iso === "US") {
      const n = polygonsOf(geometry).length;
      specials.push(
        `US: CONUS + Alaska + Aleutians kept (${n} polygons). Hawaii dropped as tiny distant overseas scraps.`,
      );
    }

    countries.push({
      id: iso,
      nameRu,
      nameEn,
      isoA2: iso,
      continent,
      centroid,
      bbox,
      geometry: {
        type: geometry.type,
        coordinates: geometry.coordinates,
      },
    });
  }

  const extraUnits = records.filter((r) => {
    const t = textOf(r.feature.properties?.TYPE);
    return t === "Dependency" || t === "Indeterminate" || r.iso === "GL" || r.iso === "FK";
  });
  if (extraUnits.length) {
    extraUnits.sort((a, b) => a.iso.localeCompare(b.iso));
    specials.push(
      `Territories / indeterminate units kept because they have ISO A2: ${extraUnits
        .map(
          (r) =>
            `${r.iso} ${textOf(r.feature.properties?.NAME_EN, r.feature.properties?.NAME)}`,
        )
        .join(", ")}.`,
    );
  }

  countries.sort((a, b) => {
    const cr = continentRank(a.continent) - continentRank(b.continent);
    if (cr !== 0) return cr;
    return a.nameRu.localeCompare(b.nameRu, "ru");
  });

  patched.sort((a, b) => a.iso.localeCompare(b.iso));

  const pack = {
    id: "world",
    titleRu: "Мир",
    titleEn: "World",
    countries,
  };

  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(FLAG_DIR, { recursive: true });
  await writeFile(
    path.join(DATA_DIR, "pack-world.json"),
    `${JSON.stringify(pack)}\n`,
    "utf8",
  );

  const flagResults = await mapPool(countries, 12, (c) => downloadFlag(c.id));
  const missingFlags = flagResults.filter((f) => !f.ok).map((f) => f.iso);
  const flagOk = flagResults.filter((f) => f.ok).length;
  for (const iso of missingFlags) {
    specials.push(`${iso}: flag download failed.`);
  }

  const report = {
    ne110Url,
    ne50Url,
    ruUrl,
    countries,
    skipped,
    patched,
    dropped: droppedAll,
    missingFlags,
    flagOk,
    specials,
    errors: null,
  };
  await writeDocs(report);

  console.log("World Snap pack-world");
  console.log(`Natural Earth 110m: ${ne110Url}`);
  console.log(`Natural Earth 50m: ${ne50Url || "(not used)"}`);
  console.log(`Russian names: ${ruUrl || "(NAME_RU / NAME_EN only)"}`);
  console.log("");

  let failCountries = 0;
  for (const country of countries) {
    const { n, issues } = validateCountry(country);
    const flagInfo = flagResults.find((f) => f.iso === country.id);
    const flagBit =
      flagInfo?.ok && flagInfo.bytes > 0
        ? `svg=ok ${flagInfo.bytes}B`
        : `svg=MISSING ${flagInfo?.error || ""}`;
    const geom = `${country.geometry.type} pts=${n}`;
    const c = country.centroid.map((v) => v.toFixed(4)).join(", ");
    const bad = issues.length > 0;
    if (bad) failCountries += 1;
    const mark = bad ? "FAIL" : "ok  ";
    console.log(
      `${mark} ${country.id}  ${country.nameRu}  ${country.continent}  ${geom}  centroid=[${c}]  ${flagBit}${issues.length ? "  " + issues.join("; ") : ""}`,
    );
  }

  console.log("");
  if (skipped.length) {
    console.log("skipped (no ISO A2):");
    for (const s of skipped) {
      console.log(`  ${s.name}  ISO_A2=${s.ISO_A2}  ADM0_A3=${s.ADM0_A3}`);
    }
  }
  if (patched.length) {
    console.log(`tiny states from 50m: ${patched.map((p) => p.iso).join(" ")}`);
  }
  if (droppedAll.length) {
    console.log(
      `dropped scraps: ${droppedAll.map((d) => `${d.iso}#${d.index}`).join(" ")}`,
    );
  }
  if (missingFlags.length) {
    console.log(`flags missing: ${missingFlags.join(" ")}`);
  }

  console.log("");
  console.log(`countries ${countries.length}`);
  console.log(`flags downloaded ${flagOk}`);
  console.log(`flags missing ${missingFlags.length}`);
  console.log(`skipped ${skipped.length}`);
  console.log(`tiny states from 50m ${patched.length}`);
  console.log(`dropped scraps ${droppedAll.length}`);

  if (!countries.length || failCountries) {
    process.exitCode = 1;
  }
}

main().catch(async (err) => {
  try {
    await writeDocs({
      ne110Url: "",
      ne50Url: "",
      ruUrl: "",
      countries: [],
      skipped: [],
      patched: [],
      dropped: [],
      missingFlags: [],
      flagOk: 0,
      specials: [],
      errors: String(err?.stack || err),
    });
  } catch {
    // still fail below
  }
  warn(err);
  process.exitCode = 1;
});
