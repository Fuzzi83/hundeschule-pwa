// /js/components/admin/customers/dialog.js
"use strict";

import { esc, genId, toast, setv, gv } from "../../core/utils.js";
import {
  settings, customers, customersTrash,
  visits, visitsTrash, stays, staysTrash,
  saveAll, getCustomerById
} from "../../core/storage.js";

import { setEditCustomerId, getEditCustomerId } from "./state.js";
import { renderCustomerList } from "./list.js";
import { renderActiveCardBlock, renderTenHistoryDlg } from "./cards.js";
import { renderCustomerOpenInvoices } from "./openitems.js";
import { renderCustomerRevenue } from "./revenue.js";
import { initSignaturePad, requireAgbForSignature, sigUpdatePreview } from "./signature.js";

/** Neuer Kunde */
export function openNewCustomer() {
  setEditCustomerId(null);
  const blank = {
    name: "", taxId: "", phone: "", email: "",
    address: { street: "", houseNo: "", city: "", zip: "" },
    emergencyContact: "", vet: "",
    signature: "", signatureLocked: false, termsAccepted: false, termsAcceptedAt: null,
    dogs: [], tenHistory: []
  };
  openCustomerDlg(blank);
}

/** Bestehenden Kunden öffnen */
export function openCustomer(id) {
  const c = getCustomerById(id);
  if (!c) { toast("Kunde nicht gefunden."); return; }
  setEditCustomerId(id);
  openCustomerDlg({ ...c });
}

/** Dialog schließen */
export function closeCustomerDlg() {
  const dlg = document.getElementById("dlg_customer");
  if (dlg) dlg.classList.add("hidden");
  renderCustomerList();
}

/** Dialog befüllen + anzeigen */
export function openCustomerDlg(c) {
  // Stammdaten
  setv("c_name", c.name ?? "");
  setv("c_taxId", c.taxId ?? "");
  setv("c_phone", c.phone ?? "");
  setv("c_email", c.email ?? "");

  const a = c.address ?? {};
  setv("c_addr_street", a.street ?? "");
  setv("c_addr_no", a.houseNo ?? "");
  setv("c_addr_city", a.city ?? "");
  setv("c_addr_zip", a.zip ?? "");

  setv("c_emergency", c.emergencyContact ?? "");
  setv("c_vet", c.vet ?? "");

  // Hunde
  const dogsDiv = document.getElementById("c_dogs");
  if (dogsDiv) dogsDiv.innerHTML = "";
  (c.dogs ?? []).forEach(d => addDogRow(d));

  // Karten-Kauf Defaults
  setv("c_buyPrice", settings.tenPrice ?? 0);
  const bm = document.getElementById("c_buyMethod"); if (bm) bm.value = "cash";
  const bs = document.getElementById("c_buyStatus"); if (bs) bs.value = "paid";

  const eid = getEditCustomerId();
  const oc = eid ? (getCustomerById(eid) ?? c) : c;
  renderActiveCardBlock(oc, "c_activeCard");
  renderTenHistoryDlg(oc);

  if (eid) {
    renderCustomerOpenInvoices(oc);
    renderCustomerRevenue();
  } else {
    const oi = document.getElementById("c_openInvoices");
    if (oi) oi.innerHTML = `<div class="muted">Noch keine offenen Posten.</div>`;
    const rt = document.getElementById("c_rev_table");
    if (rt) rt.innerHTML = `<div class="muted">Noch keine Zahlungen.</div>`;
  }

  const title = document.getElementById("dlg_c_title");
  if (title) title.textContent = eid ? "Kundendaten bearbeiten" : "Neuer Kunde";

  const dlg = document.getElementById("dlg_customer");
  if (dlg) dlg.classList.remove("hidden");

  // Signatur/AGB
  initSignaturePad();
  sigUpdatePreview();
  const cb = document.getElementById("c_terms_accept");
  if (cb) {
    const cust = eid ? getCustomerById(eid) : c;
    cb.checked = !!(cust && cust.termsAccepted);
    requireAgbForSignature();
  }
}

