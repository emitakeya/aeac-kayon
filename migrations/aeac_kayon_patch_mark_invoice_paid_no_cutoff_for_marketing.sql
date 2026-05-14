-- Migration: aeac_kayon_patch_mark_invoice_paid_no_cutoff_for_marketing
--
-- Patch mark_invoice_paid (Kayon /invoice-admin manual reconcile path):
--   - TECH commissions: keep existing scheduled_date >= 2026-05-01 cutoff
--     (older tech work was settled via April quarterly payouts)
--   - MARKETING commission: ALWAYS run (delegate to helper that has no cutoff)
--
-- This fixes the gap where manual reconciles for older orders skipped
-- marketing commission creation entirely. With this patch, finance can
-- mark any invoice paid via /invoice-admin and the marketing commission
-- gets created correctly regardless of when the order was scheduled.

CREATE OR REPLACE FUNCTION public.mark_invoice_paid(p_invoice_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_can_view_finance boolean;
  v_can_admin boolean;
  v_invoice record;
  v_paid_date_id text;
  v_commission_result jsonb := NULL;
  v_marketing_result jsonb := NULL;
  v_post_cutoff_date date := DATE '2026-05-01';
  v_order_date date;
  v_id_months text[] := ARRAY[
    'Januari','Februari','Maret','April','Mei','Juni',
    'Juli','Agustus','September','Oktober','November','Desember'
  ];
BEGIN
  -- Role check
  SELECT can_view_finance, can_admin
    INTO v_can_view_finance, v_can_admin
  FROM public.v_current_user;

  IF (v_can_view_finance IS NOT TRUE) AND (v_can_admin IS NOT TRUE) THEN
    RAISE EXCEPTION 'akses ditolak: hanya untuk staf finance atau admin'
      USING ERRCODE = '42501';
  END IF;

  -- Load invoice
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invoice tidak ditemukan: id=%', p_invoice_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent
  IF v_invoice.status = 'paid' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_paid', true,
      'invoice_id', p_invoice_id
    );
  END IF;

  -- Format today as Indonesian
  v_paid_date_id :=
    EXTRACT(DAY FROM CURRENT_DATE)::int || ' '
    || v_id_months[EXTRACT(MONTH FROM CURRENT_DATE)::int] || ' '
    || EXTRACT(YEAR FROM CURRENT_DATE)::int;

  -- Mark paid
  UPDATE public.invoices
  SET status = 'paid',
      paid_date = v_paid_date_id,
      xendit_status = COALESCE(xendit_status, 'PAID_MANUAL')
  WHERE id = p_invoice_id;

  -- Reload to get updated row (paid_date now populated; needed by
  -- create_commissions_for_invoice which parses paid_date for earned_date)
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id;

  -- Determine if order is "older" (pre-cutoff) via scheduled_date
  BEGIN
    SELECT o.scheduled_date::date
      INTO v_order_date
    FROM public.orders o
    WHERE o.order_id = v_invoice.order_id
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_order_date := NULL;
  END;

  --------------------------------------------------------------------------
  -- TECH commissions: existing gate (scheduled_date >= 2026-05-01).
  -- Older orders are handled by April backfill — skip.
  -- create_commissions_for_invoice creates BOTH tech and marketing in one
  -- pass; we only call it for new orders to honor the tech cutoff.
  --------------------------------------------------------------------------
  IF v_order_date IS NOT NULL AND v_order_date >= v_post_cutoff_date THEN
    BEGIN
      v_commission_result := public.create_commissions_for_invoice(v_invoice.order_id);
    EXCEPTION WHEN OTHERS THEN
      v_commission_result := jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'note', 'Commission generation failed but invoice was marked paid'
      );
    END;
  END IF;

  --------------------------------------------------------------------------
  -- MARKETING commission ALWAYS runs — regardless of scheduled_date.
  -- Skipped only if a marketing commission already exists for this invoice
  -- (idempotency handled inside the helper).
  --------------------------------------------------------------------------
  BEGIN
    v_marketing_result := public.create_marketing_commission_for_invoice(p_invoice_id);
  EXCEPTION WHEN OTHERS THEN
    v_marketing_result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'note', 'Marketing commission generation failed but invoice was marked paid'
    );
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'already_paid', false,
    'invoice_id', p_invoice_id,
    'paid_date', v_paid_date_id,
    'order_date', v_order_date,
    'commission_eligible', (v_order_date IS NOT NULL AND v_order_date >= v_post_cutoff_date),
    'commission_result', v_commission_result,
    'marketing_result', v_marketing_result
  );
END;
$function$;
