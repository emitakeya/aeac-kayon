-- migrations/aeac_kayon_get_laporan_initial_data.sql
-- =============================================================
-- /laporan-teknisi initial data RPC
-- One-shot fetch for the form: auth + orders + services + checklists + techs
-- Access: technicians (can_view_tech_pages) + admins (can_admin)
--
-- Applied: 2026-05-12 (Session 10) via Supabase MCP
-- Status: tested with admin, technician, marketing-role users
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_laporan_initial_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_can_view boolean := false;
  v_current_tech_id uuid;
  v_current_tech_name text;
  v_tomorrow_str text;
BEGIN
  -- Auth: must have can_view_tech_pages or can_admin
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  SELECT (can_view_tech_pages OR can_admin)
    INTO v_can_view
    FROM public.v_current_user
   LIMIT 1;

  IF NOT COALESCE(v_can_view, false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Resolve current user's technician_id + name (NULL if admin who is not a tech)
  SELECT technician_id INTO v_current_tech_id FROM public.v_current_user LIMIT 1;
  IF v_current_tech_id IS NOT NULL THEN
    SELECT name INTO v_current_tech_name FROM public.technicians WHERE id = v_current_tech_id;
  END IF;

  -- "Tomorrow" in Asia/Jakarta as YYYY-MM-DD text (matches WP scheduled_date lex sort)
  v_tomorrow_str := to_char(
    ((now() AT TIME ZONE 'Asia/Jakarta')::date + interval '1 day'),
    'YYYY-MM-DD'
  );

  RETURN jsonb_build_object(
    'current_user', jsonb_build_object(
      'technician_id', v_current_tech_id,
      'technician_name', v_current_tech_name
    ),

    'orders', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'order_id', o.order_id,
          'scheduled_date', o.scheduled_date,
          'services', o.services,
          'status', o.status,
          'customer', jsonb_build_object(
            'name_roma', c.name_roma,
            'name_kanji', c.name_kanji,
            'apartment', c.apartment,
            'unit', c.unit,
            'mobile', c.mobile,
            'email', c.email
          )
        )
        ORDER BY o.scheduled_date DESC
      )
      FROM public.orders o
      LEFT JOIN public.customers c ON c.id = o.customer_id
      WHERE o.status NOT IN ('completed', 'cancelled')
        AND o.scheduled_date < v_tomorrow_str
    ), '[]'::jsonb),

    'services', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name_id', s.name_id,
          'name_ja', s.name_ja,
          'category', s.category,
          'price', s.price
        )
        ORDER BY s.name_id
      )
      FROM public.services s
      WHERE s.active = true
    ), '[]'::jsonb),

    'checklists', jsonb_build_object(
      'kondisi', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('text_id', text_id, 'text_ja', text_ja) ORDER BY sort_order)
        FROM public.checklists WHERE active = true AND type = 'kondisi'
      ), '[]'::jsonb),
      'tindakan', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('text_id', text_id, 'text_ja', text_ja) ORDER BY sort_order)
        FROM public.checklists WHERE active = true AND type = 'tindakan'
      ), '[]'::jsonb),
      'rekomendasi', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('text_id', text_id, 'text_ja', text_ja) ORDER BY sort_order)
        FROM public.checklists WHERE active = true AND type = 'rekomendasi'
      ), '[]'::jsonb),
      'perbaikan', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('text_id', text_id, 'text_ja', text_ja) ORDER BY sort_order)
        FROM public.checklists WHERE active = true AND type = 'perbaikan'
      ), '[]'::jsonb)
    ),

    'technicians', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'name', t.name,
          'email', t.email
        )
        ORDER BY t.name
      )
      FROM public.technicians t
      WHERE t.is_active = true AND t.role = 'technician'
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_laporan_initial_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_laporan_initial_data() TO authenticated;
