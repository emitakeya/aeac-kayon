// app/b2b/layout.tsx
// Shell for the B2B Prospek pilot. Desktop-first sidebar; top bar on phones.
// Not linked from the Kayon dashboard — reached by URL.
// Gate: can_admin OR can_view_finance (admin, finance, supervisor).
// Every b2b_* RPC re-checks the same rule in the database.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { CurrentUser } from '@/lib/types';
import B2BNav from './b2b-nav';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Kayon B2B' };

export default async function B2BLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/b2b');

  const { data: me } = await supabase
    .from('v_current_user')
    .select('*')
    .maybeSingle<CurrentUser>();

  if (!me) redirect('/login');
  if (!(me.can_admin || me.can_view_finance)) redirect('/403');

  const name = me.staff_name
    ? me.staff_name.charAt(0).toUpperCase() + me.staff_name.slice(1).toLowerCase()
    : me.email;

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 md:flex">
      <B2BNav name={name} role={me.role} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
