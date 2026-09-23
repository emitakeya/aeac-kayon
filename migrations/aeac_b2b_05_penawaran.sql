-- =============================================================================
-- Migration: aeac_b2b_05_penawaran (B2B v1.4 — Penawaran)
-- ADDITIVE ONLY. New: b2b_proposals + b2b_*_proposal RPCs.
-- Proposals are drafted per prospect from a template (templates live in code,
-- lib/b2b-penawaran.ts). Content is stored as edited (blocks + items); the total
-- is always recomputed here. Nothing is ever sent by the system: "mark sent"
-- only records that staff sent the PDF themselves, via b2b_log_activity().
-- Access: b2b_can_access() (admin, finance, supervisor), same as Prospek.
-- Rollback: DROP TABLE public.b2b_proposals CASCADE; DROP the 5 functions.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.b2b_proposals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id    uuid NOT NULL REFERENCES public.b2b_prospects(id) ON DELETE CASCADE,
  template       text NOT NULL CHECK (template IN ('perkenalan','uji_coba','harga')),
  title          text NOT NULL DEFAULT 'Penawaran Perawatan AC',
  recipient      text,
  proposal_date  date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  valid_until    date,
  sender_name    text,
  sender_phone   text,
  blocks         jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(blocks) = 'array'),
  items          jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(items) = 'array'),
  total          bigint NOT NULL DEFAULT 0 CHECK (total >= 0),
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent')),
  sent_at        timestamptz,
  activity_id    uuid REFERENCES public.b2b_prospect_activities(id) ON DELETE SET NULL,
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS b2b_proposals_prospect_idx ON public.b2b_proposals (prospect_id, created_at DESC);

ALTER TABLE public.b2b_proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.b2b_proposals FROM PUBLIC, anon, authenticated;

-- ---------- Helpers ----------------------------------------------------------

-- Keep only well-formed price rows; qty/price are whole numbers >= 0.
CREATE OR REPLACE FUNCTION public.b2b_clean_proposal_items(p jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'label',        left(btrim(coalesce(x->>'label','')), 200),
           'qty',          greatest(0, coalesce(nullif(regexp_replace(coalesce(x->>'qty',''), '\D', '', 'g'), '')::bigint, 0)),
           'normal_price', left(btrim(coalesce(x->>'normal_price','')), 80),
           'price',        greatest(0, coalesce(nullif(regexp_replace(coalesce(x->>'price',''), '\D', '', 'g'), '')::bigint, 0))
         ) ORDER BY ord), '[]'::jsonb)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p) = 'array' THEN p ELSE '[]'::jsonb END)
       WITH ORDINALITY AS t(x, ord)
  WHERE jsonb_typeof(x) = 'object' AND btrim(coalesce(x->>'label','')) <> '';
$$;

CREATE OR REPLACE FUNCTION public.b2b_clean_proposal_blocks(p jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id',      left(coalesce(nullif(x->>'id',''), md5(ord::text)), 40),
           'kind',    CASE WHEN x->>'kind' IN ('text','list','table','callout') THEN x->>'kind' ELSE 'text' END,
           'title',   left(coalesce(x->>'title',''), 120),
           'text',    left(coalesce(x->>'text',''), 5000),
           'visible', coalesce((x->>'visible')::boolean, true)
         ) ORDER BY ord), '[]'::jsonb)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p) = 'array' THEN p ELSE '[]'::jsonb END)
       WITH ORDINALITY AS t(x, ord)
  WHERE jsonb_typeof(x) = 'object';
$$;

-- ---------- Save (insert or update) ------------------------------------------

