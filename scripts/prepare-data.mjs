#!/usr/bin/env node
/**
 * Download Natural Earth 110m countries + SVG flags, write the v0 pack.
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

const PACK_ISO = ["IT", "JP", "BR", "AU", "IN", "MG", "EG", "GB"];

const NAME_FALLBACK = {
  IT: { nameRu: "Италия", nameEn: "Italy" },
  JP: { nameRu: "Япония", nameEn: "Japan" },
  BR: { nameRu: "Бразилия", nameEn: "Brazil" },
  AU: { nameRu: "Австралия", nameEn: "Australia" },
  IN: { nameRu: "Индия", nameEn: "India" },
  MG: { nameRu: "Мадагаскар", nameEn: "Madagascar" },
  EG: { nameRu: "Египет", nameEn: "Egypt" },
  GB: { nameRu: "Великобритания", nameEn: "United Kingdom" },
};

const ADM0_A3_BY_ISO = {
  IT: "ITA",
  JP: "JPN",
  BR: "BRA",
  AU: "AUS",
  IN: "IND",
  MG: "MDG",
  EG: "EGY",
  GB: "GBR",
};

const NE_URLS = [
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
  "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/cultural/ne_110m_admin_0_countries.json",
];

const FLAG_URL = (iso) =>
  `https://cdn.jsdelivr.net/gh/hampusborgos/country-flags@main/svg/${iso.toLowerCase()}.svg`;

/** Keep nearby / substantial islands (Tasmania, Sicily). Drop tiny distant scraps. */
const MIN_AREA_RATIO = 0.005;
const MAX_ISOLATION_DEG = 12;

function warn(msg) {
  console.error(msg);
}

async function fetchBuffer(url, { retries = 1 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      return { url, bytes: Buffer.from(await res.arrayBuffer()) };
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        warn(`retry ${attempt + 1} ${url}: ${err.message}`);
      }
    }
  }
  throw new Error(`${url}: ${lastErr?.message || lastErr}`);
}

