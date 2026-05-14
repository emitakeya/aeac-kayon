-- =============================================================================
-- Migration: aeac_kayon_get_cancellable_orders
-- =============================================================================
-- Returns orders that are still cancellable (status='pending' OR 'confirmed')
-- with a scheduled date from (Jakarta today - 7 days) onwards.
--
-- Filtering uses order_id prefix because order_id encodes the service date:
--   aeac-YYYYMMDD-NNN-suffix
-- This matches the WordPress cancel form's behavior.
--
-- Role gate: can_admin OR can_view_finance (admin + Hafiz/finance only).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_cancellable_orders()
RETURNS TABLE (
  order_id        text,
  scheduled_date  text,
  status          text,
  services        text[],
  notes           text,
  name_roma       text,
  name_kanji      text,
  apartment       text,
  unit            text,
  mobile          text,
  email           text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, property
AS $$
DECLARE
  v_role        text;
  v_can_admin   boolean;
  v_can_finance boolean;
  v_cutoff      text;
BEGIN
  -- Role gate: admin OR finance
  SELECT role, can_admin, can_view_finance
    INTO v_role, v_can_admin, v_can_finance
  FROM public.v_current_user;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT (v_can_admin OR v_can_finance) THEN
    RAISE EXCEPTION 'Forbidden: admin or finance role required'
      USING ERRCODE = '42501';
  END IF;

  -- Build cutoff prefix: aeac-YYYYMMDD where YYYYMMDD is (Jakarta today - 7 days)
  v_cutoff := 'aeac-' || to_char(
    (now() AT TIME ZONE 'Asia/Jakarta')::date - INTERVAL '7 days',
    'YYYYMMDD'
  );

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
    c.email
  FROM public.orders o
  LEFT JOIN public.customers c ON c.id = o.customer_id
  WHERE o.status IN ('pending', 'confirmed')
    AND o.order_id >= v_cutoff
  ORDER BY o.order_id ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cancellable_orders() TO authenticated;

COMMENT ON FUNCTION public.get_cancellable_orders() IS
  'List of cancellable orders (pending/confirmed, scheduled within the last 7 days or upcoming). Role-gated to admin OR finance.';
