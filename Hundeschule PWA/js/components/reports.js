// /js/components/reports.js
"use strict";

import { esc } from "../core/utils.js";
import { customers, visits, stays, getCustomerById } from "../core/storage.js";

/* ------------------------------------------------------------------ */
/* Navigation Helper – zu Kunden (Rechnung/Details) springen          */
/* ------------------------------------------------------------------ */
export function gotoCustomerInvoice(cid) {
  const go = window.navGo || (window.show ? (s) => window.show(s) : null);
  if (go) go("admin_customers");
  if (typeof window.openCustomer === "function") {
    window.openCustomer(cid);
  }
}

/* ------------------------------------------------------------------ */
/* REPORT: Tages‑Buchungen (Tabelle)                                   */
/* ------------------------------------------------------------------ */
export function renderReports() {
  const wrap = document.getElementById("r_table");
  const from = document.getElementById("r_from")?.value || "";
  const to = document.getElementById("r_to")?.value || "";
  const mFilter = document.getElementById("r_method")?.value || "all";
  const sFilter = document.getElementById("r_status")?.value || "all";

  const inRange = (d) => {
    if (!d) return true;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };
  const passMethod = (v) => {
    if (mFilter === "all") return true;
    if (mFilter === "ten") return v.method === "ten";
    if (mFilter === "cash") return v.method === "cash";
    if (mFilter === "invoice") return v.method === "invoice";
    return true;
  };
  const passStatus = (v) => {
    if (sFilter === "all") return true;
    // offene: nicht 10er-Karte & nicht bezahlt
    if (sFilter === "open") return v.method !== "ten" && v.payStatus !== "paid";
    if (sFilter === "paid") return v.method === "ten" || v.payStatus === "paid";
    return true;
  };

  const V = visits.filter((v) => inRange(v.date)).filter(passMethod).filter(passStatus);

  let html = `
<table>
  <tr>
    <th>Datum</th>
    <th>Kunde</th>
    <th>Hund</th>
    <th>CI</th>
    <th>CO</th>
    <th>Art</th>
    <th>Status</th>
    <th>Betrag (€)</th>
  </tr>
`;
  V.forEach((v) => {
    const c = getCustomerById(v.customerId);
    const d = (c?.dogs || []).find((y) => y.id === v.dogId);
    const open = v.method !== "ten" && v.payStatus !== "paid";
    html += `
  <tr>
    <td>${esc(v.date || "")}</td>
    <td>${esc(c?.name || "")}</td>
    <td>${esc(d?.name || "")}</td>
    <td>${v.checkinAt ? new Date(v.checkinAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</td>
    <td>${v.checkoutAt ? new Date(v.checkoutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</td>
    <td>${v.method === "ten" ? "10er" : (v.method === "cash" ? "Bar" : "Rechnung")}</td>
    <td>${open ? "offen" : "bezahlt"}</td>
    <td>${Number(v.charged || 0).toFixed(2)}</td>
  </tr>`;
  });
  html += `</table>`;
  wrap.innerHTML = html;

  // Summe offene Tagesposten
  const openVisit = visits.filter(
    (v) => v.method !== "ten" && v.payStatus !== "paid" && inRange(v.date)
  );
  const sumVisit = openVisit.reduce((a, v) => a + Number(v.charged || 0), 0);
  document.getElementById("r_summary").innerHTML =
    `Offene Posten (Tag): <strong>${sumVisit.toFixed(2)} €</strong>`;
}

/* ------------------------------------------------------------------ */
/* REPORT: Umsatz gesamt                                              */
/* ------------------------------------------------------------------ */
export function renderRevenueAll() {
  const type = document.getElementById("rev_type")?.value || "all"; // all|cards|payments
  const from = document.getElementById("rev_from")?.value || "";
  const inRange = (d) => {
    if (!from) return true;
    if (!d) return false;
    return d >= from;
  };

  const rows = [];

  // 10er‑Karten (Käufe) – aus der Customer.tenHistory
  customers.forEach((c) => {
    (c.tenHistory || [])
      .filter((p) => p.type === "purchase" && p.payStatus === "paid" && inRange((p.date || "").slice(0, 10)))
      .forEach((p) => {
        if (type === "all" || type === "cards") {
          rows.push({
            date: (p.date || "").slice(0, 10),
            owner: c.name,
            dog: "—",
            cat: "Karte",
            amt: Number(p.price || 0),
          });
        }
      });
  });

  // Tageshunde (Bar/Rechnung; 10er-Karte ist schon oben erfasst)
  visits
    .filter((v) => v.payStatus === "paid" && v.method !== "ten" && inRange(v.date))
    .forEach((v) => {
      if (type === "all" || type === "payments") {
        const c = getCustomerById(v.customerId);
        const d = (c?.dogs || []).find((x) => x.id === v.dogId);
        rows.push({
          date: v.date,
          owner: c?.name || "",
          dog: d?.name || "",
          cat: "Tag",
          amt: Number(v.charged || 0),
        });
      }
    });

  // Pension (bezahlt)
  stays
    .filter((s) => s.payStatus === "paid" && inRange(((s.checkoutDate || s.checkinAt || "") + "").slice(0, 10)))
    .forEach((s) => {
      if (type === "all" || type === "payments") {
        const c = getCustomerById(s.customerId);
        const d = (c?.dogs || []).find((x) => x.id === s.dogId);
        rows.push({
          date: ((s.checkoutDate || s.checkinAt || "") + "").slice(0, 10),
          owner: c?.name || "",
          dog: d?.name || "",
          cat: "Pension",
          amt: Number(s.price || 0),
        });
      }
    });

  // Sortierung: jüngstes Datum zuerst
  rows.sort((a, b) => (a.date > b.date ? -1 : 1));

  let sum = 0;
  let html = `
<table>
  <tr>
    <th>Datum</th>
    <th>Besitzer</th>
    <th>Hund</th>
    <th>Kategorie</th>
    <th>Betrag (€)</th>
  </tr>`;
  rows.forEach((r) => {
    sum += Number(r.amt || 0);
    html += `
  <tr>
    <td>${esc(r.date || "")}</td>
    <td>${esc(r.owner || "")}</td>
    <td>${esc(r.dog || "")}</td>
    <td>${esc(r.cat || "")}</td>
    <td>${Number(r.amt || 0).toFixed(2)}</td>
  </tr>`;
  });
  html += `</table>`;
  document.getElementById("rev_table").innerHTML = html;
  document.getElementById("rev_summary").textContent = `Summe: ${sum.toFixed(2)} €`;
}