async function fetchNaturalEarth() {
  const errors = [];
  for (const url of NE_URLS) {
    try {
      const { bytes } = await fetchBuffer(url, { retries: 1 });
      const geojson = JSON.parse(bytes.toString("utf8"));
      if (!geojson?.features?.length) {
        throw new Error("GeoJSON has no features");
      }
      return { url, geojson };
    } catch (err) {
      errors.push(`${url} — ${err.message}`);
      warn(`Natural Earth source failed: ${err.message}`);
    }
  }
  throw new Error(`All Natural Earth URLs failed:\n${errors.join("\n")}`);
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

function findFeature(features, iso) {
  const wantedA3 = ADM0_A3_BY_ISO[iso];
  const byIso = features.find((f) => isoOf(f.properties) === iso);
  if (byIso) return { feature: byIso, how: "ISO_A2" };
  const byA3 = features.find(
    (f) => String(f.properties?.ADM0_A3 || "").toUpperCase() === wantedA3,
  );
  if (byA3) return { feature: byA3, how: `ADM0_A3=${wantedA3}` };
  if (iso === "GB") {
    const byName = features.find((f) => {
      const blob = [
        f.properties?.ADMIN,
        f.properties?.NAME,
        f.properties?.NAME_EN,
        f.properties?.NAME_LONG,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes("united kingdom") || blob.includes("great britain");
    });
    if (byName) return { feature: byName, how: "NAME~United Kingdom" };
  }
  return { feature: null, how: null };
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

function bboxOf(geometry) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  walkPositions(geometry.coordinates, (lon, lat) => {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
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

function ringCentroid(ring) {
  let ax = 0;
  let ay = 0;
  let crossSum = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    const x0 = ring[i][0];
    const y0 = ring[i][1];
    const x1 = ring[i + 1][0];
    const y1 = ring[i + 1][1];
    const cross = x0 * y1 - x1 * y0;
    crossSum += cross;
    ax += (x0 + x1) * cross;
    ay += (y0 + y1) * cross;
  }
  if (crossSum === 0) {
    const [minLon, minLat, maxLon, maxLat] = bboxOf({
      type: "Polygon",
      coordinates: [ring],
    });
    return { x: (minLon + maxLon) / 2, y: (minLat + maxLat) / 2, area: 0 };
  }
  return { x: ax / (3 * crossSum), y: ay / (3 * crossSum), area: crossSum / 2 };
}

function polygonsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function polygonAreaAbs(polygon) {
  if (!polygon?.[0]) return 0;
  return Math.abs(signedRingArea(polygon[0]));
}

function polygonCentroidLonLat(polygon) {
  let areaSum = 0;
  let xSum = 0;
  let ySum = 0;
  for (const ring of polygon) {
    const c = ringCentroid(ring);
    xSum += c.x * c.area;
    ySum += c.y * c.area;
    areaSum += c.area;
  }
  if (areaSum === 0) {
    const [minLon, minLat, maxLon, maxLat] = bboxOf({
      type: "Polygon",
      coordinates: polygon,
    });
    return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
  }
  return [xSum / areaSum, ySum / areaSum];
}

function pruneOverseasScraps(geometry, iso) {
  const polygons = polygonsOf(geometry);
  if (polygons.length <= 1) {
    return { geometry, dropped: [] };
  }
  const areas = polygons.map(polygonAreaAbs);
  const maxArea = Math.max(...areas);
  const mainIndex = areas.indexOf(maxArea);
  const [mainLon, mainLat] = polygonCentroidLonLat(polygons[mainIndex]);
  const kept = [];
  const dropped = [];
  polygons.forEach((polygon, i) => {
    const area = areas[i];
    const [lon, lat] = polygonCentroidLonLat(polygon);
    const dist = Math.hypot(lon - mainLon, lat - mainLat);
    const keep = area >= maxArea * MIN_AREA_RATIO || dist <= MAX_ISOLATION_DEG;
    if (keep) kept.push(polygon);
    else dropped.push({ iso, index: i, areaRatio: area / maxArea, distDeg: dist });
  });
  if (kept.length === polygons.length) {
    return { geometry, dropped: [] };
  }
  if (kept.length === 1) {
    return { geometry: { type: "Polygon", coordinates: kept[0] }, dropped };
  }
  return { geometry: { type: "MultiPolygon", coordinates: kept }, dropped };
}

function areaWeightedCentroid(geometry) {
  const polygons = polygonsOf(geometry);
  let areaSum = 0;
  let xSum = 0;
  let ySum = 0;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      const c = ringCentroid(ring);
      xSum += c.x * c.area;
      ySum += c.y * c.area;
      areaSum += c.area;
    }
  }
  if (areaSum === 0) {
    const [minLon, minLat, maxLon, maxLat] = bboxOf(geometry);
    return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
  }
  return [xSum / areaSum, ySum / areaSum];
}

function namesOf(iso, props) {
  const fallback = NAME_FALLBACK[iso];
  const nameEn =
    (typeof props?.NAME_EN === "string" && props.NAME_EN.trim()) ||
    (typeof props?.NAME === "string" && props.NAME.trim()) ||
    fallback.nameEn;
  const nameRu =
    (typeof props?.NAME_RU === "string" && props.NAME_RU.trim()) ||
    fallback.nameRu;
  return { nameEn, nameRu };
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
  const coords = country.geometry?.coordinates;
  const n = countPositions(coords);
  if (!n) issues.push("empty coordinates");
  const [lon, lat] = country.centroid;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    issues.push("non-finite centroid");
  }
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    issues.push("centroid outside world");
  }
  const [minLon, minLat, maxLon, maxLat] = country.bbox;
  const pad = 0.5;
  if (
    lon + pad < minLon ||
    lon - pad > maxLon ||
    lat + pad < minLat ||
    lat - pad > maxLat
  ) {
    issues.push("centroid outside bbox");
  }
  return { n, issues };
}

function collectionStub() {
  return {
    packs: [
      { id: "familiar", titleRu: "Знакомый мир", status: "playable", pieceCount: 8 },
      { id: "europe", titleRu: "Европа", status: "locked", pieceCount: 12 },
      { id: "continents", titleRu: "Континенты", status: "locked", pieceCount: 6 },
      {
        id: "states",
        titleRu: "Штаты и провинции",
        status: "locked",
        pieceCount: 50,
      },
    ],
  };
}

