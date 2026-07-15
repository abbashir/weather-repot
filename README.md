# Weather Report — a WeatherAI AI

A single-page Next.js app that reads live conditions from the [WeatherAI](https://weather-ai.co) API and displays them as a small instrument panel: current temperature, condition, humidity, wind, and the API's AI-generated summary.

## What it does (one page, no routing)

1. On load, it asks the browser for your location. If that's denied, it falls back to the API's own IP-based geo-detection (`/v1/weather-geo?ip=auto`).
2. You can also type a latitude/longitude manually and take a new reading.
3. Toggle °C / °F.
4. Results are rendered on a dial (temp + condition), four readout cards (place, feels-like, humidity, wind), and the API's AI summary quoted below.
5. A "View raw response" toggle shows the exact JSON returned by the API — useful for verifying the integration during review.

All API calls happen server-side, through `app/api/weather/route.ts`. The API key never reaches the browser.

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

## Deploying (Vercel)

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Add an environment variable: `WEATHER_AI_API_KEY` = your key.
4. Deploy. No other config needed — `vercel.json` isn't required for a default Next.js app.

## Notes on the API integration

- The public docs at `weather-ai.co/docs` don't publish an exact response schema for `/v1/weather`, so the client reads fields defensively across a few plausible key names (`current.temp` / `temp` / `temperature`, etc.) rather than assuming one exact shape. If your key's actual response uses different field names, they're easy to adjust in the `pick(...)` calls near the top of `app/page.tsx` — and the raw-response toggle makes it quick to see what's actually coming back.
- `/v1/weather-geo` returns location as response **headers** (`X-City`, `X-Region`, `X-Country`) rather than in the JSON body, so the API route reads those headers and folds them into the JSON it returns to the client.
- `?ai=true` is passed by default to include the Gemini-generated summary; this uses part of your monthly AI-request quota (see the plan limits table in the docs).

## Stack

Next.js 14 (App Router) · TypeScript · no UI library — plain CSS via styled-jsx, kept to one file for a one-page brief.
