-- Applied to project ehxldkjlyofhhzlxfnhf.
CREATE OR REPLACE FUNCTION public.get_session_availability(p_date text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, property
AS $$
DECLARE v_role text; v_can_mm boolean; v_can_admin boolean; v_am int; v_pm int;
BEGIN
  SELECT role, can_view_mm, can_admin INTO v_role, v_can_mm, v_can_admin FROM public.v_current_user;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  IF NOT (v_can_mm OR v_can_admin) THEN RAISE EXCEPTION 'Forbidden: MM staff role required' USING ERRCODE='42501'; END IF;
  IF p_date IS NULL OR p_date !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Invalid date (expected YYYY-MM-DD)' USING ERRCODE='22023'; END IF;
  SELECT count(*) FILTER (WHERE scheduled_date LIKE '% AM'),
         count(*) FILTER (WHERE scheduled_date LIKE '% PM')
    INTO v_am, v_pm
  FROM public.orders
  WHERE scheduled_date LIKE p_date || '%' AND status IS DISTINCT FROM 'cancelled';
  RETURN jsonb_build_object('am_count', COALESCE(v_am,0), 'pm_count', COALESCE(v_pm,0), 'max', 2);
END; $$;
GRANT EXECUTE ON FUNCTION public.get_session_availability(text) TO authenticated;
