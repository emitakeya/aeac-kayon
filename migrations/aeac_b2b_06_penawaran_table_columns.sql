-- =============================================================================
-- Migration: aeac_b2b_06_penawaran_table_columns (B2B v1.5) — applied live.
-- Keeps per-table column switches (show_normal / show_price) on proposal blocks.
-- CREATE OR REPLACE keeps existing grants (service_role only; internal helper).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.b2b_clean_proposal_blocks(p jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id',          left(coalesce(nullif(x->>'id',''), md5(ord::text)), 40),
           'kind',        CASE WHEN x->>'kind' IN ('text','list','table','callout') THEN x->>'kind' ELSE 'text' END,
           'title',       left(coalesce(x->>'title',''), 120),
           'text',        left(coalesce(x->>'text',''), 5000),
           'visible',     coalesce((x->>'visible')::boolean, true),
           'show_normal', coalesce((x->>'show_normal')::boolean, true),
           'show_price',  coalesce((x->>'show_price')::boolean, true)
         ) ORDER BY ord), '[]'::jsonb)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p) = 'array' THEN p ELSE '[]'::jsonb END)
       WITH ORDINALITY AS t(x, ord)
  WHERE jsonb_typeof(x) = 'object';
$$;
