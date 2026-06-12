import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { verifyMetaSignedRequest } from "@/lib/metaSignedRequest";
import { supabase } from "@/lib/supabase/client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    let signedRequest: string | null = null;
    const contentType = request.headers.get("content-type") || "";

    // Try to get signed_request from JSON body or form-urlencoded
    if (contentType.includes("application/json")) {
      try {
        const body = await request.json();
        signedRequest = body.signed_request || null;
      } catch {
        // JSON parsing failed, but we'll check formData as fallback
      }
    }

    // If not found in JSON, try form-urlencoded / multipart
    if (!signedRequest) {
      try {
        const formData = await request.formData();
        signedRequest = formData.get("signed_request") as string | null;
      } catch {
        // FormData parsing failed
      }
    }

    // Validate signed_request is present
    if (!signedRequest) {
      return NextResponse.json(
        { error: "missing_signed_request" },
        { status: 200 }
      );
    }

    // Verify signed_request
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      return NextResponse.json(
        { error: "server_configuration_error" },
        { status: 200 }
      );
    }

    const verification = verifyMetaSignedRequest(signedRequest, appSecret);
    if (!verification.ok) {
      const errorCode =
        verification.error === "unsupported_algorithm"
          ? "unsupported_algorithm"
          : "invalid_signed_request";
      return NextResponse.json({ error: errorCode }, { status: 200 });
    }

    // Silme talebini KAYDET (sessizce düşmesin; denetlenebilir olsun). Meta'nın
    // signed_request payload'ı Facebook user_id'sini taşır.
    const fbUserId = (verification.payload?.user_id ?? null) as string | null;
    if (supabase) {
      await supabase
        .from("account_deletion_requests")
        .insert({ fb_user_id: fbUserId, source: "meta_callback", status: "pending", detail: "Meta data deletion callback" })
        .then(undefined, (e: unknown) => console.error("[meta/data-deletion] log failed:", e instanceof Error ? e.message : e));
    }

    // Generate confirmation code
    const confirmationCode = randomUUID();

    // Get origin from request URL
    const origin = new URL(request.url).origin;

    // Return data deletion callback response (always 200)
    return NextResponse.json({
      url: `${origin}/data-deletion?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "internal_server_error" },
      { status: 200 }
    );
  }
}
