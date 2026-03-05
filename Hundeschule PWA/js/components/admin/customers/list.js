// /js/components/admin/customers/list.js
"use strict";

import { esc, gv } from "../../../core/utils.js";
import { customers, visits, stays } from "../../../core/storage.js";
import { insertStylesOnce } from "./styles.js";

function byId(id) { return document.getElementById(id); }

function normStatus(v) {
  if (v == null) return "";
  const s = String(v).trim().toLowerCase();
  if (s === "paid" || s === "bezahlt") return "paid";
  if (s === "open" || s === "offen") return "open";
  return s;
}

export function renderCustomerList(containerId = "custList") {
  insertStylesOnce();

  let wrap = byId(containerId);
  if (!wrap) {
    const page = byId("page_admin_customers");
    if (!page) return;

    page.innerHTML = `
      <div style="display:flex; gap:10px; align-items:center; margin-bottom:12px; flex-wrap:wrap">
        <input id="cust_search" placeholder="Kunde oder Hund suchen…" style="flex:1; min-width:220px" />
        <button id="btn_new_customer" class="btn">+ Neuer Kunde</button>
      </div>
      <div id="${containerId}"></div>
    `;
    page.querySelector("#cust_search")?.addEventListener("input", () => renderCustomerList(containerId));
    page.querySelector("#btn_new_customer")?.addEventListener("click", () => window.openNewCustomer?.());

    wrap = byId(containerId);
    if (!wrap) return;
  }

  const q = (gv("cust_search") || "").toLowerCase();

  const list = (customers || [])
    .filter(c => {
      if (!q) return true;
      const nm = (c.name || "").toLowerCase();
      const dogNames = (c.dogs || []).map(d => (d.name || "").toLowerCase());
      return nm.includes(q) || dogNames.some(x => x.includes(q));
    })
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"));

  wrap.innerHTML = list.map(c => {
    const dogs = (c.dogs || []).map(d => esc(d.name || "")).filter(Boolean).join(", ");
    const addr = c.address || {};
    const addrLine = [addr.street, addr.houseNo, addr.zip, addr.city].filter(Boolean).join(" ");

    const hasActiveCard =
      (c.cards || []).some(k => k.active && (Number(k.fieldsTotal || 0) - Number(k.fieldsUsed || 0)) > 0);

    // ✅ NEU: Kartenkauf zählt als "offen" sobald Status/payStatus offen ist (egal ob Bar/Rechnung/Nein)
    const openCards = (c.cards || []).some(k => {
      const pay = normStatus(k.payStatus ?? k.status ?? k.paymentStatus ?? "");
      // wenn nix gesetzt ist, werten wir Bar standardmäßig als bezahlt – ABER
      // sobald im UI "offen" gewählt wurde, steht es in status/payStatus.
      if (!pay) {
        const m = String(k.method || "cash").toLowerCase();
        return m !== "cash"; // nicht-Bar: default offen
      }
      return pay !== "paid";
    });

    const openVisits =
      (visits || []).some(v => v.customerId === c.id && v.method !== "ten" && normStatus(v.payStatus || "open") !== "paid");

    const openStays =
      (stays || []).some(s => s.customerId === c.id && normStatus(s.payStatus || "open") !== "paid");

    const hasOpenInvoice = openCards || openVisits || openStays;

    const tax = esc(c.taxId || c.vatId || "—");

    return `
      <div class="cust-row" role="button" tabindex="0"
           onclick="openCustomer('${c.id}')"
           onkeydown="if(event.key==='Enter' || event.key===' '){ event.preventDefault(); openCustomer('${c.id}'); }">

        <div class="cust-top">
          <div class="cust-name">${esc(c.name || "")}</div>

          <div class="badges" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
            ${hasOpenInvoice ? `<span class="chip chip-red">offene Rechnung</span>` : ``}
            ${hasActiveCard ? `<span class="chip chip-blue">Karte aktiv</span>` : ``}
          </div>
        </div>

        <div class="muted" style="margin-top:6px; line-height:1.35">
          <div>Hunde: ${dogs || "–"}</div>
          <div>
            St-Nr.: ${tax}
            ${addrLine ? ` · ${esc(addrLine)}` : ``}
          </div>
        </div>
      </div>
    `;
  }).join("");
}