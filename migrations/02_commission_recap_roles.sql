-- =============================================================================
-- Migration: aeac_kayon_commission_recap_roles
-- Date: 2026-08-06
-- =============================================================================
-- Two one-line role-list widenings:
--
--   get_tech_commission_recap(p_year)
--     admin, finance, technician  ->  + supervisor
--
--   get_marketing_commission_recap(p_year)
--     admin, finance, supervisor, marketing, tro  ->  + technician
--
-- WHY A DO BLOCK INSTEAD OF CREATE OR REPLACE:
-- get_marketing_commission_recap is ~14,500 characters. Retyping it by hand to
-- change one line is how logic gets silently dropped. Instead we read the live
-- definition, assert the anchor string appears EXACTLY ONCE, substitute, and
-- re-execute. If the function has drifted from what was captured on 2026-08-06,
-- the migration aborts instead of guessing.
--
-- NOTE ON SCOPING (unchanged by this migration):
-- get_marketing_commission_recap scopes `marketing` and `tro` callers to their
-- own team_code, resolved from property.staff_marketing / staff_tro by email.
-- admin / finance / supervisor / technician see all five teams. If you later
-- decide marketing should see all five too, that is a separate change to the
-- `IF v_role IN ('marketing', 'tro')` branch — deliberately NOT done here.
-- =============================================================================

-- ── 1. get_tech_commission_recap: allow supervisor ───────────────────────────
DO $mig$
DECLARE
  v_def    text;
  v_old    text := 'IF v_role NOT IN (''admin'', ''finance'', ''technician'') THEN';
  v_new    text := 'IF v_role NOT IN (''admin'', ''finance'', ''technician'', ''supervisor'') THEN';
  v_hits   int;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_tech_commission_recap';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'public.get_tech_commission_recap not found';
  END IF;

  IF position(v_new IN v_def) > 0 THEN
    RAISE NOTICE 'get_tech_commission_recap already allows supervisor - skipping';
    RETURN;
  END IF;

  v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  IF v_hits <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly 1 occurrence of the role guard in get_tech_commission_recap, found %. Function has drifted - inspect before re-running.', v_hits;
  END IF;

  EXECUTE replace(v_def, v_old, v_new);
  RAISE NOTICE 'get_tech_commission_recap: supervisor added';
END
$mig$;

-- ── 2. get_marketing_commission_recap: allow technician ──────────────────────
DO $mig$
DECLARE
  v_def    text;
  v_old    text := 'IF v_role NOT IN (''admin'', ''finance'', ''supervisor'', ''marketing'', ''tro'') THEN';
  v_new    text := 'IF v_role NOT IN (''admin'', ''finance'', ''supervisor'', ''marketing'', ''tro'', ''technician'') THEN';
  v_hits   int;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_marketing_commission_recap';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'public.get_marketing_commission_recap not found';
  END IF;

  IF position(v_new IN v_def) > 0 THEN
    RAISE NOTICE 'get_marketing_commission_recap already allows technician - skipping';
    RETURN;
  END IF;

  v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  IF v_hits <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly 1 occurrence of the role guard in get_marketing_commission_recap, found %. Function has drifted - inspect before re-running.', v_hits;
  END IF;

  EXECUTE replace(v_def, v_old, v_new);
  RAISE NOTICE 'get_marketing_commission_recap: technician added';
END
$mig$;

-- ── Verify ───────────────────────────────────────────────────────────────────
-- SELECT p.proname,
--        substring(p.prosrc from 'IF v_role NOT IN \(([^)]*)\)') AS allowed_roles
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN ('get_tech_commission_recap', 'get_marketing_commission_recap');
