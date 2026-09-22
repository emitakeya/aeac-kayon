-- =============================================================================
-- Migration: aeac_b2b_04_summary (B2B Prospek v1.3 — Ringkasan). Read-only RPC.
-- b2b_summary(p_from, p_to, p_origin)
--   p_from / p_to : Jakarta dates, inclusive. p_from NULL = since the first prospect.
--   p_origin      : 'all' | 'outbound' | 'inbound'
-- Stage numbers count a prospect in the period where it FIRST reached that
-- stage or higher (from status_to in the activity log, incl. the 'created' row).
-- Funnel/breakdown = cohort of prospects added in the period, by highest stage
-- ever reached (a prospect that hit Survei and was later Lost counts at Survei).
-- Archived prospects are excluded everywhere.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.b2b_summary(p_from date, p_to date, p_origin text DEFAULT 'all')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, property
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_first date;
  v_from  date;
  v_to    date := coalesce(p_to, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_out   jsonb;
BEGIN
  IF NOT public.b2b_can_access() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  SELECT min((created_at AT TIME ZONE 'Asia/Jakarta')::date) INTO v_first
  FROM b2b_prospects WHERE NOT is_archived;
  v_from := coalesce(p_from, v_first, v_today);

  WITH
  rank_map(status, rk) AS (VALUES
    ('new_lead',0),('pic_found',1),('contacted',2),('interested',3),
    ('survey',4),('quotation',5),('negotiation',6),('won',7)),
  p AS (
    SELECT pr.*, (pr.created_at AT TIME ZONE 'Asia/Jakarta')::date AS created_d
    FROM b2b_prospects pr
    WHERE NOT pr.is_archived
      AND (coalesce(p_origin,'all') = 'all' OR pr.lead_origin = p_origin)
  ),
  a AS (
    SELECT x.*, (x.activity_at AT TIME ZONE 'Asia/Jakarta')::date AS d, rm.rk
    FROM b2b_prospect_activities x
    JOIN p ON p.id = x.prospect_id
    LEFT JOIN rank_map rm ON rm.status = x.status_to
  ),
  -- first date each prospect reached rank >= r
  firsts AS (
    SELECT p.id,
      (SELECT min(d) FROM a WHERE a.prospect_id = p.id AND a.rk >= 1) AS d_pic,
      (SELECT min(d) FROM a WHERE a.prospect_id = p.id AND a.rk >= 4) AS d_survey,
      (SELECT min(d) FROM a WHERE a.prospect_id = p.id AND a.rk >= 5) AS d_quote,
      (SELECT min(d) FROM a WHERE a.prospect_id = p.id AND a.rk >= 7) AS d_won,
      (SELECT min(d) FROM a WHERE a.prospect_id = p.id AND a.status_to = 'lost') AS d_lost
    FROM p
  ),
  -- cohort: added in period, with highest rank ever reached
  cohort AS (
    SELECT p.id, p.category, p.area_id,
           greatest(coalesce((SELECT max(rk) FROM a WHERE a.prospect_id = p.id), 0),
                    coalesce((SELECT rk FROM rank_map WHERE status = p.status), 0)) AS max_rk
    FROM p WHERE p.created_d BETWEEN v_from AND v_to
  )
  SELECT jsonb_build_object(
    'from', v_from, 'to', v_to, 'first', v_first, 'today', v_today,
    'kpi', jsonb_build_object(
      'new',       (SELECT count(*) FROM p WHERE created_d BETWEEN v_from AND v_to),
      'visits',    (SELECT count(*) FROM a WHERE activity_type = 'visit' AND d BETWEEN v_from AND v_to),
      'contacts',  (SELECT count(*) FROM a WHERE activity_type IN ('visit','phone','whatsapp','email','meeting')
                                            AND d BETWEEN v_from AND v_to),
      'pic',       (SELECT count(*) FROM firsts WHERE d_pic    BETWEEN v_from AND v_to),
      'survey',    (SELECT count(*) FROM firsts WHERE d_survey BETWEEN v_from AND v_to),
      'quotation', (SELECT count(*) FROM firsts WHERE d_quote  BETWEEN v_from AND v_to),
      'won',       (SELECT count(*) FROM firsts WHERE d_won    BETWEEN v_from AND v_to),
      'lost',      (SELECT count(*) FROM firsts WHERE d_lost   BETWEEN v_from AND v_to)
    ),
    'funnel', jsonb_build_object(
      'prospects',  (SELECT count(*) FROM cohort),
      'pic',        (SELECT count(*) FROM cohort WHERE max_rk >= 1),
      'interested', (SELECT count(*) FROM cohort WHERE max_rk >= 3),
      'survey',     (SELECT count(*) FROM cohort WHERE max_rk >= 4),
      'quotation',  (SELECT count(*) FROM cohort WHERE max_rk >= 5),
      'won',        (SELECT count(*) FROM cohort WHERE max_rk >= 7)
    ),
    'followup', jsonb_build_object(
      'over',  (SELECT count(*) FROM p WHERE status NOT IN ('won','lost') AND next_followup_date <  v_today),
      'today', (SELECT count(*) FROM p WHERE status NOT IN ('won','lost') AND next_followup_date =  v_today),
      'none',  (SELECT count(*) FROM p WHERE status NOT IN ('won','lost') AND next_followup_date IS NULL)
    ),
    'lost_reasons', coalesce((
      SELECT jsonb_agg(jsonb_build_object('reason', r.lost_reason, 'n', r.n) ORDER BY r.n DESC)
      FROM (SELECT coalesce(p.lost_reason, 'other') AS lost_reason, count(*) AS n
            FROM p JOIN firsts f ON f.id = p.id
            WHERE p.status = 'lost' AND f.d_lost BETWEEN v_from AND v_to
            GROUP BY 1) r), '[]'::jsonb),
    'by_area', coalesce((
      SELECT jsonb_agg(jsonb_build_object('name', g.name, 'n', g.n, 'pic', g.pic, 'int', g.int_, 'won', g.won)
                       ORDER BY g.n DESC, g.name)
      FROM (SELECT ar.name, count(*) AS n,
                   count(*) FILTER (WHERE c.max_rk >= 1) AS pic,
                   count(*) FILTER (WHERE c.max_rk >= 3) AS int_,
                   count(*) FILTER (WHERE c.max_rk >= 7) AS won
            FROM cohort c JOIN b2b_areas ar ON ar.id = c.area_id GROUP BY ar.name) g), '[]'::jsonb),
    'by_category', coalesce((
      SELECT jsonb_agg(jsonb_build_object('name', g.category, 'n', g.n, 'pic', g.pic, 'int', g.int_, 'won', g.won)
                       ORDER BY g.n DESC, g.category)
      FROM (SELECT c.category, count(*) AS n,
                   count(*) FILTER (WHERE c.max_rk >= 1) AS pic,
                   count(*) FILTER (WHERE c.max_rk >= 3) AS int_,
                   count(*) FILTER (WHERE c.max_rk >= 7) AS won
            FROM cohort c GROUP BY c.category) g), '[]'::jsonb)
  ) INTO v_out;

  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.b2b_summary(date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.b2b_summary(date, date, text) TO authenticated;
