// /js/components/admin/customers/cards.js
"use strict";

import { genId, toast } from "../../../core/utils.js";
import { saveAll, getCustomerById } from "../../../core/storage.js";
import { editCustomerId } from "./state.js";
import { renderCustomerList } from "./list.js";
import { getPackById } from "../../../core/hourpacks.js";

function byId(id) { return document.getElementById(id); }
function nowISO() { return new Date().toISOString(); }

function fmtDate(iso) {
  if (!iso) return "–";
  try { return new Date(iso).toLocaleDateString("de-DE"); } catch { return "–"; }
}
function fmtEUR(n) {
  return Number(n || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function cardRemaining(card) {
  const total = Number(card.fieldsTotal || 0);
  const used = Number(card.fieldsUsed || 0);
  return Math.max(0, total - used);
}
function isActiveNotEmpty(card) {
  return !!card.active && cardRemaining(card) > 0;
}
function isActiveCard(card) {
  return card.active === true && (Number(card.fieldsTotal || 0) - Number(card.fieldsUsed || 0)) > 0;
}

/** ✅ Regel: nur eine aktive Karte pro packId */
function hasActivePackOfType(cust, packId) {
  return (cust.cards || []).some(k => k.packId === packId && isActiveNotEmpty(k));
}

function stampStateForIndex(used, i) {
  // used kann 0.5 Schritte haben
  if (used >= i + 1) return 1;
  if (used >= i + 0.5) return 0.5;
  return 0;
}

/**
 * ½ Button soll nur beim "aktuellen" (letzten nicht vollen) Feld sichtbar sein:
 * - used=3   -> aktuelles Feld index 3
 * - used=3.5 -> aktuelles Feld index 3 (halb voll)
 * - used>=total -> kein ½ Button
 */
function currentHalfIndex(used, total) {
  if (total <= 0) return -1;
  if (used >= total) return -1;
  return Math.floor(used);
}

export function renderCards(cust) {
  const activeHost = byId("cards_active");
  if (!activeHost) return;

  const cards = cust.cards || [];
  const active = cards.filter(isActiveNotEmpty);

  if (active.length === 0) {
    activeHost.innerHTML = `<div class="muted">Keine aktive Karte vorhanden.</div>`;
    return;
  }

  activeHost.innerHTML = active.map(card => {
    const total = Number(card.fieldsTotal || 0);
    const used = Number(card.fieldsUsed || 0);
    const remaining = cardRemaining(card);
    const allowHalf = !!card.allowHalfDay;
    const halfIdx = currentHalfIndex(used, total);

    const stamps = Array.from({ length: total }).map((_, i) => {
      const st = stampStateForIndex(used, i);
      const cls = st === 1 ? "used" : (st === 0.5 ? "half" : "free");

      // ✅ ½ nur beim aktuellen Feld
      const halfBtn = (allowHalf && i === halfIdx) ? `
        <span class="half-btn" title="Halber Tag"
              onclick="renderCheckoutStamps('${card.id}', ${i}, 'half'); event.stopPropagation();">½</span>
      ` : "";

      return `
        <div class="stamp-wrap">
          <div class="stamp ${cls}" onclick="renderCheckoutStamps('${card.id}', ${i}, 'full')">${i + 1}</div>
          ${halfBtn}
        </div>
      `;
    }).join("");

    return `
      <div class="card-panel">
        <div style="font-weight:800;margin-bottom:8px">Aktive ${card.packName || "Karte"}</div>
        <div class="stamp-row">${stamps}</div>
        <div class="stamp-info">Genutzt ${used}/${total} · Rest ${remaining}</div>
        <div class="muted" style="margin-top:6px">
          Kauf: ${fmtDate(card.date)} · Preis: ${fmtEUR(card.pricePaid)}
        </div>
      </div>
    `;
  }).join("");
}

/**
 * ✅ Stempeln (Kundendialog)
 * mode = "full" | "half"
 */
export function renderCheckoutStamps(cardId, index, mode = "full") {
  const cust = getCustomerById(editCustomerId);
  if (!cust) return;

  const card = (cust.cards || []).find(c => c.id === cardId);
  if (!card) return;

  const total = Number(card.fieldsTotal || 0);
  let used = Number(card.fieldsUsed || 0);
  const allowHalf = !!card.allowHalfDay;

  if (mode === "full" || !allowHalf) {
    // toggle full
    if (used >= index + 1) used = index;
    else used = index + 1;
  } else {
    // ½: frei -> halb -> voll -> zurück
    if (used >= index + 1) used = index;
    else if (used >= index + 0.5) used = index + 1;
    else used = index + 0.5;
  }

  used = Math.max(0, Math.min(total, used));
  card.fieldsUsed = used;

  // ✅ Wenn voll: NICHT ins Archiv verschieben – einfach deaktivieren (und in Rechnungen "abgeschlossen" sichtbar)
  if (total > 0 && used >= total) {
    card.fieldsUsed = total;
    card.active = false;
    card.finishedAt = card.finishedAt || nowISO();
    toast("Letztes Feld gesetzt – Karte ist voll.");
  }

  saveAll();
  renderCards(cust);
  renderCustomerList();
}

/**
 * Neue Karte buchen (✅ nur wenn keine aktive Karte gleichen Typs existiert)
 */
export function buyHourPack() {
  if (!editCustomerId) {
    toast("Bitte zuerst Kunden speichern.");
    return;
  }

  const cust = getCustomerById(editCustomerId);
  if (!cust) {
    toast("Bitte zuerst Kunden speichern.");
    return;
  }

  const packSel = byId("card_pack_sel");
  const priceEl = byId("card_price");
  const methodSel = byId("card_method");
  const invSel = byId("card_invoice_issued");
  const paySel = byId("card_pay_status");

  const pack = getPackById(packSel.value);
  if (!pack) { toast("Bitte Paket wählen."); return; }

  if (hasActivePackOfType(cust, pack.id)) {
    toast("Es ist bereits eine aktive Karte dieses Typs vorhanden. Bitte zuerst aufbrauchen.");
    return;
  }

  const method = methodSel.value;
  const card = {
    id: genId(),
    packId: pack.id,
    packName: pack.name,
    fieldsTotal: Number(pack.felder || 10),
    fieldsUsed: 0,
    allowHalfDay: !!pack.allowHalfDay,
    pricePaid: Number(String(priceEl.value || "0").replace(/\./g, "").replace(",", ".")) || 0,
    method,
    invoiceIssued: (method === "other") ? false : (invSel.value === "yes"),
    payStatus: paySel.value,
    date: nowISO(),
    finishedAt: "",
    active: true
  };

  cust.cards = cust.cards || [];
  cust.cards.push(card);

  saveAll();
  renderCards(cust);
  renderCustomerList();
  toast("Karte gebucht.");
}

window.renderCheckoutStamps = renderCheckoutStamps;