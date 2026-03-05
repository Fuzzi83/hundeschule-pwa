// /js/components/admin/customers/dialog.js
"use strict";

import { esc, genId, toast, gv } from "../../../core/utils.js";
import {
  customers, customersTrash,
  visits, visitsTrash,
  stays, staysTrash,
  saveAll, getCustomerById
} from "../../../core/storage.js";

import { listPacks } from "../../../core/hourpacks.js";

import { setEditCustomerId, editCustomerId } from "./state.js";
import { insertStylesOnce } from "./styles.js";
import { renderCustomerList } from "./list.js";
import { addDogRow } from "./dogs.js";
import {
  initSignaturePad,
  requireAgbForSignature,
  showSavedSignature,
  signatureIsBlank
} from "./signature.js";
import { renderCards, buyHourPack } from "./cards.js";
import { renderInvoices } from "./invoices.js";
import { loadAccState, saveAccState, defaultAccState, applyAccSection } from "./accordion.js";

const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
function byId(id) { return document.getElementById(id); }
function nowISO() { return new Date().toISOString(); }

/** -------------------- Draft handling (NEU) -------------------- */
let draftCustomer = null; // wird NICHT gespeichert, bis "Speichern"
function isDraftId(id) { return !!draftCustomer && draftCustomer.id === id; }
function getEditingCustomer() {
  if (!editCustomerId) return null;
  const real = getCustomerById(editCustomerId);
  if (real) return real;
  if (isDraftId(editCustomerId)) return draftCustomer;
  return null;
}
function clearDraftIfActive() {
  if (draftCustomer && editCustomerId === draftCustomer.id) {
    draftCustomer = null;
  }
}

function hasOpenPositions(c) {
  // visits/stays: offen wenn payStatus != paid (bei ten = paid default)
  const openVisits = (visits || []).some(v => v.customerId === c.id && (v.payStatus || (v.method === "ten" ? "paid" : "open")) !== "paid");
  const openStays = (stays || []).some(s => s.customerId === c.id && (s.payStatus || "open") !== "paid");

  // cards: offen wenn payStatus != paid UND (Rechnung relevant: method invoice ODER invoiceIssued=true)
  const openCards = (c.cards || []).some(k => {
    const pay = (k.payStatus || (k.method === "cash" ? "paid" : "open"));
    const invoiceRelevant = (k.method === "invoice") || (k.invoiceIssued === true);
    return invoiceRelevant && pay !== "paid";
  });

  return openVisits || openStays || openCards;
}

function collectDogsFromDialog() {
  const wrap = byId("c_dogs");
  if (!wrap) return [];

  return $$(".card-panel", wrap).map(panel => {
    const id = panel.dataset.dogId || genId();
    const get = (name) => panel.querySelector(`[name="${name}"]`)?.value ?? "";
    const getSel = (name) => panel.querySelector(`[name="${name}"]`)?.value ?? "";
    const yesNo = (name) => getSel(name) === "yes";

    return {
      id,
      name: get("dog_name").trim(),
      breed: get("dog_breed").trim(),
      sex: getSel("dog_sex") || "m",
      age: get("dog_age").trim(),
      chipId: get("dog_chip").trim(),
      neutered: yesNo("dog_neutered"),
      social: yesNo("dog_social"),
      foodGuarding: yesNo("dog_foodGuarding"),
      fearStormFireworks: yesNo("dog_fear"),
      feedingNotes: get("dog_feedNotes"),
      treatsAllowed: yesNo("dog_treats"),
      allergiesMedsNotes: get("dog_allergies")
    };
  }).filter(d => d.name || d.breed || d.chipId);
}

