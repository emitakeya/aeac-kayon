-- Migration: aeac_kayon_get_staff_onboarding_list
-- Returns merged staff list (technicians + marketing + tro + existing user_roles)
-- with auth status. Used by /akun-staff page.
--
-- Admin only. Calls auth.users to enrich with last_sign_in_at.
-- SECURITY DEFINER bypasses RLS; internal role check enforces admin-only.

DROP FUNCTION IF EXISTS public.get_staff_onboarding_list();

CREATE OR REPLACE FUNCTION public.get_staff_onboarding_list()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'property', 'auth'
AS $$
DECLARE
  v_role text;
BEGIN
  -- Internal role check: admin only
  SELECT role INTO v_role
  FROM property.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_role IS NULL OR v_role <> 'admin' THEN
    RAISE EXCEPTION 'Akses ditolak: hanya admin yang bisa membuka halaman ini'
      USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'staff', COALESCE(jsonb_agg(s ORDER BY s.role_order, s.team_code NULLS LAST, s.name), '[]'::jsonb)
    )
    FROM (
      -- Technicians from public.technicians
      SELECT
        t.id::text                                    AS source_id,
        'technician'                                  AS source_table,
        UPPER(t.name)                                 AS staff_name,
        COALESCE(t.name, '')                          AS name,
        LOWER(TRIM(t.email))                          AS email,
        'technician'                                  AS role,
        1                                             AS role_order,
        NULL::text                                    AS team_code,
        au.id IS NOT NULL                             AS has_auth,
        au.id::text                                   AS auth_user_id,
        au.last_sign_in_at                            AS last_sign_in_at,
        au.created_at                                 AS auth_created_at,
        ur.role IS NOT NULL                           AS has_role
      FROM public.technicians t
      LEFT JOIN auth.users au
        ON LOWER(TRIM(au.email)) = LOWER(TRIM(t.email))
      LEFT JOIN property.user_roles ur
        ON ur.user_id = au.id AND ur.role = 'technician'
      WHERE t.is_active = true
        AND t.email IS NOT NULL
        AND TRIM(t.email) <> ''

      UNION ALL

      -- Marketing from property.staff_marketing
      SELECT
        sm.id::text                                   AS source_id,
        'staff_marketing'                             AS source_table,
        UPPER(sm.name)                                AS staff_name,
        COALESCE(sm.short_name, sm.name)              AS name,
        LOWER(TRIM(sm.email))                         AS email,
        'marketing'                                   AS role,
        2                                             AS role_order,
        sm.team_code                                  AS team_code,
        au.id IS NOT NULL                             AS has_auth,
        au.id::text                                   AS auth_user_id,
        au.last_sign_in_at                            AS last_sign_in_at,
        au.created_at                                 AS auth_created_at,
        ur.role IS NOT NULL                           AS has_role
      FROM property.staff_marketing sm
      LEFT JOIN auth.users au
        ON LOWER(TRIM(au.email)) = LOWER(TRIM(sm.email))
      LEFT JOIN property.user_roles ur
        ON ur.user_id = au.id AND ur.role = 'marketing'
      WHERE sm.active = true
        AND sm.email IS NOT NULL
        AND TRIM(sm.email) <> ''

      UNION ALL

      -- TRO from property.staff_tro
      SELECT
        st.id::text                                   AS source_id,
        'staff_tro'                                   AS source_table,
        UPPER(st.name)                                AS staff_name,
        COALESCE(st.short_name, st.name)              AS name,
        LOWER(TRIM(st.email))                         AS email,
        'tro'                                         AS role,
        3                                             AS role_order,
        st.team_code                                  AS team_code,
        au.id IS NOT NULL                             AS has_auth,
        au.id::text                                   AS auth_user_id,
        au.last_sign_in_at                            AS last_sign_in_at,
        au.created_at                                 AS auth_created_at,
        ur.role IS NOT NULL                           AS has_role
      FROM property.staff_tro st
      LEFT JOIN auth.users au
        ON LOWER(TRIM(au.email)) = LOWER(TRIM(st.email))
      LEFT JOIN property.user_roles ur
        ON ur.user_id = au.id AND ur.role = 'tro'
      WHERE st.active = true
        AND st.email IS NOT NULL
        AND TRIM(st.email) <> ''

      UNION ALL

      -- Existing admin/finance/supervisor user_roles (no staff table source)
      -- Read-only on this page. Show so admin can see full picture + send magic links.
      SELECT
        ur.id::text                                   AS source_id,
        'user_roles'                                  AS source_table,
        ur.staff_name                                 AS staff_name,
        COALESCE(NULLIF(INITCAP(ur.staff_name), ''), au.email) AS name,
        LOWER(TRIM(au.email))                         AS email,
        ur.role                                       AS role,
        CASE ur.role
          WHEN 'admin' THEN 0
          WHEN 'finance' THEN 4
          WHEN 'supervisor' THEN 5
          ELSE 9
        END                                           AS role_order,
        NULL::text                                    AS team_code,
        true                                          AS has_auth,
        au.id::text                                   AS auth_user_id,
        au.last_sign_in_at                            AS last_sign_in_at,
        au.created_at                                 AS auth_created_at,
        true                                          AS has_role
      FROM property.user_roles ur
      JOIN auth.users au ON au.id = ur.user_id
      WHERE ur.role IN ('admin', 'finance', 'supervisor')
    ) s
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_onboarding_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_onboarding_list() TO authenticated;

COMMENT ON FUNCTION public.get_staff_onboarding_list() IS
'Returns merged staff onboarding list: technicians, marketing, tro from staff tables + admin/finance/supervisor from user_roles. Admin only. Used by /akun-staff page in Kayon.';
