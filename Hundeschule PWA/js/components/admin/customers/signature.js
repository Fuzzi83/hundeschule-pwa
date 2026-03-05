// /js/components/admin/customers/signature.js
"use strict";

function byId(id) { return document.getElementById(id); }

function isBlankCanvas(cv) {
  try {
    const blank = document.createElement("canvas");
    blank.width = cv.width; blank.height = cv.height;
    return cv.toDataURL() === blank.toDataURL();
  } catch {
    return false;
  }
}

function setReadonlyLook(cv, on) {
  if (!cv) return;
  if (on) {
    cv.style.pointerEvents = "none";
    cv.style.background = "#f3f3f3";
    cv.style.opacity = "1";
    cv.dataset.readonly = "1";
  } else {
    cv.style.background = "";
    cv.dataset.readonly = "0";
  }
}

export function initSignaturePad() {
  const cv = byId("c_signature_canvas");
  if (!cv || cv._padInit) return;
  cv._padInit = true;

  const ctx = cv.getContext("2d");
  let drawing = false;

  // ✅ Fix: korrekt skalieren (CSS-Größe vs Canvas-Auflösung)
  const pos = (e) => {
    const r = cv.getBoundingClientRect();
    const t = e.touches && e.touches[0];
    const clientX = (t?.clientX ?? e.clientX);
    const clientY = (t?.clientY ?? e.clientY);

    const xCss = clientX - r.left;
    const yCss = clientY - r.top;

    const scaleX = cv.width / r.width;
    const scaleY = cv.height / r.height;

    return { x: xCss * scaleX, y: yCss * scaleY };
  };

  const start = (e) => {
    if (cv.style.pointerEvents === "none") return;
    if (cv.dataset.readonly === "1") return;
    e.preventDefault();
    drawing = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (e) => {
    if (!drawing) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    ctx.stroke();
  };

  const end = () => { drawing = false; };

  cv.addEventListener("mousedown", start);
  cv.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);

  cv.addEventListener("touchstart", start, { passive: false });
  cv.addEventListener("touchmove", move, { passive: false });
  window.addEventListener("touchend", end);

  const clearBtn = byId("btn_sig_clear");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      setReadonlyLook(cv, false);
      requireAgbForSignature();
    });
  }
}

/**
 * AGB-Regel:
 * - Wenn AGB nicht akzeptiert: keine Eingabe möglich
 * - Wenn akzeptiert: Eingabe möglich (außer readonly signature ist aktiv)
 */
export function requireAgbForSignature() {
  const cb = byId("c_terms_accept");
  const cv = byId("c_signature_canvas");
  if (!cv) return;

  if (cv.dataset.readonly === "1") {
    cv.style.pointerEvents = "none";
    cv.style.opacity = "1";
    return;
  }

  if (cb && cb.checked) {
    cv.style.pointerEvents = "auto";
    cv.style.opacity = "1";
  } else {
    cv.style.pointerEvents = "none";
    cv.style.opacity = ".6";
  }
}

export function showSavedSignature(dataUrl) {
  const cv = byId("c_signature_canvas");
  if (!cv || !dataUrl) return;

  const ctx = cv.getContext("2d");
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    setReadonlyLook(cv, true);
  };
  img.src = dataUrl;
}

export function signatureIsBlank() {
  const cv = byId("c_signature_canvas");
  if (!cv) return true;
  return isBlankCanvas(cv);
}