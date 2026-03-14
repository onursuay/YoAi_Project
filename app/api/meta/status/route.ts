import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { metaGraphFetch } from "@/lib/metaGraph";

export const dynamic = 'force-dynamic'

const DEBUG = process.env.NODE_ENV !== 'production'

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("meta_access_token");

  if (!accessToken || !accessToken.value) {
    return NextResponse.json({ connected: false });
  }

  // Check token expiration if available
  const expiresAtCookie = cookieStore.get("meta_access_expires_at");
  if (expiresAtCookie) {
    const expiresAt = parseInt(expiresAtCookie.value, 10);
    if (Date.now() >= expiresAt) {
      return NextResponse.json({ connected: false });
    }
  }

  // Get selected ad account if available
  const selectedAdAccountId = cookieStore.get("meta_selected_ad_account_id");
  const selectedAdAccountName = cookieStore.get(
    "meta_selected_ad_account_name",
  );

  return NextResponse.json({
    connected: true,
    adAccountId: selectedAdAccountId?.value || null,
    adAccountName: selectedAdAccountName?.value || null,
  }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { objectId, status } = body;

    if (!objectId || typeof objectId !== "string") {
      return NextResponse.json(
        { error: "objectId is required" },
        { status: 400 },
      );
    }

    if (!status || (status !== "ACTIVE" && status !== "PAUSED")) {
      return NextResponse.json(
        { error: "status must be ACTIVE or PAUSED" },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("meta_access_token");

    if (!accessToken || !accessToken.value) {
      return NextResponse.json({ error: "missing_token" }, { status: 401 });
    }

    // Check token expiration if available
    const expiresAtCookie = cookieStore.get("meta_access_expires_at");
    if (expiresAtCookie) {
      const expiresAt = parseInt(expiresAtCookie.value, 10);
      if (Date.now() >= expiresAt) {
        return NextResponse.json({ error: "token_expired" }, { status: 401 });
      }
    }

    // Update status via Meta Graph API
    const formData = new URLSearchParams();
    formData.append("status", status);

    const response = await metaGraphFetch(`/${objectId}`, accessToken.value, {
      method: "POST",
      body: formData.toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: "meta_api_error",
          details: errorData.error || { message: `HTTP ${response.status}` },
        },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json({
      ok: true,
      id: objectId,
      status,
    });
  } catch (error) {
    if (DEBUG) console.error("Status update error:", error);
    return NextResponse.json(
      {
        error: "meta_api_error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
