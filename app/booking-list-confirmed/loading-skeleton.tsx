// app/booking-list-confirmed/loading-skeleton.tsx
// Shown while the server is fetching booking data via Suspense.
// Mimics the final layout: summary pills + 3 stacked date accordions.

export default function BookingListSkeleton() {
  return (
    <>
      <div className="a-summary" aria-hidden="true">
        <span className="a-skel-pill" style={{ width: 70 }} />
        <span className="a-skel-pill" style={{ width: 90 }} />
        <span className="a-skel-pill" style={{ width: 100 }} />
      </div>
      <div className="a-skel-card" aria-hidden="true" />
      <div className="a-skel-card" aria-hidden="true" />
      <div className="a-skel-card" aria-hidden="true" />
      <span className="sr-only">Memuat daftar booking…</span>
    </>
  );
}
