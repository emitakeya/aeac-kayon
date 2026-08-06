-- =============================================================================
-- Migration: aeac_kayon_supervisor_full_admin
-- Date: 2026-08-06
-- =============================================================================
-- Grants the `supervisor` role (Kawase, Sakai) the same capability set as
-- `admin`. Previously supervisor only had can_view_mm.
--
--   can_admin            admin                        -> admin, supervisor
--   can_view_finance     admin, finance               -> admin, finance, supervisor
--   can_view_mm          (unchanged - already had supervisor)
--   can_view_tech_pages  admin, finance, technician   -> + supervisor
--
-- ⚠️ Blast radius: 12 functions read v_current_user, ALL in the `public`
--    schema (cancel_order, create_invoice, create_staff_order,
--    get_bookings_confirmed, get_cancellable_orders, get_commission_saldo,
--    get_invoice_admin_data, get_laporan_initial_data, get_order_for_invoicing,
--    get_session_availability, get_staff_booking_context, mark_invoice_paid).
--    Nothing in the shared `property` schema reads it, so MM Property is
--    unaffected.
--
-- ⚠️ can_admin also gates /akun-staff, which creates and modifies staff auth
--    accounts using the service-role key. Confirmed intentional.
--
-- The view body is otherwise byte-identical to the live definition captured
-- on 2026-08-06 — only the four capability expressions changed.
-- =============================================================================

CREATE OR REPLACE VIEW public.v_current_user AS
 SELECT au.id AS user_id,
    lower(au.email::text) AS email,
    ur.role,
    ur.staff_name,
    t.id AS technician_id,
    t.name AS technician_name,
    e.team_code,
    ur.role = ANY (ARRAY['admin'::text, 'supervisor'::text]) AS can_admin,
    ur.role = ANY (ARRAY['admin'::text, 'finance'::text, 'supervisor'::text]) AS can_view_finance,
    ur.role = ANY (ARRAY['admin'::text, 'finance'::text, 'marketing'::text, 'tro'::text, 'supervisor'::text]) AS can_view_mm,
    ur.role = ANY (ARRAY['admin'::text, 'finance'::text, 'technician'::text, 'supervisor'::text]) AS can_view_tech_pages
   FROM auth.users au
     JOIN property.user_roles ur ON ur.user_id = au.id
     LEFT JOIN technicians t
       ON ur.role = 'technician'::text
      AND lower(TRIM(BOTH FROM t.email)) = lower(TRIM(BOTH FROM au.email))
      AND t.is_active = true
     LEFT JOIN earners e
       ON ur.role = 'marketing'::text
      AND e.type = 'marketing'::text
      AND e.active = true
      AND upper("left"(TRIM(BOTH FROM ur.staff_name), 3)) = upper(TRIM(BOTH FROM e.team_code))
  WHERE au.id = auth.uid();

-- Re-assert security + grants (CREATE OR REPLACE preserves these, but this
-- makes the migration self-contained and safe to re-run).
ALTER VIEW public.v_current_user SET (security_invoker = false);
REVOKE ALL ON public.v_current_user FROM anon;
REVOKE ALL ON public.v_current_user FROM authenticated;
GRANT SELECT ON public.v_current_user TO authenticated;

-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect: supervisor row shows t/t/t/t
--
-- SELECT r.role,
--        r.role = ANY (ARRAY['admin','supervisor'])                            AS can_admin,
--        r.role = ANY (ARRAY['admin','finance','supervisor'])                   AS can_view_finance,
--        r.role = ANY (ARRAY['admin','finance','marketing','tro','supervisor'])  AS can_view_mm,
--        r.role = ANY (ARRAY['admin','finance','technician','supervisor'])       AS can_view_tech_pages
-- FROM (SELECT DISTINCT role FROM property.user_roles) r ORDER BY r.role;
