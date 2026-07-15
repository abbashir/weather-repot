# CLAUDE.md — Weather Report (WeatherAI AI)

This file is the working spec for this repo. It has two parts: **Existing Spec** (what's already built and should be treated as the current baseline) and **Current Changes** (what to build next). Keep this file up to date as changes land — append to Current Changes, and fold completed items back into Existing Spec once merged.

---

## Existing Spec

### Purpose
A one-page Next.js app demonstrating integration with the WeatherAI API (`https://weather-ai.co`, API base `https://api.weather-ai.co`) for a technical assessment. Shows current conditions + forecast for a location, with the API key kept server-side only.

### Stack
- Next.js 14.2.35, App Router, TypeScript
- No UI library — plain CSS via `styled-jsx`, single-file page
- No state management library — local `useState`/`useEffect` only
- Deploy target: Vercel

### File structure (current)
```
app/
  layout.tsx          — root layout, loads Google Fonts (JetBrains Mono + Manrope)
  globals.css         — design tokens (CSS custom properties) + base resets
  page.tsx            — the entire UI (client component): location pickers + dashboard
  api/weather/route.ts             — server-side proxy to WeatherAI; injects Authorization header
  api/locations/countries/route.ts — sorted, de-duped country list from the bundled dataset
  api/locations/cities/route.ts    — cities (with lat/lon) for a given ?country=
lib/
  locations.ts        — parses data/Lat_and_Lon.json once at first use, caches country→cities
  weathercode.ts      — WMO code → { label, icon } lookup with an "Unknown" fallback
data/
  Lat_and_Lon.json    — bundled location dataset (server-side only, NOT under public/)
.env.local.example     — WEATHER_AI_API_KEY=wai_your_key_here
README.md
```

### Location dataset (`data/Lat_and_Lon.json`)
- Kept server-side (outside `public/`) and never shipped to the client — it is large (~150 MB).
- Parsed once lazily in `lib/locations.ts`; the country→cities grouping is cached in memory.
- Quirks handled at load time: the file is emitted by a Python dumper that writes bare `NaN`/`Infinity` for missing coordinates (invalid JSON), so those value-position tokens are rewritten to `null` before `JSON.parse`, and entries with non-finite lat/lon are skipped. The dumper also truncates mid-array, leaving a trailing comma before the closing `]` (invalid JSON) — trailing commas before `]`/`}` are stripped in the same sanitize pass. The current file is alphabetically truncated (last country is "Canada") — that's a property of the supplied data, not a bug.

### Design tokens (from `app/globals.css`)
```css
--ink: #0b0f17;        /* page background */
--panel: #131a26;       /* card background */
--panel-raised: #1a2230;/* inset readout background */
--hairline: #26304199;  /* borders */
--paper: #e9edf3;       /* primary text */
--fog: #7e8ba1;         /* muted/label text */
--amber: #f2b84b;       /* primary accent — dial ring, temp, active toggle */
--mint: #6fe3c4;        /* secondary accent — CTA, AI summary rule */
--danger: #e2725b;      /* error text */
--mono: "JetBrains Mono", ui-monospace, monospace;  /* numeric/label face */
--sans: "Manrope", system-ui, sans-serif;           /* body face */
```
Theme concept: an "instrument panel" — a circular dial for temperature, monospace numeric readouts in small cards, minimal chrome. Keep this concept for the dashboard redesign below rather than switching to a generic card-grid look.

### API route (`app/api/weather/route.ts`)
- `GET /api/weather?lat=&lon=&units=`
- If `lat`/`lon` are missing, calls `/v1/weather-geo?ip=auto` instead of `/v1/weather` (IP-based fallback).
- Always passes `ai=true`.
- For the geo-detect path, reads `X-City` / `X-Region` / `X-Country` response **headers** from upstream and folds them into the returned JSON as `data.geo`.
- API key (`WEATHER_AI_API_KEY`) is read from env server-side only; never sent to the client.

### Known limitation being fixed by Current Changes below
`app/page.tsx` currently reads response fields defensively (`pick()` helper trying several possible key names) because the real schema wasn't confirmed yet. **This is now confirmed — see the real schema below — so the defensive guessing should be replaced with direct, typed field access.**

### Confirmed real API response shape (`/v1/weather`)
```json
{
  "lat": -1.2921,
  "lon": 36.8219,
  "units": "metric",
  "days": 3,
  "current": {
    "time": "2026-07-14T14:15",
    "interval": 900,
    "temperature": 25.4,
    "windspeed": 13.8,
    "winddirection": 64,
    "is_day": 1,
    "weathercode": 2
  },
  "daily": [
    { "date": "2026-07-14", "temp_max": 25.4, "temp_min": 12.3, "precipitation": 0, "weathercode": 3 }
  ],
  "hourly": [
    { "time": "2026-07-14T00:00", "temp": 15.1, "precipitation": 0, "weathercode": 0 }
  ],
  "ai_summary": null
}
```
Notes:
- `weathercode` is a WMO weather code (Open-Meteo convention: 0 clear, 1 mainly clear, 2 partly cloudy, 3 overcast, 45/48 fog, 51/53/55 drizzle, 61/63/65 rain, 71/73/75 snow, 80/81/82 rain showers, 95 thunderstorm, etc.) — needs a lookup table mapping code → label + icon.
- `ai_summary` **can be `null`** — the AI summary block must be conditionally hidden, not assumed present (current code already does this correctly).
- `current.time` is local time, no timezone offset included — display as-is, don't attempt timezone math.
- No `feels_like`, `humidity`, or `condition` string fields exist — remove those from the UI/`pick()` calls; they don't exist in the real payload.
- `hourly` covers the full `days` range (72 entries for `days=3`), not just today.

---

## Current Changes (landed 2026-07-14)

All three items below are implemented and verified end-to-end (typecheck + production build clean; APIs return live data). Retained here as the record of what was built; fold into Existing Spec on next edit.

### 1. Country → City cascading select
Replace free-text lat/lon entry with a location picker sourced from a bundled dataset.

**Data file:** `data/Lat_and_Lon.json`, array of:
```json
{ "latitude": 42.58765, "longitude": 1.7418, "city": "Roc Meler", "country": "Andorra" }
```
- This file can be large (potentially every country/city in the dataset) — **do not ship it whole to the client.** Keep it server-side and expose two small API routes:
  - `GET /api/locations/countries` → sorted, de-duplicated list of country names.
  - `GET /api/locations/cities?country=<name>` → cities (with lat/lon) for that country, sorted by city name.
- Parse the JSON once at module load (e.g. in a `lib/locations.ts` helper) and cache the country→cities grouping in memory rather than re-scanning per request.
- UI: a "Country" `<select>` populated from `/api/locations/countries` on mount. Selecting a country populates a "City" `<select>` from `/api/locations/cities?country=...`, disabled/empty until a country is chosen. Selecting a city sets `lat`/`lon` and triggers `fetchWeather`.
- Keep the existing "use my location" geolocation flow as an alternative to the dropdowns (e.g. a "Use current location" button that overrides the selects) — don't remove it, since it's a reasonable UX default on load.
- Some entries in the dataset are geographic features rather than towns (e.g. "Pic de les Abelletes" is a peak, not a settlement) — that's expected, don't try to filter these; just list what's in the file as "city" values verbatim.

### 2. "Professional dashboard" redesign of the results view
Rebuild the results section using the confirmed schema above, keeping the existing instrument-panel design language (tokens, fonts, dark panel) rather than switching to a generic SaaS-dashboard look.

Target sections:
- **Current conditions** — temperature (`current.temperature`), condition label/icon from `weathercode` lookup, wind speed + direction (`current.windspeed`, `current.winddirection` — render direction as compass label, e.g. convert degrees to N/NE/E/etc., or a small rotated arrow glyph), day/night state from `is_day`.
- **3-day forecast strip** — one card per `daily[]` entry: date, high/low (`temp_max`/`temp_min`), precipitation, weathercode icon.
- **Hourly trend** — a simple inline SVG line/area chart of `hourly[].temp` for the selected day(s); no charting library needed, hand-rolled path is fine and keeps bundle size down (consistent with the "no UI library" constraint above). Highlight the current hour.
- **AI summary** — keep existing conditional block; when `ai_summary` is `null`, hide the block entirely (already implemented correctly, carry it over).
- Remove the "View raw response" toggle from the polished dashboard view, or move it behind a small "debug" affordance (e.g. a discreet `</>` icon) — it was useful while the schema was unconfirmed but shouldn't be the primary interaction now that fields are known.

### 3. Weathercode lookup table
Add a small `lib/weathercode.ts` (or similar) mapping WMO codes to `{ label, icon }`. Cover at minimum: 0, 1, 2, 3, 45, 48, 51, 53, 55, 61, 63, 65, 71, 73, 75, 80, 81, 82, 95. Fall back to a generic "Unknown" label + icon for unmapped codes rather than throwing.

### Out of scope for this pass
- No authentication/user accounts.
- No persistence of past readings (no DB) — every load is a fresh API call.
- No support for the SMS/USSD or Trees/Forestry endpoints — this app only uses `/v1/weather` and `/v1/weather-geo`.