/** Speichern */
export function saveCustomer() {
  const name = (gv("c_name") ?? "").trim();
  const tax  = (gv("c_taxId") ?? "").trim();
  if (!name || !tax) { toast("Name und Steuernummer sind Pflicht."); return; }

  const cb = document.getElementById("c_terms_accept");
  if (!(cb && cb.checked)) { toast("Bitte AGB lesen und Zustimmung anhaken."); return; }

  const phone = (gv("c_phone") ?? "").trim();
  const email = (gv("c_email") ?? "").trim();
  const emergency = (gv("c_emergency") ?? "").trim();
  const vet = (gv("c_vet") ?? "").trim();

  let signature = null;
  try {
    const cv = document.getElementById("c_signature_canvas");
    if (cv && cv._sig && cv._sig.hasDrawing) signature = cv.toDataURL("image/png");
    if (cv && cv._deleted) signature = ""; // explizit löschen
  } catch (e) {}

  const address = {
    street: (gv("c_addr_street") ?? "").trim(),
    houseNo: (gv("c_addr_no") ?? "").trim(),
    city:    (gv("c_addr_city") ?? "").trim(),
    zip:     (gv("c_addr_zip") ?? "").trim(),
  };

  const dogCards = [...document.querySelectorAll("#c_dogs .card")]
    .map(div => {
      const val = n => (div.querySelector(`[name="${n}"]`)?.value ?? "").trim();
      const yes = n => (div.querySelector(`[name="${n}"]`)?.value ?? "no") === "yes";
      return {
        id: div.dataset.dogId ?? genId(),
        name: val("dog_name"),
        breed: val("dog_breed"),
        sex: val("dog_sex"),
        age: val("dog_age"),
        chipId: val("dog_chip"),
        neutered: yes("dog_neutered"),
        social: yes("dog_social"),
        foodGuarding: yes("dog_foodGuarding"),
        fearStormFireworks: yes("dog_fear"),
        feedingNotes: val("dog_feedNotes"),
        treatsAllowed: yes("dog_treats"),
        allergiesMedsNotes: (div.querySelector('[name="dog_allergies"]')?.value ?? "").trim(),
      };
    })
    .filter(d => d.name);

  const eid = getEditCustomerId();

  if (eid) {
    const c = getCustomerById(eid);
    if (!c) return;
    c.name = name; c.taxId = tax; c.phone = phone; c.email = email;
    c.address = address; c.emergencyContact = emergency; c.vet = vet;
    if (signature !== null) c.signature = signature;
    c.signatureLocked = true; c.termsAccepted = true;
    c.termsAcceptedAt = c.termsAcceptedAt ?? new Date().toISOString();
    c.dogs = dogCards;
  } else {
    const c = {
      id: genId(),
      name, taxId: tax, phone, email, address,
      emergencyContact: emergency, vet,
      signature: signature ?? "",
      signatureLocked: true,
      termsAccepted: true,
      termsAcceptedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      dogs: dogCards,
      tenHistory: [],
    };
    customers.push(c);
    setEditCustomerId(c.id);
  }

  saveAll();
  closeCustomerDlg();

  if (window.renderDayList) window.renderDayList();
  if (window.renderStayList) window.renderStayList();
}

/** Löschen (in den Papierkorb verschieben) */
export function deleteCustomer() {
  const eid = getEditCustomerId();
  if (!eid) return;

  const c = getCustomerById(eid);
  if (!c) return;

  if (!confirm("Diesen Kunden in den Papierkorb verschieben?")) return;

  // Kunde -> Trash
  const idx = customers.findIndex(x => x.id === c.id);
  if (idx >= 0) customers.splice(idx, 1);
  customersTrash.push({ deletedAt: new Date().toISOString(), ...c });

  // Zugehörige Visits & Stays -> Trash
  for (let i = (visits ?? []).length - 1; i >= 0; i--) {
    if (visits[i].customerId === c.id) {
      const v = visits[i];
      visits.splice(i, 1);
      visitsTrash.push({ deletedAt: new Date().toISOString(), ...v });
    }
  }
  for (let i = (stays ?? []).length - 1; i >= 0; i--) {
    if (stays[i].customerId === c.id) {
      const s = stays[i];
      stays.splice(i, 1);
      staysTrash.push({ deletedAt: new Date().toISOString(), ...s });
    }
  }

  saveAll();
  closeCustomerDlg();

  if (window.renderDayList) window.renderDayList();
  if (window.renderStayList) window.renderStayList();
}

