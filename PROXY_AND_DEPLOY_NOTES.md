# /tech-invoice — deploy & cutover notes

## What's in this bundle (drop into `D:\aeac-kayon`)

```
app/api/tech-invoice/create-invoice/route.ts   ← NEW token-gated save route
app/tech-invoice/page.tsx                       ← NEW Server Component (loads by token)
app/tech-invoice/tech-invoice-editor.tsx        ← NEW client editor
app/tech-invoice/tech-invoice-preview-modal.tsx ← NEW client send modal
app/tech-invoice/tech-invoice-states.tsx        ← NEW used/expired/invalid cards
```

Nothing existing is modified. The page reuses your existing `@/lib/invoices`
helpers and your existing `/api/xendit/create-invoice` + `/api/email/send-invoice`
routes **unchanged** (confirmed: neither requires a login).

## Backend — ALREADY APPLIED to Supabase

Three migrations are live (project `ehxldkjlyofhhzlxfnhf`):
- `get_order_for_invoicing_by_token(text)` — read (returns order, report, services, technicians)
- `create_invoice_by_token(text, jsonb)` — write (validates token, inserts, marks used)
- Both `SECURITY DEFINER`, granted to `anon` + `authenticated`, `PUBLIC` revoked.

Nothing to run on the DB side.

## ⚠ proxy.ts — REQUIRED change

Kayon protects routes via `proxy.ts`. `/tech-invoice` must be reachable WITHOUT
a session (technicians open it from an email link, not logged in). Add it to the
public allowlist, e.g.:

```ts
// inside proxy.ts — routes that skip the auth redirect
const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/tech-invoice",   // ← add this (public, token-gated)
];
```

`/api/tech-invoice/...` is already public because the matcher excludes `api`.

> Paste me your current `proxy.ts` and I'll return the exact edited file —
> the snippet above is the shape, but your matcher logic may differ.

## Env vars — nothing new

The page reuses the same routes the admin page already uses, so the same vars
cover it: `XENDIT_SECRET_KEY`, `XENDIT_SUCCESS_REDIRECT_BASE_URL`,
`XENDIT_FAILURE_REDIRECT_BASE_URL`, `GAS_EXEC_URL`. No additions.

## Local test

1. `npm run dev`
2. Grab a token that has NO invoice yet and isn't expired. (Right now the only
   live unused token already has an invoice. To make a clean test token without
   touching real data, run this in Supabase SQL editor — it points a throwaway
   token at a real order with no invoice, valid 7 days:)

   ```sql
   INSERT INTO public.invoice_tokens(token, order_id, expires_at, used)
   VALUES ('LOCALTEST1234567890ABCD', 'aeac-20260605-001-26', now()+interval '7 days', false);
   ```
3. Open `http://localhost:3000/tech-invoice?token=LOCALTEST1234567890ABCD`
   - You should see the editor with the customer card. (This order has no
     report, so line items start empty — add one from the dropdown to test send.)
4. To test the blocked states:
   - expired: set `expires_at` to a past time → expects "Link Kedaluwarsa"
   - used: set `used = true` → expects "Invoice Sudah Dibuat"
   - bad token: `?token=nope` → expects "Link Tidak Valid"
5. Clean up: `DELETE FROM public.invoice_tokens WHERE token = 'LOCALTEST1234567890ABCD';`
   (If you ran a full send during testing, also delete the test invoice row.)

## Cutover (LATER — WordPress stays live until you say so)

The post-report email currently builds the invoice link to the WordPress page.
To move technicians onto Kayon, change that link to:

```
https://kayon.aeac-service.id/tech-invoice?token=<token>
```

This is the single switch. Until it's flipped, WordPress remains the live path
and this page just sits ready. We can flip it after a Vercel-preview test with a
controlled order.

## Suggested branch

`session13-tech-invoice` → push → Vercel preview → test on the preview URL with
the throwaway token above → merge to main.
```
