import fs from "fs";
import path from "path";

export interface LocationEntry {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
}

export interface City {
  city: string;
  latitude: number;
  longitude: number;
}

// The source dataset (data/Lat_and_Lon.json) is large — it is kept server-side
// and never shipped to the client. We parse it exactly once, on first use, and
// keep the country -> cities grouping in memory so subsequent requests are a
// cheap Map lookup rather than a full re-scan of the file.
let countriesCache: string[] | null = null;
let citiesByCountry: Map<string, City[]> | null = null;

function load(): void {
  if (citiesByCountry) return;

  const filePath = path.join(process.cwd(), "data", "Lat_and_Lon.json");
  const raw = fs.readFileSync(filePath, "utf8");

  // The dataset was produced by a Python dumper that emits bare `NaN` /
  // `Infinity` for missing coordinates, which standard JSON.parse rejects.
  // Rewrite those value-position tokens to `null`; the regex only matches
  // after a `:` so quoted strings like "city": "NaN" are left untouched.
  // The same dumper truncates the dump mid-array, leaving a trailing comma
  // before the closing bracket — strip commas that directly precede `]`/`}`.
  const sanitized = raw
    .replace(/:(\s*)(NaN|-?Infinity)\b/g, ":$1null")
    .replace(/,(\s*[\]}])/g, "$1");
  const entries: LocationEntry[] = JSON.parse(sanitized);

  const map = new Map<string, City[]>();
  for (const entry of entries) {
    if (!entry || !entry.country || !entry.city) continue;
    if (!Number.isFinite(entry.latitude) || !Number.isFinite(entry.longitude)) continue;
    let list = map.get(entry.country);
    if (!list) {
      list = [];
      map.set(entry.country, list);
    }
    list.push({
      city: entry.city,
      latitude: entry.latitude,
      longitude: entry.longitude,
    });
  }

  // Sort cities within each country by name; some entries are geographic
  // features (peaks, lakes) rather than settlements — that's expected, we list
  // them verbatim.
  for (const list of map.values()) {
    list.sort((a, b) => a.city.localeCompare(b.city));
  }

  citiesByCountry = map;
  countriesCache = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
}

export function getCountries(): string[] {
  load();
  return countriesCache!;
}

export function getCities(country: string): City[] {
  load();
  return citiesByCountry!.get(country) ?? [];
}
