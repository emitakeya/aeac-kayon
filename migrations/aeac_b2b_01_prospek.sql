-- =============================================================================
-- Migration: aeac_b2b_01_prospek
-- B2B Prospek pilot (Kayon /b2b). ADDITIVE ONLY.
-- New objects: b2b_areas, b2b_prospects, b2b_prospect_activities + RPCs.
-- Touches nothing existing (orders, invoices, customers, locations,
-- v_current_user, property.user_roles are read-only here).
-- Access: v_current_user.can_admin OR can_view_finance
--         (admin, finance, supervisor).
-- Rollback: DROP the 3 tables (CASCADE) and the b2b_* functions.
-- =============================================================================

-- ---------- Tables -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.b2b_areas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (btrim(name) <> ''),
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS b2b_areas_name_uq
  ON public.b2b_areas (lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.b2b_prospects (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name       text NOT NULL CHECK (btrim(business_name) <> ''),
  category            text NOT NULL CHECK (category IN
                        ('resto','kantor','retail','klinik','salon','gym',
                         'sekolah','hotel','gedung','lainnya')),
  area_id             uuid NOT NULL REFERENCES public.b2b_areas(id),
  address             text,
  maps_url            text,
  phone               text,
  pic_name            text,
  pic_position        text,
  pic_phone           text,
  pic_email           text,
  ac_types            text[] NOT NULL DEFAULT '{}' CHECK (ac_types <@
                        ARRAY['split','cassette','duct','central','standing','lainnya']),
  estimated_units     integer CHECK (estimated_units IS NULL OR estimated_units >= 0),
  existing_vendor     text NOT NULL DEFAULT 'unknown'
                        CHECK (existing_vendor IN ('yes','no','unknown')),
  vendor_price_notes  text,
  needs               text,
  source              text CHECK (source IS NULL OR source IN
                        ('walk_in','google_maps','referral','spreadsheet','other')),
  status              text NOT NULL DEFAULT 'new_lead' CHECK (status IN
                        ('new_lead','pic_found','contacted','interested','survey',
                         'quotation','negotiation','won','lost')),
  lost_reason         text CHECK (lost_reason IS NULL OR lost_reason IN
                        ('price','has_vendor','no_response','no_need','closed','other')),
  staff_ids           uuid[] NOT NULL DEFAULT '{}',
  next_followup_date  date,
  followup_note       text,
  location_id         uuid REFERENCES public.locations(id),   -- future link, unused in V1
  is_archived         boolean NOT NULL DEFAULT false,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS b2b_prospects_status_idx   ON public.b2b_prospects (status);
CREATE INDEX IF NOT EXISTS b2b_prospects_area_idx     ON public.b2b_prospects (area_id);
CREATE INDEX IF NOT EXISTS b2b_prospects_followup_idx ON public.b2b_prospects (next_followup_date)
  WHERE NOT is_archived;
CREATE INDEX IF NOT EXISTS b2b_prospects_staff_idx    ON public.b2b_prospects USING gin (staff_ids);

CREATE TABLE IF NOT EXISTS public.b2b_prospect_activities (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id         uuid NOT NULL REFERENCES public.b2b_prospects(id) ON DELETE CASCADE,
  activity_type       text NOT NULL CHECK (activity_type IN
                        ('created','visit','phone','whatsapp','email','followup',
                         'survey','quotation','meeting','note','other')),
  activity_at         timestamptz NOT NULL DEFAULT now(),
  notes               text,
  staff_ids           uuid[] NOT NULL DEFAULT '{}',
  status_from         text,
  status_to           text,
  next_followup_date  date,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS b2b_activities_prospect_idx
  ON public.b2b_prospect_activities (prospect_id, activity_at DESC);

-- Locked down: no direct table access; everything goes through RPCs.
ALTER TABLE public.b2b_areas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_prospects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_prospect_activities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.b2b_areas, public.b2b_prospects, public.b2b_prospect_activities
  FROM anon, authenticated;

-- ---------- Helpers ----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.b2b_can_access()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, property
AS $$
  SELECT coalesce(bool_or(can_admin OR can_view_finance), false)
  FROM public.v_current_user;
$$;

-- user_id -> display name (any user_roles row, so either of a person's accounts resolves)
CREATE OR REPLACE FUNCTION public.b2b_staff_names(p_ids uuid[])
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, property
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name) ORDER BY x.ord), '[]'::jsonb)
  FROM (
    SELECT u.id, u.ord,
           coalesce((SELECT initcap(r.staff_name) FROM property.user_roles r
                     WHERE r.user_id = u.id AND r.staff_name IS NOT NULL LIMIT 1), '?') AS name
    FROM unnest(coalesce(p_ids, '{}')) WITH ORDINALITY AS u(id, ord)
  ) x;
$$;

-- ---------- Read RPCs --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.b2b_get_meta()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, property
AS $$
BEGIN
  IF NOT public.b2b_can_access() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'me', auth.uid(),
    'areas', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'count', a.cnt)
                       ORDER BY lower(a.name))
      FROM (
        SELECT ar.id, ar.name,
               (SELECT count(*) FROM b2b_prospects p
                 WHERE p.area_id = ar.id AND NOT p.is_archived) AS cnt
        FROM b2b_areas ar
      ) a), '[]'::jsonb),
    -- One entry per person (a person may have two logins); prefer the caller's own id.
    'staff', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', s.user_id, 'name', s.name) ORDER BY s.name)
      FROM (
        SELECT DISTINCT ON (upper(r.staff_name))
               r.user_id, initcap(r.staff_name) AS name
        FROM property.user_roles r
        WHERE r.role IN ('admin','finance','supervisor')
          AND r.user_id IS NOT NULL AND r.staff_name IS NOT NULL
        ORDER BY upper(r.staff_name), (r.user_id = auth.uid()) DESC, r.user_id
      ) s), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.b2b_list_prospects()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, property