function buildCustomerDialogHTML(c) {
  const dogsSummary = (c.dogs || []).map(d => d.name).filter(Boolean).join(", ") || "";
  const invHint = hasOpenPositions(c)
    ? `<span class="chip chip-red" id="head_invoices">offene Positionen</span>`
    : `<span id="head_invoices"></span>`;

  const isDraft = isDraftId(c.id);

  return `
    <div class="backdrop"></div>
    <div class="dlg">
      <h3>${isDraft ? "Neuen Kunden anlegen" : "Kundendaten bearbeiten"}</h3>

      <!-- Kunde -->
      <div class="acc" data-sec="kunde">
        <div class="acc-head">
          <div class="acc-title">Kunde <span class="acc-sub" id="head_name">${esc(c.name || "")}</span></div>
          <div class="acc-arrow">▾</div>
        </div>
        <div class="acc-body">

          <div class="fg3">
            <label>
              Name *
              <input id="c_name" type="text" value="${esc(c.name || "")}" required>
            </label>

            <label>
              Steuernummer
              <input id="c_taxId" type="text" value="${esc(c.taxId || c.vatId || "")}">
            </label>

            <label>Telefon <input id="c_phone" type="text" value="${esc(c.phone || "")}"></label>
            <label>E-Mail <input id="c_email" type="email" value="${esc(c.email || "")}"></label>
            <label>Notfallkontakt <input id="c_emergency" type="text" value="${esc(c.emergencyContact || "")}"></label>
            <label>Tierarzt <input id="c_vet" type="text" value="${esc(c.vet || "")}"></label>
          </div>

          <div class="fg4" style="margin-top:8px">
            <label>Straße <input id="c_addr_street" value="${esc(c.address?.street || "")}"></label>
            <label>Nr <input id="c_addr_no" value="${esc(c.address?.houseNo || "")}"></label>
            <label>PLZ <input id="c_addr_zip" value="${esc(c.address?.zip || "")}"></label>
            <label>Ort <input id="c_addr_city" value="${esc(c.address?.city || "")}"></label>
          </div>

          <div style="margin-top:14px; display:flex; align-items:center; gap:12px; flex-wrap:wrap">
            <label style="display:flex; align-items:center; gap:8px; margin:0">
              <input id="c_terms_accept" type="checkbox" ${c.termsAccepted ? "checked" : ""}>
              <span><strong>AGB akzeptiert *</strong></span>
            </label>

            <a class="btn" href="/AGB.pdf" target="_blank" rel="noopener">AGB öffnen</a>
          </div>

          <div style="margin-top:10px">
            <div style="font-weight:600; margin-bottom:4px">Unterschrift *</div>
            <div class="sig-wrap">
              <canvas id="c_signature_canvas" class="sig-cv" width="900" height="160"></canvas>
              <button class="btn" id="btn_sig_clear" type="button">Unterschrift löschen</button>
            </div>
            <div class="muted" style="font-size:12px; margin-top:6px">
              Wenn AGB akzeptiert wird, ist eine Unterschrift erforderlich.
            </div>
          </div>

        </div>
      </div>

      <!-- Hunde -->
      <div class="acc" data-sec="hunde">
        <div class="acc-head">
          <div class="acc-title">Hunde <span class="acc-sub" id="head_dogs">${esc(dogsSummary)}</span></div>
          <div class="acc-arrow">▾</div>
        </div>
        <div class="acc-body">
          <div id="c_dogs"></div>
          <button class="btn" id="btn_add_dog" type="button" style="margin-top:8px">Hund hinzufügen</button>
        </div>
      </div>

      <!-- Karten -->
      <div class="acc" data-sec="karten">
        <div class="acc-head">
          <div class="acc-title">Karten</div>
          <div class="acc-arrow">▾</div>
        </div>
        <div class="acc-body">

          <div class="cards-stack">
            <div id="cards_active"></div>

            <div class="card-panel" style="padding:10px 12px">
              <div id="buy_head"
                   style="display:flex; align-items:center; justify-content:space-between; gap:10px; cursor:pointer; user-select:none">
                <div style="font-weight:800; display:flex; gap:8px; align-items:center">
                  <span id="buy_arrow" style="font-weight:900">▸</span>
                  <span>Neue Karte</span>
                </div>
                <div class="muted" style="font-size:12px"></div>
              </div>

              <div id="card_buy_section" class="hidden" style="margin-top:10px">
                <div class="fg4">
                  <label>Paket
                    <select id="card_pack_sel"></select>
                  </label>

                  <label>Preis (€)
                    <input id="card_price" type="text" placeholder="0,00">
                  </label>

                  <label>Zahlart
                    <select id="card_method">
                      <option value="cash">Bar</option>
                      <option value="invoice">Rechnung</option>
                      <option value="other">Sonstiges</option>
                    </select>
                  </label>

                  <label id="card_invoice_wrap">
                    Rechnung erstellt?
                    <select id="card_invoice_issued">
                      <option value="no">Nein</option>
                      <option value="yes">Ja</option>
                    </select>
                  </label>

                  <label>
                    Zahlungsstatus
                    <select id="card_pay_status">
                      <option value="paid">Bezahlt</option>
                      <option value="open">Nicht bezahlt</option>
                    </select>
                  </label>
                </div>

                <button class="btn primary" id="btn_buy_card" style="margin-top:10px" type="button">Karte buchen</button>
                ${isDraft ? `<div class="muted" style="font-size:12px; margin-top:6px">Hinweis: Karte buchen erst nach Speichern des Kunden möglich.</div>` : ``}
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- Rechnungen -->
      <div class="acc" data-sec="rechnungen">
        <div class="acc-head">
          <div class="acc-title" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap">
            <span>Rechnungen</span>
            ${invHint}
          </div>
          <div class="acc-arrow">▾</div>
        </div>
        <div class="acc-body">
          <div id="inv_list"></div>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; margin-top:12px">
        ${isDraft ? `<div></div>` : `<button class="btn danger" id="btn_delete" type="button">Löschen</button>`}
        <div style="display:flex; gap:8px">
          <button class="btn" id="btn_cancel" type="button">Abbrechen</button>
          <button class="btn primary" id="btn_save" type="button">Speichern</button>
        </div>
      </div>
    </div>
  `;
}

