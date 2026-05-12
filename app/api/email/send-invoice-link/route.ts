// app/api/email/send-invoice-link/route.ts
// Forwards an invoice-link-email payload to Google Apps Script.
// Triggers sendInvoiceLinkEmail_() in GAS, which emails ONLY the techs
// who worked on the job (passed via techEmails) plus aeac@maisonmap.com CC.

import { NextRequest, NextResponse } from "next/server";

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbw_F2761A5aCtbFBN2VzlQC4SIXiyAmbq9ohOPSuM0HadN0y7A93yEkhcgk-PaByMhyew/exec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const body = { ...payload, endpoint: "invoice_link" };

    // Required fields per GAS sendInvoiceLinkEmail_() — both must be non-empty
    // or GAS silently no-ops, which would look like success to the client.
    if (!body.invoiceLink) {
      return NextResponse.json(
        { ok: false, error: "Missing invoiceLink" },
        { status: 400 }
      );
    }
    if (!body.techEmails) {
      return NextResponse.json(
        { ok: false, error: "Missing techEmails" },
        { status: 400 }
      );
    }

    const gasRes = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      redirect: "follow",
      signal: AbortSignal.timeout(45_000),
    });

    const text = await gasRes.text();
    let gasJson: unknown = null;
    try {
      gasJson = JSON.parse(text);
    } catch {
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
