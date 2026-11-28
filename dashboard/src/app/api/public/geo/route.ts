/**
 * GET /api/public/geo — the visitor's country (Cloudflare's `cf-ipcountry`)
 * and whether analytics needs opt-in consent there (EEA, UK, Switzerland).
 * The consent banner calls it once and caches the answer in the browser.
 *
 *   { country: "DE", consentRequired: true }
 *   { country: null, consentRequired: null }   no Cloudflare header (local dev):
 *                                              the client falls back to the time zone
 */

import { countryRequiresConsent } from "@/lib/analytics/config";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const raw = (request.headers.get("cf-ipcountry") || "").trim().toUpperCase();
  // XX = unknown, T1 = Tor exit: no usable country. Tor users get asked.
  const country = /^[A-Z]{2}$/.test(raw) && raw !== "XX" && raw !== "T1" ? raw : null;
  const consentRequired = raw === "T1" ? true : country ? countryRequiresConsent(country) : null;
  return NextResponse.json({ country, consentRequired }, { headers: { "Cache-Control": "private, no-store" } });
}
