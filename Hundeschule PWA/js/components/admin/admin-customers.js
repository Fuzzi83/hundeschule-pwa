// /js/components/admin/admin-customers.js
// Kundenverwaltung – MwSt.-Pflicht, AGB & Unterschrift Pflicht, Hunde-Felder, stabile UI
// Fix: neue Zeichnung hat Vorrang vor „gelöscht“-Flag; _deleted wird beim Zeichnen zurückgesetzt
// Version: 2026-02-17

import { esc, genId, toast, setv, gv } from "../../core/utils.js";
import {
  settings,
  customers,
  customersTrash,
  visits,
  visitsTrash,
  stays,
  staysTrash,
  saveAll,
  getCustomerById,
} from "../../core/storage.js";

/* ============================================================
 * Zustand
 * ============================================================ */
let editCustomerId = null;

/* ============================================================
 * Ten-Card Helfer (nur Anzeige in Liste)
 * ============================================================ */
function getPurchases(c) {
  return (c.tenHistory ?? [])
    .filter((h) => h.type === "purchase")
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}
function hasActiveCard(c) {
  return getPurchases(c).some(
    (p) => (p.used ?? 0) < (p.size ?? settings.tenSize ?? 10)
  );
}

/* ============================================================
 * Kundenliste
 * ============================================================ */
