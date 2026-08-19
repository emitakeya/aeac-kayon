// app/riwayat-customer/page.tsx
// Server Component. Auth gate only — data is fetched client-side per search
// (search_customers_for_history / get_customer_history RPCs, both of which
// independently enforce can_admin OR can_view_finance at the DB).
// Access: admin + finance. Everyone else → /403.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import RiwayatClient from './riwayat-client';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('v_current_user').select('*').maybeSingle();
  if (!me) redirect('/login');
  if (!me.can_view_finance && !me.can_admin) redirect('/403');

  return <RiwayatClient />;
}
