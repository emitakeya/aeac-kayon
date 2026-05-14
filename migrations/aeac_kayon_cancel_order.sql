-- =============================================================================
-- Migration: aeac_kayon_cancel_order
-- =============================================================================
-- Cancels an order:
--   - Re-checks role (admin OR finance)
--   - Validates order is currently pending/confirmed (idempotency guard)
--   - Updates status='cancelled' and notes (prepended with 'CANCELLED'
--     or 'CANCELLED: <reason>' if a reason was given)
--   - Returns a JSON payload with everything GAS needs to send the email
--
-- Returned JSON shape:
-- {
--   "order_id": "...",
--   "scheduled_date": "...",
--   "services": ["...", "..."],
--   "customer": {
--     "name_roma":  "...",
--     "name_kanji": "...",
--     "apartment":  "...",
--     "unit":       "...",
--     "mobile":     "...",
--     "email":      "..."
--   }
-- }
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cancel_order(
  p_order_id text,
  p_reason   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, property
AS $$
DECLARE
  v_role        text;
  v_can_admin   boolean;
  v_can_finance boolean;
  v_current     record;
  v_new_notes   text;
  v_payload     jsonb;
BEGIN
  -- Role gate
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

  -- Input validation
  IF p_order_id IS NULL OR length(trim(p_order_id)) = 0 THEN
    RAISE EXCEPTION 'Order ID is required' USING ERRCODE = '22023';
  END IF;

  -- Lock the row and load current state
  SELECT o.order_id, o.status, o.scheduled_date, o.services,
         c.name_roma, c.name_kanji, c.apartment, c.unit, c.mobile, c.email
    INTO v_current
  FROM public.orders o
  LEFT JOIN public.customers c ON c.id = o.customer_id
  WHERE o.order_id = p_order_id
  FOR UPDATE OF o;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id USING ERRCODE = '02000';
  END IF;

  IF v_current.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Order cannot be cancelled (current status: %)', v_current.status
      USING ERRCODE = '22023';
  END IF;

  -- Build the new notes value (match WP shortcode behavior)
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    v_new_notes := 'CANCELLED';
  ELSE
    v_new_notes := 'CANCELLED: ' || trim(p_reason);
  END IF;

  -- Apply the update
  UPDATE public.orders
     SET status = 'cancelled',
         notes  = v_new_notes
   WHERE order_id = p_order_id;

  -- Build the payload for the GAS email
  v_payload := jsonb_build_object(
    'order_id',       v_current.order_id,
    'scheduled_date', v_current.scheduled_date,
    'services',       COALESCE(v_current.services, ARRAY[]::text[]),
    'customer', jsonb_build_object(
      'name_roma',  v_current.name_roma,
      'name_kanji', v_current.name_kanji,
      'apartment',  v_current.apartment,
      'unit',       v_current.unit,
      'mobile',     v_current.mobile,
      'email',      v_current.email
    )
  );

  RETURN v_payload;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_order(text, text) TO authenticated;

COMMENT ON FUNCTION public.cancel_order(text, text) IS
  'Cancels an order (status=cancelled, prepends CANCELLED to notes). Returns JSON payload for the GAS cancel email. Role-gated to admin OR finance.';
