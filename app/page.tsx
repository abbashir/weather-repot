"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { weatherInfo } from "@/lib/weathercode";

// Confirmed /v1/weather response shape (see CLAUDE.md).
interface Current {
  time: string;
  interval: number;
  temperature: number;
  windspeed: number;
  winddirection: number;
  is_day: number;
  weathercode: number;
}
interface Daily {
  date: string;
  temp_max: number;
  temp_min: number;
  precipitation: number;
  weathercode: number;
}
interface Hourly {
  time: string;
  temp: number;
  precipitation: number;
  weathercode: number;
}
interface Geo {
  city: string | null;
  region: string | null;
  country: string | null;
}
interface WeatherData {
  lat: number;
  lon: number;
  units: string;
  days: number;
  current: Current;
  daily: Daily[];
  hourly: Hourly[];
  ai_summary: string | null;
  geo?: Geo;
}

interface City {
  city: string;
  latitude: number;
  longitude: number;
}

const COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

function compass(deg: number): string {
  return COMPASS[Math.round(deg / 22.5) % 16];
}

function formatDay(dateStr: string): string {
  // dateStr is a local YYYY-MM-DD; render weekday + day without timezone math.
  const d = new Date(`${dateStr}T00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatHour(timeStr: string): string {
  // "2026-07-14T14:00" -> "14:00"
  return timeStr.slice(11, 16);
}

export default function Page() {
  const [countries, setCountries] = useState<string[]>([]);
  const [country, setCountry] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState("");

  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");

  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const fetchWeather = useCallback(
    async (coords?: { lat: string; lon: string }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ units });
        if (coords?.lat && coords?.lon) {
          params.set("lat", coords.lat);
          params.set("lon", coords.lon);
        }
        const res = await fetch(`/api/weather?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Request failed");
        setData(json as WeatherData);
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [units]
  );

  // Load the country list once on mount.
  useEffect(() => {
    fetch("/api/locations/countries")
      .then((r) => r.json())
      .then((j) => setCountries(j.countries ?? []))
      .catch(() => setError("Could not load country list."));
  }, []);

  // On first load: try the browser's geolocation, and fall back to the API's
  // own IP-based detection if it's denied or unavailable.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator.geolocation) {
      fetchWeather();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latStr = pos.coords.latitude.toFixed(4);
        const lonStr = pos.coords.longitude.toFixed(4);
        setLat(latStr);
        setLon(lonStr);
        fetchWeather({ lat: latStr, lon: lonStr });
      },
      () => fetchWeather(),
      { timeout: 6000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCountryChange = (value: string) => {
    setCountry(value);
    setSelectedCity("");
    setCities([]);
    if (!value) return;
    setCitiesLoading(true);
    fetch(`/api/locations/cities?country=${encodeURIComponent(value)}`)
      .then((r) => r.json())
      .then((j) => setCities(j.cities ?? []))
      .catch(() => setError("Could not load city list."))
      .finally(() => setCitiesLoading(false));
  };

  const handleCityChange = (value: string) => {
    setSelectedCity(value);
    const city = cities.find((c) => c.city === value);
    if (!city) return;
    const latStr = String(city.latitude);
    const lonStr = String(city.longitude);
    setLat(latStr);
    setLon(lonStr);
    fetchWeather({ lat: latStr, lon: lonStr });
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      fetchWeather();
      return;
    }
    // Overriding the selects: clear them so the UI reflects the geo source.
    setCountry("");
    setSelectedCity("");
    setCities([]);
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latStr = pos.coords.latitude.toFixed(4);
        const lonStr = pos.coords.longitude.toFixed(4);
        setLat(latStr);
        setLon(lonStr);
        fetchWeather({ lat: latStr, lon: lonStr });
      },
      () => fetchWeather(),
      { timeout: 6000 }
    );
  };

  // Re-fetch when the unit toggle changes, if we already have a reading.
  const changeUnits = (next: "metric" | "imperial") => {
    if (next === units) return;
    setUnits(next);
  };
  useEffect(() => {
    if (!data) return;
    fetchWeather(lat && lon ? { lat, lon } : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units]);

  const unitLabel = units === "metric" ? "°C" : "°F";
  const windUnit = units === "metric" ? "km/h" : "mph";
  const precipUnit = units === "metric" ? "mm" : "in";

  const current = data?.current;
  const currentInfo = current ? weatherInfo(current.weathercode) : null;
  const place = data?.geo
    ? [data.geo.city, data.geo.region, data.geo.country].filter(Boolean).join(", ")
    : selectedCity && country
    ? `${selectedCity}, ${country}`
    : data
    ? `${data.lat.toFixed(2)}, ${data.lon.toFixed(2)}`
    : "";

  // Hourly points for the current day, for the trend chart.
  const currentDay = current?.time.slice(0, 10);
  const dayHours = useMemo(() => {
    if (!data) return [];
    const scoped = data.hourly.filter((h) => h.time.slice(0, 10) === currentDay);
    return scoped.length ? scoped : data.hourly.slice(0, 24);
  }, [data, currentDay]);

  const currentHourIndex = useMemo(() => {
    if (!current) return -1;
    const hourKey = current.time.slice(0, 13); // yyyy-mm-ddThh
    return dayHours.findIndex((h) => h.time.slice(0, 13) === hourKey);
  }, [dayHours, current]);

  return (
    <main className="wrap">
      <header className="eyebrow-row">
        <span className="eyebrow">Weather REPORT</span>
      </header>

      <form className="picker" onSubmit={(e) => e.preventDefault()}>
        <div className="picker-row">
        <label className="field">
          COUNTRY
          <select value={country} onChange={(e) => handleCountryChange(e.target.value)}>
            <option value="">Select country…</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          CITY
          <select
            value={selectedCity}
            onChange={(e) => handleCityChange(e.target.value)}
            disabled={!country || citiesLoading}
          >
            <option value="">
              {!country
                ? "Choose a country first"
                : citiesLoading
                ? "Loading…"
                : "Select city…"}
            </option>
            {cities.map((c) => (
              <option key={`${c.city}-${c.latitude}-${c.longitude}`} value={c.city}>
                {c.city}
              </option>
            ))}
          </select>
        </label>
        </div>

        <div className="picker-row">
        <div className="unit-toggle" role="group" aria-label="Units">
          <button
            type="button"
            className={units === "metric" ? "active" : ""}
            onClick={() => changeUnits("metric")}
          >
            °C
          </button>
          <button
            type="button"
            className={units === "imperial" ? "active" : ""}
            onClick={() => changeUnits("imperial")}
          >
            °F
          </button>
        </div>

        <button type="button" className="go" onClick={handleUseLocation}>
          {loading ? "Reading…" : "Use current location"}
        </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      {data && current && currentInfo && !error && (
        <section className="dashboard">
          {/* Current conditions */}
          <div className="panel current">
            <div className="dial">
              <div className="dial-ring">
                <span className="dial-icon">{currentInfo.icon}</span>
                <span className="dial-temp">
                  {Math.round(current.temperature)}
                  <span className="dial-unit">{unitLabel}</span>
                </span>
                <span className="dial-condition">{currentInfo.label}</span>
              </div>
            </div>

            <div className="readouts">
              <div className="readout">
                <span className="fog">PLACE</span>
                <span>{place || "Unknown"}</span>
              </div>
              <div className="readout">
                <span className="fog">WIND</span>
                <span>
                  <span
                    className="arrow"
                    style={{ transform: `rotate(${current.winddirection}deg)` }}
                    aria-hidden
                  >
                    ↑
                  </span>
                  {Math.round(current.windspeed)} {windUnit} {compass(current.winddirection)}
                </span>
              </div>
              <div className="readout">
                <span className="fog">STATE</span>
                <span>{current.is_day ? "☀ Daytime" : "☾ Night"}</span>
              </div>
              <div className="readout">
                <span className="fog">LOCAL TIME</span>
                <span>{formatHour(current.time)}</span>
              </div>
            </div>
          </div>

          {/* 3-day forecast strip */}
          <div className="forecast">
            {data.daily.map((d) => {
              const info = weatherInfo(d.weathercode);
              return (
                <div key={d.date} className="day-card">
                  <span className="day-date">{formatDay(d.date)}</span>
                  <span className="day-icon">{info.icon}</span>
                  <span className="day-temps">
                    <span className="hi">{Math.round(d.temp_max)}°</span>
                    <span className="lo fog">{Math.round(d.temp_min)}°</span>
                  </span>
                  <span className="day-precip fog">
                    {d.precipitation} {precipUnit}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Hourly trend */}
          {dayHours.length > 1 && (
            <div className="panel trend">
              <span className="section-label fog">HOURLY TREND · {currentDay}</span>
              <HourlyChart hours={dayHours} highlight={currentHourIndex} unit={unitLabel} />
            </div>
          )}

          {/* AI summary — hidden entirely when null */}
          {data.ai_summary && (
            <blockquote className="ai-summary">
              <span className="fog">AI SUMMARY</span>
              <p>{data.ai_summary}</p>
            </blockquote>
          )}

          {/* Discreet debug affordance replacing the old raw toggle */}
          <div className="debug-row">
            {/* <button
              className="debug-toggle"
              onClick={() => setShowRaw((v) => !v)}
              title="View raw API response"
              aria-label="View raw API response"
            >
              {"</>"}
            </button> */}
          </div>
          {showRaw && <pre className="raw">{JSON.stringify(data, null, 2)}</pre>}
        </section>
      )}

      <style jsx>{`
        .wrap {
          max-width: 860px;
          margin: 0 auto;
          padding: 48px 24px 80px;
        }
        .eyebrow-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 32px;
        }
        .eyebrow {
          font-family: var(--mono);
          letter-spacing: 0.14em;
          font-size: 13px;
          font-weight: 700;
        }
        .fog {
          color: var(--fog);
        }
        .picker {
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: var(--panel);
          border: 1px solid var(--hairline);
          border-radius: 14px;
          padding: 18px;
        }
        .picker-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: end;
        }
        .field {
          display: flex;
          flex-direction: column;
          font-family: var(--mono);
          font-size: 11px;
          letter-spacing: 0.1em;
          color: var(--fog);
          gap: 6px;
          flex: 1 1 200px;
        }
        .field select {
          background: var(--ink);
          border: 1px solid var(--hairline);
          border-radius: 8px;
          padding: 10px 12px;
          color: var(--paper);
          font-family: var(--mono);
          font-size: 14px;
          cursor: pointer;
        }
        .field select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .field select:focus-visible,
        .picker button:focus-visible {
          outline: 2px solid var(--amber);
          outline-offset: 2px;
        }
        .unit-toggle {
          display: flex;
          border: 1px solid var(--hairline);
          border-radius: 8px;
          overflow: hidden;
          height: 40px;
        }
        .unit-toggle button {
          background: var(--ink);
          color: var(--fog);
          border: none;
          padding: 10px 14px;
          font-family: var(--mono);
          cursor: pointer;
        }
        .unit-toggle button.active {
          background: var(--amber);
          color: var(--ink);
          font-weight: 700;
        }
        .go {
          background: var(--mint);
          color: var(--ink);
          border: none;
          border-radius: 8px;
          padding: 11px 20px;
          font-weight: 700;
          font-family: var(--sans);
          cursor: pointer;
          height: 40px;
        }
        .go:hover {
          filter: brightness(1.05);
        }
        .error {
          color: var(--danger);
          font-family: var(--mono);
          margin-top: 16px;
        }
        .dashboard {
          margin-top: 28px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .panel {
          background: var(--panel);
          border: 1px solid var(--hairline);
          border-radius: 18px;
          padding: 32px;
        }
        .current {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 28px;
          align-items: center;
        }
        .dial {
          display: flex;
          justify-content: center;
        }
        .dial-ring {
          width: 200px;
          height: 200px;
          border-radius: 50%;
          border: 2px solid var(--amber);
          box-shadow: inset 0 0 0 6px var(--panel-raised);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
        }
        .dial-icon {
          font-size: 28px;
          line-height: 1;
        }
        .dial-temp {
          font-family: var(--mono);
          font-size: 52px;
          font-weight: 700;
          color: var(--amber);
          line-height: 1;
        }
        .dial-unit {
          font-size: 20px;
          margin-left: 2px;
        }
        .dial-condition {
          font-size: 12px;
          color: var(--fog);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          text-align: center;
        }
        .readouts {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }
        .readout {
          display: flex;
          flex-direction: column;
          gap: 6px;
          background: var(--panel-raised);
          border-radius: 10px;
          padding: 14px 16px;
          font-family: var(--mono);
          font-size: 14px;
        }
        .readout .fog {
          font-size: 10px;
          letter-spacing: 0.1em;
        }
        .arrow {
          display: inline-block;
          color: var(--amber);
          margin-right: 6px;
        }
        .forecast {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 14px;
        }
        .day-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          background: var(--panel);
          border: 1px solid var(--hairline);
          border-radius: 14px;
          padding: 18px 12px;
          font-family: var(--mono);
        }
        .day-date {
          font-size: 12px;
          letter-spacing: 0.06em;
          color: var(--fog);
        }
        .day-icon {
          font-size: 26px;
          line-height: 1;
        }
        .day-temps {
          display: flex;
          gap: 8px;
          font-size: 16px;
        }
        .day-temps .hi {
          color: var(--amber);
          font-weight: 700;
        }
        .day-precip {
          font-size: 11px;
        }
        .trend {
          padding: 24px 28px;
        }
        .section-label {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.12em;
          display: block;
          margin-bottom: 12px;
        }
        .ai-summary {
          margin: 0;
          padding: 16px 18px;
          border-left: 3px solid var(--mint);
          background: var(--panel-raised);
          border-radius: 0 10px 10px 0;
        }
        .ai-summary .fog {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.1em;
        }
        .ai-summary p {
          margin: 8px 0 0;
          line-height: 1.5;
        }
        .debug-row {
          display: flex;
          justify-content: flex-end;
        }
        .debug-toggle {
          background: none;
          border: 1px solid var(--hairline);
          color: var(--fog);
          font-family: var(--mono);
          font-size: 12px;
          border-radius: 8px;
          padding: 6px 10px;
          cursor: pointer;
        }
        .debug-toggle:hover {
          color: var(--paper);
          border-color: var(--fog);
        }
        .raw {
          margin: 0;
          background: var(--ink);
          border: 1px solid var(--hairline);
          border-radius: 10px;
          padding: 16px;
          font-size: 12px;
          overflow-x: auto;
          max-height: 320px;
        }
        @media (max-width: 620px) {
          .current {
            grid-template-columns: 1fr;
          }
          .dial {
            margin-bottom: 8px;
          }
        }
      `}</style>
    </main>
  );
}

// Hand-rolled inline SVG area chart of the day's hourly temperatures.
function HourlyChart({
  hours,
  highlight,
  unit,
}: {
  hours: Hourly[];
  highlight: number;
  unit: string;
}) {
  const W = 780;
  const H = 160;
  const padX = 8;
  const padY = 24;

  const temps = hours.map((h) => h.temp);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const span = max - min || 1;

  const x = (i: number) =>
    padX + (i * (W - padX * 2)) / (hours.length - 1);
  const y = (t: number) =>
    padY + (1 - (t - min) / span) * (H - padY * 2);

  const linePath = hours
    .map((h, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(h.temp).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${x(hours.length - 1).toFixed(1)},${H - padY} L${x(0).toFixed(
    1
  )},${H - padY} Z`;

  const hl = highlight >= 0 ? highlight : -1;

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Hourly temperature trend"
    >
      <defs>
        <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--amber)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--amber)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={areaPath} fill="url(#tempFill)" />
      <path d={linePath} fill="none" stroke="var(--amber)" strokeWidth="2" />

      {hl >= 0 && (
        <>
          <line
            x1={x(hl)}
            y1={padY - 6}
            x2={x(hl)}
            y2={H - padY}
            stroke="var(--mint)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <circle cx={x(hl)} cy={y(hours[hl].temp)} r="4" fill="var(--mint)" />
          <text
            x={x(hl)}
            y={y(hours[hl].temp) - 10}
            fill="var(--mint)"
            fontSize="12"
            fontFamily="var(--mono)"
            textAnchor="middle"
          >
            {Math.round(hours[hl].temp)}
            {unit}
          </text>
        </>
      )}

      {/* Sparse hour labels along the bottom */}
      {hours.map((h, i) =>
        i % 4 === 0 ? (
          <text
            key={h.time}
            x={x(i)}
            y={H - 6}
            fill="var(--fog)"
            fontSize="10"
            fontFamily="var(--mono)"
            textAnchor="middle"
          >
            {formatHour(h.time)}
          </text>
        ) : null
      )}

      <style jsx>{`
        .chart {
          width: 100%;
          height: 160px;
          display: block;
        }
      `}</style>
    </svg>
  );
}
