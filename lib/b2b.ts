// lib/b2b.ts
// Types, labels and small helpers for the /b2b Prospek pilot.
// Data comes from the b2b_* SECURITY DEFINER RPCs (migrations aeac_b2b_01 / _02).

/** Shown in the sidebar so staff can see a new version is live. Bump on each release. */
export const B2B_VERSION = 'v1.5';

export type Area = { id: string; name: string; count: number };
export type Staff = { id: string; name: string };
export type B2BMeta = { me: string; areas: Area[]; staff: Staff[] };

export type ProspectRow = {
  id: string;
  business_name: string;
  category: string;
  area_id: string;
  area_name: string;
  pic_name: string | null;
  pic_position: string | null;
  pic_phone: string | null;
  status: string;
  staff_ids: string[];
  staff: Staff[];
  next_followup_date: string | null;
  followup_note: string | null;
  updated_at: string;
  last_activity_at: string | null;
  last_activity_type: string | null;
};

export type Prospect = {
  id: string;
  business_name: string;
  category: string;
  area_id: string;
  area_name: string;
  address: string | null;
  maps_url: string | null;
  phone: string | null;
  pic_name: string | null;
  pic_position: string | null;
  pic_phone: string | null;
  pic_email: string | null;
  ac_types: string[];
  ac_units: Record<string, number>;
  estimated_units: number | null;
  existing_vendor: string;
  vendor_price_notes: string | null;
  needs: string | null;
  lead_origin: string | null;
  source: string | null;
  status: string;
  lost_reason: string | null;
  staff_ids: string[];
  staff: Staff[];
  next_followup_date: string | null;
  followup_note: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type Activity = {
  id: string;
  activity_type: string;
  activity_at: string;
  notes: string | null;
  status_from: string | null;
  status_to: string | null;
  next_followup_date: string | null;
  staff: Staff[];
  created_by_name: string | null;
};

export type ProspectDetail = { prospect: Prospect; activities: Activity[] };

export type SummaryGroupRow = { name: string; n: number; pic: number; int: number; won: number };

export type Summary = {
  from: string;
  to: string;
  first: string | null;
  today: string;
  kpi: {
    new: number; visits: number; contacts: number; pic: number;
    survey: number; quotation: number; won: number; lost: number;
  };
  funnel: { prospects: number; pic: number; interested: number; survey: number; quotation: number; won: number };
  followup: { over: number; today: number; none: number };
  lost_reasons: { reason: string; n: number }[];
  by_area: SummaryGroupRow[];
  by_category: SummaryGroupRow[];
};

// ── Labels ──────────────────────────────────────────────────────────────────

export const CATEGORIES: [string, string][] = [
  ['resto', 'Kafe / Resto'],
  ['kantor', 'Kantor'],
  ['retail', 'Retail'],
  ['klinik', 'Klinik'],
  ['salon', 'Salon / Kecantikan'],
  ['gym', 'Gym / Studio'],
  ['sekolah', 'Sekolah'],
  ['hotel', 'Hotel'],
  ['gedung', 'Gedung'],
  ['lainnya', 'Lainnya'],
];

export const STATUSES: [string, string, string][] = [
  // key, label, chip classes
  ['new_lead', 'Lead Baru', 'bg-neutral-100 text-neutral-700'],
  ['pic_found', 'PIC Ditemukan', 'bg-sky-100 text-sky-800'],
  ['contacted', 'Dihubungi', 'bg-indigo-100 text-indigo-800'],
  ['interested', 'Tertarik', 'bg-amber-100 text-amber-800'],
  ['survey', 'Survei', 'bg-violet-100 text-violet-800'],
  ['quotation', 'Penawaran', 'bg-orange-100 text-orange-800'],
  ['negotiation', 'Negosiasi', 'bg-pink-100 text-pink-800'],
  ['won', 'Deal', 'bg-green-100 text-green-800'],
  ['lost', 'Gagal', 'bg-neutral-100 text-neutral-500 line-through'],
];

export const AC_TYPES: [string, string][] = [
  ['split', 'Split'],
  ['cassette', 'Cassette'],
  ['duct', 'Ducting'],
  ['central', 'Central / VRV'],
  ['standing', 'Standing'],
  ['lainnya', 'Lainnya'],
];

export const VENDOR: [string, string][] = [
  ['yes', 'Ya'],
  ['no', 'Tidak'],
  ['unknown', 'Tidak tahu'],
];

export const SOURCES: [string, string][] = [
  ['walk_in', 'Kunjungan langsung'],
  ['google_maps', 'Google Maps'],
  ['website', 'Website'],
  ['referral', 'Referensi'],
  ['spreadsheet', 'Spreadsheet lama'],
  ['other', 'Lainnya'],
];

export const ORIGINS: [string, string][] = [
  ['outbound', 'Kami (hunting)'],
  ['inbound', 'Mereka menghubungi kami'],
];

export const LOST_REASONS: [string, string][] = [
  ['price', 'Harga'],
  ['has_vendor', 'Sudah ada vendor, tidak tertarik'],
  ['no_response', 'Tidak ada respons'],
  ['no_need', 'Tidak butuh'],
  ['closed', 'Usaha tutup'],
  ['other', 'Lainnya'],
];

export const ACTIVITY_TYPES: [string, string][] = [
  ['visit', 'Kunjungan'],
  ['phone', 'Telepon'],
  ['whatsapp', 'WhatsApp'],
  ['email', 'Email'],
  ['followup', 'Follow-up'],
  ['survey', 'Survei'],
  ['quotation', 'Penawaran'],
  ['meeting', 'Meeting'],
  ['order', 'Order'],
  ['note', 'Catatan'],
  ['other', 'Lainnya'],
];

const toMap = (xs: [string, string, ...string[]][]) =>
  Object.fromEntries(xs.map((x) => [x[0], x[1]])) as Record<string, string>;

export const CATEGORY_LABEL = toMap(CATEGORIES);
export const STATUS_LABEL = toMap(STATUSES);
export const STATUS_CLASS = Object.fromEntries(STATUSES.map((s) => [s[0], s[2]])) as Record<string, string>;
export const AC_LABEL = toMap(AC_TYPES);
export const VENDOR_LABEL = toMap(VENDOR);
export const SOURCE_LABEL = toMap(SOURCES);
export const ORIGIN_LABEL = toMap(ORIGINS);
export const LOST_REASON_LABEL = toMap(LOST_REASONS);
export const ACTIVITY_LABEL: Record<string, string> = { ...toMap(ACTIVITY_TYPES), created: 'Dibuat' };

// ── Dates (always Jakarta) ──────────────────────────────────────────────────

const TZ = 'Asia/Jakarta';

/** Today in Jakarta as YYYY-MM-DD. */
export function jakartaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

/** Now in Jakarta as a datetime-local value (YYYY-MM-DDTHH:mm). */
export function jakartaNowLocal(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const hh = g('hour') === '24' ? '00' : g('hour');
  return `${g('year')}-${g('month')}-${g('day')}T${hh}:${g('minute')}`;
}

/** datetime-local (Jakarta) → ISO string with +07:00. */
export function localToIso(v: string): string {
  return `${v}:00+07:00`;
}

export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type FollowupKind = 'over' | 'today' | 'soon' | 'later' | 'none';

export function followupKind(date: string | null, status: string, today = jakartaToday()): FollowupKind {
  if (!date || status === 'won' || status === 'lost') return 'none';
  if (date < today) return 'over';
  if (date === today) return 'today';
  if (date <= addDays(today, 7)) return 'soon';
  return 'later';
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** "22 Sep" / "22 Sep 2025" when not this year. */
export function fmtDate(ymd: string | null): string {
  if (!ymd) return '—';
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00Z`);
  const sameYear = ymd.slice(0, 4) === jakartaToday().slice(0, 4);
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'UTC', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
  }).format(d);
}

/** "Rab, 23 Sep" — weekday + date, for the coming-week list. */
export function fmtDay(ymd: string | null): string {
  if (!ymd) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(`${ymd.slice(0, 10)}T00:00:00Z`));
}

export function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

/** ISO timestamp → Jakarta YYYY-MM-DD. */
export function isoToJakartaYmd(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));
}

// ── Misc ────────────────────────────────────────────────────────────────────

/** 08123… / +62 812… → https://wa.me/62812… (null if unusable). */
export function waLink(phone: string | null): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  if (d.length < 9) return null;
  return `https://wa.me/${d}`;
}

export function staffNames(staff: Staff[] | null | undefined): string {
  return (staff ?? []).map((s) => s.name).join(', ') || '—';
}
