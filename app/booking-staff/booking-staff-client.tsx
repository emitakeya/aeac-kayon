"use client";

// app/booking-staff/booking-staff-client.tsx
// 4-step staff booking form (Tanggal → Layanan → Kontak → Review).
// Reminder mode (prefill present): apartment/unit locked, fields + cart seeded.
// Fresh mode: apartment picker, unit input, empty cart.

import { useEffect, useMemo, useState } from "react";
import {
  type BookingContext,
  type CatalogSection,
  type CatalogCard,
  type CartItem,
  allowedSessions,
  buildServiceString,
  cartTotal,
  formatRupiah,
  formatScheduledDate,
  todayJakartaISO,
  type CreateBookingResponse,
} from "@/lib/booking-staff";

type Props = {
  context: BookingContext;
  catalog: CatalogSection[];
  apartments: string[];
  refOrderId: string | null;
};

const STEPS = ["Tanggal", "Layanan", "Kontak", "Review"] as const;

export default function BookingStaffClient({ context, catalog, apartments, refOrderId }: Props) {
  const prefill = context.prefill;
  const isReminderMode = !!prefill;
  const selfMember = context.team.find((t) => t.is_self) ?? null;
  const teamCodes = Array.from(
    new Set(context.team.map((t) => t.team_code).filter(Boolean) as string[])
  );
  const groupedIdentity = teamCodes.length > 1; // admin: staff span multiple teams

  const [step, setStep] = useState(1);

  // Step 1
  const [isoDate, setIsoDate] = useState("");
  const [session, setSession] = useState<"AM" | "PM" | "">("");
  const [load, setLoad] = useState<{ am: number; pm: number; max: number } | null>(null);
  const [loadingLoad, setLoadingLoad] = useState(false);

  // Step 2
  const [cart, setCart] = useState<CartItem[]>(
    (prefill?.services ?? []).map((s) => ({ name: s.name, qty: s.qty, price: s.price }))
  );
  const [qtyByCard, setQtyByCard] = useState<Record<string, number>>({});
  const [optByCard, setOptByCard] = useState<Record<string, number>>({});

  // Step 3
  const [orderedByStaffId, setOrderedByStaffId] = useState(selfMember?.staff_id ?? "");
  const [apartment, setApartment] = useState(prefill?.apartment ?? "");
  const [unit, setUnit] = useState(prefill?.unit ?? "");
  const [tenantName, setTenantName] = useState(prefill?.tenant_name ?? "");
  const [tenantEmail, setTenantEmail] = useState(prefill?.tenant_email ?? "");
  const [notes, setNotes] = useState("");
  const [standbyName, setStandbyName] = useState(prefill?.standby_name ?? "");
  const [standbyPhone, setStandbyPhone] = useState(prefill?.standby_phone ?? "");

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneOrderId, setDoneOrderId] = useState<string | null>(null);

  const total = useMemo(() => cartTotal(cart), [cart]);
  const sessions = useMemo(() => allowedSessions(isoDate), [isoDate]);
  const orderedByName = context.team.find((t) => t.staff_id === orderedByStaffId)?.name ?? selfMember?.name ?? "";
  const today = todayJakartaISO();

  // Fetch session capacity when the date changes (fail-open on error).
  useEffect(() => {
    if (!isoDate || sessions.length === 0) {
      setLoad(null);
      return;
    }
    let cancelled = false;
    setLoadingLoad(true);
    fetch(`/api/booking-staff/availability?date=${encodeURIComponent(isoDate)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d && d.ok) setLoad({ am: d.am_count, pm: d.pm_count, max: d.max });
        else setLoad(null);
      })
      .catch(() => { if (!cancelled) setLoad(null); })
      .finally(() => { if (!cancelled) setLoadingLoad(false); });
    return () => { cancelled = true; };
  }, [isoDate, sessions.length]);

  const amFull = !!load && load.am >= load.max;
  const pmFull = !!load && load.pm >= load.max;
  const isFull = (s: "AM" | "PM") => (s === "AM" ? amFull : pmFull);

  // Deselect a session that turns out to be full once counts load.
  useEffect(() => {
    if (session && isFull(session as "AM" | "PM")) setSession("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amFull, pmFull]);

  const qtyOf = (key: string) => qtyByCard[key] ?? 1;
  const setQty = (key: string, v: number) =>
    setQtyByCard((m) => ({ ...m, [key]: Math.max(1, v) }));

  function addToCart(name: string, qty: number, price: number) {
    setCart((prev) => {
      const i = prev.findIndex((c) => c.name === name && c.price === price);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + qty };
        return next;
      }
      return [...prev, { name, qty, price }];
    });
  }

  function addCard(card: CatalogCard) {
    const qty = qtyOf(card.key);
    if (card.kind === "simple") addToCart(card.name, qty, card.price);
    else if (card.kind === "range") addToCart(card.name, qty, card.minPrice);
    else {
      const optId = optByCard[card.key] ?? card.options[0]?.id;
      const opt = card.options.find((o) => o.id === optId) ?? card.options[0];
      if (opt) addToCart(opt.name, qty, opt.price);
    }
  }

  function removeCartItem(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── validation ──
  const step1Ok = !!isoDate && !!session && sessions.includes(session as "AM" | "PM") && !isFull(session as "AM" | "PM");
  const step2Ok = cart.length > 0;
  const step3Ok =
    !!orderedByStaffId && !!apartment.trim() && !!unit.trim() && !!tenantName.trim() && !!standbyName.trim();

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        ordered_by_staff_id: orderedByStaffId,
        scheduled_date: formatScheduledDate(isoDate, session as "AM" | "PM"),
        services: cart.map(buildServiceString),
        apartment: apartment.trim(),
        unit: unit.trim(),
        tenant_name: tenantName.trim(),
        tenant_email: tenantEmail.trim() || null,
        notes: notes.trim() || null,
        standby_name: standbyName.trim() || null,
        standby_phone: standbyPhone.trim() || null,
        ref_order_id: refOrderId,
        total_estimate: total,
      };
      const res = await fetch("/api/booking-staff/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as CreateBookingResponse;
      if (!res.ok || !data.ok) {
        setError(("error" in data && data.error) || "Gagal membuat pesanan.");
      } else {
        setDoneOrderId(data.order_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan jaringan.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── success view ──
  if (doneOrderId) {
    return (
      <div className="b-card">
        <div className="b-topbar" />
        <div className="b-success">
          <span className="b-success-icon">✓</span>
          <h3>Pesanan Terkirim</h3>
          <p>Email konfirmasi sudah dikirim ke tenant, staff pemesan, dan teknisi.</p>
          <div className="b-order-badge">{doneOrderId}</div>
          <div className="b-btn-row">
            <a href="/dashboard" className="b-btn b-btn-ghost" style={{ flex: 1, textAlign: "center", textDecoration: "none", lineHeight: "1.6" }}>
              Ke Dashboard
            </a>
            <a href="/booking-staff" className="b-btn b-btn-primary" style={{ flex: 1, textAlign: "center", textDecoration: "none", lineHeight: "1.6" }}>
              Order Baru
            </a>
          </div>
        </div>
        <BookingStyles />
      </div>
    );
  }

  return (
    <div>
      {/* progress */}
      <div className="b-prog">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const cls = n < step ? "done" : n === step ? "active" : "";
          return (
            <div key={label} className={`b-pstep ${cls}`}>
              <div className="b-pdot">{n < step ? "✓" : n}</div>
              <div className="b-plabel">{label}</div>
            </div>
          );
        })}
      </div>

      {/* ── STEP 1 : TANGGAL ── */}
      {step === 1 && (
        <div className="b-card">
          <div className="b-topbar" />
          <div className="b-header">
            <h3>Pilih Tanggal &amp; Waktu</h3>
            <p>Kami beroperasi Senin–Sabtu. Sabtu hanya sesi pagi (AM).</p>
          </div>
          <div className="b-body">
            <div className="b-field">
              <label className="b-label">Tanggal Layanan</label>
              <input
                className="b-input"
                type="date"
                min={today}
                value={isoDate}
                onChange={(e) => {
                  setIsoDate(e.target.value);
                  setSession("");
                }}
              />
            </div>
            {isoDate && sessions.length === 0 && (
              <div className="b-warn">Tutup pada hari Minggu. Silakan pilih tanggal lain.</div>
            )}
            {sessions.length > 0 && (
              <div className="b-field">
                <label className="b-label">Sesi</label>
                <div className="b-ampm">
                  {(["AM", "PM"] as const).map((s) => {
                    const full = isFull(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        className={session === s ? "active" : ""}
                        disabled={!sessions.includes(s) || full || loadingLoad}
                        onClick={() => setSession(s)}
                      >
                        {s}{full ? " · Penuh" : ""}
                      </button>
                    );
                  })}
                </div>
                {loadingLoad && <div className="b-cap-hint">Mengecek ketersediaan…</div>}
                {!loadingLoad && amFull && pmFull && (
                  <div className="b-warn" style={{ marginTop: 8 }}>Kedua sesi sudah penuh di tanggal ini. Silakan pilih tanggal lain.</div>
                )}
              </div>
            )}
            <div className="b-btn-row">
              <button className="b-btn b-btn-primary" disabled={!step1Ok} onClick={() => setStep(2)}>
                Selanjutnya →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2 : LAYANAN ── */}
      {step === 2 && (
        <div className="b-card">
          <div className="b-topbar" />
          <div className="b-header">
            <h3>Pilih Layanan</h3>
            <p>Pilih jenis layanan dan jumlah unit. Harga minimum — aktual dikonfirmasi teknisi di lokasi.</p>
          </div>
          <div className="b-body">
            {catalog.map((section) => (
              <div key={section.title}>
                <div className="b-svc-section">{section.title}</div>
                {section.cards.map((card) => (
                  <div key={card.key} className="b-svc-card">
                    <div className="b-svc-head">
                      <div className="b-svc-name">{card.name}</div>
                      <div className="b-svc-price">{card.priceLabel}</div>
                    </div>
                    {card.kind === "options" && (
                      <select
                        className="b-select b-svc-opt"
                        value={optByCard[card.key] ?? card.options[0]?.id}
                        onChange={(e) => setOptByCard((m) => ({ ...m, [card.key]: Number(e.target.value) }))}
                      >
                        {card.options.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label} — {formatRupiah(o.price)}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="b-svc-foot">
                      <div className="b-qty">
                        <button type="button" onClick={() => setQty(card.key, qtyOf(card.key) - 1)}>−</button>
                        <span className="b-qty-v">{qtyOf(card.key)}</span>
                        <button type="button" onClick={() => setQty(card.key, qtyOf(card.key) + 1)}>+</button>
                      </div>
                      <button type="button" className="b-add" onClick={() => addCard(card)}>
                        + Tambah
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <div className="b-cart-lab">
              <span>🛒 Keranjang Pesanan</span>
              <span className="b-muted">{cart.length} item</span>
            </div>
            {cart.length === 0 ? (
              <div className="b-cart-empty">Belum ada layanan dipilih.</div>
            ) : (
              cart.map((item, i) => (
                <div key={`${item.name}-${i}`} className="b-cart-item">
                  <span>
                    {item.name} {item.qty > 1 && <span className="b-muted">×{item.qty}</span>}
                  </span>
                  <span>
                    <b>{formatRupiah(item.qty * item.price)}</b>{" "}
                    <button type="button" className="b-cart-x" onClick={() => removeCartItem(i)} aria-label="Hapus">
                      ✕
                    </button>
                  </span>
                </div>
              ))
            )}
            <div className="b-total-box">
              <div className="b-total-lab">
                Total Estimasi
                <span className="b-total-note">* harga minimum — dikonfirmasi teknisi di lokasi</span>
              </div>
              <div className="b-total-v">{formatRupiah(total)}</div>
            </div>

            <div className="b-btn-row">
              <button className="b-btn b-btn-ghost" onClick={() => setStep(1)}>← Kembali</button>
              <button className="b-btn b-btn-primary" disabled={!step2Ok} onClick={() => setStep(3)}>
                Selanjutnya →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3 : KONTAK ── */}
      {step === 3 && (
        <div className="b-card">
          <div className="b-topbar" />
          <div className="b-header">
            <h3>Kontak &amp; Lokasi</h3>
            <p>{isReminderMode ? "Data terisi dari pengingat — bisa diubah. Apartemen & unit terkunci." : "Isi data tenant & lokasi."}</p>
          </div>
          <div className="b-body">
            {/* identity */}
            <div className="b-ident">
              <div className="b-ident-av">{(orderedByName || "?").charAt(0).toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div className="b-ident-lab">Dipesan oleh</div>
                <div className="b-ident-hint">▾ {selfMember ? "Terdeteksi otomatis — klik untuk pesan atas nama rekan tim" : "Pilih staff pemesan"}</div>
                <select
                  className="b-select b-ident-dd"
                  value={orderedByStaffId}
                  onChange={(e) => setOrderedByStaffId(e.target.value)}
                >
                  {!selfMember && <option value="" disabled>— Pilih staff pemesan —</option>}
                  {groupedIdentity
                    ? teamCodes.map((code) => (
                        <optgroup key={code} label={`Tim ${code}`}>
                          {context.team
                            .filter((t) => t.team_code === code)
                            .map((t) => (
                              <option key={t.staff_id} value={t.staff_id}>
                                {t.is_self ? `${t.name} — saya` : `${t.name} (${t.role})`}
                              </option>
                            ))}
                        </optgroup>
                      ))
                    : context.team.map((t) => (
                        <option key={t.staff_id} value={t.staff_id}>
                          {t.is_self ? `${t.name} — saya sendiri` : `${t.name} (${t.role})`}
                        </option>
                      ))}
                </select>
              </div>
            </div>

            <div className="b-row">
              <div>
                <label className="b-label">Nama Apartemen</label>
                {isReminderMode ? (
                  <input className="b-input b-lock" value={apartment} readOnly />
                ) : (
                  <select className="b-select" value={apartment} onChange={(e) => setApartment(e.target.value)}>
                    <option value="">Pilih apartemen</option>
                    {apartments.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="b-label">Nomor Unit</label>
                <input
                  className={`b-input ${isReminderMode ? "b-lock" : ""}`}
                  value={unit}
                  readOnly={isReminderMode}
                  placeholder="contoh: 1204"
                  onChange={(e) => setUnit(e.target.value)}
                />
              </div>
            </div>

            <div className="b-row">
              <div>
                <label className="b-label">Nama Tenant</label>
                <input className="b-input" value={tenantName} placeholder="Nama tenant" onChange={(e) => setTenantName(e.target.value)} />
              </div>
              <div>
                <label className="b-label">Email Tenant <span className="b-opt">(opsional)</span></label>
                <input className="b-input" value={tenantEmail} placeholder="email@domain.com" onChange={(e) => setTenantEmail(e.target.value)} />
              </div>
            </div>

            <div className="b-field">
              <label className="b-label">Catatan / Pesan ke Teknisi <span className="b-opt">(opsional)</span></label>
              <textarea
                className="b-textarea"
                value={notes}
                placeholder="Contoh: Mohon datang setelah jam 10 pagi..."
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="b-info">
              <b>Ada orang yang menunggu di lokasi?</b> Isi kontak orang yang akan menunggu teknisi bila tenant tidak bisa hadir.
            </div>
            <div className="b-row">
              <div>
                <label className="b-label">Nama Standby</label>
                <input className="b-input" value={standbyName} placeholder="Nama di lokasi" onChange={(e) => setStandbyName(e.target.value)} />
              </div>
              <div>
                <label className="b-label">HP Standby <span className="b-opt">(opsional)</span></label>
                <input className="b-input" value={standbyPhone} placeholder="08xx-xxxx-xxxx" onChange={(e) => setStandbyPhone(e.target.value)} />
              </div>
            </div>

            <div className="b-btn-row">
              <button className="b-btn b-btn-ghost" onClick={() => setStep(2)}>← Kembali</button>
              <button className="b-btn b-btn-primary" disabled={!step3Ok} onClick={() => setStep(4)}>
                Review Pesanan →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4 : REVIEW ── */}
      {step === 4 && (
        <div className="b-card">
          <div className="b-topbar" />
          <div className="b-header">
            <h3>Review &amp; Kirim</h3>
            <p>Periksa kembali sebelum mengirim.</p>
          </div>
          <div className="b-body">
            <div className="b-rev-title">Jadwal</div>
            <div className="b-rev-row"><span className="b-rev-k">Tanggal</span><span className="b-rev-v">{isoDate}</span></div>
            <div className="b-rev-row"><span className="b-rev-k">Sesi</span><span className="b-rev-v">{session === "AM" ? "Pagi (AM)" : "Siang (PM)"}</span></div>

            <hr className="b-sep" />
            <div className="b-rev-title">Layanan</div>
            {cart.map((item, i) => (
              <div key={i} className="b-rev-row">
                <span className="b-rev-k" style={{ flex: 1, textAlign: "left" }}>
                  {item.name} {item.qty > 1 && <span className="b-muted">×{item.qty}</span>}
                </span>
                <span className="b-rev-v" style={{ flex: "none" }}>{formatRupiah(item.qty * item.price)}</span>
              </div>
            ))}
            <div className="b-rev-total"><span>Total Estimasi *</span><span className="b-rev-total-v">{formatRupiah(total)}</span></div>

            <hr className="b-sep" />
            <div className="b-rev-title">Kontak &amp; Lokasi</div>
            <div className="b-rev-row"><span className="b-rev-k">Dipesan oleh</span><span className="b-rev-v b-hl">{orderedByName}</span></div>
            <div className="b-rev-row"><span className="b-rev-k">Apartemen</span><span className="b-rev-v">{apartment}</span></div>
            <div className="b-rev-row"><span className="b-rev-k">Unit</span><span className="b-rev-v">{unit}</span></div>
            <div className="b-rev-row"><span className="b-rev-k">Tenant</span><span className="b-rev-v">{tenantName}</span></div>
            {tenantEmail.trim() && <div className="b-rev-row"><span className="b-rev-k">Email</span><span className="b-rev-v">{tenantEmail}</span></div>}
            {notes.trim() && <div className="b-rev-row"><span className="b-rev-k">Catatan</span><span className="b-rev-v">{notes}</span></div>}
            {(standbyName.trim() || standbyPhone.trim()) && (
              <div className="b-rev-row"><span className="b-rev-k">Standby</span><span className="b-rev-v">{standbyName} {standbyPhone && <br />}{standbyPhone}</span></div>
            )}

            {error && <div className="b-err">⚠️ {error}</div>}

            <div className="b-btn-row">
              <button className="b-btn b-btn-ghost" disabled={submitting} onClick={() => setStep(3)}>← Kembali</button>
              <button className="b-btn b-btn-primary" disabled={submitting} onClick={submit}>
                {submitting ? <><span className="b-spinner" />Mengirim...</> : "✓ Kirim Pemesanan"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BookingStyles />
    </div>
  );
}

function BookingStyles() {
  return (
    <style>{`
      .bsw {
        --accent:#f59e0b; --accent2:#d97706; --dark:#111827; --text:#1f2937;
        --muted:#6b7280; --border:#e5e7eb; --bg:#f3f4f6; --card:#fff;
        --danger:#dc2626; --success:#16a34a;
        font-family:'Roboto',system-ui,-apple-system,sans-serif;
        color:var(--text); background:var(--bg);
        max-width:560px; margin:0 auto; padding:16px 12px 80px; min-height:100vh;
      }
      .bsw * { box-sizing:border-box; }
      .bsw .b-topnav { display:grid; grid-template-columns:84px 1fr 84px; align-items:center; margin-bottom:14px; gap:8px; }
      .bsw .b-back-btn { display:inline-flex; align-items:center; gap:4px; padding:6px 12px; border-radius:999px; font-size:12px; font-weight:500; background:#fff; border:1px solid var(--border); color:var(--muted); text-decoration:none; white-space:nowrap; justify-self:start; }
      .bsw .b-back-btn:hover { border-color:var(--accent); color:var(--accent2); }
      .bsw .b-topnav-title { text-align:center; min-width:0; }
      .bsw .b-topnav-title h2 { margin:0; font-size:17px; font-weight:600; color:var(--dark); line-height:1.2; }
      .bsw .b-topnav-title p { margin:2px 0 0; font-size:11px; color:var(--muted); }
      .bsw .b-topnav-spacer { width:84px; }

      .bsw .b-prog { display:flex; margin:0 0 16px; }
      .bsw .b-pstep { flex:1; display:flex; flex-direction:column; align-items:center; gap:5px; position:relative; }
      .bsw .b-pstep::after { content:''; position:absolute; top:14px; left:50%; width:100%; height:2px; background:var(--border); }
      .bsw .b-pstep:last-child::after { display:none; }
      .bsw .b-pstep.done::after { background:var(--accent); }
      .bsw .b-pdot { width:28px; height:28px; border-radius:50%; border:2px solid var(--border); background:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; color:var(--muted); z-index:1; }
      .bsw .b-pstep.active .b-pdot, .bsw .b-pstep.done .b-pdot { border-color:var(--accent); background:var(--accent); color:#fff; }
      .bsw .b-plabel { font-size:10px; color:var(--muted); }
      .bsw .b-pstep.active .b-plabel { color:var(--accent2); font-weight:600; }

      .bsw .b-card { background:var(--card); border:1px solid var(--border); border-radius:14px; box-shadow:0 4px 24px rgba(0,0,0,0.06); overflow:hidden; margin-bottom:16px; }
      .bsw .b-topbar { height:5px; background:linear-gradient(90deg,#f59e0b,#d97706); }
      .bsw .b-header { padding:18px 20px 12px; border-bottom:1px solid var(--border); }
      .bsw .b-header h3 { margin:0 0 4px; font-size:16px; font-weight:600; color:var(--dark); }
      .bsw .b-header p { margin:0; font-size:12px; color:var(--muted); line-height:1.5; }
      .bsw .b-body { padding:18px 20px; }

      .bsw .b-label { display:block; font-size:12px; font-weight:500; color:#4b5563; margin-bottom:6px; }
      .bsw .b-opt { color:var(--muted); font-weight:400; }
      .bsw .b-input, .bsw .b-select, .bsw .b-textarea { width:100%; padding:11px 13px; border:1.5px solid var(--border); border-radius:10px; font-size:14px; font-family:inherit; background:#fff; color:var(--text); outline:none; }
      .bsw .b-input:focus, .bsw .b-select:focus, .bsw .b-textarea:focus { border-color:var(--accent); }
      .bsw .b-select { appearance:none; padding-right:32px; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%236b7280' d='M6 8L0 0h12z'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; }
      .bsw .b-lock { background:#f3f4f6; color:#4b5563; }
      .bsw .b-textarea { min-height:80px; resize:vertical; }
      .bsw .b-field { margin-bottom:16px; }
      .bsw .b-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; }
      @media (max-width:480px){ .bsw .b-row { grid-template-columns:1fr; } }

      .bsw .b-ampm { display:flex; gap:8px; }
      .bsw .b-ampm button { padding:11px 22px; border:1.5px solid var(--border); border-radius:10px; background:#fff; color:var(--muted); font-size:14px; font-family:inherit; cursor:pointer; }
      .bsw .b-ampm button.active { border-color:var(--accent); background:var(--accent); color:#fff; }
      .bsw .b-ampm button:disabled { opacity:.4; cursor:not-allowed; }
      .bsw .b-cap-hint { font-size:12px; color:var(--muted); margin-top:8px; }
      .bsw .b-warn { background:#fffbeb; border:1px solid #fde68a; color:#78350f; border-radius:10px; padding:10px 12px; font-size:13px; margin-bottom:12px; }

      .bsw .b-svc-section { font-size:11px; font-weight:600; color:var(--muted); letter-spacing:.6px; text-transform:uppercase; margin:16px 0 10px; padding-top:12px; border-top:1px solid var(--border); }
      .bsw .b-svc-section:first-child { border-top:none; padding-top:0; margin-top:0; }
      .bsw .b-svc-card { border:1.5px solid var(--border); border-radius:12px; padding:14px 16px; margin-bottom:10px; }
      .bsw .b-svc-head { display:flex; justify-content:space-between; gap:10px; }
      .bsw .b-svc-name { font-size:14px; font-weight:600; color:var(--dark); }
      .bsw .b-svc-price { font-size:12px; font-weight:600; color:var(--accent2); white-space:nowrap; text-align:right; }
      .bsw .b-svc-opt { margin-top:10px; }
      .bsw .b-svc-foot { display:flex; align-items:center; gap:10px; margin-top:12px; }
      .bsw .b-qty { display:flex; align-items:center; border:1.5px solid var(--border); border-radius:10px; overflow:hidden; }
      .bsw .b-qty button { width:34px; height:34px; border:none; background:#fff; font-size:18px; color:var(--text); cursor:pointer; }
      .bsw .b-qty-v { width:34px; text-align:center; line-height:34px; border-left:1.5px solid var(--border); border-right:1.5px solid var(--border); font-size:14px; }
      .bsw .b-add { flex:1; padding:10px; background:var(--dark); color:#fff; border:none; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; }

      .bsw .b-muted { color:var(--muted); }
      .bsw .b-cart-lab { display:flex; justify-content:space-between; font-size:13px; color:#374151; margin:18px 0 8px; }
      .bsw .b-cart-empty { font-size:13px; color:var(--muted); background:#f9fafb; border:1px dashed var(--border); border-radius:10px; padding:12px; text-align:center; }
      .bsw .b-cart-item { display:flex; justify-content:space-between; align-items:center; background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:10px 12px; gap:10px; font-size:13px; margin-bottom:6px; }
      .bsw .b-cart-x { background:none; border:none; color:var(--muted); font-size:15px; cursor:pointer; margin-left:6px; }
      .bsw .b-total-box { border:1.5px solid rgba(17,24,39,0.12); background:rgba(17,24,39,0.03); border-radius:12px; padding:14px 16px; margin-top:12px; display:flex; justify-content:space-between; align-items:center; }
      .bsw .b-total-lab { font-size:12px; }
      .bsw .b-total-note { display:block; font-size:11px; color:var(--muted); margin-top:2px; }
      .bsw .b-total-v { font-size:22px; font-weight:600; color:var(--dark); }

      .bsw .b-ident { display:flex; gap:12px; align-items:flex-start; background:#fffdf7; border:2px solid var(--accent); border-radius:12px; padding:14px 16px; margin-bottom:18px; }
      .bsw .b-ident-av { flex-shrink:0; width:38px; height:38px; border-radius:50%; background:var(--accent); color:#fff; font-weight:700; font-size:15px; display:flex; align-items:center; justify-content:center; }
      .bsw .b-ident-lab { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.6px; margin-bottom:2px; }
      .bsw .b-ident-hint { font-size:11px; color:var(--accent2); margin:2px 0 8px; }
      .bsw .b-ident-dd { border-color:var(--accent); font-weight:600; }

      .bsw .b-info { background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.3); border-radius:10px; padding:12px 14px; font-size:13px; line-height:1.55; margin:2px 0 16px; }

      .bsw .b-rev-title { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.8px; margin:0 0 8px; }
      .bsw .b-rev-row { display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid var(--border); }
      .bsw .b-rev-row:last-of-type { border-bottom:none; }
      .bsw .b-rev-k { font-size:12px; color:var(--muted); min-width:100px; }
      .bsw .b-rev-v { font-size:13px; font-weight:600; text-align:right; flex:1; word-break:break-word; }
      .bsw .b-rev-v.b-hl { color:var(--accent2); }
      .bsw .b-sep { border:none; border-top:1px solid var(--border); margin:16px 0; }
      .bsw .b-rev-total { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--dark); color:#fff; border-radius:10px; margin-top:6px; font-size:13px; font-weight:600; }
      .bsw .b-rev-total-v { font-size:20px; font-weight:600; }

      .bsw .b-btn-row { display:flex; gap:10px; margin-top:18px; }
      .bsw .b-btn { padding:12px 16px; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; border:none; font-family:inherit; flex:1; }
      .bsw .b-btn-primary { background:var(--accent); color:#fff; }
      .bsw .b-btn-primary:hover { background:var(--accent2); }
      .bsw .b-btn-primary:disabled { opacity:.5; cursor:not-allowed; }
      .bsw .b-btn-ghost { background:transparent; border:1.5px solid var(--border); color:var(--dark); }

      .bsw .b-err { background:rgba(220,38,38,0.07); border:1px solid rgba(220,38,38,0.25); border-radius:10px; padding:12px 14px; font-size:13px; margin-top:12px; color:#991b1b; }
      .bsw .b-err-msg { padding:14px; background:#fef2f2; border:1px solid #fecaca; color:#991b1b; border-radius:10px; font-size:13px; }
      .bsw .b-spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,0.4); border-top-color:#fff; border-radius:50%; animation:bs-spin 0.7s linear infinite; vertical-align:middle; margin-right:6px; }
      @keyframes bs-spin { to { transform:rotate(360deg); } }

      .bsw .b-success { text-align:center; padding:32px 20px; }
      .bsw .b-success-icon { font-size:48px; margin-bottom:12px; display:block; color:var(--success); }
      .bsw .b-success h3 { font-size:20px; font-weight:600; margin:0 0 8px; color:var(--dark); }
      .bsw .b-success p { color:var(--muted); font-size:14px; line-height:1.6; margin:0 0 20px; }
      .bsw .b-order-badge { display:inline-block; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:8px 16px; font-size:13px; font-weight:600; color:var(--accent2); margin-bottom:20px; font-family:monospace; }
    `}</style>
  );
}
