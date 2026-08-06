# Lihat Semua Pesanan + dashboard reorder — deployment guide

**Date:** 6 August 2026
**Built against:** live `app/` zip uploaded this session + live Supabase schema
(`ehxldkjlyofhhzlxfnhf`), both verified before writing.

---

## Contents

```
migrations/
  01_supervisor_full_admin.sql        supervisor -> full admin capabilities
  02_commission_recap_roles.sql       tech recap +supervisor, marketing recap +technician
  03_orders_history_rpcs.sql          get_orders_history_summary / _month

app/
  dashboard/
    page.tsx                          PATCH — new order, new card, Lottie, gates
    order-form-lottie.tsx             NEW   — lottie-web client component
  lihat-semua-pesanan/
    page.tsx                          NEW   — server component, auth gate
    history-client.tsx                NEW   — accordions, lazy load, filters

lib/
  orders-history.ts                   NEW   — types, badges, formatters
```

`public/animation/order_form.json` is already on your disk — nothing to copy.

---

## Deploy order

### 1. Install the Lottie renderer

```powershell
cd D:\aeac-kayon
npm install lottie-web
```

Nothing else needs it. `lottie-web` has no React peer dependency, so React 19
is a non-issue. It is imported dynamically, so it stays out of the initial
dashboard bundle.

### 2. Apply migrations, in order

Supabase Dashboard → SQL Editor, one file at a time.

Run **01** first — 03's role gate depends on supervisor already having the
widened capability flags.

Each file ends with a commented-out verification query. Run it before moving on.

Migration 02 uses a `DO` block that reads the live function definition, asserts
the role guard appears exactly once, substitutes, and re-executes. If either
function has drifted since 6 Aug 2026 it raises instead of guessing — that
error is a signal to inspect, not to force.

### 3. Copy files into the repo

Extract preserving structure over `D:\aeac-kayon`. Expected `git status`:

```
modified:   app/dashboard/page.tsx
new file:   app/dashboard/order-form-lottie.tsx
new file:   app/lihat-semua-pesanan/page.tsx
new file:   app/lihat-semua-pesanan/history-client.tsx
new file:   lib/orders-history.ts
modified:   package.json  package-lock.json   (from step 1)
```

If `page.tsx` shows as **new** rather than modified, it landed in the wrong
folder — check whether your repo uses `src/app/` and move accordingly.

### 4. Local test

```powershell
npm run dev
```

At http://localhost:3000/dashboard as admin:

- Card order reads: Booking / Order Baru → Booking List → Cancel →
  **Lihat Semua Pesanan** → Laporan Teknisi → Invoice Admin →
  Rekap Komisi Teknisi → Rekap Komisi Marketing
- The Lottie animates on the Booking card (2.5s loop)
- `/lihat-semua-pesanan` opens with **Agustus 2026** expanded
- Collapse it, open **Mei 2026** — 71 orders, 24 cancelled
- Type a unit number in the search box — it pulls every month, then filters
- The "Belum Lunas" chip surfaces unpaid, non-cancelled orders

### 5. Deploy

```powershell
git add .
git commit -m "feat(history): /lihat-semua-pesanan + dashboard reorder + order-form Lottie"
git push origin main
```

Or use a feature branch and test on the Vercel preview first — this touches
role capabilities, so a preview smoke test is the safer path.

---

## Verified against live data (6 Aug 2026)

Both new RPC queries were run against production before being wrapped in
functions. `get_orders_history_summary` returns:

| Month    | Orders | Cancelled | Paid          |
|----------|--------|-----------|---------------|
| Aug 2026 | 12     | 0         | Rp 2.490.000  |
| Jul 2026 | 51     | 9         | Rp 13.875.000 |
| Jun 2026 | 61     | 2         | Rp 12.340.000 |
| May 2026 | 71     | 24        | Rp 15.365.000 |
| Apr 2026 | 50     | 9         | Rp 15.055.000 |
| Mar 2026 | 40     | 3         | Rp 12.660.000 |
| Feb 2026 | 18     | 4         | Rp 6.275.000  |

**303 orders total, all in 2026.** The year-accordion layer is built and
correct but renders nothing until January 2027, when 2026 folds itself into a
year bar automatically. No action needed then.

---

## Design notes

**Month bucketing uses the date inside `order_id`** (`aeac-YYYYMMDD-NNN-slug`),
not the free-text `scheduled_date` ("2026-08-05 (Rabu) AM"). All 303 IDs match
the pattern — zero exceptions — so this is reliable and indexable.

**"Dipesan oleh" comes from `customers.ordered_by_email`**, joined to
`property.staff_marketing` / `staff_tro` for name and team. No schema change
was needed: `create_staff_order` has been writing that field all along, and 191
of 303 orders already carry it. Orders from the public WordPress form have no
value, so the line is simply omitted for them.

**Technician names come from `reports.technicians`** — the latest report wins,
since two orders currently have duplicate report rows. Orders without a report
show no technician line.

**Cancelled orders get no payment strip.** They owe nothing, and the absence
reads faster than an empty row. The cancellation reason from `notes` shows in
red instead.

**`property.staff_marketing` and `staff_tro` hold HR data** — salary, bank
account, KTP, passport. `get_orders_history_month` selects only `name` and
`team_code` from them. Technicians can call this function, so do not widen that
select list.

---

## Known limits

**Filtering loads the whole archive.** Turning on search or a status chip
fetches every month that isn't already cached — you can't filter what hasn't
been fetched. At ~300 orders across 7 months that's a handful of small calls
and feels instant. If the archive ever reaches tens of thousands of rows, move
filtering into a server-side RPC.

**The "Confirmed" filter chip currently matches nothing.** Live `orders.status`
values are `completed` (225), `cancelled` (51), `pending` (27) — no rows sit at
`confirmed`, even though the cancel flow treats it as valid. The chip is there
because the state is legitimate, not because it's in use. Remove it if the
empty result is more confusing than useful.

**30 invoices sit at `payment_expired`.** Some were likely settled by bank
transfer without the Xendit link being closed out, so "Belum Lunas" may surface
old noise. Worth one pass through that list before treating the chip as a
collections queue.

---

## Not done — still open

**Marketing/TRO team scoping is unchanged.** `get_marketing_commission_recap`
still scopes `marketing` and `tro` callers to their own `team_code`, resolved
from their email. That behaviour was built deliberately, and opening it to all
five teams would let each pair see the others' earnings — so it was left alone
pending your call.

**Technicians do not get "Booking / Order Baru".** You said techs see
everything except Cancel, but `create_staff_order` requires the order to be
attributed to a marketing or TRO teammate, and a technician has no valid value
for that field. Showing them the card would produce a card that fails on
submit. If techs genuinely need to create bookings, that needs its own
attribution rule.
