# Staff form — session capacity ("Penuh"), matching the original

## Files (extract at repo root)
- `app/api/booking-staff/availability/route.ts` — NEW. GET `?date=YYYY-MM-DD` →
  `{ ok, am_count, pm_count, max }`. Gated to MM staff/admin. Fail-open on error.
- `app/booking-staff/booking-staff-client.tsx` — REPLACES the previous copy. On date
  change it fetches availability; a session at **2/2** renders disabled and labelled
  "· Penuh"; if both are full it shows a notice; a selected session that turns out full
  is auto-deselected; "Selanjutnya" stays blocked until a non-full session is chosen.

## Supabase — ALREADY APPLIED (ehxldkjlyofhhzlxfnhf)
- `get_session_availability(text)` — same rule as the WP form: non-cancelled orders whose
  `scheduled_date` starts with the date, counted by AM/PM, MAX 2. Verified live
  (2026-03-06 AM = 2/2 → full).

## Note (same as the original)
This is a **UI-level** check, exactly like the WP form — it doesn't hard-lock at the DB,
so two people submitting the same slot within the same second could still both get in.
If you want a hard server-side guard, I can add a capacity check inside `create_staff_order`.