function docsMarkdown({ neUrl, specials, dropped, errors }) {
  const specialLines =
    specials.length > 0
      ? specials.map((s) => `- ${s}`).join("\n")
      : "- None.";
  const droppedLines =
    dropped.length > 0
      ? dropped
          .map(
            (d) =>
              `- ${d.iso} polygon ${d.index}: area ratio ${(d.areaRatio * 100).toFixed(2)}%, ${d.distDeg.toFixed(1)}° from main ring`,
          )
          .join("\n")
      : "- None dropped in this pack.";
  const failBlock = errors
    ? `## Download failed\n\n${errors}\n\nFix the network (or the source URL) and re-run the command above.\n\n`
    : "";
  return `# Geography data (v0)

Offline pack for World Snap.

Re-run:

\`\`\`
node scripts/prepare-data.mjs
\`\`\`

Requires Node 18+ (global \`fetch\`). The script downloads Natural Earth + flag SVGs and writes:

- \`public/data/pack-familiar.json\`
- \`public/data/collection.json\`
- \`public/flags/{iso}.svg\` (lowercase ISO A2)

${failBlock}## Sources

### Countries — Natural Earth 110m admin 0

Primary:

https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson

Fallback:

https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/cultural/ne_110m_admin_0_countries.json

Used this run: ${neUrl || "(none — download failed)"}

Upstream: [Natural Earth](https://www.naturalearthdata.com/). License: **public domain** ([terms of use](https://www.naturalearthdata.com/about/terms-of-use/)). Attribution is appreciated, not required.

ISO field: \`ISO_A2\` (United Kingdom is \`GB\`, not \`UK\`). If \`ISO_A2\` is missing or \`-99\`, the script tries \`ISO_A2_EH\`, then \`WB_A2\`, then \`ADM0_A3\`.

Scale is 1:110 million. Coordinates are kept as published. No extra simplification.

### Flags — country-flags (Wikimedia SVGs)

https://cdn.jsdelivr.net/gh/hampusborgos/country-flags@main/svg/{code}.svg

Repo: [hampusborgos/country-flags](https://github.com/hampusborgos/country-flags) (collection MIT). Paths are lowercase ISO A2 (\`it.svg\`, \`gb.svg\`).

The drawings come from Wikimedia Commons. The eight pack flags are **national flags in the public domain** (state symbols; not subject to copyright). Stored as \`public/flags/{code}.svg\`.

## Pack \`familiar\` (8)

| ISO A2 | nameRu | nameEn | geometry at 110m |
| --- | --- | --- | --- |
| IT | Италия | Italy | MultiPolygon: mainland + Sicily + Sardinia |
| JP | Япония | Japan | MultiPolygon: main islands. Okinawa is not in 110m |
| BR | Бразилия | Brazil | Polygon |
| AU | Австралия | Australia | MultiPolygon: mainland + Tasmania (kept) |
| IN | Индия | India | Polygon. Sri Lanka is \`LK\`, not included |
| MG | Мадагаскар | Madagascar | Polygon |
| EG | Египет | Egypt | Polygon |
| GB | Великобритания | United Kingdom | MultiPolygon: Great Britain + Northern Ireland |

Centroids are area-weighted in lon/lat. Degenerate area falls back to bbox center.

Tiny distant scraps (area &lt; 0.5% of the largest ring **and** more than 12° from it) are dropped so a puzzle piece stays readable.

Dropped this run:

${droppedLines}

## Collection stub

\`public/data/collection.json\` lists four packs. Only \`familiar\` is playable.

## Special cases

${specialLines}

## License short

- Natural Earth geometries: public domain.
- Flag SVGs: public-domain flag designs, via Wikimedia Commons / country-flags.
`;
}

async function writeDocs(opts) {
  await mkdir(path.dirname(DOCS_PATH), { recursive: true });
  await writeFile(DOCS_PATH, docsMarkdown(opts), "utf8");
}

