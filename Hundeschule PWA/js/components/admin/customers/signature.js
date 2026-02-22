// /js/components/admin/customers/signature.js
"use strict";

import { getCustomerById } from "../../core/storage.js";
import { getEditCustomerId } from "./state.js";

/** Canvas schreibschutz + Buttons für Signatur umschalten */
export function sigSetReadonlyUI(ro) {
  const cv = document.getElementById("c_signature_canvas");
  const bC = document.getElementById("btn_sig_clear");
  const bD = document.getElementById("btn_sig_delete_saved");
  const bE = document.getElementById("btn_sig_edit");
  if (!cv) return;
  cv.style.pointerEvents = ro ? "none" : "auto";
  cv.style.opacity = ro ? "0.6" : "1";
  if (bC) bC.style.display = ro ? "none" : "inline-block";
  if (bD) bD.style.display = ro ? "none" : "inline-block";
  if (bE) bE.style.display = ro ? "inline-block" : "none";
}

/** Vorschau rechts neben dem Canvas aktualisieren */
export function sigUpdatePreview() {
  const cv = document.getElementById("c_signature_canvas");
  const w = document.getElementById("sig_preview_wrap");
  if (!cv || !w) return;

  w.innerHTML = "";
  const owner = getEditCustomerId() ? getCustomerById(getEditCustomerId()) : null;
  const saved = owner && owner.signature ? owner.signature : null;

  if (cv._sig && cv._sig.hasDrawing) {
    const url = cv.toDataURL("image/png");
    const img = document.createElement("img");
    img.src = url; img.alt = "Signatur";
    img.style = "max-width:100%;border:1px solid #eee;border-radius:6px";
    w.appendChild(img);
  } else if (saved && !cv._deleted) {
    const img2 = document.createElement("img");
    img2.src = saved; img2.alt = "Signatur";
    img2.style = "max-width:100%;border:1px solid #eee;border-radius:6px";
    w.appendChild(img2);
  } else {
    const d = document.createElement("div");
    d.className = "muted";
    d.textContent = "(noch keine)";
    w.appendChild(d);
  }
}

/** AGB-Haken steuert Schreibschutz des Canvas */
export function requireAgbForSignature() {
  const cb = document.getElementById("c_terms_accept");
  const cv = document.getElementById("c_signature_canvas");
  if (!cb || !cv) return;

  const cust = getEditCustomerId() ? getCustomerById(getEditCustomerId()) : null;
  const locked = cust && typeof cust.signatureLocked === "boolean" ? cust.signatureLocked : !!(cust && cust.signature);

  if (!cb.checked) { sigSetReadonlyUI(true); return; }
  if (!locked) sigSetReadonlyUI(false);
  else sigSetReadonlyUI(true);
}

/** Einfacher, eingebauter "Signature Pad" (ohne externe Lib) */
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
    e.preventDefault();
    cv._sig.drawing = true;
    cv._sig.hasDrawing = true;
    const p = getPos(e);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
  }

  function move(e) {
    if (!cv._sig.drawing) return;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = "#111"; ctx.lineWidth = 2;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.stroke();
  }

  function end() {
    cv._sig.drawing = false;
    sigUpdatePreview();
  }

  // Maus
  cv.addEventListener("mousedown", start);
  cv.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);

  // Touch
  cv.addEventListener("touchstart", start, { passive: false });
  cv.addEventListener("touchmove", move, { passive: false });
  window.addEventListener("touchend", end);

  // Buttons (falls vorhanden)
  const btnClear = document.getElementById("btn_sig_clear");
  if (btnClear) {
    btnClear.onclick = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      cv._sig.hasDrawing = false;
      cv._deleted = false;
      sigUpdatePreview();
    };
  }
  const btnDeleteSaved = document.getElementById("btn_sig_delete_saved");
  if (btnDeleteSaved) {
    btnDeleteSaved.onclick = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      cv._sig.hasDrawing = false;
      cv._deleted = true;
      sigUpdatePreview();
    };
  }
  const btnEdit = document.getElementById("btn_sig_edit");
  if (btnEdit) {
    btnEdit.onclick = () => { sigSetReadonlyUI(false); };
  }

  sigUpdatePreview();
}