AS $$
BEGIN
  IF NOT public.b2b_can_access() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.next_followup_date NULLS LAST, t.business_name)
    FROM (
      SELECT p.id, p.business_name, p.category, p.area_id, a.name AS area_name,
             p.pic_name, p.pic_position, p.pic_phone, p.status,
             p.staff_ids, public.b2b_staff_names(p.staff_ids) AS staff,
             p.next_followup_date, p.followup_note, p.updated_at,
             la.activity_at AS last_activity_at, la.activity_type AS last_activity_type
      FROM b2b_prospects p
      JOIN b2b_areas a ON a.id = p.area_id
      LEFT JOIN LATERAL (
        SELECT x.activity_at, x.activity_type
        FROM b2b_prospect_activities x
        WHERE x.prospect_id = p.id AND x.activity_type <> 'created'
        ORDER BY x.activity_at DESC LIMIT 1
      ) la ON true
      WHERE NOT p.is_archived
    ) t), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.b2b_get_prospect(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, property
AS $$
DECLARE
  v_row jsonb;
BEGIN
  IF NOT public.b2b_can_access() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(p) || jsonb_build_object(
           'area_name', a.name,
           'staff', public.b2b_staff_names(p.staff_ids))
    INTO v_row
  FROM b2b_prospects p JOIN b2b_areas a ON a.id = p.area_id
  WHERE p.id = p_id;

  IF v_row IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'prospect', v_row,
    'activities', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', x.id, 'activity_type', x.activity_type, 'activity_at', x.activity_at,
               'notes', x.notes, 'status_from', x.status_from, 'status_to', x.status_to,
               'next_followup_date', x.next_followup_date,
               'staff', public.b2b_staff_names(x.staff_ids),
               'created_by_name', (public.b2b_staff_names(ARRAY[x.created_by])->0->>'name'))
             ORDER BY x.activity_at DESC, x.created_at DESC)
      FROM b2b_prospect_activities x WHERE x.prospect_id = p_id), '[]'::jsonb)
  );
END;
$$;

-- ---------- Write RPCs -------------------------------------------------------

-- Validate staff ids against user_roles (admin/finance/supervisor), keep order, dedupe.
CREATE OR REPLACE FUNCTION public.b2b_clean_staff(p jsonb)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, property
AS $$
  SELECT coalesce(array_agg(s.id ORDER BY s.ord), '{}')
  FROM (
    SELECT DISTINCT ON (e.v::uuid) e.v::uuid AS id, e.ord
    FROM jsonb_array_elements_text(coalesce(p, '[]'::jsonb)) WITH ORDINALITY AS e(v, ord)
    WHERE EXISTS (SELECT 1 FROM property.user_roles r
                  WHERE r.user_id = e.v::uuid AND r.role IN ('admin','finance','supervisor'))
    ORDER BY e.v::uuid, e.ord
  ) s;
