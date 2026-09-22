-- =============================================================================
-- Migration: aeac_b2b_03_followup_count (B2B Prospek v1.2) — applied live.
-- Overdue count for the /b2b nav badge. Read-only; returns 0 without access.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.b2b_overdue_count()
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, property
AS $$
BEGIN
  IF NOT public.b2b_can_access() THEN
    RETURN 0;
  END IF;
  RETURN (SELECT count(*)::int FROM b2b_prospects
          WHERE NOT is_archived
            AND status NOT IN ('won','lost')
            AND next_followup_date < (now() AT TIME ZONE 'Asia/Jakarta')::date);
END;
$$;
REVOKE ALL ON FUNCTION public.b2b_overdue_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.b2b_overdue_count() TO authenticated;