/** Hunde-Editor: eine Hundekarte hinzufügen */
export function addDogRow(d) {
  const wrap = document.getElementById("c_dogs");
  if (!wrap) return;

  const id = (d && d.id) ?? genId();
  const name = (d && d.name) ?? "";
  const breed = (d && d.breed) ?? "";
  const sex = (d && d.sex) ?? "";
  const age = (d && d.age) ?? "";
  const chipId = (d && d.chipId) ?? "";
  const neutered = !!(d && d.neutered);
  const social = !!(d && d.social);
  const foodGuarding = !!(d && d.foodGuarding);
  const fear = !!(d && d.fearStormFireworks);
  const feeding = (d && d.feedingNotes) ?? "";
  const treats = !!(d && d.treatsAllowed);
  const notes = (d && d.allergiesMedsNotes) ?? "";

  const div = document.createElement("div");
  div.className = "card";
  div.style.margin = "8px 0";
  div.dataset.dogId = id;

  div.innerHTML = `
    <div class="fg2">
      <div><label>Name</label><input name="dog_name" value="${esc(name)}"></div>
      <div><label>Rasse</label><input name="dog_breed" value="${esc(breed)}"></div>
    </div>

    <div class="fg3">
      <div>
        <label>Geschlecht</label>
        <select name="dog_sex">
          <option value="" ${sex===""?"selected":""}>–</option>
          <option value="m" ${sex==="m"?"selected":""}>männlich</option>
          <option value="w" ${sex==="w"?"selected":""}>weiblich</option>
        </select>
      </div>
      <div><label>Alter</label><input name="dog_age" value="${esc(age)}"></div>
      <div><label>Chip‑Nr.</label><input name="dog_chip" value="${esc(chipId)}"></div>
    </div>

    <div class="fg3">
      <div>
        <label>Kastriert?</label>
        <select name="dog_neutered">
          <option value="no" ${!neutered?"selected":""}>nein</option>
          <option value="yes" ${neutered?"selected":""}>ja</option>
        </select>
      </div>
      <div>
        <label>Kommt mit anderen Hunden klar?</label>
        <select name="dog_social">
          <option value="no" ${!social?"selected":""}>nein</option>
          <option value="yes" ${social?"selected":""}>ja</option>
        </select>
      </div>
      <div>
        <label>Verteidigt Futter?</label>
        <select name="dog_foodGuarding">
          <option value="no" ${!foodGuarding?"selected":""}>nein</option>
          <option value="yes" ${foodGuarding?"selected":""}>ja</option>
        </select>
      </div>
    </div>

    <div class="fg2">
      <div>
        <label>Angst vor Gewitter/Feuerwerk?</label>
        <select name="dog_fear">
          <option value="no" ${!fear?"selected":""}>nein</option>
          <option value="yes" ${fear?"selected":""}>ja</option>
        </select>
      </div>
      <div>
        <label>Darf er Leckerlies?</label>
        <select name="dog_treats">
          <option value="no" ${!treats?"selected":""}>nein</option>
          <option value="yes" ${treats?"selected":""}>ja</option>
        </select>
      </div>
    </div>

    <div>
      <label>Fütterungshinweise</label>
      <textarea name="dog_feedNotes">${esc(feeding)}</textarea>
    </div>

    <div>
      <label>Allergien/Medikamente/Sonstiges</label>
      <textarea name="dog_allergies">${esc(notes)}</textarea>
    </div>

    <div style="margin-top:6px">
      <button type="button" class="btn ghost" onclick="this.closest('.card').remove()">Entfernen</button>
    </div>
  `;

  wrap.appendChild(div);
}

/** Kopfzeilen/Kurzinfo aktualisieren (optional) */
export function updateSummaryMeta() {
  const n = (gv("c_name") ?? "").trim();
  const dogs = [...document.querySelectorAll('#c_dogs input[name="dog_name"]')]
    .map(i => i.value).filter(Boolean);
  const meta = document.getElementById("meta_customer");
  if (meta) meta.textContent = n + (dogs.length > 0 ? " · Hunde: " + dogs.join(", ") : "");
  const md = document.getElementById("meta_dogs");
  if (md) md.textContent = dogs.length > 0 ? dogs.join(", ") : "";
}
