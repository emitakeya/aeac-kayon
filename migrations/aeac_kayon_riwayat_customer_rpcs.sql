-- migrations/aeac_kayon_riwayat_customer_rpcs.sql
-- =============================================================
-- /riwayat-customer RPCs (Kayon)
--   1) search_customers_for_history(p_query)
--        Picker rows: matches name_roma / name_kanji / email / apartment,
--        returns order + unpaid counts per customer row. Multi-select on the
--        frontend handles the duplicate-customer-rows-per-booking reality.
--   2) get_customer_history(p_customer_ids, p_from, p_unpaid_only)
--        Full history: orders + latest report + latest invoice per order,
--        plus summary totals (TOTAL PERIODE / TOTAL BELUM DIBAYAR).
--
-- Access: can_admin OR can_view_finance (both functions).
-- Rules:
--   - cancelled orders excluded
--   - orders with neither report nor invoice excluded (e.g. stale pendings)
--   - unpaid = invoice.status <> 'paid' (payment_expired counts as unpaid)
--   - reports/invoices deduped via LATERAL latest-row (double-submitted report
--     on aeac-20260505-001-26 caused join fan-out + double-counted totals)
--
-- APPLIED LIVE: 2026-08-19 via Supabase MCP as two migrations
--   (kayon_riwayat_customer_rpcs + kayon_riwayat_dedupe_report_invoice_joins).
--   This file is the combined final state for the repo record.
-- Verified: Daitokyo 6-month test → 11 visits, 10 unpaid, Rp 4.585.000.
-- =============================================================

CREATE OR REPLACE FUNCTION public.search_customers_for_history(p_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ok boolean := false;
  v_q text := '%' || trim(coalesce(p_query,'')) || '%';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;
  SELECT (can_admin OR can_view_finance) INTO v_ok FROM public.v_current_user LIMIT 1;
  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_query,''))) < 2 THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.last_service_date DESC NULLS LAST)
    FROM (
      SELECT
        c.id,
        c.name_roma,
        c.name_kanji,
        c.apartment,
        c.unit,
        c.email,
        count(o.id) FILTER (WHERE o.status <> 'cancelled') AS order_count,
        count(*) FILTER (
          WHERE o.status <> 'cancelled'
            AND i.id IS NOT NULL AND i.status IS DISTINCT FROM 'paid'
        ) AS unpaid_count,
        max(o.service_date) FILTER (WHERE o.status <> 'cancelled') AS last_service_date
      FROM public.customers c
      LEFT JOIN public.orders o   ON o.customer_id = c.id
      LEFT JOIN public.invoices i ON i.order_id   = o.order_id
      WHERE c.name_roma  ILIKE v_q
         OR c.name_kanji ILIKE v_q
         OR c.email      ILIKE v_q
         OR c.apartment  ILIKE v_q
      GROUP BY c.id
    ) t
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.search_customers_for_history(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_customers_for_history(text) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_customer_history(
  p_customer_ids uuid[],
  p_from date DEFAULT NULL,
  p_unpaid_only boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ok boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;
  SELECT (can_admin OR can_view_finance) INTO v_ok FROM public.v_current_user LIMIT 1;
  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_customer_ids IS NULL OR array_length(p_customer_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'no customers selected' USING ERRCODE = '22023';
  END IF;

  RETURN (
    WITH visits AS (
      SELECT
        o.order_id,
        o.service_date,
        o.session,
        o.status,
        o.services,
        (r.id IS NOT NULL)                              AS has_report,
        (i.id IS NOT NULL)                              AS has_invoice,
        (i.id IS NOT NULL AND i.status IS DISTINCT FROM 'paid') AS is_unpaid,
        CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object(
          'technicians',        r.technicians,
          'jam_mulai',          r.jam_mulai,
          'jam_selesai',        r.jam_selesai,
          'pengerjaan',         r.pengerjaan,
          'unit_split_standar_small',     r.unit_split_standar_small,
          'unit_split_standar_large',     r.unit_split_standar_large,
          'unit_split_semibongkar_small', r.unit_split_semibongkar_small,
          'unit_split_semibongkar_large', r.unit_split_semibongkar_large,
          'unit_cassette',      r.unit_cassette,
          'unit_ducting',       r.unit_ducting,
          'unit_perbaikan',     r.unit_perbaikan,
          'perbaikan_dilakukan', r.perbaikan_dilakukan,
          'kondisi_sebelum',    r.kondisi_sebelum,
          'tindakan_dilakukan', r.tindakan_dilakukan,
          'opsi_rekomendasi',   r.opsi_rekomendasi,
          'photo_sebelum',      r.photo_sebelum,
          'photo_sesudah',      r.photo_sesudah
        ) END AS report,
        CASE WHEN i.id IS NULL THEN NULL ELSE jsonb_build_object(
          'invoice_number', i.invoice_number,
          'line_items',     i.line_items,
          'subtotal',       i.subtotal,
          'discount',       i.discount,
          'total_amount',   i.total_amount,
          'status',         i.status,
          'paid_date',      i.paid_date,
          'payment_method', i.payment_method,
          'xendit_payment_url', i.xendit_payment_url
        ) END AS invoice,
        COALESCE(i.total_amount, 0) AS total_amount
      FROM public.orders o
      LEFT JOIN LATERAL (
        SELECT * FROM public.reports r0
        WHERE r0.order_id = o.order_id
        ORDER BY r0.created_at DESC LIMIT 1
      ) r ON true
      LEFT JOIN LATERAL (
        SELECT * FROM public.invoices i0
        WHERE i0.order_id = o.order_id
        ORDER BY i0.created_at DESC LIMIT 1
      ) i ON true
      WHERE o.customer_id = ANY (p_customer_ids)
        AND o.status <> 'cancelled'
        AND (r.id IS NOT NULL OR i.id IS NOT NULL)
        AND (p_from IS NULL OR o.service_date >= p_from)
        AND (NOT p_unpaid_only OR (i.id IS NOT NULL AND i.status IS DISTINCT FROM 'paid'))
    )
    SELECT jsonb_build_object(
      'customers', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', c.id, 'name_roma', c.name_roma, 'name_kanji', c.name_kanji,
          'apartment', c.apartment, 'unit', c.unit, 'email', c.email, 'mobile', c.mobile
        ))
        FROM public.customers c WHERE c.id = ANY (p_customer_ids)
      ), '[]'::jsonb),
      'visits', COALESCE((
        SELECT jsonb_agg(row_to_json(v)::jsonb ORDER BY v.service_date DESC)
        FROM visits v
      ), '[]'::jsonb),
      'summary', jsonb_build_object(
        'visit_count',          (SELECT count(*) FROM visits),
        'total_periode',        (SELECT COALESCE(sum(total_amount), 0) FROM visits),
        'total_belum_dibayar',  (SELECT COALESCE(sum(total_amount) FILTER (WHERE is_unpaid), 0) FROM visits),
        'unpaid_count',         (SELECT count(*) FILTER (WHERE is_unpaid) FROM visits),
        'from_date',            p_from,
        'generated_at',         to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI')
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_history(uuid[], date, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_history(uuid[], date, boolean) TO authenticated;