$$;

-- Resolve area by id, or by name (created if new, case-insensitive match).
CREATE OR REPLACE FUNCTION public.b2b_resolve_area(p_area_id uuid, p_area_name text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, property
AS $$
DECLARE
  v_id   uuid;
  v_name text := nullif(regexp_replace(btrim(coalesce(p_area_name, '')), '\s+', ' ', 'g'), '');
BEGIN
  IF p_area_id IS NOT NULL THEN
    SELECT id INTO v_id FROM b2b_areas WHERE id = p_area_id;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Area wajib diisi';
  END IF;
  SELECT id INTO v_id FROM b2b_areas WHERE lower(btrim(name)) = lower(v_name);
  IF v_id IS NULL THEN
    INSERT INTO b2b_areas (name, created_by) VALUES (v_name, auth.uid())
    ON CONFLICT (lower(btrim(name))) DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      SELECT id INTO v_id FROM b2b_areas WHERE lower(btrim(name)) = lower(v_name);
    END IF;
  END IF;
  RETURN v_id;
END;
$$;

-- Create (no id) or update (id) a prospect. Status is set only on create;
-- afterwards it changes through b2b_log_activity so every change is logged.
CREATE OR REPLACE FUNCTION public.b2b_save_prospect(p jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, property
AS $$
DECLARE
  v_id     uuid := nullif(p->>'id', '')::uuid;
  v_area   uuid;
  v_staff  uuid[];
  v_status text := coalesce(nullif(p->>'status', ''), 'new_lead');
  v_ac     text[];
  v_fu     date := nullif(p->>'next_followup_date', '')::date;
BEGIN
  IF NOT public.b2b_can_access() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p->>'business_name', '')), '') IS NULL THEN
    RAISE EXCEPTION 'Nama bisnis wajib diisi';
  END IF;

  v_area  := public.b2b_resolve_area(nullif(p->>'area_id', '')::uuid, p->>'area_name');
  v_staff := public.b2b_clean_staff(p->'staff_ids');
  SELECT coalesce(array_agg(DISTINCT e), '{}') INTO v_ac
    FROM jsonb_array_elements_text(coalesce(p->'ac_types', '[]'::jsonb)) e;

  IF v_id IS NULL THEN
    INSERT INTO b2b_prospects (
      business_name, category, area_id, address, maps_url, phone,
      pic_name, pic_position, pic_phone, pic_email,
      ac_types, estimated_units, existing_vendor, vendor_price_notes, needs,
      source, status, staff_ids, next_followup_date, followup_note, created_by)
    VALUES (
      btrim(p->>'business_name'), p->>'category', v_area,
      nullif(btrim(p->>'address'), ''), nullif(btrim(p->>'maps_url'), ''), nullif(btrim(p->>'phone'), ''),
      nullif(btrim(p->>'pic_name'), ''), nullif(btrim(p->>'pic_position'), ''),
      nullif(btrim(p->>'pic_phone'), ''), nullif(btrim(p->>'pic_email'), ''),
      v_ac, nullif(p->>'estimated_units', '')::int,
      coalesce(nullif(p->>'existing_vendor', ''), 'unknown'),
      nullif(btrim(p->>'vendor_price_notes'), ''), nullif(btrim(p->>'needs'), ''),
      nullif(p->>'source', ''), v_status, v_staff, v_fu,
      nullif(btrim(p->>'followup_note'), ''), auth.uid())
    RETURNING id INTO v_id;

    INSERT INTO b2b_prospect_activities
      (prospect_id, activity_type, notes, staff_ids, status_to, next_followup_date, created_by)
    VALUES (v_id, 'created', 'Prospek dibuat', ARRAY[auth.uid()], v_status, v_fu, auth.uid());
  ELSE
    UPDATE b2b_prospects SET
      business_name      = btrim(p->>'business_name'),
      category           = p->>'category',
      area_id            = v_area,
      address            = nullif(btrim(p->>'address'), ''),
      maps_url           = nullif(btrim(p->>'maps_url'), ''),
      phone              = nullif(btrim(p->>'phone'), ''),
      pic_name           = nullif(btrim(p->>'pic_name'), ''),
      pic_position       = nullif(btrim(p->>'pic_position'), ''),
      pic_phone          = nullif(btrim(p->>'pic_phone'), ''),
      pic_email          = nullif(btrim(p->>'pic_email'), ''),
      ac_types           = v_ac,
      estimated_units    = nullif(p->>'estimated_units', '')::int,
      existing_vendor    = coalesce(nullif(p->>'existing_vendor', ''), 'unknown'),
      vendor_price_notes = nullif(btrim(p->>'vendor_price_notes'), ''),
      needs              = nullif(btrim(p->>'needs'), ''),
      source             = nullif(p->>'source', ''),
      staff_ids          = v_staff,
      is_archived        = coalesce((p->>'is_archived')::boolean, is_archived),
      updated_at         = now()
    WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Prospek tidak ditemukan';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

