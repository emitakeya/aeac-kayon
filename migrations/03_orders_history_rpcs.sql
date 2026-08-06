-- =============================================================================
-- Migration: aeac_kayon_orders_history_rpcs
-- Date: 2026-08-06
-- =============================================================================
-- Backend for /lihat-semua-pesanan — the full order archive, cancellations
-- included.
--
-- Two functions, deliberately split so the page loads instantly and only pulls
-- detail for months the user actually opens:
--
--   get_orders_history_summary()      -> one row per month: counts + paid total
--   get_orders_history_month(p_ym)    -> the orders inside one month
--
-- Month bucketing uses the DATE ENCODED IN order_id (aeac-YYYYMMDD-NNN-slug),
-- not the free-text scheduled_date ("2026-08-05 (Rabu) AM"). Verified on
-- 2026-08-06: all 303 order_ids match the pattern, zero exceptions.
--
-- Role gate on both: can_admin OR can_view_finance OR can_view_tech_pages
--   => admin, supervisor, finance, technician.   Marketing and TRO excluded.
--
-- ⚠️ property.staff_marketing / staff_tro hold HR data (salary, bank account,
--    KTP, passport). These functions select ONLY name and team_code. Do not
--    widen that select list — technicians can call these.
-- =============================================================================


-- ── 1. Monthly summary ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_orders_history_summary()
RETURNS TABLE (
  ym          text,    -- 'YYYYMM'
  yr          integer,
  mon         integer,
  n_orders    bigint,
  n_cancelled bigint,
  paid_total  bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, property
AS $$
DECLARE
  v_role  text;
  v_admin boolean;
  v_fin   boolean;
  v_tech  boolean;
BEGIN
  SELECT v.role, v.can_admin, v.can_view_finance, v.can_view_tech_pages
    INTO v_role, v_admin, v_fin, v_tech
  FROM public.v_current_user v;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT (v_admin OR v_fin OR v_tech) THEN
    RAISE EXCEPTION 'Tidak ada akses ke halaman ini.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT s.ym6,
         substring(s.ym6 from 1 for 4)::integer,
         substring(s.ym6 from 5 for 2)::integer,
         count(*)::bigint,
         count(*) FILTER (WHERE s.ostatus = 'cancelled')::bigint,
         COALESCE(sum(s.paid_amount), 0)::bigint
  FROM (
    SELECT substring(o.order_id from 6 for 6) AS ym6,
           o.status                           AS ostatus,
           (SELECT i.total_amount
              FROM public.invoices i
             WHERE i.order_id = o.order_id
               AND i.status = 'paid'
             LIMIT 1)                         AS paid_amount
      FROM public.orders o
     WHERE o.order_id ~ '^aeac-[0-9]{8}-'
  ) s
  GROUP BY s.ym6
  ORDER BY s.ym6 DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_orders_history_summary() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_orders_history_summary() TO authenticated;

COMMENT ON FUNCTION public.get_orders_history_summary() IS
  'Per-month order counts + paid revenue for /lihat-semua-pesanan. Buckets on the date encoded in order_id. Role-gated to admin, supervisor, finance, technician.';


-- ── 2. One month of orders ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_orders_history_month(p_ym text)
RETURNS TABLE (
  order_id           text,
  scheduled_date     text,
  status             text,
  services           text[],
  notes              text,
  name_roma          text,
  name_kanji         text,
  apartment          text,
  unit               text,
  mobile             text,
  email              text,
  ordered_by_email   text,
  ordered_by_name    text,
  ordered_by_team    text,
  technicians        text[],
  invoice_number     text,
  invoice_total      bigint,
  invoice_status     text,
  paid_date          text,
  payment_method     text,
  xendit_payment_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, property
AS $$
DECLARE
  v_role  text;
  v_admin boolean;
  v_fin   boolean;
  v_tech  boolean;
BEGIN
  SELECT v.role, v.can_admin, v.can_view_finance, v.can_view_tech_pages
    INTO v_role, v_admin, v_fin, v_tech
  FROM public.v_current_user v;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT (v_admin OR v_fin OR v_tech) THEN
    RAISE EXCEPTION 'Tidak ada akses ke halaman ini.' USING ERRCODE = '42501';
  END IF;

  IF p_ym IS NULL OR p_ym !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Format bulan tidak valid (harus YYYYMM).' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    o.order_id,
    o.scheduled_date,
    o.status::text,
    o.services,
    o.notes,
    c.name_roma,
    c.name_kanji,
    c.apartment,
    c.unit,
    c.mobile,
    c.email,
    lower(NULLIF(TRIM(c.ordered_by_email), '')),
    ob.sname,
    ob.steam,
    r.technicians,
    i.invoice_number,
    i.total_amount::bigint,
    i.status,
    i.paid_date,
    i.payment_method,
    i.xendit_payment_url
  FROM public.orders o
  LEFT JOIN public.customers c
    ON c.id = o.customer_id
  LEFT JOIN public.invoices i
    ON i.order_id = o.order_id
  LEFT JOIN LATERAL (
    -- Latest report wins; 2 orders currently have duplicate report rows.
    SELECT rp.technicians
      FROM public.reports rp
     WHERE rp.order_id = o.order_id
     ORDER BY rp.created_at DESC
     LIMIT 1
  ) r ON true
  LEFT JOIN LATERAL (
    -- Ordering staff, resolved from customers.ordered_by_email.
    -- ONLY name + team_code — never widen this select list.
    SELECT x.sname, x.steam
      FROM (
        SELECT sm.name AS sname, sm.team_code AS steam, sm.active AS sactive, 1 AS pri
          FROM property.staff_marketing sm
         WHERE lower(TRIM(sm.email)) = lower(TRIM(c.ordered_by_email))
        UNION ALL
        SELECT st.name, st.team_code, st.active, 2
          FROM property.staff_tro st
         WHERE lower(TRIM(st.email)) = lower(TRIM(c.ordered_by_email))
      ) x
     ORDER BY x.sactive DESC NULLS LAST, x.pri
     LIMIT 1
  ) ob ON NULLIF(TRIM(c.ordered_by_email), '') IS NOT NULL
  WHERE o.order_id ~ '^aeac-[0-9]{8}-'
    AND substring(o.order_id from 6 for 6) = p_ym
  ORDER BY o.order_id DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_orders_history_month(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_orders_history_month(text) TO authenticated;

COMMENT ON FUNCTION public.get_orders_history_month(text) IS
  'Orders for one YYYYMM bucket with customer, ordering staff, technicians and invoice/payment state. Role-gated to admin, supervisor, finance, technician.';


-- ── Verify ───────────────────────────────────────────────────────────────────
-- SELECT * FROM public.get_orders_history_summary();
-- SELECT order_id, status, invoice_status, invoice_total, ordered_by_name
--   FROM public.get_orders_history_month('202608');
