-- Migration: aeac_kayon_backfill_missing_marketing_commissions_may2026
--
-- One-time backfill: 18 marketing commission rows for paid invoices that
-- fell into the gap between the BCA-only April 2026 backfill and the
-- post-May-1 mark_invoice_paid / create_commissions_for_invoice flows.
--
-- Affected invoices: marketing customers (maison*@gmail.com emails) whose
-- invoices were paid via Xendit (April 16-30 2026) or manually reconciled
-- on May 4 2026 for orders scheduled before May 1.
--
-- Tech commissions are NOT being backfilled per separate decision.
-- Tech tally was settled via April quarterly payouts; reopening would
-- create reconciliation complexity.
--
-- Per-team breakdown of what gets created:
--   DES: 2 rows, Rp 59.000
--   ERF: 2 rows, Rp 118.500
--   ERI: 7 rows, Rp 202.000
--   EVE: 3 rows, Rp 105.000
--   WID: 4 rows, Rp 137.500
--   Total: 18 rows, Rp 622.000
--
-- Saldo before: Rp 4.687.750
-- Saldo after:  Rp 5.309.750
--
-- Idempotent: NOT EXISTS check skips invoices that already have any
-- commission row referencing them.

WITH mkt_email_map AS (
  SELECT * FROM (VALUES
    ('maisoncucum@gmail.com',   'DES'),
    ('maisonagasi@gmail.com',   'ERF'),
    ('maisonokta@gmail.com',    'ERI'),
    ('maisonare@gmail.com',     'EVE'),
    ('maisonevelyn@gmail.com',  'EVE'),
    ('maisonrizky@gmail.com',   'WID')
  ) AS t(email, team_code)
),
parse_paid_date AS (
  SELECT
    m.team_code,
    i.id           AS invoice_id,
    i.order_id,
    i.invoice_number,
    i.total_amount AS basis,
    i.paid_date    AS paid_date_raw,
    -- Indonesian → English month substitution for date parsing
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      i.paid_date,
      'Januari',   'January'),
      'Februari',  'February'),
      'Maret',     'March'),
      'April',     'April'),
      'Mei',       'May'),
      'Juni',      'June'),
      'Juli',      'July'),
      'Agustus',   'August'),
      'September', 'September'),
      'Oktober',   'October'),
      'November',  'November'),
      'Desember',  'December'
    ) AS paid_date_en
  FROM public.invoices i
  JOIN mkt_email_map m ON LOWER(TRIM(i.customer_email)) = m.email
  WHERE i.status = 'paid'
    AND i.created_at >= '2026-01-01'::timestamptz
    AND NOT EXISTS (
      SELECT 1 FROM public.commissions c
      WHERE c.invoice_id = i.id OR c.order_id = i.order_id
    )
),
to_create AS (
  SELECT
    p.team_code,
    p.invoice_id,
    p.order_id,
    p.invoice_number,
    p.basis,
    ROUND(p.basis * 0.10)::int AS commission_amount,
    to_date(p.paid_date_en, 'FMDD FMMonth YYYY') AS earned_date,
    p.paid_date_raw,
    e.id AS earner_id
  FROM parse_paid_date p
  JOIN public.earners e
    ON e.type = 'marketing'
   AND e.team_code = p.team_code
   AND e.active = true
)
INSERT INTO public.commissions (
  earner_id,
  invoice_id,
  order_id,
  basis_amount,
  rate,
  amount,
  status,
  earned_date,
  notes
)
SELECT
  earner_id,
  invoice_id,
  order_id,
  basis,
  0.10,
  commission_amount,
  'available',
  earned_date,
  format(
    'Backfill May 4 2026: missing marketing commission for %s (paid %s, gap from BCA-only April backfill)',
    invoice_number,
    paid_date_raw
  )
FROM to_create
ORDER BY team_code, earned_date;
