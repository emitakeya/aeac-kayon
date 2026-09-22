'use client';
// app/b2b/b2b-nav.tsx — sidebar (md+) and top bar (mobile) for /b2b.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { B2B_VERSION } from '@/lib/b2b';

const ITEMS = [
  { href: '/b2b/prospek', label: 'Prospek', ready: true },
  { href: '/b2b/follow-up', label: 'Follow-up', ready: false },
  { href: '/b2b/ringkasan', label: 'Ringkasan', ready: false },
];

export default function B2BNav({ name, role }: { name: string; role: string }) {
  const path = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <nav
        aria-label="Navigasi B2B"
        className="hidden md:flex w-56 shrink-0 flex-col gap-7 bg-neutral-900 text-neutral-200 px-4 py-6 sticky top-0 h-screen"
      >
        <Link href="/b2b/prospek" className="flex items-center gap-3 px-2">
          <span className="w-10 h-10 rounded-xl bg-aeac-amber-500 text-black font-bold text-[13px] flex items-center justify-center">
            AEAC
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-bold text-[15px] text-neutral-50">Kayon B2B</span>
            <span className="text-xs text-neutral-400">Pilot prospek</span>
          </span>
        </Link>

        <ul className="flex flex-col gap-1">
          {ITEMS.map((it) => {
            const active = path.startsWith(it.href);
            if (!it.ready) {
              return (
                <li key={it.href} className="flex items-center px-3 py-3 rounded-lg text-sm text-neutral-500">
                  {it.label}
                  <span className="ml-auto text-[11px]">nanti</span>
                </li>
              );
            }
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  aria-current={active ? 'page' : undefined}
                  className={
                    'flex items-center px-3 py-3 rounded-lg text-sm font-medium transition ' +
                    (active ? 'bg-neutral-800 text-aeac-amber-400 font-semibold' : 'text-neutral-400 hover:text-neutral-100')
                  }
                >
                  {it.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto border-t border-neutral-800 pt-3 px-3 text-[13px] flex flex-col gap-0.5">
          <span className="text-neutral-100 font-semibold">{name}</span>
          <span className="text-neutral-400">{role}</span>
          <Link href="/dashboard" className="mt-2 text-neutral-400 hover:text-neutral-100 text-xs">
            ← Kayon dashboard
          </Link>
          <span className="mt-3 text-[11px] text-neutral-500">Prospek {B2B_VERSION}</span>
        </div>
      </nav>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-20 flex items-center gap-3 bg-neutral-900 text-neutral-100 px-4 h-14">
        <Link href="/b2b/prospek" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-aeac-amber-500 text-black font-bold text-[10px] flex items-center justify-center">
            AEAC
          </span>
          <span className="font-bold text-sm">Kayon B2B</span>
        </Link>
        <span className="ml-auto text-xs text-neutral-400">{name}</span>
        <span className="text-[10px] text-neutral-500">{B2B_VERSION}</span>
      </header>
    </>
  );
}
