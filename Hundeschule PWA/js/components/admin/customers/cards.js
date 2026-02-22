// /js/components/admin/customers/cards.js
"use strict";

import { genId, gv, toast } from "../../core/utils.js";
import { settings, saveAll, getCustomerById } from "../../core/storage.js";
import { getActiveCard, getPurchases } from "./utils.js";
import { getEditCustomerId } from "./state.js";
import { renderCustomerOpenInvoices } from "./openitems.js";
import { renderCustomerRevenue } from "./revenue.js";
import { renderCustomerList } from "./list.js";

/** 10er-Karte buchen */
export function buyTenCard() {
  const c = getCustomerById(getEditCustomerId());
  if (!c) return;

  const price = parseFloat(gv("c_buyPrice")) || 0;
  const method = gv("c_buyMethod") || "cash";
  const status = gv("c_buyStatus") || "paid";
  const size = settings.tenSize ?? 10;

  const p = {
    id: genId(),
    type: "purchase",
    date: new Date().toISOString(),
    price, size, used: 0, stamps: [],
    method, payStatus: status
  };

  c.tenHistory = c.tenHistory ?? [];
  c.tenHistory.push(p);

  saveAll();
  renderActiveCardBlock(c, "c_activeCard");
  renderTenHistoryDlg(c);
  renderCustomerOpenInvoices(c);
  renderCustomerList();
  renderCustomerRevenue();

  toast("10er‑Karte gebucht.");
}

/** Aktive Karte als Kreise darstellen */
export function renderActiveCardBlock(c, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const card = getActiveCard(c);
  if (!card) {
    el.innerHTML = `<div class="muted">Keine aktive 10er‑Karte.</div>`;
    return;
  }

  const total = card.size ?? settings.tenSize ?? 10;
  const used = card.used ?? 0;

  let circles = "";
  for (let i = 0; i < total; i++) {
    circles += `<span class="circle" style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border:1px solid #ccc;border-radius:50%;margin:2px">${ i < used ? "✓" : i + 1 }</span>`;
  }

  el.innerHTML = `
    <div class="card">
      <strong>Aktive 10er‑Karte</strong>
      <div style="margin:6px 0">${circles}</div>
      <div class="muted">Genutzt: ${used}/${total} · Rest: ${total - used}</div>
    </div>
  `;
}

/** Karten-Historie im Dialog */
export function renderTenHistoryDlg(c) {
  const wrap = document.getElementById("c_tenHistory");
  if (!wrap) return;

  const P = getPurchases(c);
  if (P.length === 0) {
    wrap.innerHTML = `<div class="muted">Noch keine Karten gekauft.</div>`;
    return;
  }

  let html = `<table class="table">
  <tr><th>Datum</th><th>Größe</th><th>Verbraucht</th><th>Preis (€)</th><th>Zahlung</th><th>Aktionen</th></tr>`;

  html += P.slice().reverse().map(p => `
    <tr>
      <td>${new Date(p.date).toLocaleString()}</td>
      <td>${p.size}</td>
      <td>${p.used ?? 0}</td>
      <td>${(p.price ?? 0).toFixed(2)}</td>
      <td>${p.method === "invoice" ? "Rechnung" : "Bar"} · ${p.payStatus === "paid" ? "bezahlt" : "offen"}</td>
      <td>
        <button class="btn ghost" onclick="editTen('${c.id}','${p.id}')">Bearb.</button>
        ${p.payStatus !== "paid" ? `<button class="btn" onclick="markPurchasePaid('${c.id}','${p.id}')">bezahlt</button>` : ""}
      </td>
    </tr>`).join("");

  html += `</table>`;
  wrap.innerHTML = html;
}

/** Kaufpreis aktualisieren */
export function editTen(cid, pid) {
  const c = getCustomerById(cid);
  if (!c) return;
  const p = (c.tenHistory ?? []).find(x => x.id === pid);
  if (!p) return;

  if (p.payStatus !== "paid") {
    toast("Offene Karten bitte unter Offene Posten bearbeiten.");
    return;
  }

  const price = prompt("Preis (€):", String(p.price ?? 0));
  if (price === null) return;
  p.price = parseFloat(price) || p.price;

  saveAll();
  toast("Karte aktualisiert.");
  renderTenHistoryDlg(c);
  renderCustomerList();
}

/** Offene Karte als bezahlt markieren */
export function markPurchasePaid(cid, pid) {
  const c = getCustomerById(cid);
  if (!c) return;
  const p = (c.tenHistory ?? []).find(x => x.id === pid);
  if (!p) return;

  p.payStatus = "paid";
  saveAll();

  renderCustomerOpenInvoices(c);
  renderTenHistoryDlg(c);
  renderCustomerList();
  renderCustomerRevenue();
}