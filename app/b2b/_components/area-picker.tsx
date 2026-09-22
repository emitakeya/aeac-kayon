'use client';
// Area combobox. Areas are the team's own names (e.g. "Melawai Raya 1"),
// not derived from the address. Typing a name that doesn't exist offers
// "Tambah area baru"; the area row is created on save by b2b_save_prospect.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Area } from '@/lib/b2b';

export type AreaValue = { id: string | null; name: string };

export default function AreaPicker({
  areas, value, onChange, inputId,
}: { areas: Area[]; value: AreaValue; onChange: (v: AreaValue) => void; inputId: string }) {
  const [q, setQ] = useState(value.name);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const needle = norm(q);
  const list = useMemo(
    () => areas.filter((a) => !needle || norm(a.name).includes(needle)),
    [areas, needle],
  );
  const exact = areas.find((a) => norm(a.name) === needle);
  const isNew = !value.id && value.name.trim() !== '';

  const pick = (a: Area) => {
    onChange({ id: a.id, name: a.name });
    setQ(a.name);
    setOpen(false);
  };
  const addNew = () => {
    const name = q.trim().replace(/\s+/g, ' ');
    onChange({ id: null, name });
    setQ(name);
    setOpen(false);
  };

  return (
    <div ref={wrap} className="relative">
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        value={q}
        placeholder="Ketik atau pilih area…"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          const hit = areas.find((a) => norm(a.name) === norm(e.target.value));
          onChange(hit ? { id: hit.id, name: hit.name } : { id: null, name: '' });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (exact) pick(exact);
            else if (needle) addNew();
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3.5 text-sm focus:border-aeac-amber-500 focus:outline-none"
      />
      {open && (list.length > 0 || (needle && !exact)) ? (
        <div
          role="listbox"
          aria-label="Daftar area"
          className="absolute left-0 right-0 top-12 z-30 max-h-72 overflow-auto rounded-xl border border-neutral-300 bg-white p-1.5 shadow-xl"
        >
          {list.map((a) => (
            <button
              key={a.id}
              type="button"
              role="option"
              aria-selected={value.id === a.id}
              onClick={() => pick(a)}
              className={
                'flex w-full items-center justify-between min-h-10 px-3 rounded-lg text-left text-sm hover:bg-aeac-amber-50 ' +
                (value.id === a.id ? 'bg-aeac-amber-100' : '')
              }
            >
              <span>{a.name}</span>
              <span className="text-xs text-neutral-600">{a.count} prospek</span>
            </button>
          ))}
          {needle && !exact ? (
            <button
              type="button"
              onClick={addNew}
              className="mt-1 flex w-full items-center min-h-11 px-3 rounded-lg border border-dashed border-aeac-amber-600 bg-aeac-amber-50 text-left text-sm font-semibold text-amber-800"
            >
              + Tambah area baru “{q.trim()}”
            </button>
          ) : null}
        </div>
      ) : null}
      {isNew ? (
        <p className="mt-1.5 text-[13px] font-semibold text-green-800">
          Area baru “{value.name}” akan dibuat saat disimpan.
        </p>
      ) : null}
    </div>
  );
}
