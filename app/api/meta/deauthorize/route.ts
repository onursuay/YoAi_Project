import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyMetaSignedRequest } from "@/lib/metaSignedRequest";

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

    // Validate signed_request if present
    let validated = false;
    let validationReason: string | undefined = undefined;

    if (!signedRequest) {
      validationReason = "missing_signed_request";
    } else {
      const appSecret = process.env.META_APP_SECRET;
      if (!appSecret) {
        validationReason = "invalid_signed_request";
      } else {
        const verification = verifyMetaSignedRequest(signedRequest, appSecret);
        if (verification.ok) {
          validated = true;
        } else {
          validationReason =
            verification.error === "unsupported_algorithm"
              ? "unsupported_algorithm"
              : "invalid_signed_request";
        }
      }
    }

    // Clear all Meta-related cookies (regardless of signed_request validation)
    const cookieStore = await cookies();
    const response = NextResponse.json(
      {
        success: true,
        validated,
        ...(validationReason ? { reason: validationReason } : {}),
      },
      { status: 200 }
    );

    // Clear Meta cookies
    const metaCookies = [
      "meta_access_token",
      "meta_access_expires_at",
      "meta_oauth_state",
      "selected_meta_ad_account",
      "meta_selected_ad_account_id",
      "meta_selected_ad_account_name",
    ];

    metaCookies.forEach((cookieName) => {
      response.cookies.set(cookieName, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    });

    return response;
  } catch (error) {
    // Always return success even on error (Meta expects 200)
    const cookieStore = await cookies();
    const response = NextResponse.json(
      {
        success: true,
        validated: false,
        reason: "error",
      },
      { status: 200 }
    );

    // Clear cookies even on error
    const metaCookies = [
      "meta_access_token",
      "meta_access_expires_at",
      "meta_oauth_state",
      "selected_meta_ad_account",
      "meta_selected_ad_account_id",
      "meta_selected_ad_account_name",
    ];

    metaCookies.forEach((cookieName) => {
      response.cookies.set(cookieName, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    });

    return response;
  }
}
