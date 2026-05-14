// app/api/email/send-report/route.ts
// Forwards a report-email payload to Google Apps Script.
// Replaces the WordPress aeac_send_report_email PHP relay for Kayon.

import { NextRequest, NextResponse } from "next/server";

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbw_F2761A5aCtbFBN2VzlQC4SIXiyAmbq9ohOPSuM0HadN0y7A93yEkhcgk-PaByMhyew/exec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Force endpoint to "report" regardless of what the client sends —
    // this route only ever sends report emails.
    const body = { ...payload, endpoint: "report" };

    // Minimal sanity check: orderId + at least one recipient
    if (!body.orderId) {
      return NextResponse.json(
        { ok: false, error: "Missing orderId" },
        { status: 400 }
      );
    }

    const gasRes = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      redirect: "follow",
      // GAS can be slow — generous timeout
      signal: AbortSignal.timeout(45_000),
    });

    const text = await gasRes.text();
    let gasJson: unknown = null;
    try {
      gasJson = JSON.parse(text);
    } catch {
      // GAS sometimes returns HTML on error
      gasJson = { raw: text.slice(0, 500) };
    }

    if (!gasRes.ok) {
      return NextResponse.json(
        { ok: false, error: `GAS returned ${gasRes.status}`, gas: gasJson },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, gas: gasJson });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
