-- Migration: aeac_kayon_create_marketing_commission_for_invoice
--
-- Marketing-only commission creation helper. NO date cutoff — if the invoice
-- is paid and the customer email matches a marketing earner, create the
-- commission row. Idempotent: skips if a marketing commission row already
-- exists for the invoice.
--
-- Used by:
--   - public.mark_invoice_paid (Kayon /invoice-admin manual reconcile path)
--   - public.create_commissions_for_invoice (Xendit webhook path)
--
-- Email resolution sources (in order):
--   1. property.staff_marketing.email → team_code
--   2. property.staff_tro.email → team_code
--   3. public.earner_emails.email → earner_id (custom map for any unusual emails)

CREATE OR REPLACE FUNCTION public.create_marketing_commission_for_invoice(p_invoice_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'property'
AS $function$
DECLARE
  v_invoice         record;
  v_team_code       text;
  v_marketing_earner_id uuid;
  v_marketing_amount integer;
  v_existing_marketing integer;
  v_earned_date     date;
  v_match_email     text;
  v_paid_date_en    text;
BEGIN
  -- 1. Fetch invoice
  SELECT i.id, i.order_id, i.total_amount, i.customer_email,
         i.paid_date, i.status
  INTO v_invoice
  FROM public.invoices i
  WHERE i.id = p_invoice_id
  LIMIT 1;

  IF v_invoice IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found',
                              'invoice_id', p_invoice_id);
  END IF;

  -- 2. Only PAID invoices
  IF v_invoice.status IS DISTINCT FROM 'paid' THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'Invoice not paid',
      'invoice_id', p_invoice_id, 'status', v_invoice.status
    );
  END IF;

  -- 3. Idempotency: skip if marketing commission already exists.
  --    Joins to earners.type = 'marketing' to scope correctly — a tech
  --    commission on the same invoice should NOT block marketing creation.
  SELECT COUNT(*) INTO v_existing_marketing
  FROM public.commissions c
  JOIN public.earners e ON e.id = c.earner_id
  WHERE c.invoice_id = v_invoice.id
    AND e.type = 'marketing';

  IF v_existing_marketing > 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Marketing commission already exists (idempotent skip)',
      'invoice_id', p_invoice_id
    );
  END IF;

  -- 4. Parse paid_date as earned_date (handles Indonesian month names)
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

  -- 5. Resolve customer_email → team_code → earner
  v_match_email := lower(trim(coalesce(v_invoice.customer_email, '')));

  IF v_match_email = '' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'No customer_email on invoice',
      'invoice_id', p_invoice_id
    );
  END IF;

  -- Try property.staff_marketing first
  SELECT team_code INTO v_team_code
  FROM property.staff_marketing
  WHERE lower(email) = v_match_email
  LIMIT 1;

  -- If not found, try property.staff_tro
  IF v_team_code IS NULL THEN
    SELECT team_code INTO v_team_code
    FROM property.staff_tro
    WHERE lower(email) = v_match_email
    LIMIT 1;
  END IF;

  -- Resolve team_code → AEAC earner
  IF v_team_code IS NOT NULL THEN
    SELECT id INTO v_marketing_earner_id
    FROM public.earners
    WHERE type = 'marketing' AND team_code = v_team_code AND active = true
    LIMIT 1;
  END IF;

  -- Fallback: try public.earner_emails for custom-mapped emails
  IF v_marketing_earner_id IS NULL THEN
    SELECT earner_id INTO v_marketing_earner_id
    FROM public.earner_emails
    WHERE lower(email) = v_match_email
    LIMIT 1;
  END IF;

  IF v_marketing_earner_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', format('Email %s not found in marketing attribution sources',
                       v_invoice.customer_email),
      'invoice_id', p_invoice_id,
      'created', false
    );
  END IF;

  -- 6. Insert marketing commission row
  v_marketing_amount := round(v_invoice.total_amount * 0.10);

  INSERT INTO public.commissions (
    earner_id, invoice_id, order_id, basis_amount, rate, amount,
    status, earned_date, notes
  ) VALUES (
    v_marketing_earner_id, v_invoice.id, v_invoice.order_id,
    v_invoice.total_amount, 0.10, v_marketing_amount,
    'available', v_earned_date,
    format('Auto-created via mark_invoice_paid / webhook. Matched email: %s (team: %s)',
           v_invoice.customer_email, coalesce(v_team_code, 'custom'))
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'created', true,
    'team_code', v_team_code,
    'earner_id', v_marketing_earner_id,
    'amount', v_marketing_amount,
    'earned_date', v_earned_date
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_marketing_commission_for_invoice(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_marketing_commission_for_invoice(bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_marketing_commission_for_invoice(bigint) TO authenticated;
