# Weather Report — WeatherAI

A single-page Next.js app that reads live conditions from the [WeatherAI](https://weather-ai.co) API and displays them as a small instrument panel: current temperature dial, wind, a 6-day forecast strip, an hourly temperature trend chart, and the API's AI-generated summary.

## What it does (one page, no routing)

1. **On load**, it asks the browser for your location. If that's denied or unavailable, it falls back to the API's own IP-based geo-detection (`/v1/weather-geo?ip=auto`).
2. **Country → City picker** — choose a country and then a city from a bundled location dataset (served via small API routes; the dataset itself never ships to the client). Selecting a city fetches weather for its coordinates.
3. **"Use current location"** button re-runs browser geolocation at any time, overriding the selects.
4. **°C / °F toggle** — switching units re-fetches the current reading.
5. Results are rendered as a dashboard:
   - **Current conditions** — a dial with temperature, condition icon + label (from the WMO weathercode), plus readout cards for place, wind (speed, compass direction, rotated arrow), day/night state, and local time.
   - **6-day forecast strip** — one card per day: date, weathercode icon, high/low, precipitation.
   - **Hourly trend** — a hand-rolled inline SVG area chart of today's hourly temperatures, with the current hour highlighted.
   - **AI summary** — the API's AI-generated text, quoted below the panels; hidden entirely when the API returns `null`.

All WeatherAI calls happen server-side, through `app/api/weather/route.ts`. The API key never reaches the browser.

## Requirements

- Node.js 18+
- A WeatherAI API key ([weather-ai.co](https://weather-ai.co) → Dashboard → API Keys)

## Setup

```bash
npm install
cp .env.local.example .env.local
# edit .env.local and paste your key:
# WEATHER_AI_API_KEY=wai_your_key_here

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
app/
  layout.tsx          — root layout: Google Fonts + styled-jsx SSR registry
  registry.tsx        — styled-jsx style registry (prevents flash of unstyled content)
  globals.css         — design tokens (CSS custom properties) + base resets
  page.tsx            — the entire UI (client component): pickers + dashboard + chart
  api/weather/route.ts             — server-side proxy to WeatherAI; injects the API key
  api/locations/countries/route.ts — sorted, de-duped country list
  api/locations/cities/route.ts    — cities (with lat/lon) for a given ?country=
lib/
  locations.ts        — parses data/Lat_and_Lon.json once, caches country→cities in memory
  weathercode.ts      — WMO code → { label, icon } lookup with an "Unknown" fallback
data/
  Lat_and_Lon.json    — bundled location dataset (server-side only, NOT under public/)
```

## Notes on the API integration

- `GET /api/weather?lat=&lon=&units=` proxies to `/v1/weather`; when `lat`/`lon` are missing it calls `/v1/weather-geo?ip=auto` instead. Both are requested with `ai=true` and `days=6` (the 6-day forecast strip).
- `/v1/weather-geo` returns location as response **headers** (`X-City`, `X-Region`, `X-Country`) rather than in the JSON body, so the API route reads those headers and folds them into the JSON it returns to the client as `geo`.
- `weathercode` follows the WMO / Open-Meteo convention (0 clear, 2 partly cloudy, 61 rain, 95 thunderstorm, …); `lib/weathercode.ts` maps codes to a label + icon.
- `ai_summary` can be `null` — the summary block is conditionally hidden rather than assumed present.
- `?ai=true` uses part of your monthly AI-request quota (see the plan limits table in the docs).

## Notes on the location dataset

- `data/Lat_and_Lon.json` is large, so it stays server-side and is exposed only through the two small `/api/locations/*` routes. It's parsed lazily once and cached in memory.
- The file has some quirks that are sanitized at load time (bare `NaN`/`Infinity` tokens, a trailing comma from a truncated dump); entries with non-finite coordinates are skipped.
- Some entries are geographic features rather than towns (peaks, etc.) — they're listed verbatim as given.

## Deploying (Vercel)

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Add an environment variable: `WEATHER_AI_API_KEY` = your key.
4. Deploy. No other config needed — a default Next.js app requires no `vercel.json`.

## Stack

Next.js 14 (App Router) · TypeScript · React 18 · no UI library — plain CSS via styled-jsx, no charting library (hand-rolled SVG), no state management library.
