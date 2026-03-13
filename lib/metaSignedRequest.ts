/**
 * Meta signed_request verification utility
 * Verifies HMAC-SHA256 signatures from Meta callbacks
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Convert base64url string to Buffer
 * Base64url uses - and _ instead of + and /
 */
function base64UrlToBuffer(input: string): Buffer {
  // Replace base64url characters with standard base64
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  
  // Add padding if needed
  const padding = base64.length % 4;
  const padded = padding ? base64 + "=".repeat(4 - padding) : base64;
  
  return Buffer.from(padded, "base64");
}

/**
 * Constant-time comparison of two buffers
 * Returns true only if buffers are equal length and identical
 */
function safeTimingEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Verify Meta signed_request
 * Format: "<signature>.<payload>" (both base64url encoded)
 * 
 * @param signedRequest - The signed_request string from Meta
 * @param appSecret - META_APP_SECRET
 * @returns Verification result with payload if valid
 */
export function verifyMetaSignedRequest(
  signedRequest: string,
  appSecret: string
): { ok: boolean; payload?: any; error?: string } {
  try {
    if (!signedRequest || !appSecret) {
      return { ok: false, error: "Missing signed_request or app_secret" };
    }

    // Split signature and payload
    const parts = signedRequest.split(".");
    if (parts.length !== 2) {
      return { ok: false, error: "Invalid signed_request format" };
    }

    const [providedSig, payloadPart] = parts;

    if (!providedSig || !payloadPart) {
      return { ok: false, error: "Missing signature or payload" };
    }

    // Decode payload
    let payload: any;
    try {
      const payloadBuffer = base64UrlToBuffer(payloadPart);
      payload = JSON.parse(payloadBuffer.toString("utf-8"));
    } catch (error) {
      return { ok: false, error: "Failed to decode payload" };
    }

    // Check algorithm if present (must be HMAC-SHA256)
    if (payload.algorithm !== undefined) {
      if (payload.algorithm !== "HMAC-SHA256") {
        return { ok: false, error: "unsupported_algorithm" };
      }
    }

    // Compute expected signature
    // IMPORTANT: HMAC input is the raw base64url payload string (second part), not decoded JSON
    const hmac = createHmac("sha256", appSecret);
    hmac.update(payloadPart);
    const expectedSigBuffer = hmac.digest();

    // Decode provided signature (base64url) to binary for comparison
    let providedSigBuffer: Buffer;
    try {
      providedSigBuffer = base64UrlToBuffer(providedSig);
    } catch {
      return { ok: false, error: "Invalid signature format" };
    }

    // Compare signatures in constant-time (compare binary buffers directly)
    if (!safeTimingEqual(providedSigBuffer, expectedSigBuffer)) {
      return { ok: false, error: "Invalid signature" };
    }

    return { ok: true, payload };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}