-- Log an activity. Also (atomically) changes status if status_to given, and
-- replaces the next follow-up (null = no follow-up planned).
CREATE OR REPLACE FUNCTION public.b2b_log_activity(p jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, property
AS $$
DECLARE
  v_pid    uuid := (p->>'prospect_id')::uuid;
  v_old    text;
  v_new    text := nullif(p->>'status_to', '');
  v_staff  uuid[];
  v_fu     date := nullif(p->>'next_followup_date', '')::date;
  v_id     uuid;
BEGIN
  IF NOT public.b2b_can_access() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_old FROM b2b_prospects WHERE id = v_pid FOR UPDATE;
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'Prospek tidak ditemukan';
  END IF;
  IF v_new = v_old THEN v_new := NULL; END IF;
  IF v_new = 'lost' AND nullif(p->>'lost_reason', '') IS NULL THEN
    RAISE EXCEPTION 'Alasan gagal wajib dipilih';
  END IF;

  v_staff := public.b2b_clean_staff(p->'staff_ids');
  IF cardinality(v_staff) = 0 THEN v_staff := ARRAY[auth.uid()]; END IF;

  INSERT INTO b2b_prospect_activities
    (prospect_id, activity_type, activity_at, notes, staff_ids,
     status_from, status_to, next_followup_date, created_by)
  VALUES
    (v_pid, p->>'activity_type',
     coalesce(nullif(p->>'activity_at', '')::timestamptz, now()),
     nullif(btrim(p->>'notes'), ''), v_staff,
     CASE WHEN v_new IS NOT NULL THEN v_old END, v_new, v_fu, auth.uid())
  RETURNING id INTO v_id;

  UPDATE b2b_prospects SET
    status             = coalesce(v_new, status),
    lost_reason        = CASE WHEN coalesce(v_new, status) = 'lost'
                              THEN coalesce(nullif(p->>'lost_reason', ''), lost_reason)
                              ELSE NULL END,
    next_followup_date = CASE WHEN coalesce(v_new, status) IN ('won','lost') THEN NULL ELSE v_fu END,
    followup_note      = CASE WHEN coalesce(v_new, status) IN ('won','lost') THEN NULL
                              ELSE nullif(btrim(p->>'followup_note'), '') END,
    updated_at         = now()
  WHERE id = v_pid;

  RETURN v_id;
END;
$$;

-- ---------- Grants -----------------------------------------------------------

REVOKE ALL ON FUNCTION
  public.b2b_can_access(), public.b2b_staff_names(uuid[]), public.b2b_get_meta(),
  public.b2b_list_prospects(), public.b2b_get_prospect(uuid), public.b2b_clean_staff(jsonb),
  public.b2b_resolve_area(uuid, text), public.b2b_save_prospect(jsonb), public.b2b_log_activity(jsonb)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.b2b_get_meta(), public.b2b_list_prospects(), public.b2b_get_prospect(uuid),
  public.b2b_save_prospect(jsonb), public.b2b_log_activity(jsonb)
  TO authenticated;

-- Applied right after the migration: Supabase default privileges grant EXECUTE
-- to `authenticated` directly, so helpers must be revoked from it explicitly.
REVOKE EXECUTE ON FUNCTION
  public.b2b_can_access(), public.b2b_staff_names(uuid[]),
  public.b2b_clean_staff(jsonb), public.b2b_resolve_area(uuid, text)
  FROM authenticated;
