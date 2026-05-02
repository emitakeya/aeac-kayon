/**
 * /api/email/send-invoice
 * ──────────────────────────────────────────────────────────────────────────
 * Replaces the WordPress AJAX endpoint `aeac_send_invoice_email`.
 *
 * Forwards a JSON payload to the AEAC Google Apps Script email relay.
 * The GAS endpoint dispatches based on the `endpoint` field in the body
 * ("invoice", "report", "invoice_link", "cancel", etc.) — so this single
 * Next.js route covers all email types. The WP version was named
 * `aeac_send_invoice_email` but in practice it's a generic GAS proxy;
 * we keep the same generic behaviour here.
 *
 * Required env var (Vercel project settings):
 *   GAS_EXEC_URL — the Google Apps Script web-app deployment URL
 *
 * Falls back to the canonical AEAC GAS URL if GAS_EXEC_URL is unset
 * (so the route works even before env var setup, but logs a warning).
 *
 * Request: any JSON body — forwarded verbatim to GAS.
 * Response (200): { ok: true, gas_response: <whatever GAS returned> }
 * Errors: 400 / 502 with { ok: false, error: string }
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Canonical fallback — same URL stored in project memory.
// In production the env var should be set, but this prevents broken state
// during initial deploys.
const GAS_FALLBACK_URL =
  "https://script.google.com/macros/s/AKfycbw_F2761A5aCtbFBN2VzlQC4SIXiyAmbq9ohOPSuM0HadN0y7A93yEkhcgk-PaByMhyew/exec";

export async function POST(request: Request) {
  // Read raw body — forward verbatim to GAS.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Gagal membaca body request" },
      { status: 400 }
    );
  }

  if (!rawBody) {
    return NextResponse.json(
      { ok: false, error: "Body kosong" },
      { status: 400 }
    );
  }

  // Validate it's JSON (we don't transform it, but we want to fail fast
  // if the caller sent garbage — easier to debug than a GAS-side error).
  try {
    JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body harus JSON yang valid" },
      { status: 400 }
    );
  }

  const gasUrl = process.env.GAS_EXEC_URL || GAS_FALLBACK_URL;
  if (!process.env.GAS_EXEC_URL) {
    console.warn(
      "[email/send-invoice] GAS_EXEC_URL env var not set — using fallback. " +
        "Set this in Vercel project settings."
    );
  }

  let gasRes: Response;
  try {
    gasRes = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rawBody,
      cache: "no-store",
      // GAS sometimes takes 10–20 s; Next.js default timeout is fine.
      // Vercel function timeout is the actual ceiling (10 s on Hobby, 60 s on Pro).
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    console.error("[email/send-invoice] GAS fetch failed:", msg);
    return NextResponse.json(
      { ok: false, error: "Gagal terhubung ke server email." },
      { status: 502 }
    );
  }

  // GAS usually returns JSON, but if it fails it can return HTML.
  // Read as text first, then try JSON.parse.
  const gasText = await gasRes.text();
  let gasParsed: unknown;
  try {
    gasParsed = JSON.parse(gasText);
  } catch {
    // GAS returned non-JSON — likely an error page or auth issue
    console.error(
      "[email/send-invoice] GAS returned non-JSON:",
      gasRes.status,
      gasText.slice(0, 500)
    );
    return NextResponse.json(
      {
        ok: false,
        error: "Server email memberikan respons yang tidak valid.",
        gas_status: gasRes.status,
      },
      { status: 502 }
    );
  }

  if (!gasRes.ok) {
    return NextResponse.json(
      { ok: false, error: "Server email memberikan error.", gas_response: gasParsed },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, gas_response: gasParsed });
}