export function openCustomer(id) {
  insertStylesOnce();

  const c = getCustomerById(id) || (draftCustomer && draftCustomer.id === id ? draftCustomer : null);
  if (!c) { toast("Kunde nicht gefunden."); return; }

  setEditCustomerId(id);

  let host = byId("dlg_customer");
  if (!host) {
    host = document.createElement("div");
    host.id = "dlg_customer";
    document.body.appendChild(host);
  }

  host.className = "show";
  host.innerHTML = buildCustomerDialogHTML(c);
  document.body.style.overflow = "hidden";

  host.querySelector(".backdrop")?.addEventListener("click", closeCustomerDlg);

  const state = loadAccState(c.id) || defaultAccState();
  ["kunde", "hunde", "karten", "rechnungen"].forEach(sec => {
    applyAccSection(host, sec, (state[sec] || "open") === "open");
  });

  $$(".acc-head", host).forEach(head => {
    head.addEventListener("click", () => {
      const blk = head.closest(".acc");
      const key = blk?.dataset?.sec;
      const body = blk?.querySelector(".acc-body");
      const arr = blk?.querySelector(".acc-arrow");
      if (!key || !body || !arr) return;

      const hidden = body.classList.toggle("hidden");
      arr.textContent = hidden ? "▸" : "▾";

      const s = loadAccState(c.id) || defaultAccState();
      s[key] = hidden ? "closed" : "open";
      saveAccState(c.id, s);
    });
  });

  // Hunde render + Add
  const dogsWrap = byId("c_dogs");
  if (dogsWrap) dogsWrap.innerHTML = "";
  (c.dogs || []).forEach(d => addDogRow(d));
  byId("btn_add_dog")?.addEventListener("click", () => addDogRow(null));

  const updateDogsHead = () => {
    const dogs = collectDogsFromDialog();
    const names = dogs.map(d => d.name).filter(Boolean).join(", ");
    const el = byId("head_dogs");
    if (el) el.textContent = names || "";
  };
  byId("c_dogs")?.addEventListener("input", updateDogsHead);
  byId("c_dogs")?.addEventListener("change", updateDogsHead);

  // Signatur
  initSignaturePad();
  requireAgbForSignature();
  if (c.signature) showSavedSignature(c.signature);
  byId("c_terms_accept")?.addEventListener("change", requireAgbForSignature);

  // Neue Karte toggle
  const buyHead = byId("buy_head");
  const buyArrow = byId("buy_arrow");
  const buyBody = byId("card_buy_section");
  if (buyHead && buyArrow && buyBody) {
    buyHead.addEventListener("click", () => {
      const hidden = buyBody.classList.toggle("hidden");
      buyArrow.textContent = hidden ? "▸" : "▾";
    });
  }

  // Packs
  const packs = listPacks({ onlyActive: true, scope: "stay" }) || [];
  const packSel = byId("card_pack_sel");
  if (packSel) {
    packSel.innerHTML = packs.map(p => `
      <option value="${p.id}" data-price="${Number(p.preis || 0)}">
        ${esc(p.name)} (${Number(p.felder || 10)}×)
      </option>
    `).join("");
  }

  const priceEl = byId("card_price");
  const applyPrice = () => {
    const o = packSel?.selectedOptions?.[0];
    const n = Number(o?.dataset?.price || 0);
    if (priceEl) priceEl.value = n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  packSel?.addEventListener("change", applyPrice);
  applyPrice();

  // Payment defaults
  const methodSel = byId("card_method");
  const invWrap = byId("card_invoice_wrap");
  const invSel = byId("card_invoice_issued");
  const paySel = byId("card_pay_status");

  const applyPaymentDefaults = () => {
    const m = methodSel?.value || "cash";
    if (m === "other") {
      if (invWrap) invWrap.style.display = "none";
      if (invSel) invSel.value = "no";
      if (paySel) paySel.value = "paid";
      return;
    }
    if (invWrap) invWrap.style.display = "";
    if (invSel) invSel.value = "no";
    if (m === "cash") {
      if (paySel) paySel.value = "paid";
    } else {
      if (paySel) paySel.value = "open";
    }
  };
  methodSel?.addEventListener("change", applyPaymentDefaults);
  applyPaymentDefaults();

  // Karte buchen nur bei echten Kunden
  if (isDraftId(c.id)) {
    byId("btn_buy_card")?.addEventListener("click", () => toast("Bitte zuerst den Kunden speichern."));
  } else {
    byId("btn_buy_card")?.addEventListener("click", buyHourPack);
  }

  renderCards(c);
  renderInvoices(c);

  byId("btn_cancel")?.addEventListener("click", closeCustomerDlg);
  byId("btn_delete")?.addEventListener("click", deleteCustomer);
  byId("btn_save")?.addEventListener("click", saveCustomer);
}

export function openNewCustomer() {
  // ✅ NICHT speichern, nur Entwurf
  draftCustomer = {
    id: genId(),
    name: "",
    taxId: "",
    phone: "",
    email: "",
    address: { street: "", houseNo: "", zip: "", city: "" },
    emergencyContact: "",
    vet: "",
    dogs: [],
    cards: [],
    termsAccepted: false,
    signature: ""
  };
  openCustomer(draftCustomer.id);
}

export function closeCustomerDlg() {
  const host = byId("dlg_customer");
  if (host) {
    host.classList.remove("show");
    host.innerHTML = "";
  }
  document.body.style.overflow = "";

  // ✅ Wenn Entwurf aktiv war: verwerfen
  clearDraftIfActive();

  renderCustomerList();
}

export function saveCustomer() {
  const c = getEditingCustomer();
  if (!c) return;

  const name = (gv("c_name") || "").trim();
  const agb = !!byId("c_terms_accept")?.checked;

  if (!name) { toast("Name ist Pflicht."); return; }
  if (!agb) { toast("AGB müssen akzeptiert werden."); return; }
  if (agb && signatureIsBlank()) { toast("Bitte Unterschrift setzen."); return; }

  c.name = name;
  c.taxId = gv("c_taxId") || "";
  c.phone = gv("c_phone") || "";
  c.email = gv("c_email") || "";
  c.emergencyContact = gv("c_emergency") || "";
  c.vet = gv("c_vet") || "";

  c.address = {
    street: gv("c_addr_street") || "",
    houseNo: gv("c_addr_no") || "",
    zip: gv("c_addr_zip") || "",
    city: gv("c_addr_city") || ""
  };

  c.dogs = collectDogsFromDialog();
  c.termsAccepted = agb;

  const cv = byId("c_signature_canvas");
  if (cv && cv.toDataURL) {
    try { c.signature = cv.toDataURL("image/png"); } catch { }
  }

  // ✅ Wenn es ein Entwurf war: jetzt erst in customers übernehmen
  if (draftCustomer && c.id === draftCustomer.id) {
    customers.push(draftCustomer);
    draftCustomer = null;
  }

  saveAll();
  toast("Gespeichert");
  closeCustomerDlg();
}

export function deleteCustomer() {
  if (!editCustomerId) return;

  // Entwurf löschen = nur schließen
  if (isDraftId(editCustomerId)) {
    draftCustomer = null;
    closeCustomerDlg();
    return;
  }

  const c = getCustomerById(editCustomerId);
  if (!c) return;

  if (!confirm("Kunden wirklich löschen?")) return;

  const ts = nowISO();
  customersTrash.push({ ...c, deletedAt: ts });

  const idx = customers.findIndex(x => x.id === c.id);
  if (idx >= 0) customers.splice(idx, 1);

  for (let i = visits.length - 1; i >= 0; i--) {
    if (visits[i].customerId === c.id) {
      visitsTrash.push({ ...visits[i], deletedAt: ts });
      visits.splice(i, 1);
    }
  }
  for (let i = stays.length - 1; i >= 0; i--) {
    if (stays[i].customerId === c.id) {
      staysTrash.push({ ...stays[i], deletedAt: ts });
      stays.splice(i, 1);
    }
  }

  saveAll();
  closeCustomerDlg();
}