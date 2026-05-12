-- Migration: aeac_kayon_patch_create_commissions_no_cutoff_for_marketing
--
-- Patch create_commissions_for_invoice (Xendit webhook path):
--   - TECH commissions: keep existing paid_date > 2026-04-30 cutoff
--     (older tech work was settled via April quarterly payouts)
--   - MARKETING commission: ALWAYS run via the dedicated helper
--     (delegates to public.create_marketing_commission_for_invoice)
--
-- This fixes the gap where Xendit webhooks for older orders would silently
-- skip BOTH tech AND marketing commission via the early-return cutoff.
-- Going forward, every PAID Xendit webhook creates marketing commission
-- if the customer email matches a marketing earner — regardless of when
-- the order was scheduled or when payment was received.

CREATE OR REPLACE FUNCTION public.create_commissions_for_invoice(p_order_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_invoice         record;
  v_tech            text;
  v_tech_rate       numeric;
  v_tech_amount     integer;
  v_tech_earner_id  uuid;
  v_existing_tech_count  integer;
  v_created_tech    integer := 0;
  v_skipped_tech    text[] := ARRAY[]::text[];
  v_marketing_result jsonb;
  v_earned_date     date;
  v_backfill_cutoff date := '2026-04-30';
  v_paid_date_en    text;
  v_tech_eligible   boolean := false;
BEGIN
  -- 1. Fetch invoice
  SELECT i.id, i.order_id, i.total_amount, i.technicians, i.customer_email,
         i.paid_date, i.status, i.xendit_status
  INTO v_invoice
  FROM public.invoices i
  WHERE i.order_id = p_order_id
  LIMIT 1;

  IF v_invoice IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found',
                              'order_id', p_order_id);
  END IF;

  -- 2. Only PAID invoices
  IF v_invoice.xendit_status IS DISTINCT FROM 'PAID'
     OR v_invoice.status IS DISTINCT FROM 'paid' THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'Invoice not in PAID status',
      'order_id', p_order_id, 'status', v_invoice.status,
      'xendit_status', v_invoice.xendit_status
    );
  END IF;

  -- 3. Parse earned_date (handle Indonesian month names)
  v_paid_date_en := REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    COALESCE(v_invoice.paid_date, ''),
    'Januari',   'January'),
    'Februari',  'February'),
    'Maret',     'March'),
    'April',     'April'),
    'Mei',       'May'),
    'Juni',      'June'),
    'Juli',      'July'),
    'Agustus',   'August'),
    'September', 'September'),
    'Oktober',   'October'),
    'November',  'November'),
    'Desember',  'December'
  );

  BEGIN
    v_earned_date := to_date(v_paid_date_en, 'FMDD FMMonth YYYY');
  EXCEPTION WHEN OTHERS THEN
    v_earned_date := CURRENT_DATE;
  END;

  -- 4. TECH commission gate (unchanged): only post-cutoff payments earn tech.
  v_tech_eligible := (v_earned_date > v_backfill_cutoff);

  -- 5. TECH commissions (gated by cutoff)
  IF v_tech_eligible
     AND v_invoice.technicians IS NOT NULL
     AND array_length(v_invoice.technicians, 1) > 0 THEN

    -- Idempotency for tech: skip if any tech commission already exists
    SELECT COUNT(*) INTO v_existing_tech_count
    FROM public.commissions c
    JOIN public.earners e ON e.id = c.earner_id
    WHERE c.invoice_id = v_invoice.id
      AND e.type = 'technician';

    IF v_existing_tech_count = 0 THEN
      FOREACH v_tech IN ARRAY v_invoice.technicians
      LOOP
        SELECT id INTO v_tech_earner_id
        FROM public.earners
        WHERE type = 'technician' AND lower(name) = lower(v_tech)
          AND active = true AND start_date <= v_earned_date
        LIMIT 1;

        IF v_tech_earner_id IS NULL THEN
          v_skipped_tech := array_append(v_skipped_tech, v_tech);
          CONTINUE;
        END IF;

        v_tech_rate := public.calculate_tech_commission_rate(v_tech, v_invoice.technicians);
        v_tech_amount := round(v_invoice.total_amount * v_tech_rate);
        IF v_tech_amount <= 0 THEN CONTINUE; END IF;

        INSERT INTO public.commissions (
          earner_id, invoice_id, order_id, basis_amount, rate, amount,
          status, earned_date, notes
        ) VALUES (
          v_tech_earner_id, v_invoice.id, v_invoice.order_id,
          v_invoice.total_amount, v_tech_rate, v_tech_amount,
          'available', v_earned_date,
          format('Auto-created from Xendit webhook. %s techs on job, rate %s%%',
                 array_length(v_invoice.technicians, 1),
                 to_char(v_tech_rate * 100, 'FM990.0'))
        );
        v_created_tech := v_created_tech + 1;
      END LOOP;
    END IF;
  END IF;

  -- 6. MARKETING commission (NO date gate — always runs).
  --    Delegated to the helper which handles email resolution + idempotency.
  v_marketing_result := public.create_marketing_commission_for_invoice(v_invoice.id);

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'invoice_id', v_invoice.id,
    'invoice_amount', v_invoice.total_amount,
    'earned_date', v_earned_date,
    'tech_eligible', v_tech_eligible,
    'tech_commissions_created', v_created_tech,
    'tech_skipped', v_skipped_tech,
    'marketing_result', v_marketing_result
  );
END;
$function$;