async function main() {
  const specials = [];
  const droppedAll = [];

  let neUrl = "";
  let geojson;
  try {
    const ne = await fetchNaturalEarth();
    neUrl = ne.url;
    geojson = ne.geojson;
  } catch (err) {
    await writeDocs({
      neUrl: "",
      specials: [],
      dropped: [],
      errors: String(err.message || err),
    });
    warn(err.message || err);
    process.exitCode = 1;
    return;
  }

  const features = geojson.features;
  const countries = [];

  for (const iso of PACK_ISO) {
    const { feature, how } = findFeature(features, iso);
    if (!feature?.geometry) {
      specials.push(
        `${iso}: missing from Natural Earth 110m. No substitute included.`,
      );
      continue;
    }
    if (how && how !== "ISO_A2") {
      specials.push(
        `${iso}: ISO_A2 not usable; matched via ${how} (${feature.properties?.ADMIN || feature.properties?.NAME}).`,
      );
    }

    let geometry = feature.geometry;
    if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
      specials.push(`${iso}: unexpected geometry type ${geometry.type}.`);
      continue;
    }

    const pruned = pruneOverseasScraps(geometry, iso);
    geometry = pruned.geometry;
    droppedAll.push(...pruned.dropped);
    if (pruned.dropped.length) {
      specials.push(
        `${iso}: dropped ${pruned.dropped.length} tiny distant polygon(s).`,
      );
    }

    if (iso === "GB") {
      const ie = features.find((f) => isoOf(f.properties) === "IE");
      specials.push(
        "GB: Natural Earth feature is United Kingdom (Great Britain + Northern Ireland). Ireland is a separate IE feature and is not included.",
      );
      if (ie) {
        const gbBox = bboxOf(geometry);
        const ieBox = bboxOf(ie.geometry);
        if (gbBox[0] <= ieBox[0] + 0.2 && gbBox[2] >= ieBox[2] - 0.2) {
          specials.push(
            "GB: bbox looks wide enough to swallow Ireland — check the piece by eye.",
          );
        }
      }
    }

    if (iso === "AU") {
      const n = polygonsOf(geometry).length;
      specials.push(
        n >= 2
          ? "AU: Tasmania is present in the 110m feature and was kept."
          : "AU: only one polygon at 110m (Tasmania not a separate ring).",
      );
    }

    const { nameRu, nameEn } = namesOf(iso, feature.properties);
    const centroid = areaWeightedCentroid(geometry);
    const bbox = bboxOf(geometry);

    countries.push({
      id: iso,
      nameRu,
      nameEn,
      isoA2: iso,
      centroid,
      bbox,
      geometry: {
        type: geometry.type,
        coordinates: geometry.coordinates,
      },
    });
  }

  if (countries.length !== PACK_ISO.length) {
    const missing = PACK_ISO.filter((c) => !countries.some((x) => x.id === c));
    specials.push(`Missing countries after filter: ${missing.join(", ")}.`);
  }

  const pack = {
    id: "familiar",
    titleRu: "Знакомый мир",
    titleEn: "Familiar world",
    countries,
  };

  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(FLAG_DIR, { recursive: true });
  await writeFile(
    path.join(DATA_DIR, "pack-familiar.json"),
    `${JSON.stringify(pack, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(DATA_DIR, "collection.json"),
    `${JSON.stringify(collectionStub(), null, 2)}\n`,
    "utf8",
  );

  const flagResults = [];
  for (const iso of PACK_ISO) {
    const code = iso.toLowerCase();
    const dest = path.join(FLAG_DIR, `${code}.svg`);
    try {
      const { bytes } = await fetchBuffer(FLAG_URL(iso), { retries: 1 });
      const svg = normalizeSvg(bytes.toString("utf8"));
      await writeFile(dest, svg, "utf8");
      flagResults.push({
        iso,
        ok: svg.startsWith("<svg"),
        bytes: Buffer.byteLength(svg),
        error: null,
      });
    } catch (err) {
      flagResults.push({ iso, ok: false, bytes: 0, error: err.message });
      specials.push(`${iso}: flag download failed — ${err.message}`);
    }
  }

  const failedFlags = flagResults.filter((f) => !f.ok);
  if (failedFlags.length) {
    await writeDocs({
      neUrl,
      specials,
      dropped: droppedAll,
      errors: `Flag download failed for: ${failedFlags.map((f) => f.iso).join(", ")}.`,
    });
  } else {
    await writeDocs({ neUrl, specials, dropped: droppedAll, errors: null });
  }

  console.log("World Snap v0 pack");
  console.log(`Natural Earth: ${neUrl}`);
  console.log("");
  for (const country of countries) {
    const { n, issues } = validateCountry(country);
    const flagInfo = flagResults.find((f) => f.iso === country.id);
    const flagOk =
      flagInfo?.ok && flagInfo.bytes > 0 ? `svg=ok ${flagInfo.bytes}B` : `svg=FAIL ${flagInfo?.error || ""}`;
    const geom = `${country.geometry.type} pts=${n}`;
    const c = country.centroid.map((v) => v.toFixed(4)).join(", ");
    const mark = issues.length || !flagInfo?.ok ? "FAIL" : "ok  ";
    console.log(
      `${mark} ${country.id}  ${country.nameEn.padEnd(16)}  ${geom.padEnd(28)}  centroid=[${c}]  ${flagOk}${issues.length ? "  " + issues.join("; ") : ""}`,
    );
  }
  for (const iso of PACK_ISO) {
    if (!countries.some((c) => c.id === iso)) {
      console.log(`FAIL ${iso}  missing feature`);
    }
  }
  const countryOk =
    countries.length === PACK_ISO.length &&
    countries.every((c) => validateCountry(c).issues.length === 0);
  const flagsOk = flagResults.length === PACK_ISO.length && flagResults.every((f) => f.ok);
  console.log("");
  console.log(
    `countries ${countries.length}/${PACK_ISO.length}  flags ${flagResults.filter((f) => f.ok).length}/${PACK_ISO.length}`,
  );
  if (!countryOk || !flagsOk) {
    process.exitCode = 1;
  }
}

main().catch(async (err) => {
  try {
    await writeDocs({
      neUrl: "",
      specials: [],
      dropped: [],
      errors: String(err?.stack || err),
    });
  } catch {
    // still fail below
  }
  warn(err);
  process.exitCode = 1;
});
