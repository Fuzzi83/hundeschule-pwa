// /js/components/admin/customers/list.js
"use strict";

import { esc, gv } from "../../core/utils.js";
import { settings, customers, visits, stays } from "../../core/storage.js";
import { hasActiveCard, getPurchases } from "./utils.js";

/** Kundenliste rendern (Filter anhand #cust_search) */
export function renderCustomerList() {
  const q = (gv("cust_search") ?? "").toLowerCase();
  const wrap = document.getElementById("custList");
  if (!wrap) return;

  const filtered = (customers ?? []).filter(c => {
    if (!q) return true;
    const owner = (c.name ?? "").toLowerCase();
    const dogs = (c.dogs ?? []).map(d => (d.name ?? "").toLowerCase());
    return owner.includes(q) || dogs.some(n => n.includes(q));
  });

  let html = "";

  if ((customers ?? []).length === 0) {
    html += `
      <div class="muted">Noch keine Kunden.</div>
      <button class="btn primary" onclick="openNewCustomer()">Neuer Kunde</button>
    `;
  }

  if (filtered.length === 0 && (customers ?? []).length > 0) {
    html += `<div class="muted">Keine Treffer.</div>`;
  } else {
    html += filtered
      .map(c => {
        const activeCard = hasActiveCard(c);
        const P = getPurchases(c);
        const last = P[P.length - 1];
        const tagActive = activeCard ? `10er frei` : `keine freie Karte`;
        const rest = activeCard && last
          ? ` · Rest: ${(last.size ?? settings.tenSize ?? 10) - (last.used ?? 0)}`
          : "";
        const dogs = (c.dogs ?? []).map(d => esc(d.name ?? "")).join(", ");

        const openV = (visits ?? []).some(
          v => v.customerId === c.id && v.method !== "ten" && v.payStatus !== "paid"
        );
        const openS = (stays ?? []).some(
          s => s.customerId === c.id && s.method && s.payStatus !== "paid"
        );
        const openP = getPurchases(c).some(p => p.payStatus !== "paid");
        const hasOpen = openV || openS || openP;
        const openTag = hasOpen ? " offene Rechnung" : "";

        const addr = c.address ?? {};
        const addrLine = [addr.street, addr.houseNo, addr.zip, addr.city]
          .filter(Boolean)
          .join(" ");

        return `
          <div class="card" style="margin:8px 0">
            <div><strong>${esc(c.name ?? "")}</strong>${openTag ? `<span class="tag warn">${openTag}</span>` : ""}</div>
            <div class="muted">${tagActive}${rest ? esc(rest) : ""}</div>
            <div class="muted">${dogs ? `Hunde: ${dogs} · ` : ""}St‑Nr.: ${esc(c.taxId ?? "-")} · ${esc(addrLine ?? "")}</div>
            <div style="margin-top:6px">
              <button class="btn" onclick="openCustomer('${c.id}')">Bearbeiten</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  wrap.innerHTML = html;

  const kpi = document.getElementById("cust_kpi");
  if (kpi) kpi.textContent = `Kunden: ${(customers ?? []).length}`;
}