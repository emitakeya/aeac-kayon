'use client';

// app/dashboard/order-form-lottie.tsx
// Animated icon on the "Booking / Order Baru" card.
//
// Source file: public/animation/order_form.json
//   Lottie v5.9.0 · 500x500 · 60fps · 150 frames (2.5s loop) · 26 KB
//   No external image assets — fully self-contained, works offline.
//
// lottie-web is imported dynamically so it never lands in the initial dashboard
// bundle. If the import or the fetch fails the card simply renders without the
// icon; nothing else on the dashboard is affected.
//
// Requires:  npm install lottie-web

import { useEffect, useRef } from 'react';

type LottieInstance = { destroy: () => void };

export function OrderFormLottie() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let anim: LottieInstance | null = null;
    let cancelled = false;

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    import('lottie-web')
      .then((mod) => {
        if (cancelled || !hostRef.current) return;
        anim = mod.default.loadAnimation({
          container: hostRef.current,
          renderer: 'svg',
          // Reduced motion: render the first frame and hold it.
          loop: !reduceMotion,
          autoplay: !reduceMotion,
          path: '/animation/order_form.json',
        }) as unknown as LottieInstance;
      })
      .catch((err) => {
        console.warn('[dashboard] Lottie failed to load:', err);
      });

    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="w-11 h-11 shrink-0 pointer-events-none"
    />
  );
}
