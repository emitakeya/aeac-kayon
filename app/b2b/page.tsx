// app/b2b/page.tsx — /b2b lands on the daily Follow-up list.
import { redirect } from 'next/navigation';

export default function B2BIndex() {
  redirect('/b2b/follow-up');
}
