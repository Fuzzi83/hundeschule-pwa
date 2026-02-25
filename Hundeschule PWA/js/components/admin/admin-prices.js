// /js/components/admin/admin-prices.js
// Preisseite (Settings) – ohne 10er-Karte (ersetzt alte Version vollständig)

import { settings, saveAll } from "../../core/storage.js";
import { toast } from "../../core/utils.js";

/* ---------------------------------- Helpers --------------------------------- */
function num(v) { return Number.parseFloat(v ?? "NaN"); }
function str(v) { return (v ?? "").trim(); }

function bindAutosave() {
  const ids = [
    "s_dayHourly","s_dayHourlySecond","s_dayDaily","s_dayDailySecond",
    "s_summerStart","s_winterStart",
    "s_nightSummer","s_nightWinter","s_nightSecondSummer","s_nightSecondWinter",
    "s_earlyFeeSummer","s_lateFeeSummer","s_earlyFeeWinter","s_lateFeeWinter",
    "s_earlyThreshold","s_lateThreshold","s_stdNoon"
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el._blurBound) {
      el._blurBound = true;
      el.addEventListener("blur", () => {
        switch(id) {
          case "s_dayHourly": settings.dayHourly = num(el.value) || 0; break;
          case "s_dayHourlySecond": settings.dayHourlySecond = num(el.value) || 0; break;
          case "s_dayDaily": settings.dayDaily = num(el.value) || 0; break;
          case "s_dayDailySecond": settings.dayDailySecond = num(el.value) || 0; break;
          case "s_summerStart": settings.summerStart = str(el.value); break;
          case "s_winterStart": settings.winterStart = str(el.value); break;
          case "s_nightSummer": settings.nightSummer = num(el.value) || 0; break;
          case "s_nightWinter": settings.nightWinter = num(el.value) || 0; break;
          case "s_nightSecondSummer": settings.nightSecondSummer = num(el.value) || 0; break;
          case "s_nightSecondWinter": settings.nightSecondWinter = num(el.value) || 0; break;
          case "s_earlyFeeSummer": settings.earlyFeeSummer = num(el.value) || 0; break;
          case "s_lateFeeSummer": settings.lateFeeSummer = num(el.value) || 0; break;
          case "s_earlyFeeWinter": settings.earlyFeeWinter = num(el.value) || 0; break;
          case "s_lateFeeWinter": settings.lateFeeWinter = num(el.value) || 0; break;
          case "s_earlyThreshold": settings.earlyThreshold = str(el.value); break;
          case "s_lateThreshold": settings.lateThreshold = str(el.value); break;
          case "s_stdNoon": settings.stdNoon = str(el.value); break;
        }
        saveAll();
      });
    }
  });
}

/* ---------------------------------- Render ---------------------------------- */
export function renderSettings() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ""; };
  set("s_dayHourly", settings.dayHourly);
  set("s_dayHourlySecond", settings.dayHourlySecond);
  set("s_dayDaily", settings.dayDaily);
  set("s_dayDailySecond", settings.dayDailySecond);
  set("s_summerStart", settings.summerStart);
  set("s_winterStart", settings.winterStart);
  set("s_nightSummer", settings.nightSummer);
  set("s_nightWinter", settings.nightWinter);
  set("s_nightSecondSummer", settings.nightSecondSummer);
  set("s_nightSecondWinter", settings.nightSecondWinter);
  set("s_earlyFeeSummer", settings.earlyFeeSummer);
  set("s_lateFeeSummer", settings.lateFeeSummer);
  set("s_earlyFeeWinter", settings.earlyFeeWinter);
  set("s_lateFeeWinter", settings.lateFeeWinter);
  set("s_earlyThreshold", settings.earlyThreshold);
  set("s_lateThreshold", settings.lateThreshold);
  set("s_stdNoon", settings.stdNoon);

  const btn = document.getElementById("btn_save_settings");
  if (btn) {
    btn.disabled = false;
    if (!btn._bound) {
      btn._bound = true;
      btn.addEventListener("click", () => {
        // Werte übernehmen
        settings.dayHourly = num(document.getElementById("s_dayHourly")?.value) || 0;
        settings.dayHourlySecond = num(document.getElementById("s_dayHourlySecond")?.value) || 0;
        settings.dayDaily = num(document.getElementById("s_dayDaily")?.value) || 0;
        settings.dayDailySecond = num(document.getElementById("s_dayDailySecond")?.value) || 0;
        settings.summerStart = str(document.getElementById("s_summerStart")?.value);
        settings.winterStart = str(document.getElementById("s_winterStart")?.value);
        settings.nightSummer = num(document.getElementById("s_nightSummer")?.value) || 0;
        settings.nightWinter = num(document.getElementById("s_nightWinter")?.value) || 0;
        settings.nightSecondSummer = num(document.getElementById("s_nightSecondSummer")?.value) || 0;
        settings.nightSecondWinter = num(document.getElementById("s_nightSecondWinter")?.value) || 0;
        settings.earlyFeeSummer = num(document.getElementById("s_earlyFeeSummer")?.value) || 0;
        settings.lateFeeSummer = num(document.getElementById("s_lateFeeSummer")?.value) || 0;
        settings.earlyFeeWinter = num(document.getElementById("s_earlyFeeWinter")?.value) || 0;
        settings.lateFeeWinter = num(document.getElementById("s_lateFeeWinter")?.value) || 0;
        settings.earlyThreshold = str(document.getElementById("s_earlyThreshold")?.value);
        settings.lateThreshold = str(document.getElementById("s_lateThreshold")?.value);
        settings.stdNoon = str(document.getElementById("s_stdNoon")?.value);

        saveAll();
        toast("Einstellungen gespeichert.");

        // Optional: direkter Sprung in die neue Seite (falls Button vorhanden)
        // if (typeof window.go === "function") window.go("admin_hourpacks");
      });
    }
  }

  // optional: Autosave-on-blur
  bindAutosave();

  // Optional: Falls du einen Button "Stundenpakete verwalten" im Markup hast:
  const btnHP = document.getElementById("btn_open_hourpacks");
  if (btnHP && !btnHP._bound) {
    btnHP._bound = true;
    btnHP.addEventListener("click", () => {
      if (typeof window.go === "function") window.go("admin_hourpacks");
      else location.hash = "#admin_hourpacks";
    });
  }
}

// Für manuelle Tests
window.renderSettings = renderSettings;