// /js/app.js
// App-Bootstrap: Navigation + Seiten-Hooks
"use strict";

import { initNavigation, makeGo, bindTiles } from "./core/navigation.js";

// Komponenten
import "./components/day.js";
import "./components/stay.js";
import "./components/reports.js";

// Admin-Module
import "./components/admin/admin-customers.js";
import "./components/admin/admin-prices.js";
import "./components/admin/admin-trash.js";
import "./components/admin/admin-backup.js";

/**
 * Führt die Render-Hooks der jeweils aktiven Seite aus.
 * Wird beim Initialisieren und nach jedem Hash-Change aufgerufen.
 */
function runActivePageHook() {
  const active = document.querySelector(".page:not(.hidden)");
  if (!active) return;
  const id = active.id;

  // Tageshunde
  if (id === "page_day") {
    window.renderDayPage?.();
  }

  // Pensionshunde
  if (id === "page_stay") {
    window.renderStayPage?.();
  }

  // Reports
  if (id === "page_reports") {
    window.renderReports?.();       // Tabelle(n) füllen
    window.renderRevenueAll?.();    // Umsatz-Ansicht
    window.renderConflictReport?.();// Konflikte
  }

  // Admin: Kunden
  if (id === "page_admin_customers") {
    window.renderCustomerList?.();
  }

  // Admin: Preise
  if (id === "page_admin_prices") {
    window.renderSettings?.();
  }

  // Admin: Papierkorb
  if (id === "page_admin_trash") {
    window.renderTrashPage?.();
  }

  // Admin: Backup
  if (id === "page_admin_backup") {
    window.renderStats?.();
    window.renderFsSection?.();
  }
}

// Navigation initialisieren und global machen
const go = makeGo();
initNavigation(go);
window.go = go; // wichtig für onclick="go('...')"

// DOM ready
document.addEventListener("DOMContentLoaded", () => {
  // Alle Dialoge initial verstecken (Sicherheitsnetz)
  document.querySelectorAll(".dlg-wrap").forEach((d) => d.classList.add("hidden"));

  // Tiles mit data-target an Navigation binden
  bindTiles(go);

  // Startseite / Hash-Ziel aktivieren
  const initial = (location.hash || "#home").substring(1) || "home";
  go(initial);

  // Hooks ausführen (kurze Verzögerung für initiales Layout)
  setTimeout(runActivePageHook, 10);

  // Beim Hashwechsel Hooks erneut
  window.addEventListener("hashchange", () => setTimeout(runActivePageHook, 0));
});