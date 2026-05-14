// app/akun-staff/staff-onboarding-client.tsx
'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  type StaffOnboardingRow,
  ROLE_LABEL,
  ROLE_BADGE_CLS,
  ROLE_AVATAR_CLS,
  initials,
  canCreateAccount,
  canSendMagicLink,
  formatLastSignIn,
} from '@/lib/staff-onboarding';

type FilterTab = 'pending' | 'active' | 'all';

interface Toast {
  id: number;
  kind: 'success' | 'error';
  text: string;
}

export function StaffOnboardingClient({
  initialStaff,
}: {
  initialStaff: StaffOnboardingRow[];
}) {
  const [staff, setStaff] = useState<StaffOnboardingRow[]>(initialStaff);
  const [filter, setFilter] = useState<FilterTab>('pending');
  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const counts = useMemo(() => {
    let pending = 0;
    let active = 0;
    for (const s of staff) {
      if (!s.has_auth) pending++;
      else active++;
    }
    return { pending, active, all: staff.length };
  }, [staff]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((s) => {
      if (filter === 'pending' && s.has_auth) return false;
      if (filter === 'active' && !s.has_auth) return false;
      if (q) {
        const hay = `${s.name} ${s.staff_name} ${s.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [staff, filter, search]);

  function pushToast(kind: Toast['kind'], text: string) {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  async function handleCreateAccount(row: StaffOnboardingRow) {
    setBusyId(row.source_id);
    try {
      const res = await fetch('/api/akun-staff/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_table: row.source_table,
          source_id: row.source_id,
        }),
      });
      const json = (await res.json()) as
        | { ok: true; auth_user_id: string }
        | { ok: false; error: string };

      if (!res.ok || !json.ok) {
        pushToast('error', `Gagal: ${(json as { error: string }).error}`);
        return;
      }

      // Optimistic update: mark as active
      setStaff((prev) =>
        prev.map((s) =>
          s.source_id === row.source_id
            ? {
                ...s,
                has_auth: true,
                has_role: true,
                auth_user_id: json.auth_user_id,
                auth_created_at: new Date().toISOString(),
              }
            : s,
        ),
      );
      pushToast('success', `Akun untuk ${row.name} berhasil dibuat`);
    } catch (err) {
      pushToast(
        'error',
        `Error jaringan: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    } finally {
      setBusyId(null);
      // Refresh server data so we're truthful next render
      startTransition(() => {
        // No-op transition just to allow Next to revalidate if needed
      });
    }
  }

  async function handleSendMagicLink(row: StaffOnboardingRow) {
    setBusyId(row.source_id);
    try {
      const res = await fetch('/api/akun-staff/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: row.email }),
      });
      const json = (await res.json()) as
        | { ok: true }
        | { ok: false; error: string };

      if (!res.ok || !json.ok) {
        pushToast(
          'error',
          `Gagal kirim magic link: ${(json as { error: string }).error}`,
        );
        return;
      }

      pushToast('success', `Magic link dikirim ke ${row.email}`);
    } catch (err) {
      pushToast(
        'error',
        `Error jaringan: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {/* Filter pills */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        <FilterPill
          label="Belum ada akun"
          count={counts.pending}
          active={filter === 'pending'}
          onClick={() => setFilter('pending')}
        />
        <FilterPill
          label="Aktif"
          count={counts.active}
          active={filter === 'active'}
          onClick={() => setFilter('active')}
        />
        <FilterPill
          label="Semua"
          count={counts.all}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari nama atau email…"
        className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg mb-3 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
      />

      {/* List */}
      <div className="space-y-2 mb-6">
        {filtered.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-xl px-4 py-8 text-center">
            <p className="text-sm text-neutral-500">
              {filter === 'pending'
                ? 'Semua staff sudah punya akun! 🎉'
                : 'Tidak ada hasil.'}
            </p>
          </div>
        ) : (
          filtered.map((row) => (
            <StaffCard
              key={`${row.source_table}-${row.source_id}`}
              row={row}
              busy={busyId === row.source_id}
              onCreateAccount={() => handleCreateAccount(row)}
              onSendMagicLink={() => handleSendMagicLink(row)}
            />
          ))
        )}
      </div>

      {/* Toasts */}
      <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-2xl mx-auto">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-sm border ${
              t.kind === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </>
  );
}

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
        active
          ? 'bg-amber-100 text-amber-900 border-amber-300'
          : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50 hover:border-neutral-400'
      }`}
    >
      {label} · {count}
    </button>
  );
}

function StaffCard({
  row,
  busy,
  onCreateAccount,
  onSendMagicLink,
}: {
  row: StaffOnboardingRow;
  busy: boolean;
  onCreateAccount: () => void;
  onSendMagicLink: () => void;
}) {
  const showCreate = canCreateAccount(row);
  const showLink = canSendMagicLink(row);

  return (
    <div
      className={`bg-white border border-neutral-200 rounded-xl p-3 ${
        row.has_auth ? '' : ''
      }`}
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
            ROLE_AVATAR_CLS[row.role]
          }`}
        >
          {initials(row.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-neutral-900 flex items-center gap-1.5 flex-wrap">
            <span>{row.name}</span>
            {row.team_code ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-mono">
                {row.team_code}
              </span>
            ) : null}
          </div>
          <div className="text-[11px] text-neutral-500 truncate">
            {row.email}
          </div>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded border font-medium flex-shrink-0 ${
            ROLE_BADGE_CLS[row.role]
          }`}
        >
          {ROLE_LABEL[row.role]}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-100">
        <div className="flex-1 min-w-0">
          {row.has_auth ? (
            <span className="text-[11px] text-emerald-700">
              ✓ {formatLastSignIn(row.last_sign_in_at)}
            </span>
          ) : (
            <span className="text-[11px] text-amber-700">⚠ Belum ada akun</span>
          )}
        </div>

        {showCreate ? (
          <button
            onClick={onCreateAccount}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {busy ? 'Membuat…' : 'Buat akun'}
          </button>
        ) : showLink ? (
          <button
            onClick={onSendMagicLink}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-lg bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {busy ? 'Mengirim…' : 'Kirim magic link'}
          </button>
        ) : (
          <span className="text-[11px] text-neutral-400">—</span>
        )}
      </div>
    </div>
  );
}
