'use client';

import { signOut } from '../login/actions';
import { useTransition } from 'react';

export function LogoutButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => signOut())}
      disabled={pending}
      className="text-xs px-3 py-1.5 rounded-md border border-neutral-300 text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 transition"
    >
      {pending ? '...' : 'Keluar'}
    </button>
  );
}
