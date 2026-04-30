/**
 * Shape of a row from public.v_current_user (Supabase view).
 * See migration `aeac_kayon_v_current_user_view`.
 */
export type CurrentUser = {
  user_id: string;
  email: string;
  role: 'admin' | 'finance' | 'marketing' | 'tro' | 'supervisor' | 'technician';
  staff_name: string | null;
  technician_id: string | null;
  technician_name: string | null;
  team_code: string | null;
  can_admin: boolean;
  can_view_finance: boolean;
  can_view_mm: boolean;
  can_view_tech_pages: boolean;
};
