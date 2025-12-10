import fs from "fs";
import path from "path";

const rawPath = path.join(process.cwd(), "data", "rawPois.geojson");
const outPath = path.join(process.cwd(), "data", "enrichedPois.geojson");

const raw = JSON.parse(fs.readFileSync(rawPath));

const categoryMap = [
  { keyword: "school", category: "Education" },
  { keyword: "college", category: "Education" },
  { keyword: "university", category: "Education" },
  { keyword: "hospital", category: "Health" },
  { keyword: "clinic", category: "Health" },
  { keyword: "pharmacy", category: "Health" },
  { keyword: "park", category: "Recreation" },
  { keyword: "garden", category: "Recreation" },
  { keyword: "mosque", category: "Religious" },
  { keyword: "masjid", category: "Religious" },
  { keyword: "church", category: "Religious" },
  { keyword: "mall", category: "Commercial" },
  { keyword: "market", category: "Commercial" },
  { keyword: "shop", category: "Commercial" },
];

function inferCategory(name = "") {
  const lower = name.toLowerCase();
  for (let rule of categoryMap) {
    if (lower.includes(rule.keyword)) return rule.category;
  }
  return "Unknown";
}

function normalizeName(name = "") {
  return name.trim().replace(/\s+/g, " ");
}

const enrichedFeatures = raw.features.map((f) => {
  const name = f.properties?.name || "";

  return {
    ...f,
    properties: {
      ...f.properties,

      clean_name: normalizeName(name),
      category: f.properties?.category || inferCategory(name),
      coords_valid: Array.isArray(f.geometry?.coordinates),
      source: "Enriched by script v1",

      address_normalized: f.properties?.address
        ? f.properties.address.toLowerCase()
        : "N/A",
    },
  };
});

fs.writeFileSync(
  outPath,
  JSON.stringify({ type: "FeatureCollection", features: enrichedFeatures }, null, 2)
);

console.log("✨ Enrichment complete →", outPath);


