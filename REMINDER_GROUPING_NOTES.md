# 3-Month Reminder — Grouping + Kayon Link (deploy notes)

## What changed

### GAS (`AEAC_GAS_Complete_Merged.js`) — paste the whole file into Code.gs, redeploy
- New constant `KAYON_BOOKING_URL` = https://kayon.aeac-service.id/booking-staff
- New `loadMMTeamsCache_()` / `findTeamForEmails_()` / `teamLabel_()` (uses new `get_mm_teams` RPC)
- `runReminder_()` now classifies eligible units:
  - **Standalone non-staff customers (caseA)** → unchanged per-unit email, keeps the
    public `aeac-service.id` link.
  - **MM-team-routed units** → grouped into **one email per team**, each unit row with
    its own **Booking →** button linking to `…/booking-staff?ref=<order_id>`.
- New `sendTeamReminder_()` + `buildTeamReminderHtml_()`.
- One `reminder_log` row is still written **per unit**, so the 30-day cooldown stays per-unit.
- Team-email **BCC = aeac@maisonmap.com only** (session-18 trim). The standalone path
  BCC was left exactly as it was in the file — verify it matches your live intent.
- Syntax validated with `node --check`. All 6 email endpoints intact.

### Supabase — ALREADY APPLIED (project ehxldkjlyofhhzlxfnhf)
- `get_mm_teams()` (SECURITY DEFINER, granted anon + authenticated). SQL in `migrations/`.

### Kayon login round-trip (so `?ref=` survives a logged-out click)
- `app/login/actions.ts` — password + magic-link now honor a safe internal `next`
  (fallback `/dashboard`, so nothing changes when `next` is absent).
- `app/login/page.tsx` — reads `next` from the URL, carries it as a hidden field.
- `app/auth/callback/route.ts` — already honors `next` (no change needed).

## ⚠ One change I could NOT make (file not in the zip)
`lib/supabase/middleware.ts` (`updateSession`) is what redirects logged-out users to
`/login`. It must append the original path so login can return there. Wherever it does
the redirect to `/login`, change it to include `next`, e.g.:

```ts
const url = request.nextUrl.clone();
url.pathname = '/login';
url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
return NextResponse.redirect(url);
```
Send me `lib/supabase/middleware.ts` and I'll produce the exact merged file.
(Until then: staff who are already logged in — the common case — land on the prefilled
page fine; only a logged-OUT click currently falls back to `/dashboard`.)

## Cron
No schedule change needed — the weekly pg_cron job still calls the same GAS endpoint.
Keep `REMINDER_DRY_RUN=true` for the first run after deploy and check the heartbeat.
