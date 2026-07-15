import { NextRequest, NextResponse } from "next/server";
import { getCities } from "@/lib/locations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const country = new URL(req.url).searchParams.get("country");
  if (!country) {
    return NextResponse.json({ error: "Missing country parameter." }, { status: 400 });
  }
  return NextResponse.json({ cities: getCities(country) });
}
