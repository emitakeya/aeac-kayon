# Update — login round-trip + admin dropdown

## Kayon files (extract at repo root, overwrites)
- `lib/supabase/middleware.ts` — `next` now carries **path + query** (so `?ref=` survives
  login); a logged-in hit to `/login` also honors a safe internal `next`.
- `app/login/actions.ts`, `app/login/page.tsx` — thread the `next` param (safe fallback
  `/dashboard`). *(Same files as the reminder bundle — these supersede them.)*
- `lib/booking-staff.ts` — `TeamMember` gains `team_code`.
- `app/booking-staff/booking-staff-client.tsx` — **admin** sees every team in the
  "Dipesan oleh" dropdown, grouped by team (`<optgroup>`); when there's no auto-detected
  "self" (admin not on a team), it shows a "— Pilih staff pemesan —" placeholder and
  forces a pick instead of defaulting to a random staffer.
- `app/booking-staff/page.tsx`, `app/api/booking-staff/create/route.ts`,
  `app/dashboard/page.tsx` — unchanged since the first booking-staff bundle (included
  here so this is a complete drop-in).

## Supabase — ALREADY APPLIED (ehxldkjlyofhhzlxfnhf)
- `get_staff_booking_context` replaced: admins → all active teams; members carry `team_code`.
  Verified: admin sees 12 staff, Desti sees 2 (her team). `create_staff_order` already
  permitted admin attribution to anyone, so no change there.

## GAS
- Unchanged this round — use the `AEAC_GAS_Complete_Merged.js` from the reminder bundle.

## Still open
- Round-trip is now complete end-to-end (middleware → login → callback/action).
