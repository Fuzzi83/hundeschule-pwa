// /js/components/reports.js
"use strict";

/*
  AUSWERTUNGEN – Accordion + persistent open/closed

  Abschnitte (wie Kundendialog):
  1) Offene Posten (ganz oben)
  2) Umsatz (Filter: Zeitraum, Kunde, Zahlart)
  3) Buchungen (Filter: Zeitraum, Kunde, Zahlart, Status)

  Default Zeitraum: letzte 30 Tage
*/

import { esc, toast } from "../core/utils.js";
import { settings, customers, visits, stays, getCustomerById } from "../core/storage.js";

/* ----------------------------- helpers ----------------------------- */
function byId(id) { return document.getElementById(id); }
function fmtEUR(n) {
  return Number(n || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}
function toISODate(d) {
  if (!d) return "";
  const dt = (d instanceof Date) ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}
function defaultFromTo30Days() {
  const today = new Date();
  const from = addDays(today, -30);
  return { from: toISODate(from), to: toISODate(today) };
}
function inRange(dateISO, fromISO, toISO) {
  if (!dateISO) return false;
  if (fromISO && dateISO < fromISO) return false;
  if (toISO && dateISO > toISO) return false;
  return true;
}
function methodLabel(m) {
  if (m === "cash") return "Bar";
  if (m === "invoice") return "Rechnung";
  if (m === "card" || m === "ten") return "Karte";
  if (m === "other") return "Sonstiges";
  return m || "—";
}
function safeTimeFromISO(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function dogName(customerId, dogId) {
  const c = getCustomerById(customerId);
  const d = (c?.dogs || []).find(x => x.id === dogId);
  return d?.name || "—";
}

/* ----------------------------- persistent accordion state ----------------------------- */
const ACC_KEYS = {
  open: "rep_acc_open_v1",
  revenue: "rep_acc_rev_v1",
  bookings: "rep_acc_book_v1",
};
function getAccOpen(key, def = true) {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return !!def;
    return v === "1";
  } catch {
    return !!def;
  }
}
function setAccOpen(key, open) {
  try { localStorage.setItem(key, open ? "1" : "0"); } catch {}
}

/* ----------------------------- navigation to customer invoices ----------------------------- */
export function gotoCustomerInvoice(cid) {
  const go = window.go || window.navGo || window.showSection || window.show;
  if (typeof go === "function") go("admin_customers");

  if (typeof window.openCustomer === "function") window.openCustomer(cid);
  else if (typeof window.openCustomerDialog === "function") window.openCustomerDialog(cid);

  if (typeof window.openCustomerInvoicesAccordion === "function") {
    try { window.openCustomerInvoicesAccordion(cid); } catch {}
  }
}
window.gotoCustomerInvoice = gotoCustomerInvoice;

/* ----------------------------- unify data rows ----------------------------- */
function loadTrainingRows(fromISO, toISO) {
  const tr = Array.isArray(settings.trainings) ? settings.trainings : [];
  const rows = [];
  for (const t of tr) {
    const date = toISODate(t.checkinAt || t.date || t.checkoutAt);
    if (!inRange(date, fromISO, toISO)) continue;
    const c = getCustomerById(t.customerId);
    rows.push({
      id: t.id || `${t.customerId}:${t.dogId}:${date}:${Math.random()}`,
      type: "HT",
      date,
      customerId: t.customerId,
      customerName: c?.name || "",
      dogName: dogName(t.customerId, t.dogId),
      method: t.method || "cash",
      payStatus: t.payStatus || ((t.method === "card") ? "paid" : "open"),
      invoiceIssued: (t.invoiceIssued ?? null),
      amount: Number(t.charged || 0) || 0,
      meta: (t.typeName ? String(t.typeName) : "Training") + (t.checkinAt ? ` · CI ${safeTimeFromISO(t.checkinAt)}` : "")
    });
  }
  return rows;
}

function loadDayRows(fromISO, toISO) {
  const rows = [];
  for (const v of (visits || [])) {
    const date = v.date || toISODate(v.checkinAt || v.checkoutAt);
    if (!inRange(date, fromISO, toISO)) continue;

    const c = getCustomerById(v.customerId);
    const method = v.method === "ten" ? "card" : (v.method || "cash");
    rows.push({
      id: v.id || `${v.customerId}:${v.dogId}:${date}:${Math.random()}`,
      type: "TH",
      date,
      customerId: v.customerId,
      customerName: c?.name || "",
      dogName: dogName(v.customerId, v.dogId),
      method,
      payStatus: v.payStatus || (method === "card" ? "paid" : "open"),
      invoiceIssued: (v.invoiceIssued ?? null),
      amount: Number(v.charged || 0) || 0,
      meta: (v.checkinAt ? `CI ${safeTimeFromISO(v.checkinAt)}` : "") + (v.checkoutAt ? ` · CO ${safeTimeFromISO(v.checkoutAt)}` : "")
    });
  }
  return rows;
}

function loadStayRows(fromISO, toISO) {
  const rows = [];
  for (const s of (stays || [])) {
    const date = toISODate(s.checkoutDate || s.checkoutAt || s.checkinAt);
    if (!inRange(date, fromISO, toISO)) continue;

    const c = getCustomerById(s.customerId);
    rows.push({
      id: s.id || `${s.customerId}:${s.dogId}:${date}:${Math.random()}`,
      type: "PH",
      date,
      customerId: s.customerId,
      customerName: c?.name || "",
      dogName: dogName(s.customerId, s.dogId),
      method: s.method || "cash",
      payStatus: s.payStatus || (s.method === "card" ? "paid" : "open"),
      invoiceIssued: (s.invoiceIssued ?? null),
      amount: Number(s.price || s.charged || 0) || 0,
      meta: (s.checkinAt ? `CI ${safeTimeFromISO(s.checkinAt)}` : "") + (s.checkoutAt ? ` · CO ${safeTimeFromISO(s.checkoutAt)}` : "")
    });
  }
  return rows;
}

function loadHourPackPurchaseRows(fromISO, toISO) {
  const rows = [];
  for (const c of (customers || [])) {
    for (const k of (c.cards || [])) {
      const date = toISODate(String(k.date || "").slice(0, 10) || k.date);
      if (!date || !inRange(date, fromISO, toISO)) continue;

      const method = k.method || "cash";
      const payStatus = k.payStatus || (method === "card" ? "paid" : "open");

      rows.push({
        id: k.id || `${c.id}:${date}:${k.packId || k.packName || "SP"}:${Math.random()}`,
        type: "SP",
        date,
        customerId: c.id,
        customerName: c.name || "",
        dogName: "—",
        method,
        payStatus,
        invoiceIssued: (k.invoiceIssued ?? null),
        amount: Number(k.pricePaid || 0) || 0,
        meta: k.packName ? String(k.packName) : (k.name ? String(k.name) : "Stundenpaket")
      });
    }
  }
  return rows;
}

function buildAllRows(fromISO, toISO) {
  const rows = [
    ...loadDayRows(fromISO, toISO),
    ...loadStayRows(fromISO, toISO),
    ...loadTrainingRows(fromISO, toISO),
    ...loadHourPackPurchaseRows(fromISO, toISO),
  ];
  rows.sort((a, b) => (a.date < b.date ? 1 : (a.date > b.date ? -1 : 0)));
  return rows;
}

/* ----------------------------- open items logic ----------------------------- */
function isOpenInvoiceRow(r) {
  const open = String(r.payStatus || "").toLowerCase() !== "paid";
  const invoiceLike = (r.method === "invoice") || (r.invoiceIssued === true);
  return invoiceLike && open && Number(r.amount || 0) > 0;
}

/* ----------------------------- CSV export ----------------------------- */
function downloadCSV(filename, headers, rows) {
  const escCSV = (v) => {
    const s = String(v ?? "");
    if (s.includes('"') || s.includes(";") || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [];
  lines.push(headers.map(escCSV).join(";"));
  for (const r of rows) lines.push(headers.map(h => escCSV(r[h])).join(";"));

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ----------------------------- UI (accordion + mobile) ----------------------------- */
function injectStylesOnce() {
  if (byId("reports_css")) return;
  const st = document.createElement("style");
  st.id = "reports_css";
  st.textContent = `
    .rep-acc-head{
      display:flex; align-items:center; justify-content:space-between;
      gap:12px; cursor:pointer; user-select:none;
      padding:12px 14px;
      border-radius:14px;
      background: rgba(0,0,0,.04);
      border: 1px solid rgba(0,0,0,.08);
      margin: 10px 0;
    }
    .rep-acc-left{ display:flex; flex-direction:column; gap:2px; }
    .rep-acc-title{ font-weight:900; }
    .rep-acc-sub{ font-size:12px; opacity:.75; }
    .rep-acc-right{ display:flex; align-items:center; gap:10px; }
    .rep-acc-sum{ font-weight:900; white-space:nowrap; }
    .rep-acc-arrow{
      display:flex; align-items:center; justify-content:center;
      width:28px; height:28px; border-radius:10px;
      background:#fff; border:1px solid rgba(0,0,0,.10);
      font-weight:900;
      transition: transform .12s ease;
    }
    .rep-acc-body{ padding: 0 2px 6px 2px; }

    .rep-grid{ display:flex; gap:10px; flex-wrap:wrap; }
    .rep-grid > *{ flex:1; min-width:160px; }
    .rep-row{ display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
    .rep-chip{ display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:999px; font-size:12px; border:1px solid rgba(0,0,0,.12); background:#fff; }
    .rep-chip.open{ border-color: rgba(229,57,53,.45); background: rgba(229,57,53,.06); }
    .rep-chip.paid{ border-color: rgba(33,150,243,.35); background: rgba(33,150,243,.06); }
    .rep-mini{ font-size:12px; opacity:.75; margin-top:2px; }
    .rep-table{ width:100%; border-collapse:collapse; }
    .rep-table th, .rep-table td{ padding:8px 6px; border-bottom:1px solid rgba(0,0,0,.08); text-align:left; vertical-align:top; }
    .rep-table th{ font-size:12px; opacity:.8; }
    @media (max-width: 640px){
      .rep-table{ display:none; }
    }
  `;
  document.head.appendChild(st);
}

function getReportsRoot() {
  const main = byId("revenueRoot") || byId("reportsRoot") || null;
  const legacyOpen = byId("openItemsRoot") || null;
  return { main, legacyOpen };
}

function accSectionHTML(id, title, subtitle, sumText, open, badgeHTML = "") {
  return `
    <div class="rep-acc-head" id="${esc(id)}_head">
      <div class="rep-acc-left">
        <div class="rep-acc-title">${esc(title)} ${badgeHTML}</div>
        <div class="rep-acc-sub">${esc(subtitle)}</div>
      </div>
      <div class="rep-acc-right">
        <div class="rep-acc-sum">${esc(sumText)}</div>
        <div class="rep-acc-arrow" id="${esc(id)}_arrow" style="transform:${open ? "rotate(90deg)" : "rotate(0deg)"}">›</div>
      </div>
    </div>
    <div class="rep-acc-body" id="${esc(id)}_body" style="display:${open ? "" : "none"}"></div>
  `;
}

function customerOptionsHTML() {
  return (
    `<option value="all">Alle Kunden</option>` +
    (customers || []).slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "de"))
      .map(c => `<option value="${esc(c.id)}">${esc(c.name || "")}</option>`)
      .join("")
  );
}

/* ----------------------------- UI blocks ----------------------------- */
function revenueFiltersHTML(state) {
  return `
    <div class="card" style="padding:12px; margin-bottom:10px">
      <div class="rep-grid">
        <label>Von
          <input id="rev_from" type="date" value="${esc(state.from)}">
        </label>
        <label>Bis
          <input id="rev_to" type="date" value="${esc(state.to)}">
        </label>
        <label>Kunde
          <select id="rev_customer">${customerOptionsHTML()}</select>
        </label>
        <label>Zahlart
          <select id="rev_method">
            <option value="all">alle</option>
            <option value="cash">Bar</option>
            <option value="invoice">Rechnung</option>
            <option value="card">Karte</option>
            <option value="other">Sonstiges</option>
          </select>
        </label>
      </div>
      <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-top:10px; align-items:center">
        <div class="rep-acc-sub">Standard: letzte 30 Tage</div>
        <div style="display:flex; gap:8px; flex-wrap:wrap">
          <button class="btn outline" type="button" id="rev_btn_30">Letzte 30 Tage</button>
          <button class="btn" type="button" id="rev_btn_export">Export Umsatz (CSV)</button>
        </div>
      </div>
    </div>
    <div id="rev_out"></div>
  `;
}

function bookingsFiltersHTML(state) {
  return `
    <div class="card" style="padding:12px; margin-bottom:10px">
      <div class="rep-grid">
        <label>Von
          <input id="bk_from" type="date" value="${esc(state.from)}">
        </label>
        <label>Bis
          <input id="bk_to" type="date" value="${esc(state.to)}">
        </label>
        <label>Status
          <select id="bk_status">
            <option value="all">alle</option>
            <option value="paid">bezahlt</option>
            <option value="open">offen</option>
          </select>
        </label>
        <label>Kunde
          <select id="bk_customer">${customerOptionsHTML()}</select>
        </label>
        <label>Zahlart
          <select id="bk_method">
            <option value="all">alle</option>
            <option value="cash">Bar</option>
            <option value="invoice">Rechnung</option>
            <option value="card">Karte</option>
            <option value="other">Sonstiges</option>
          </select>
        </label>
      </div>
      <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-top:10px; align-items:center">
        <div class="rep-acc-sub">TH=Tageshunde · PH=Pensionshunde · SP=Stundenpaket · HT=Hundetraining</div>
        <div style="display:flex; gap:8px; flex-wrap:wrap">
          <button class="btn outline" type="button" id="bk_btn_30">Letzte 30 Tage</button>
          <button class="btn" type="button" id="bk_btn_export">Export Buchungen (CSV)</button>
        </div>
      </div>
    </div>
    <div id="bk_out"></div>
  `;
}

function applyFilters(rows, { from, to, customerId, method, status }) {
  let out = rows.filter(r => inRange(r.date, from, to));
  if (customerId && customerId !== "all") out = out.filter(r => r.customerId === customerId);
  if (method && method !== "all") out = out.filter(r => r.method === method);
  if (status && status !== "all") {
    const wantOpen = status === "open";
    out = out.filter(r => (String(r.payStatus || "").toLowerCase() !== "paid") === wantOpen);
  }
  return out;
}

/* ----------------------------- section renders ----------------------------- */
function renderOpenItemsSection(bodyEl, rowsAll, fromISO, toISO) {
  const open = rowsAll.filter(r => inRange(r.date, fromISO, toISO)).filter(isOpenInvoiceRow);
  const sum = open.reduce((a, r) => a + Number(r.amount || 0), 0);

  bodyEl.innerHTML = `
    <div class="card" style="padding:12px">
      <div class="rep-row">
        <div class="rep-acc-sub">Bearbeitung nur im Kundendialog → Bereich „Rechnungen“.</div>
        <div class="rep-acc-sum">${fmtEUR(sum)}</div>
      </div>
      <div style="height:1px;background:rgba(0,0,0,.08);margin:10px 0"></div>
      <div>
        ${
          open.length === 0
            ? `<div class="muted">Keine offenen Posten im Zeitraum.</div>`
            : open.map(r => `
              <div class="card" style="padding:10px 12px; margin:8px 0; cursor:pointer"
                   onclick="window.gotoCustomerInvoice && window.gotoCustomerInvoice('${esc(r.customerId)}')">
                <div class="rep-row">
                  <div>
                    <div><strong>${esc(r.customerName || "")}</strong> <span class="rep-mini">· ${esc(r.type)}</span></div>
                    <div class="rep-mini">${esc(r.date)} · ${esc(r.dogName || "—")} · ${esc(r.meta || "")}</div>
                    <div class="rep-mini">${esc(methodLabel(r.method))} · offen</div>
                  </div>
                  <div class="rep-acc-sum">${fmtEUR(r.amount)}</div>
                </div>
              </div>
            `).join("")
        }
      </div>
    </div>
  `;

  return { count: open.length, sum };
}

function renderRevenueSection(bodyEl, rowsAll, ui) {
  const filtered = applyFilters(rowsAll, { ...ui, status: "paid" }).filter(r => String(r.payStatus || "").toLowerCase() === "paid");
  const sum = filtered.reduce((a, r) => a + Number(r.amount || 0), 0);

  const groups = new Map();
  for (const r of filtered) {
    const key = methodLabel(r.method);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const groupEntries = Array.from(groups.entries()).map(([k, list]) => {
    const s = list.reduce((a, r) => a + Number(r.amount || 0), 0);
    return { k, list, s };
  }).sort((a, b) => b.s - a.s);

  bodyEl.innerHTML = revenueFiltersHTML(ui);

  byId("rev_customer").value = ui.customerId || "all";
  byId("rev_method").value = ui.method || "all";

  const out = byId("rev_out");
  if (!out) return { sum: 0 };

  out.innerHTML = (filtered.length === 0)
    ? `<div class="muted">Kein Umsatz (bezahlt) im Filter.</div>`
    : groupEntries.map(g => `
        <div class="card" style="padding:10px 12px; margin:8px 0">
          <div class="rep-row">
            <div><strong>${esc(g.k)}</strong> <span class="rep-mini">(${g.list.length} Einträge)</span></div>
            <div class="rep-acc-sum">${fmtEUR(g.s)}</div>
          </div>
          <div class="rep-mini" style="margin-top:6px">
            ${g.list.slice(0, 6).map(r => `${esc(r.type)} ${esc(r.customerName || "")} ${fmtEUR(r.amount)}`).join(" · ")}
            ${g.list.length > 6 ? ` · …` : ``}
          </div>
        </div>
      `).join("");

  const rerender = () => window.renderReportsPage && window.renderReportsPage();

  byId("rev_from")?.addEventListener("change", rerender);
  byId("rev_to")?.addEventListener("change", rerender);
  byId("rev_customer")?.addEventListener("change", rerender);
  byId("rev_method")?.addEventListener("change", rerender);

  byId("rev_btn_30")?.addEventListener("click", () => {
    const d = defaultFromTo30Days();
    byId("rev_from").value = d.from;
    byId("rev_to").value = d.to;
    rerender();
  });

  byId("rev_btn_export")?.addEventListener("click", () => {
    const rows = filtered.map(r => ({
      Datum: r.date,
      Kunde: r.customerName,
      Hund: r.dogName,
      Was: r.type,
      Details: r.meta,
      Zahlart: methodLabel(r.method),
      Betrag: Number(r.amount || 0).toFixed(2),
    }));
    downloadCSV(`umsatz_${ui.from}_${ui.to}.csv`,
      ["Datum","Kunde","Hund","Was","Details","Zahlart","Betrag"], rows);
    toast("CSV Export erstellt.");
  });

  return { sum };
}

function renderBookingsSection(bodyEl, rowsAll, ui) {
  const filtered = applyFilters(rowsAll, ui);
  const sum = filtered.reduce((a, r) => a + Number(r.amount || 0), 0);

  bodyEl.innerHTML = bookingsFiltersHTML(ui);

  byId("bk_customer").value = ui.customerId || "all";
  byId("bk_method").value = ui.method || "all";
  byId("bk_status").value = ui.status || "all";

  const out = byId("bk_out");
  if (!out) return { sum: 0 };

  const table = `
    <table class="rep-table">
      <tr>
        <th>Datum</th><th>Kunde</th><th>Hund</th><th>Was</th><th>Zahlart</th><th>Status</th><th>Betrag</th>
      </tr>
      ${filtered.map(r => {
        const isOpen = String(r.payStatus || "").toLowerCase() !== "paid";
        return `
          <tr>
            <td>${esc(r.date)}</td>
            <td>${esc(r.customerName || "")}</td>
            <td>${esc(r.dogName || "—")}</td>
            <td>${esc(r.type)} · ${esc(r.meta || "")}</td>
            <td>${esc(methodLabel(r.method))}</td>
            <td>${esc(isOpen ? "offen" : "bezahlt")}</td>
            <td>${esc(Number(r.amount||0).toFixed(2))}</td>
          </tr>
        `;
      }).join("")}
    </table>
  `;

  const cards = filtered.map(r => {
    const isOpen = String(r.payStatus || "").toLowerCase() !== "paid";
    const chipCls = isOpen ? "open" : "paid";
    return `
      <div class="card" style="padding:10px 12px; margin:8px 0">
        <div class="rep-row">
          <div>
            <div>
              <strong>${esc(r.customerName || "")}</strong>
              <span class="rep-chip ${chipCls}" style="margin-left:6px">${esc(r.type)} · ${isOpen ? "offen" : "bezahlt"}</span>
            </div>
            <div class="rep-mini">${esc(r.date)} · ${esc(r.dogName || "—")} · ${esc(r.meta || "")}</div>
            <div class="rep-mini">${esc(methodLabel(r.method))}</div>
          </div>
          <div class="rep-acc-sum">${fmtEUR(r.amount)}</div>
        </div>
      </div>
    `;
  }).join("");

  out.innerHTML = (filtered.length === 0)
    ? `<div class="muted">Keine Buchungen im Filter.</div>`
    : `${table}<div>${cards}</div>`;

  const rerender = () => window.renderReportsPage && window.renderReportsPage();

  byId("bk_from")?.addEventListener("change", rerender);
  byId("bk_to")?.addEventListener("change", rerender);
  byId("bk_customer")?.addEventListener("change", rerender);
  byId("bk_method")?.addEventListener("change", rerender);
  byId("bk_status")?.addEventListener("change", rerender);

  byId("bk_btn_30")?.addEventListener("click", () => {
    const d = defaultFromTo30Days();
    byId("bk_from").value = d.from;
    byId("bk_to").value = d.to;
    rerender();
  });

  byId("bk_btn_export")?.addEventListener("click", () => {
    const rows = filtered.map(r => ({
      Datum: r.date,
      Kunde: r.customerName,
      Hund: r.dogName,
      Was: r.type,
      Details: r.meta,
      Zahlart: methodLabel(r.method),
      Status: (String(r.payStatus || "").toLowerCase() === "paid") ? "bezahlt" : "offen",
      Betrag: Number(r.amount || 0).toFixed(2),
    }));
    downloadCSV(`buchungen_${ui.from}_${ui.to}.csv`,
      ["Datum","Kunde","Hund","Was","Details","Zahlart","Status","Betrag"], rows);
    toast("CSV Export erstellt.");
  });

  return { sum };
}

/* ----------------------------- main render ----------------------------- */
export function renderReportsPage() {
  injectStylesOnce();

  const { main, legacyOpen } = getReportsRoot();
  if (!main) return;
  if (legacyOpen) legacyOpen.innerHTML = "";

  if (!window.__rep_state_v2) {
    const d = defaultFromTo30Days();
    window.__rep_state_v2 = {
      open: { from: d.from, to: d.to },
      revenue: { from: d.from, to: d.to, customerId: "all", method: "all" },
      bookings: { from: d.from, to: d.to, customerId: "all", method: "all", status: "all" },
    };
  }
  const st = window.__rep_state_v2;

  const maxFrom = st.bookings.from || st.revenue.from || st.open.from;
  const maxTo = st.bookings.to || st.revenue.to || st.open.to;
  const rowsAll = buildAllRows(maxFrom, maxTo);

  const openAccOpen = getAccOpen(ACC_KEYS.open, true);
  const revAccOpen = getAccOpen(ACC_KEYS.revenue, true);
  const bookAccOpen = getAccOpen(ACC_KEYS.bookings, false);

  const openInRange = rowsAll.filter(r => inRange(r.date, st.open.from, st.open.to)).filter(isOpenInvoiceRow);
  const openSum = openInRange.reduce((a, r) => a + Number(r.amount || 0), 0);

  const revFiltered = applyFilters(rowsAll, { ...st.revenue, status: "paid" }).filter(r => String(r.payStatus || "").toLowerCase() === "paid");
  const revSum = revFiltered.reduce((a, r) => a + Number(r.amount || 0), 0);

  const bkFiltered = applyFilters(rowsAll, st.bookings);
  const bkSum = bkFiltered.reduce((a, r) => a + Number(r.amount || 0), 0);

  const openBadge = openInRange.length
    ? `<span class="rep-chip open" style="margin-left:6px">(${openInRange.length})</span>`
    : ``;

  main.innerHTML = `
    ${accSectionHTML("rep_open", "Offene Posten", "Klick → Kunde → Rechnungen", fmtEUR(openSum), openAccOpen, openBadge)}
    ${accSectionHTML("rep_rev", "Umsatz", "Filter: Zeitraum · Kunde · Zahlart", fmtEUR(revSum), revAccOpen)}
    ${accSectionHTML("rep_bk", "Buchungen", "Filter: Zeitraum · Kunde · Zahlart · Status · TH/PH/SP/HT", fmtEUR(bkSum), bookAccOpen)}
  `;

  function bindAcc(id, key) {
    const head = byId(id + "_head");
    const body = byId(id + "_body");
    const arrow = byId(id + "_arrow");
    if (!head || !body || !arrow) return;

    head.addEventListener("click", () => {
      const now = body.style.display !== "none";
      const next = !now;
      body.style.display = next ? "" : "none";
      arrow.style.transform = next ? "rotate(90deg)" : "rotate(0deg)";
      setAccOpen(key, next);
    });
  }
  bindAcc("rep_open", ACC_KEYS.open);
  bindAcc("rep_rev", ACC_KEYS.revenue);
  bindAcc("rep_bk", ACC_KEYS.bookings);

  if (openAccOpen) {
    const b = byId("rep_open_body");
    if (b) renderOpenItemsSection(b, rowsAll, st.open.from, st.open.to);
  }

  if (revAccOpen) {
    const b = byId("rep_rev_body");
    if (b) {
      const ui = { ...st.revenue };
      const res = renderRevenueSection(b, rowsAll, ui);

      st.revenue = {
        from: byId("rev_from")?.value || ui.from,
        to: byId("rev_to")?.value || ui.to,
        customerId: byId("rev_customer")?.value || ui.customerId,
        method: byId("rev_method")?.value || ui.method
      };
      st.open = { from: st.revenue.from, to: st.revenue.to };

      const sumEl = byId("rep_rev_head")?.querySelector(".rep-acc-sum");
      if (sumEl) sumEl.textContent = fmtEUR(res.sum);
    }
  }

  if (bookAccOpen) {
    const b = byId("rep_bk_body");
    if (b) {
      const ui = { ...st.bookings };
      const res = renderBookingsSection(b, rowsAll, ui);

      st.bookings = {
        from: byId("bk_from")?.value || ui.from,
        to: byId("bk_to")?.value || ui.to,
        customerId: byId("bk_customer")?.value || ui.customerId,
        method: byId("bk_method")?.value || ui.method,
        status: byId("bk_status")?.value || ui.status
      };

      const sumEl = byId("rep_bk_head")?.querySelector(".rep-acc-sum");
      if (sumEl) sumEl.textContent = fmtEUR(res.sum);
    }
  }

  window.__rep_state_v2 = st;
}

export function renderReports() { renderReportsPage(); }
export function renderRevenueAll() { renderReportsPage(); }

// Backward compatibility name (falls irgendwo aufgerufen wird)
export function renderOpenItems() { renderReportsPage(); }

window.renderReportsPage = renderReportsPage;
window.renderReports = renderReports;
window.renderRevenueAll = renderRevenueAll;
window.renderOpenItems = renderOpenItems;