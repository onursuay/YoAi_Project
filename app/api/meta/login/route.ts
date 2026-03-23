import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { META_OAUTH_BASE_URL, META_SCOPES } from "@/lib/metaConfig";

export async function GET(request: Request) {
  const appId = process.env.META_APP_ID;

  if (!appId) {
    return NextResponse.json(
      { error: "META_APP_ID or META_REDIRECT_URI is not configured" },
      { status: 500 }
    );
  }

  // Get redirect URI from env (required for prod/video)
  // Fallback to origin-based for local dev if env not set
  const envRedirect = process.env.META_REDIRECT_URI;
  const origin = new URL(request.url).origin;
  const redirectUri = envRedirect || `${origin}/api/meta/callback`;

  // Generate state for CSRF protection
  const state = randomUUID();

  // Build Meta OAuth authorize URL
  const authorizeUrl = new URL(`${META_OAUTH_BASE_URL}/dialog/oauth`);
  authorizeUrl.searchParams.set("client_id", appId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", META_SCOPES);
  authorizeUrl.searchParams.set("state", state);

  // Store state in httpOnly cookie
  const cookieStore = await cookies();
  const response = NextResponse.redirect(authorizeUrl.toString());

  response.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });

  // Ensure session_id exists before OAuth redirect so callback can persist to DB
  if (!cookieStore.get('session_id')?.value) {
    response.cookies.set('session_id', randomUUID(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });
  }

  return response;
}