CREATE OR REPLACE FUNCTION public.b2b_save_proposal(p jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, property
AS $$
DECLARE
  v_id     uuid := nullif(p->>'id','')::uuid;
  v_pid    uuid := nullif(p->>'prospect_id','')::uuid;
  v_items  jsonb := public.b2b_clean_proposal_items(p->'items');
  v_blocks jsonb := public.b2b_clean_proposal_blocks(p->'blocks');
  v_total  bigint;
BEGIN
  IF NOT public.b2b_can_access() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(sum((i->>'qty')::bigint * (i->>'price')::bigint), 0)
    INTO v_total FROM jsonb_array_elements(v_items) i;

  IF v_id IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM b2b_prospects WHERE id = v_pid AND NOT is_archived) THEN
      RAISE EXCEPTION 'Prospek tidak ditemukan';
    END IF;
    INSERT INTO b2b_proposals
      (prospect_id, template, title, recipient, proposal_date, valid_until,
       sender_name, sender_phone, blocks, items, total, created_by, updated_by)
    VALUES
      (v_pid, p->>'template',
       coalesce(nullif(btrim(p->>'title'),''), 'Penawaran Perawatan AC'),
       nullif(btrim(p->>'recipient'),''),
       coalesce(nullif(p->>'proposal_date','')::date, (now() AT TIME ZONE 'Asia/Jakarta')::date),
       nullif(p->>'valid_until','')::date,
       nullif(btrim(p->>'sender_name'),''), nullif(btrim(p->>'sender_phone'),''),
       v_blocks, v_items, v_total, auth.uid(), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE b2b_proposals SET
      template      = p->>'template',
      title         = coalesce(nullif(btrim(p->>'title'),''), 'Penawaran Perawatan AC'),
      recipient     = nullif(btrim(p->>'recipient'),''),
      proposal_date = coalesce(nullif(p->>'proposal_date','')::date, proposal_date),
      valid_until   = nullif(p->>'valid_until','')::date,
      sender_name   = nullif(btrim(p->>'sender_name'),''),
      sender_phone  = nullif(btrim(p->>'sender_phone'),''),
      blocks        = v_blocks,
      items         = v_items,
      total         = v_total,
      updated_by    = auth.uid(),
      updated_at    = now()
    WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Penawaran tidak ditemukan';
    END IF;
  END IF;
  RETURN v_id;
END;
$$;

-- ---------- Read -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.b2b_get_proposal(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, property
AS $$
DECLARE
  v jsonb;
BEGIN
  IF NOT public.b2b_can_access() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
           'proposal', to_jsonb(x) || jsonb_build_object(
              'created_by_name', public.b2b_staff_names(ARRAY[x.created_by])->0->>'name',
              'updated_by_name', public.b2b_staff_names(ARRAY[x.updated_by])->0->>'name'),
           'prospect', jsonb_build_object(
              'id', p.id, 'business_name', p.business_name, 'address', p.address,
              'pic_name', p.pic_name, 'pic_phone', p.pic_phone, 'status', p.status,
              'area_name', a.name, 'is_archived', p.is_archived))
    INTO v
  FROM b2b_proposals x
  JOIN b2b_prospects p ON p.id = x.prospect_id
  JOIN b2b_areas a ON a.id = p.area_id
  WHERE x.id = p_id;
  RETURN v;
END;
$$;

-- All proposals (p_prospect_id NULL) or one prospect's, newest first.
CREATE OR REPLACE FUNCTION public.b2b_list_proposals(p_prospect_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, property
AS $$
BEGIN
  IF NOT public.b2b_can_access() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', x.id, 'prospect_id', x.prospect_id, 'business_name', p.business_name,
             'template', x.template, 'proposal_date', x.proposal_date, 'valid_until', x.valid_until,
             'total', x.total, 'status', x.status, 'sent_at', x.sent_at, 'updated_at', x.updated_at,
             'updated_by_name', public.b2b_staff_names(ARRAY[x.updated_by])->0->>'name')
           ORDER BY x.proposal_date DESC, x.created_at DESC)
    FROM b2b_proposals x JOIN b2b_prospects p ON p.id = x.prospect_id
    WHERE (p_prospect_id IS NULL OR x.prospect_id = p_prospect_id)
      AND NOT p.is_archived), '[]'::jsonb);
END;
$$;

-- ---------- Record that staff sent it (manual) -------------------------------
-- Logs a 'quotation' activity through b2b_log_activity (same rules: status,
-- follow-up) and marks the proposal sent. Can be recorded again if re-sent.

CREATE OR REPLACE FUNCTION public.b2b_mark_proposal_sent(p jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, property
AS $$
DECLARE
  v_prop  b2b_proposals;
  v_act   uuid;
BEGIN
  IF NOT public.b2b_can_access() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_prop FROM b2b_proposals WHERE id = nullif(p->>'proposal_id','')::uuid FOR UPDATE;
  IF v_prop.id IS NULL THEN
    RAISE EXCEPTION 'Penawaran tidak ditemukan';
  END IF;

  v_act := public.b2b_log_activity(jsonb_build_object(
    'prospect_id',        v_prop.prospect_id,
    'activity_type',      'quotation',
    'activity_at',        p->>'activity_at',
    'notes',              coalesce(nullif(btrim(p->>'notes'),''),
                            'Penawaran dikirim · Rp ' || replace(to_char(v_prop.total, 'FM999,999,999,999'), ',', '.')),
    'staff_ids',          CASE WHEN jsonb_typeof(p->'staff_ids') = 'array' THEN p->'staff_ids' ELSE '[]'::jsonb END,
    'status_to',          p->>'status_to',
    'next_followup_date', p->>'next_followup_date',
    'followup_note',      p->>'followup_note'));

  UPDATE b2b_proposals SET status = 'sent', sent_at = now(), activity_id = v_act,
         updated_by = auth.uid(), updated_at = now()
  WHERE id = v_prop.id;
  RETURN v_act;
END;
$$;

-- Drafts only; a sent proposal is part of the prospect's history.
CREATE OR REPLACE FUNCTION public.b2b_delete_proposal(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, property
AS $$
BEGIN
  IF NOT public.b2b_can_access() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;
  DELETE FROM b2b_proposals WHERE id = p_id AND status = 'draft';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hanya draf yang bisa dihapus';
  END IF;
END;
$$;

-- ---------- Grants -----------------------------------------------------------

REVOKE ALL ON FUNCTION
  public.b2b_clean_proposal_items(jsonb), public.b2b_clean_proposal_blocks(jsonb),
  public.b2b_save_proposal(jsonb), public.b2b_get_proposal(uuid),
  public.b2b_list_proposals(uuid), public.b2b_mark_proposal_sent(jsonb),
  public.b2b_delete_proposal(uuid)
FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION
  public.b2b_clean_proposal_items(jsonb), public.b2b_clean_proposal_blocks(jsonb)
FROM authenticated;
GRANT EXECUTE ON FUNCTION
  public.b2b_save_proposal(jsonb), public.b2b_get_proposal(uuid),
  public.b2b_list_proposals(uuid), public.b2b_mark_proposal_sent(jsonb),
  public.b2b_delete_proposal(uuid)
TO authenticated;
