-- aeac_kayon_get_bookings_confirmed_merged_may2026.sql
-- APPLIED to ehxldkjlyofhhzlxfnhf on 2026-05-12.
--
-- Merges /booking-list-mobile into /booking-list-confirmed. The mobile
-- route is being deleted; this RPC now serves both audiences.
--
-- Changes from prior get_bookings_confirmed:
--   • Auth gate relaxed: can_view_mm OR can_view_tech_pages (was can_view_mm only)
--   • No longer filters out cancelled status (was: WHERE status IS DISTINCT FROM 'cancelled')
--
-- Also drops public.get_bookings_for_tech_mobile (no longer needed since
-- /booking-list-mobile is being removed from the codebase).

CREATE OR REPLACE FUNCTION public.get_bookings_confirmed()
RETURNS TABLE (
  order_id          text,
  scheduled_date    text,
  status            text,
  services          text[],
  notes             text,
  wait_name         text,
  wait_phone        text,
  name_roma         text,
  name_kanji        text,
  ordered_by_email  text,
  mobile            text,
  email             text,
  apartment         text,
  unit              text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'property'
AS $function$
DECLARE
  v_can_view boolean;
  v_cutoff_prefix text;
BEGIN
  SELECT (can_view_mm OR can_view_tech_pages) INTO v_can_view
  FROM public.v_current_user;

  IF v_can_view IS NOT TRUE THEN
    RAISE EXCEPTION 'akses ditolak: hanya untuk staf AEAC'
      USING ERRCODE = '42501';
  END IF;

  v_cutoff_prefix := 'aeac-' || to_char(CURRENT_DATE - 3, 'YYYYMMDD') || '-';

  RETURN QUERY
  SELECT
    o.order_id, o.scheduled_date, o.status, o.services, o.notes,
    o.wait_name, o.wait_phone,
    c.name_roma, c.name_kanji, c.ordered_by_email, c.mobile, c.email,
    c.apartment, c.unit
  FROM public.orders o
  LEFT JOIN public.customers c ON c.id = o.customer_id
  WHERE o.order_id >= v_cutoff_prefix
  ORDER BY o.order_id ASC;
END;
$function$;

-- Drop the deprecated tech-mobile RPC; route is being deleted.
DROP FUNCTION IF EXISTS public.get_bookings_for_tech_mobile();
