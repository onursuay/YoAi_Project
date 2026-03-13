import { NextResponse } from "next/server";

export async function GET() {
  // In production, do not leak environment variable presence
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({
      ok: true,
    });
  }

  // In development, allow env details for debugging
  return NextResponse.json({
    ok: true,
    now: new Date().toISOString(),
    env: {
      META_APP_ID: !!process.env.META_APP_ID,
      META_APP_SECRET: !!process.env.META_APP_SECRET,
      META_REDIRECT_URI: !!process.env.META_REDIRECT_URI,
      NEXT_PUBLIC_BASE_URL: !!process.env.NEXT_PUBLIC_BASE_URL,
    },
  });
}

