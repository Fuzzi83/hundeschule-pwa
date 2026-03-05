// /js/app.js
"use strict";

import { initNavigation, makeGo, bindTiles } from "./core/navigation.js";

// Komponenten
import "./components/day.js";
import "./components/stay.js";
import "./components/reports.js";

// Admin-Module
import "./components/admin/customers/index.js";   
import "./components/admin/admin-prices.js";
import "./components/admin/admin-hourpacks.js";
import "./components/admin/admin-trash.js";
import "./components/admin/admin-backup.js";


function runActivePageHook() {
  const active = document.querySelector(".page:not(.hidden)");
  if (!active) return;
  const id = active.id;

  if (id === "page_day") {
    window.renderDayPage?.();
  }

  if (id === "page_stay") {
    window.renderStayPage?.();
  }

  if (id === "page_reports") {
    window.renderReports?.();
    window.renderRevenueAll?.();
    window.renderConflictReport?.();
  }

  if (id === "page_admin_customers") {
    window.renderCustomerList?.();
  }

  if (id === "page_admin_prices") {
    window.renderSettings?.();
  }

  if (id === "page_admin_hourpacks") {
    window.renderHourPacks?.();
  }

  if (id === "page_admin_trash") {
    window.renderTrashPage?.();
  }

  if (id === "page_admin_backup") {
    window.renderStats?.();
    window.renderFsSection?.();
  }
}

const go = makeGo();
initNavigation(go);
window.go = go;

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".dlg-wrap").forEach((d) =>
    d.classList.add("hidden")
  );

  bindTiles(go);

  const initial = (location.hash || "#home").substring(1) || "home";
  go(initial);

  setTimeout(runActivePageHook, 10);
  window.addEventListener("hashchange", () =>
    setTimeout(runActivePageHook, 0)
  );
});