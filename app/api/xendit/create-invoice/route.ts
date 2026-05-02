/**
 * /api/xendit/create-invoice
 * ──────────────────────────────────────────────────────────────────────────
 * Replaces the WordPress AJAX endpoint `aeac_xendit_create_invoice`.
 *
 * Called from /invoice-admin (and later /tech-invoice) after saving the
 * invoice row to Supabase. Creates a Xendit hosted-checkout invoice and
 * returns the payment URL for the customer.
 *
 * Required env vars (Vercel project settings):
 *   XENDIT_SECRET_KEY                   — production or test secret key
 *   XENDIT_SUCCESS_REDIRECT_BASE_URL    — e.g. https://aeac-service.id/?payment=success
 *   XENDIT_FAILURE_REDIRECT_BASE_URL    — e.g. https://aeac-service.id/?payment=failed
 *
 * The order_id is appended to the redirect URLs as `&order_id=<orderId>`.
 *
 * Request body (JSON):
 *   {
 *     orderId:        string,
 *     invoiceNumber:  string,
 *     amount:         number,   // IDR, integer, must be >= 10000
 *     email:          string,
 *     customerName:   string,
 *     description?:   string,
 *     items?:         Array<{ name: string, qty: number, price: number }>
 *   }
 *
 * Response (200):
 *   { ok: true, data: { invoice_url, xendit_id, expiry_date, external_id } }
 * Error responses:
 *   400 — { ok: false, error: "..." }
 *   500 — { ok: false, error: "...", details?: ... }
 *   502 — { ok: false, error: "..." }
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────
type Item = { name: string; qty: number; price: number };

interface CreateInvoiceBody {
  orderId?: string;
  invoiceNumber?: string;
  amount?: number;
  email?: string;
  customerName?: string;
  description?: string;
  items?: Item[];
}

interface XenditPayload {
  external_id: string;
  amount: number;
  payer_email: string;
  description: string;
  currency: "IDR";
  invoice_duration: number;
  customer: { given_names: string; email: string };
  success_redirect_url: string;
  failure_redirect_url: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
    category: string;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function err(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

function sanitize(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

function appendOrderId(baseUrl: string, orderId: string): string {
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${sep}order_id=${encodeURIComponent(orderId)}`;
}

// ── Handler ───────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  let body: CreateInvoiceBody;
  try {
    body = (await request.json()) as CreateInvoiceBody;
  } catch {
    return err("Body harus JSON yang valid", 400);
  }

  // Validate required fields
  const orderId = sanitize(body.orderId);
  const invoiceNumber = sanitize(body.invoiceNumber);
  const email = sanitize(body.email);
  const customerName = sanitize(body.customerName);
  const amount = Number.isFinite(body.amount) ? Math.floor(body.amount as number) : NaN;

  const missing: string[] = [];
  if (!orderId) missing.push("orderId");
  if (!invoiceNumber) missing.push("invoiceNumber");
  if (!email) missing.push("email");
  if (!customerName) missing.push("customerName");
  if (!Number.isFinite(amount)) missing.push("amount");
  if (missing.length) {
    return err(`Field wajib tidak lengkap: ${missing.join(", ")}`, 400);
  }

  if (amount < 10000) {
    return err("Jumlah minimum pembayaran Xendit adalah Rp 10.000", 400);
  }

  // Env vars
  const secretKey = process.env.XENDIT_SECRET_KEY;
  if (!secretKey) {
    console.error("[xendit/create-invoice] XENDIT_SECRET_KEY not set");
    return err("Sistem pembayaran belum dikonfigurasi. Hubungi admin.", 500);
  }

  const successBase = process.env.XENDIT_SUCCESS_REDIRECT_BASE_URL
    || "https://aeac-service.id/?payment=success";
  const failureBase = process.env.XENDIT_FAILURE_REDIRECT_BASE_URL
    || "https://aeac-service.id/?payment=failed";

  const description = sanitize(body.description) || `AEAC Invoice ${invoiceNumber}`;

  // Build Xendit payload
  const payload: XenditPayload = {
    external_id: orderId,
    amount,
    payer_email: email,
    description,
    currency: "IDR",
    invoice_duration: 86400, // 24 hours
    customer: { given_names: customerName, email },
    success_redirect_url: appendOrderId(successBase, orderId),
    failure_redirect_url: appendOrderId(failureBase, orderId),
  };

  if (Array.isArray(body.items) && body.items.length > 0) {
    payload.items = body.items.map((item) => ({
      name: sanitize(item?.name) || "Service",
      quantity: Math.max(1, Math.floor(Number(item?.qty) || 1)),
      price: Math.max(0, Math.floor(Number(item?.price) || 0)),
      category: "AC Service",
    }));
  }

  // Call Xendit
  // Basic auth: base64("<secret_key>:")
  const authHeader = "Basic " + Buffer.from(secretKey + ":").toString("base64");

  let xenditRes: Response;
  try {
    xenditRes = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
      // Next.js server-side fetch — no caching
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    console.error("[xendit/create-invoice] fetch failed:", msg);
    return err("Gagal terhubung ke Xendit. Silakan coba lagi.", 502);
  }

  let xenditBody: Record<string, unknown> = {};
  try {
    xenditBody = (await xenditRes.json()) as Record<string, unknown>;
  } catch {
    /* keep empty body */
  }

  if (!xenditRes.ok) {
    console.error(
      "[xendit/create-invoice] Xendit returned",
      xenditRes.status,
      xenditBody
    );
    return err(
      "Pembuatan invoice Xendit gagal.",
      xenditRes.status >= 400 && xenditRes.status < 500 ? 400 : 502,
      { xendit_error: xenditBody?.message ?? "Unknown error" }
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      invoice_url: xenditBody.invoice_url ?? null,
      xendit_id: xenditBody.id ?? null,
      expiry_date: xenditBody.expiry_date ?? null,
      external_id: xenditBody.external_id ?? orderId,
    },
  });
}
