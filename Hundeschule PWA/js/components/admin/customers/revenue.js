// /js/components/admin/customers/revenue.js
"use strict";

import { esc } from "../../core/utils.js";
import { getCustomerById, visits, stays } from "../../core/storage.js";
import { getPurchases } from "./utils.js";
import { getEditCustomerId } from "./state.js";

/** Einnahmen des Kunden (Karten + Zahlungen) */
export function renderCustomerRevenue() {
  const c = getCustomerById(getEditCustomerId());
  if (!c) return;

  const filter = (document.getElementById("c_rev_filter")?.value) ?? "all";
  let rows = [];

  const cards = getPurchases(c).filter(p => p.payStatus === "paid");
  if (filter === "all" || filter === "cards") {
    cards.forEach(p => rows.push({
      date: (p.date ?? "").slice(0, 10),
      type: "Karte",
      amount: +(p.price ?? 0)
    }));
  }

  if (filter === "all" || filter === "payments") {
    (visits ?? [])
      .filter(v => v.customerId === c.id && v.method !== "ten" && v.payStatus === "paid")
      .forEach(v => rows.push({ date: v.date, type: "Tag", amount: +(v.charged ?? 0) }));
    (stays ?? [])
      .filter(s => s.customerId === c.id && s.payStatus === "paid")
      .forEach(s => rows.push({ date: ((s.checkoutDate ?? s.checkinAt) ?? "").slice(0, 10), type: "Pension", amount: +(s.price ?? 0) }));
  }

  rows.sort((a, b) => (a.date > b.date ? -1 : 1));

  let sum = 0;
  let html = `<table class="table">
    <tr><th>Datum</th><th>Typ</th><th>Betrag (€)</th></tr>`;
  rows.forEach(r => {
    sum += r.amount ?? 0;
    html += `<tr>
      <td>${esc(r.date ?? "")}</td>
      <td>${esc(r.type ?? "")}</td>
      <td>${(r.amount ?? 0).toFixed(2)}</td>
    </tr>`;
  });
  html += `</table>`;

  const tbl = document.getElementById("c_rev_table");
  if (tbl) tbl.innerHTML = html;
}
