// lib/laporan-draft.ts
// Draft autosave for /laporan-teknisi.
//
// The form holds ~15 pieces of state in useState, so a page refresh used to
// wipe everything and drop the technician back to Step 1. This persists the
// serialisable parts to sessionStorage on every change and restores them on
// mount.
//
// sessionStorage (not localStorage) is deliberate: the draft survives a
// refresh, an accidental back-navigation, and the browser reloading a
// backgrounded tab, but is discarded when the tab is closed. Nothing lingers
// on a shared phone.
//
// Photos are NOT persisted. StagedPhoto holds a File, a Blob and an
// ObjectURL; ObjectURLs are void after a reload and blobs can't be JSON'd
// without base64 inflating them past the storage quota. The technician
// re-adds photos after a refresh.

import type { LineItem } from "@/lib/invoices";

const KEY = "aeac.laporan-teknisi.draft";
const VERSION = 1;

export type LaporanDraft = {
  v: number;
  step: 1 | 2 | 3 | 4 | 5;
  selectedOrderId: string;
  selectedTechs: string[];
  jamMulai: string;
  jamSelesai: string;
  serviceCounts: Record<string, number>;
  selectedKondisi: string[];
  selectedTindakan: string[];
  selectedRekomendasi: string[];
  selectedPerbaikan: string[];
  invoiceItems: LineItem[];
  invoiceDiscount: number;
  // Mirrors the lastSeededSig ref so manual invoice edits aren't clobbered by
  // an automatic re-seed after a restore.
  lastSeededSig: string | null;
};

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

// Defensive: sessionStorage can hold anything (older draft shape, a value
// written by a previous deploy, hand-edited junk). Reject rather than let a
// malformed draft crash the form on mount.
function isValidDraft(d: unknown): d is LaporanDraft {
  if (!d || typeof d !== "object") return false;
  const o = d as Record<string, unknown>;
  return (
    o.v === VERSION &&
    typeof o.step === "number" &&
    o.step >= 1 &&
    o.step <= 5 &&
    typeof o.selectedOrderId === "string" &&
    isStringArray(o.selectedTechs) &&
    typeof o.jamMulai === "string" &&
    typeof o.jamSelesai === "string" &&
    typeof o.serviceCounts === "object" &&
    o.serviceCounts !== null &&
    isStringArray(o.selectedKondisi) &&
    isStringArray(o.selectedTindakan) &&
    isStringArray(o.selectedRekomendasi) &&
    isStringArray(o.selectedPerbaikan) &&
    Array.isArray(o.invoiceItems) &&
    typeof o.invoiceDiscount === "number"
  );
}

export function saveDraft(draft: Omit<LaporanDraft, "v">): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ v: VERSION, ...draft }));
  } catch {
    // Quota exceeded or storage disabled (Safari private mode throws on
    // write). Autosave is a convenience, never a requirement — fail silently.
  }
}

export function loadDraft(): LaporanDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidDraft(parsed)) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
