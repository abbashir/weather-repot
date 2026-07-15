import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://api.weather-ai.co";

export async function GET(req: NextRequest) {
  const apiKey = process.env.WEATHER_AI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing WEATHER_AI_API_KEY. Add it to .env.local." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const units = searchParams.get("units") ?? "metric";

  // If no coordinates were supplied, fall back to IP-based geo-detection.
  const usingGeoDetect = !lat || !lon;
  const path = usingGeoDetect ? "/v1/weather-geo" : "/v1/weather";
  const upstreamParams = new URLSearchParams({ units, ai: "true" });

  if (usingGeoDetect) {
    upstreamParams.set("ip", "auto");
  } else {
    upstreamParams.set("lat", lat);
    upstreamParams.set("lon", lon);
  }

  try {
    const upstream = await fetch(`${BASE_URL}${path}?${upstreamParams.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      // Weather data goes stale fast; don't let Next cache it.
      cache: "no-store",
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(
        { error: data?.message ?? "WeatherAI request failed", status: upstream.status },
        { status: upstream.status }
      );
    }

    // /v1/weather-geo returns location in response headers rather than the body.
    if (usingGeoDetect) {
      data.geo = {
        city: upstream.headers.get("x-city"),
        region: upstream.headers.get("x-region"),
        country: upstream.headers.get("x-country"),
      };
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Could not reach WeatherAI upstream API." },
      { status: 502 }
    );
  }
}
