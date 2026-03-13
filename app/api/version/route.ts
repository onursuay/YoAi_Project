import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    patchVersion: "yoai-version-v1",
    ts: new Date().toISOString(),
  });
}
