-- =============================================================================
-- Migration: aeac_b2b_02_v11  (B2B Prospek v1.1) — ADDITIVE / b2b_* only.
--  1. Per-type AC unit counts: b2b_prospects.ac_units jsonb {"split":20,"cassette":2}
--     estimated_units = sum of ac_units when any count is given, else manual total.
--  2. Lead origin: b2b_prospects.lead_origin 'outbound' (kami) | 'inbound' (mereka)
--     + new source 'website'.
--  3. New activity type 'order' (e.g. trial order via normal booking).
-- =============================================================================

ALTER TABLE public.b2b_prospects
  ADD COLUMN IF NOT EXISTS ac_units jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lead_origin text;

ALTER TABLE public.b2b_prospects DROP CONSTRAINT IF EXISTS b2b_prospects_lead_origin_check;
ALTER TABLE public.b2b_prospects ADD CONSTRAINT b2b_prospects_lead_origin_check
  CHECK (lead_origin IS NULL OR lead_origin IN ('outbound','inbound'));

ALTER TABLE public.b2b_prospects DROP CONSTRAINT IF EXISTS b2b_prospects_source_check;
ALTER TABLE public.b2b_prospects ADD CONSTRAINT b2b_prospects_source_check
  CHECK (source IS NULL OR source IN ('walk_in','google_maps','website','referral','spreadsheet','other'));

ALTER TABLE public.b2b_prospect_activities DROP CONSTRAINT IF EXISTS b2b_prospect_activities_activity_type_check;
ALTER TABLE public.b2b_prospect_activities ADD CONSTRAINT b2b_prospect_activities_activity_type_check
  CHECK (activity_type IN ('created','visit','phone','whatsapp','email','followup',
                           'survey','quotation','meeting','order','note','other'));

-- Keep only known AC keys with positive integer counts.
CREATE OR REPLACE FUNCTION public.b2b_clean_ac_units(p jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(jsonb_object_agg(e.key, (e.value #>> '{}')::int), '{}'::jsonb)
  FROM jsonb_each(CASE WHEN jsonb_typeof(p) = 'object' THEN p ELSE '{}'::jsonb END) e
  WHERE e.key IN ('split','cassette','duct','central','standing','lainnya')
    AND (e.value #>> '{}') ~ '^\d{1,5}$'
    AND (e.value #>> '{}')::int > 0;
$$;

CREATE OR REPLACE FUNCTION public.b2b_save_prospect(p jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, property
AS $$
DECLARE
  v_id     uuid := nullif(p->>'id', '')::uuid;
  v_area   uuid;
  v_staff  uuid[];
  v_status text := coalesce(nullif(p->>'status', ''), 'new_lead');
  v_ac     text[];
  v_units  jsonb;
  v_total  int;
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
  v_units := public.b2b_clean_ac_units(p->'ac_units');
  -- types = chips selected + any type that has a count
  SELECT coalesce(array_agg(DISTINCT t), '{}') INTO v_ac FROM (
    SELECT jsonb_array_elements_text(coalesce(p->'ac_types', '[]'::jsonb)) t
    UNION SELECT jsonb_object_keys(v_units)
  ) s;
  SELECT sum(value::int) INTO v_total FROM jsonb_each_text(v_units);
  v_total := coalesce(v_total, nullif(p->>'estimated_units', '')::int);

  IF v_id IS NULL THEN
    INSERT INTO b2b_prospects (
      business_name, category, area_id, address, maps_url, phone,
      pic_name, pic_position, pic_phone, pic_email,
      ac_types, ac_units, estimated_units, existing_vendor, vendor_price_notes, needs,
      lead_origin, source, status, staff_ids, next_followup_date, followup_note, created_by)
    VALUES (
      btrim(p->>'business_name'), p->>'category', v_area,
      nullif(btrim(p->>'address'), ''), nullif(btrim(p->>'maps_url'), ''), nullif(btrim(p->>'phone'), ''),
      nullif(btrim(p->>'pic_name'), ''), nullif(btrim(p->>'pic_position'), ''),
      nullif(btrim(p->>'pic_phone'), ''), nullif(btrim(p->>'pic_email'), ''),
      v_ac, v_units, v_total,
      coalesce(nullif(p->>'existing_vendor', ''), 'unknown'),
      nullif(btrim(p->>'vendor_price_notes'), ''), nullif(btrim(p->>'needs'), ''),
      nullif(p->>'lead_origin', ''), nullif(p->>'source', ''), v_status, v_staff, v_fu,
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
      ac_units           = v_units,
      estimated_units    = v_total,
      existing_vendor    = coalesce(nullif(p->>'existing_vendor', ''), 'unknown'),
      vendor_price_notes = nullif(btrim(p->>'vendor_price_notes'), ''),
      needs              = nullif(btrim(p->>'needs'), ''),
      lead_origin        = nullif(p->>'lead_origin', ''),
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

REVOKE EXECUTE ON FUNCTION public.b2b_clean_ac_units(jsonb) FROM PUBLIC, anon, authenticated;
