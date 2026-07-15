import { NextResponse } from "next/server";
import { getCountries } from "@/lib/locations";

// Reads a large local file via fs, so it must run on the Node.js runtime and
// must not be statically prerendered at build time.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ countries: getCountries() });
}