/* ------------------------------------------------------------------ */
/* REPORT: Konflikte (Dubletten, Fehler)                               */
/* ------------------------------------------------------------------ */
export function renderConflictReport() {
  const C = buildConflicts();
  const wrap = document.getElementById("r_conflicts");
  if (C.length === 0) {
    wrap.innerHTML = `<p class="muted">Konflikt‑Report: keine Auffälligkeiten.</p>`;
    return;
  }
  let html = `
<h4>Konflikt‑Report</h4>
<table>
  <tr>
    <th>Typ</th>
    <th>Besitzer</th>
    <th>Hund</th>
    <th>Details</th>
  </tr>`;
  C.forEach((x) => {
    html += `
  <tr>
    <td>${esc(x.type)}</td>
    <td>${esc(x.owner || "")}</td>
    <td>${esc(x.dog || "")}</td>
    <td>${esc(x.details || "")}</td>
  </tr>`;
  });
  html += `</table>`;
  wrap.innerHTML = html;
}

/* ------------------------------------------------------------------ */
/* Konflikt‑Erkennung                                                 */
/* ------------------------------------------------------------------ */
export function buildConflicts() {
  const out = [];
  const byKey = {};

  // doppelte offene Tages‑Einträge (gleiches Datum+Hund, mehrfach offen)
  visits.forEach((v) => {
    if (!v.date || !v.dogId) return;
    const key = `${v.dogId}\n${v.date}`;
    byKey[key] = byKey[key] || [];
    byKey[key].push(v);
  });
  Object.keys(byKey).forEach((k) => {
    const arr = byKey[k].filter((v) => !v.checkoutAt);
    if (arr.length > 1) {
      arr.forEach((v) => {
        const c = getCustomerById(v.customerId);
        const d = (c?.dogs || []).find((x) => x.id === v.dogId);
        out.push({
          type: "Doppelter Tages‑CI",
          owner: c?.name || "",
          dog: d?.name || "",
          details: `${v.date} · mehrere offene Einträge`,
        });
      });
    }
  });

  // CO < CI (TAG)
  visits.forEach((v) => {
    if (v.checkoutAt && v.checkinAt && new Date(v.checkoutAt) < new Date(v.checkinAt)) {
      const c = getCustomerById(v.customerId);
      const d = (c?.dogs || []).find((x) => x.id === v.dogId);
      out.push({
        type: "Tag: CO vor CI",
        owner: c?.name || "",
        dog: d?.name || "",
        details: v.date,
      });
    }
  });

  // CO < CI (PENSION)
  stays.forEach((s) => {
    if (s.checkoutDate && s.checkinAt && new Date(s.checkoutDate) < new Date(s.checkinAt)) {
      const c = getCustomerById(s.customerId);
      const d = (c?.dogs || []).find((x) => x.id === s.dogId);
      out.push({
        type: "Pension: CO vor CI",
        owner: c?.name || "",
        dog: d?.name || "",
        details: `CI ${new Date(s.checkinAt).toLocaleDateString()} · CO ${new Date(s.checkoutDate).toLocaleDateString()}`,
      });
    }
  });

  // Tag & Pension überschneiden
  visits.forEach((v) => {
    const overlaps = stays.filter((s) => {
      const ci = new Date(s.checkinAt).toISOString().slice(0, 10);
      const co = s.checkoutDate ? new Date(s.checkoutDate).toISOString().slice(0, 10) : null;
      const day = v.date;
      if (s.dogId !== v.dogId) return false;
      if (co) return ci <= day && co >= day;
      return ci <= day;
    });
    if (overlaps.length > 0) {
      const c = getCustomerById(v.customerId);
      const d = (c?.dogs || []).find((x) => x.id === v.dogId);
      out.push({
        type: "Tag & Pension überschneiden",
        owner: c?.name || "",
        dog: d?.name || "",
        details: v.date,
      });
    }
  });

  // 10er-Karten überzählt
  customers.forEach((c) => {
    (c.tenHistory || []).forEach((p) => {
      const used = Number(p.used || 0);
      const size = Number(p.size || 0);
      if (used > size && size > 0) {
        out.push({
          type: "10er‑Karte überzählt",
          owner: c.name,
          dog: "",
          details: `Used ${used} > Size ${size}`,
        });
      }
    });
  });

  return out;
}

/* ---------------------------- Window-Bindings ---------------------------- */
window.renderReports = renderReports;
window.renderRevenueAll = renderRevenueAll;
window.renderConflictReport = renderConflictReport;
window.buildConflicts = buildConflicts;
window.gotoCustomerInvoice = gotoCustomerInvoice;

export default {};