export function renderCustomerList() {
  const q = (gv("cust_search") || "").toLowerCase();
  const wrap = document.getElementById("custList");
  if (!wrap) return;

  const filtered = customers.filter((c) => {
    if (!q) return true;
    const owner = (c.name || "").toLowerCase();
    const dogs = (c.dogs ?? []).map((d) => (d.name || "").toLowerCase());
    return owner.includes(q) || dogs.some((n) => n.includes(q));
  });

  let html = "";

  if (customers.length === 0) {
    html += `
      <div class="muted">Noch keine Kunden.</div>
      <button class="btn primary" onclick="openNewCustomer()">Neuer Kunde</button>
    `;
  } else if (filtered.length === 0) {
    html += `<div class="muted">Keine Treffer.</div>`;
  } else {
    html += filtered
      .map((c) => {
        const active = hasActiveCard(c);
        const dogNames = (c.dogs ?? [])
          .map((d) => esc(d.name || ""))
          .join(", ");
        return `
          <div class="card list-item">
            <div><strong>${esc(c.name)}</strong></div>
            <div class="muted">Hunde: ${dogNames || "–"}</div>
            <div class="muted">10er-Karte: ${active ? "aktiv" : "keine"}</div>
            <div style="margin-top:8px">
              <button class="btn" onclick="openCustomer('${c.id}')">Bearbeiten</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  wrap.innerHTML = html;

  const kpi = document.getElementById("cust_kpi");
  if (kpi) kpi.textContent = `Kunden: ${customers.length}`;
}

/* ============================================================
 * Signatur-Helfer
 * ============================================================ */
function setCanvasReadonly(ro) {
  const canvas = document.getElementById("c_signature_canvas");
  const btnClear = document.getElementById("btn_sig_clear");
  if (!canvas) return;
  canvas.style.pointerEvents = ro ? "none" : "auto";
  canvas.style.opacity = ro ? "0.6" : "1";
  if (btnClear) btnClear.disabled = ro;
}

export function initSignaturePad() {
  const cv = document.getElementById("c_signature_canvas");
  if (!cv || cv._padInit) return;
  cv._padInit = true;

  const ctx = cv.getContext("2d");
  cv._sig = { drawing: false, hasDrawing: false };

  function getPos(e) {
    const r = cv.getBoundingClientRect();
    if (e.touches && e.touches[0]) {
      return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
    }
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function start(e) {
    if (cv.style.pointerEvents === "none") return;
    e.preventDefault();
    // WICHTIG: Sobald eine neue Zeichnung beginnt, gilt nicht mehr „gelöscht“.
    cv._deleted = false;
    cv._sig.drawing = true;
    cv._sig.hasDrawing = true;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e) {
    if (!cv._sig.drawing) return;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function end() {
    cv._sig.drawing = false;
  }

  // Maus
  cv.addEventListener("mousedown", start);
  cv.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);

  // Touch
  cv.addEventListener("touchstart", start, { passive: false });
  cv.addEventListener("touchmove", move, { passive: false });
  window.addEventListener("touchend", end);

  // Buttons
  const btnClear = document.getElementById("btn_sig_clear");
  if (btnClear && !btnClear._bound) {
    btnClear._bound = true;
    btnClear.addEventListener("click", () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      cv._sig.hasDrawing = false;
      // _deleted bleibt unberührt – das ist gut, weil „Zeichnung löschen“ NICHT die gespeicherte Signatur betrifft.
    });
  }
}

/**
 * AGB-Checkbox-Handler (wird auch aus HTML aufgerufen)
 * Wenn gespeicherte Signatur sichtbar ist, bleibt Canvas hidden/readonly.
 * Sonst wird je nach AGB (de)aktiviert.
 */
export function requireAgbForSignature() {
  const savedWrap = document.getElementById("sig_saved_wrap");
  const cb = document.getElementById("c_terms_accept");
  const hasVisibleSaved = savedWrap && savedWrap.style.display !== "none";
  if (!hasVisibleSaved) {
    setCanvasReadonly(!(cb && cb.checked));
  }
}
// Früh global binden, damit onchange="window.requireAgbForSignature()" sicher funktioniert
window.requireAgbForSignature = requireAgbForSignature;

/* ============================================================
 * Dialog öffnen/schließen
 * ============================================================ */
export function openNewCustomer() {
  editCustomerId = null;
  const blank = {
    name: "",
    taxId: "",
    phone: "",
    email: "",
    address: { street: "", houseNo: "", city: "", zip: "" },
    emergencyContact: "",
    vet: "",
    dogs: [],
    tenHistory: [],
    signature: "",
    termsAccepted: false,
    termsAcceptedAt: null,
  };
  openCustomerDlg(blank);
}

export function openCustomer(id) {
  const c = getCustomerById(id);
  if (!c) return toast("Kunde nicht gefunden.");
  editCustomerId = id;
  openCustomerDlg({ ...c });
}

export function closeCustomerDlg() {
  document.getElementById("dlg_customer")?.classList.add("hidden");
  renderCustomerList();
}

/* ============================================================
 * Dialog befüllen + Signatur-UI + Hunde
 * ============================================================ */
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
  (c.dogs ?? []).forEach((d) => addDogRow(d));

  // AGB
  const cb = document.getElementById("c_terms_accept");
  if (cb) cb.checked = !!c.termsAccepted;

  // Signatur-UI
  const savedWrap  = document.getElementById("sig_saved_wrap");
  const savedImg   = document.getElementById("sig_saved_img");
  const btnDel     = document.getElementById("btn_sig_delete_saved");
  const canvasWrap = document.getElementById("sig_canvas_wrap");
  const canvas     = document.getElementById("c_signature_canvas");
  const ctx        = canvas.getContext("2d");

  // Canvas NEU initialisieren
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas._sig = { drawing: false, hasDrawing: false };
  canvas._deleted = false;
  canvas._padInit = false;
  initSignaturePad();

  // Gespeicherte Signatur?
  const hasSaved = !!c.signature;
  if (hasSaved) {
    // Bild anzeigen, Canvas-Bereich ausblenden
    savedImg.src = c.signature;
    savedWrap.style.display = "";
    canvasWrap.style.display = "none";
    canvasWrap.classList.remove("field-error-box");
  } else {
    // Bild weg, Canvas-Bereich einblenden und je nach AGB (de)aktivieren
    savedWrap.style.display = "none";
    canvasWrap.style.display = "";
    setCanvasReadonly(!(cb && cb.checked));
  }

  // Gespeicherte Unterschrift löschen
  if (btnDel && !btnDel._bound) {
    btnDel._bound = true;
    btnDel.addEventListener("click", () => {
      savedWrap.style.display = "none";
      canvasWrap.style.display = "";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas._sig.hasDrawing = false;
      canvas._deleted = true; // markiere: gespeicherte Signatur löschen
      setCanvasReadonly(!(cb && cb.checked));
      canvasWrap.classList.remove("field-error-box");
    });
  }

  // AGB wechselt nur Wirkung, wenn KEINE gespeicherte Signatur sichtbar ist
  if (cb && !cb._bound) {
    cb._bound = true;
    cb.addEventListener("change", () => {
      const visibleSaved = savedWrap.style.display !== "none";
      if (!visibleSaved) setCanvasReadonly(!cb.checked);
      document.getElementById("c_terms_wrap")?.classList.remove("field-error-box");
    });
  }

  const title = document.getElementById("dlg_c_title");
  if (title)
    title.textContent = editCustomerId ? "Kundendaten bearbeiten" : "Neuer Kunde";

  // Fehlerrahmen zurücksetzen
  document.getElementById("c_taxId")?.classList.remove("field-error");
  document.getElementById("c_terms_wrap")?.classList.remove("field-error-box");
  canvasWrap.classList.remove("field-error-box");

  document.getElementById("dlg_customer")?.classList.remove("hidden");
}

/* ============================================================
 * Kunde speichern (MwSt.-Pflicht + AGB & Unterschrift Pflicht)
 * ============================================================ */
export function saveCustomer() {
  const taxEl      = document.getElementById("c_taxId");
  const termsEl    = document.getElementById("c_terms_wrap");
  const canvasWrap = document.getElementById("sig_canvas_wrap");
  const savedWrap  = document.getElementById("sig_saved_wrap");

  // Reset Fehlerzustände
  taxEl.classList.remove("field-error");
  termsEl.classList.remove("field-error-box");
  canvasWrap.classList.remove("field-error-box");

  const name = (gv("c_name") || "").trim();
  const tax  = (gv("c_taxId") || "").trim();

  // 1) MwSt.-Pflicht
  if (!tax) {
    taxEl.classList.add("field-error");
    taxEl.focus({ preventScroll: false });
    toast("MwSt.-Nummer ist ein Pflichtfeld.");
    return;
  }
  if (!name) {
    toast("Name ist Pflicht.");
    document.getElementById("c_name")?.focus();
    return;
  }

  // 2) AGB & Unterschrift Pflicht
  const cb = document.getElementById("c_terms_accept");
  const accepted = !!(cb && cb.checked);

  const savedVisible   = savedWrap?.style.display !== "none";
  const cv             = document.getElementById("c_signature_canvas");
  const hasNewDrawing  = !!(cv && cv._sig && cv._sig.hasDrawing);
  const willDelete     = !!(cv && cv._deleted);

  // NEUE PRIORITÄT: neue Zeichnung > löschen > unverändert
  let signatureValid = false;
  if (accepted) {
    if (savedVisible && !willDelete) signatureValid = true;
    else if (hasNewDrawing)          signatureValid = true;
  }

  if (!accepted || !signatureValid) {
    if (!accepted) {
      termsEl.classList.add("field-error-box");
      termsEl.scrollIntoView({ behavior: "smooth", block: "center" });
      toast("Bitte AGB akzeptieren.");
    }
    if (accepted && !signatureValid) {
      if (canvasWrap.style.display !== "none") {
        canvasWrap.classList.add("field-error-box");
        canvasWrap.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      toast("Bitte unterschreiben.");
    }
    return;
  }

  // ===== Daten übernehmen =====
  const phone = (gv("c_phone") || "").trim();
  const email = (gv("c_email") || "").trim();
  const emergency = (gv("c_emergency") || "").trim();
  const vet = (gv("c_vet") || "").trim();

  const address = {
    street: (gv("c_addr_street") || "").trim(),
    houseNo: (gv("c_addr_no") || "").trim(),
    city: (gv("c_addr_city") || "").trim(),
    zip: (gv("c_addr_zip") || "").trim(),
  };

  const dogCards = [...document.querySelectorAll("#c_dogs .card")]
    .map((div) => {
      const val  = (n) => div.querySelector(`[name="${n}"]`)?.value?.trim() || "";
      const yes  = (n) => (div.querySelector(`[name="${n}"]`)?.value || "no") === "yes";
      return {
        id: div.dataset.dogId || genId(),
        name: val("dog_name"),
        breed: val("dog_breed"),
        sex: val("dog_sex"), // "m" | "w"
        age: val("dog_age"),
        chipId: val("dog_chip"),
        neutered: yes("dog_neutered"),
        social: yes("dog_social"),
        foodGuarding: yes("dog_foodGuarding"),
        fearStormFireworks: yes("dog_fear"),
        feedingNotes: val("dog_feedNotes"),
        treatsAllowed: yes("dog_treats"),
        allergiesMedsNotes: div.querySelector('[name="dog_allergies"]')?.value?.trim() || ""
      };
    })
    .filter((d) => d.name);

  // Signaturwert ermitteln – NEUE PRIORITÄT
  let signatureToSave = null; // null = unverändert
  if (cv) {
    if (cv._sig && cv._sig.hasDrawing) {
      // Neue Zeichnung hat Vorrang
      try { signatureToSave = cv.toDataURL("image/png"); } catch { signatureToSave = null; }
    } else if (cv._deleted) {
      signatureToSave = ""; // gespeicherte löschen
    }
  }

  if (editCustomerId) {
    const c = getCustomerById(editCustomerId);
    if (!c) return;
    c.name = name;
    c.taxId = tax;
    c.phone = phone;
    c.email = email;
    c.address = address;
    c.emergencyContact = emergency;
    c.vet = vet;
    c.dogs = dogCards;

    c.termsAccepted = accepted;
    if (accepted && !c.termsAcceptedAt) c.termsAcceptedAt = new Date().toISOString();

    if (signatureToSave !== null) c.signature = signatureToSave;
  } else {
    const c = {
      id: genId(),
      name,
      taxId: tax,
      phone,
      email,
      address,
      emergencyContact: emergency,
      vet,
      dogs: dogCards,
      tenHistory: [],
      termsAccepted: accepted,
      termsAcceptedAt: new Date().toISOString(),
      signature: signatureToSave || "",
    };
    customers.push(c);
    editCustomerId = c.id;
  }

  saveAll();
  closeCustomerDlg();
}

/* ============================================================
 * Löschen → Papierkorb
 * ============================================================ */
export function deleteCustomer() {
  if (!editCustomerId) return;
  const c = getCustomerById(editCustomerId);
  if (!c) return;
  if (!confirm("Diesen Kunden in den Papierkorb verschieben?")) return;

  const ts = new Date().toISOString();

  const idx = customers.findIndex((x) => x.id === c.id);
  if (idx >= 0) customers.splice(idx, 1);
  customersTrash.push({ ...c, deletedAt: ts });

  for (let i = visits.length - 1; i >= 0; i--) {
    if (visits[i].customerId === c.id) {
      const v = visits[i];
      visits.splice(i, 1);
      visitsTrash.push({ ...v, deletedAt: ts });
    }
  }
  for (let i = stays.length - 1; i >= 0; i--) {
    if (stays[i].customerId === c.id) {
      const s = stays[i];
      stays.splice(i, 1);
      staysTrash.push({ ...s, deletedAt: ts });
    }
  }

  saveAll();
  closeCustomerDlg();
}

/* ============================================================
 * Hunde-Editor – Karte gemäß deinem Screenshot
 * ============================================================ */
export function addDogRow(d) {
  const wrap = document.getElementById("c_dogs");
  if (!wrap) return;

  const id = d?.id || genId();
  const name = d?.name || "";
  const breed = d?.breed || "";
  const sex = d?.sex || "m"; // m | w
  const age = d?.age || "";
  const chipId = d?.chipId || "";
  const neutered = !!d?.neutered;
  const social = !!d?.social;
  const foodGuarding = !!d?.foodGuarding;
  const fear = !!d?.fearStormFireworks;
  const feeding = d?.feedingNotes || "";
  const treats = !!d?.treatsAllowed;
  const notes = d?.allergiesMedsNotes || "";

  const div = document.createElement("div");
  div.className = "card";
  div.style.margin = "8px 0";
  div.dataset.dogId = id;

  div.innerHTML = `
    <div class="fg3">
      <label>Name
        <input name="dog_name" value="${esc(name)}" />
      </label>

      <label>Rasse
        <input name="dog_breed" value="${esc(breed)}" />
      </label>

      <label>Geschlecht
        <select name="dog_sex">
          <option value="m" ${sex === "m" ? "selected" : ""}>männlich</option>
          <option value="w" ${sex === "w" ? "selected" : ""}>weiblich</option>
        </select>
      </label>

      <label>Alter
        <input name="dog_age" placeholder="z. B. 3 Jahre" value="${esc(age)}" />
      </label>

      <label>Chip‑Nr.
        <input name="dog_chip" value="${esc(chipId)}" />
      </label>

      <label>Kastriert?
        <select name="dog_neutered">
          <option value="no" ${!neutered ? "selected" : ""}>nein</option>
          <option value="yes" ${neutered ? "selected" : ""}>ja</option>
        </select>
      </label>

      <label>Kommt mit anderen Hunden klar?
        <select name="dog_social">
          <option value="no" ${!social ? "selected" : ""}>nein</option>
          <option value="yes" ${social ? "selected" : ""}>ja</option>
        </select>
      </label>

      <label>Verteidigt Futter?
        <select name="dog_foodGuarding">
          <option value="no" ${!foodGuarding ? "selected" : ""}>nein</option>
          <option value="yes" ${foodGuarding ? "selected" : ""}>ja</option>
        </select>
      </label>

      <label>Angst vor Gewitter/Feuerwerk?
        <select name="dog_fear">
          <option value="no" ${!fear ? "selected" : ""}>nein</option>
          <option value="yes" ${fear ? "selected" : ""}>ja</option>
        </select>
      </label>

      <label>Fütterungshinweise
        <input name="dog_feedNotes" placeholder="z. B. Uhrzeiten, Mengen" value="${esc(feeding)}" />
      </label>

      <label>Darf er Leckerlies?
        <select name="dog_treats">
          <option value="no" ${!treats ? "selected" : ""}>nein</option>
          <option value="yes" ${treats ? "selected" : ""}>ja</option>
        </select>
      </label>

      <label style="grid-column: 1 / -1">Allergien/Medikamente/Sonstiges
        <textarea name="dog_allergies" rows="3">${esc(notes)}</textarea>
      </label>
    </div>

    <div style="margin-top:8px">
      <button class="btn outline" onclick="this.closest('.card').remove()">Entfernen</button>
    </div>
  `;

  wrap.appendChild(div);
}

/* ============================================================
 * Globale Exporte
 * ============================================================ */
window.renderCustomerList = renderCustomerList;
window.openNewCustomer = openNewCustomer;
window.openCustomer = openCustomer;
window.closeCustomerDlg = closeCustomerDlg;
window.addDogRow = addDogRow;
window.saveCustomer = saveCustomer;
window.deleteCustomer = deleteCustomer;
window.initSignaturePad = initSignaturePad;
// requireAgbForSignature wurde oben bereits global gesetzt