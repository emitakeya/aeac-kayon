// lib/staff-onboarding.ts

export type StaffRole =
  | 'admin'
  | 'finance'
  | 'supervisor'
  | 'marketing'
  | 'tro'
  | 'technician';

export type SourceTable =
  | 'technician'
  | 'staff_marketing'
  | 'staff_tro'
  | 'user_roles';

export interface StaffOnboardingRow {
  source_id: string;
  source_table: SourceTable;
  staff_name: string;
  name: string;
  email: string;
  role: StaffRole;
  role_order: number;
  team_code: string | null;
  has_auth: boolean;
  auth_user_id: string | null;
  last_sign_in_at: string | null;
  auth_created_at: string | null;
  has_role: boolean;
}

export interface StaffOnboardingResponse {
  staff: StaffOnboardingRow[];
}

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: 'Admin',
  finance: 'Finance',
  supervisor: 'Supervisor',
  marketing: 'Marketing',
  tro: 'TRO',
  technician: 'Teknisi',
};

// Match the existing dashboard RoleBadge color scheme
export const ROLE_BADGE_CLS: Record<StaffRole, string> = {
  admin: 'bg-red-50 text-red-700 border-red-200',
  finance: 'bg-blue-50 text-blue-700 border-blue-200',
  marketing: 'bg-violet-50 text-violet-700 border-violet-200',
  tro: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  supervisor: 'bg-amber-50 text-amber-700 border-amber-200',
  technician: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// Initial-circle color (lighter background, darker text)
export const ROLE_AVATAR_CLS: Record<StaffRole, string> = {
  admin: 'bg-red-100 text-red-800',
  finance: 'bg-blue-100 text-blue-800',
  marketing: 'bg-violet-100 text-violet-800',
  tro: 'bg-cyan-100 text-cyan-800',
  supervisor: 'bg-amber-100 text-amber-800',
  technician: 'bg-emerald-100 text-emerald-800',
};

export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '??';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Whether this row can have a new auth account created from this page
// (rows from staff tables that don't yet have auth)
export function canCreateAccount(row: StaffOnboardingRow): boolean {
  return (
    !row.has_auth &&
    (row.source_table === 'technician' ||
      row.source_table === 'staff_marketing' ||
      row.source_table === 'staff_tro')
  );
}

// Whether we can send a magic link (any active auth user)
export function canSendMagicLink(row: StaffOnboardingRow): boolean {
  return row.has_auth && !!row.email;
}

export function formatLastSignIn(iso: string | null): string {
  if (!iso) return 'Belum pernah login';
  const then = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Login terakhir hari ini';
  if (diffDays === 1) return 'Login terakhir kemarin';
  if (diffDays < 7) return `Login terakhir ${diffDays} hari lalu`;
  if (diffDays < 30) {
    const w = Math.floor(diffDays / 7);
    return `Login terakhir ${w} minggu lalu`;
  }
  return `Login terakhir ${then.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}
