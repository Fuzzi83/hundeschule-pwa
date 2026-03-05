// /js/components/admin/admin-prices.js
"use strict";

import { settings, saveAll } from "../../core/storage.js";
import { toast } from "../../core/utils.js";

function byId(id){ return document.getElementById(id); }
function gv(id){ return byId(id)?.value ?? ""; }
function setv(id, v){ const el = byId(id); if (el) el.value = (v ?? ""); }
function num(v){ return Number.parseFloat(String(v ?? "").replace(",", ".")); }
function str(v){ return String(v ?? "").trim(); }

/**
 * Datumformat TT-MM speichern/anzeigen.
 * Legacy: ältere Werte könnten als MM-TT gespeichert sein (z.B. "05-01").
 */
function normDayMonthTTMM(v){
  const s = String(v ?? "").trim();
  if(!s) return "";
  const m = s.match(/^(\d{1,2})-(\d{1,2})$/);
  if(!m) return s;

  let a = Number(m[1]);
  let b = Number(m[2]);

  // Heuristik:
  // a>12 => TT-MM
  // b>12 => MM-TT -> drehen
  // ambig (beide <=12) => bisher MM-TT -> drehen
  if (a > 12) {
    return `${String(a).padStart(2,"0")}-${String(b).padStart(2,"0")}`;
  }
  if (b > 12) {
    return `${String(b).padStart(2,"0")}-${String(a).padStart(2,"0")}`;
  }
  return `${String(b).padStart(2,"0")}-${String(a).padStart(2,"0")}`;
}
function sanitizeTTMMInput(v){ return normDayMonthTTMM(v); }

/**
 * UI State:
 * - settings.ui_prices_state: JSON {"day":true/false,"stay":true/false,"training":true/false}
 * - settings.ui_prices_last: "day"|"stay"|"training" (letztes Panel, das geöffnet wurde)
 */
function ensureDefaults(){
  // Tageshunde
  if (settings.dayHourly == null) settings.dayHourly = 0;
  if (settings.dayHourlySecond == null) settings.dayHourlySecond = 0;
  if (settings.dayDaily == null) settings.dayDaily = 0;
  if (settings.dayDailySecond == null) settings.dayDailySecond = 0;

  // Pension (TT-MM)
  if (settings.summerStart == null) settings.summerStart = "01-05";
  if (settings.winterStart == null) settings.winterStart = "01-10";

  if (settings.nightSummer == null) settings.nightSummer = 0;
  if (settings.nightWinter == null) settings.nightWinter = 0;
  if (settings.nightSecondSummer == null) settings.nightSecondSummer = 0;
  if (settings.nightSecondWinter == null) settings.nightSecondWinter = 0;

  if (settings.earlyThreshold == null) settings.earlyThreshold = "07:00";
  if (settings.lateThreshold == null) settings.lateThreshold = "18:00";
  if (settings.stdNoon == null) settings.stdNoon = "12:00";

  if (settings.earlyFeeSummer == null) settings.earlyFeeSummer = 0;
  if (settings.lateFeeSummer == null) settings.lateFeeSummer = 0;
  if (settings.earlyFeeWinter == null) settings.earlyFeeWinter = 0;
  if (settings.lateFeeWinter == null) settings.lateFeeWinter = 0;

  // Hundetraining
  if (settings.trainingJuenghunde == null) settings.trainingJuenghunde = 0;
  if (settings.trainingWelpen == null) settings.trainingWelpen = 0;
  if (settings.trainingEinzel == null) settings.trainingEinzel = 0;
  if (settings.trainingKurse == null) settings.trainingKurse = 0;

  if (settings.ui_prices_state == null) {
    settings.ui_prices_state = JSON.stringify({ day: true, stay: false, training: false });
  }
  if (settings.ui_prices_last == null) {
    settings.ui_prices_last = "day";
  }
}

function getUIState(){
  try {
    const obj = JSON.parse(settings.ui_prices_state || "{}");
    return {
      day: !!obj.day,
      stay: !!obj.stay,
      training: !!obj.training
    };
  } catch {
    return { day: true, stay: false, training: false };
  }
}
function setUIState(state){
  settings.ui_prices_state = JSON.stringify({
    day: !!state.day,
    stay: !!state.stay,
    training: !!state.training
  });
}

/**
 * ✅ Wichtig: Wir speichern IMMER den Zustand aller Panels,
 * auch wenn danach ALLE geschlossen sind.
 */
function captureAndPersistPanels(){
  const d = byId("prices_day");
  const s = byId("prices_stay");
  const t = byId("prices_training");

  const state = {
    day: !!d?.open,
    stay: !!s?.open,
    training: !!t?.open
  };
  setUIState(state);

  saveAll(); // UI-State sofort persistieren (damit "alles zu" wirklich bleibt)
}

function applyPanelsFromSavedState(){
  const st = getUIState();
  const d = byId("prices_day");
  const s = byId("prices_stay");
  const t = byId("prices_training");

  if (d) d.open = !!st.day;
  if (s) s.open = !!st.stay;
  if (t) t.open = !!st.training;
}

function wireBack(){
  const page = byId("page_admin_prices");
  const btn = page?.querySelector?.('[data-target="admin_home"]');
  if(!btn || btn.dataset.bound) return;
  btn.addEventListener("click", (e)=>{
    e.preventDefault();
    window.go?.("admin_home");
  });
  btn.dataset.bound = "1";
}

function buildUI(){
  const page = byId("page_admin_prices");
  if(!page) return;

  page.innerHTML = `
    <div class="space">
      <h2>Preise</h2>
      <button class="btn ghost" type="button" data-target="admin_home">Zurück</button>
    </div>

    <div class="card" style="padding:12px">
      <details id="prices_day">
        <summary style="cursor:pointer; font-weight:900">Tageshunde</summary>
        <div style="margin-top:10px" class="fg3">
          <label>Stundensatz (1. Hund) €/h
            <input id="s_dayHourly" type="number" step="0.01" inputmode="decimal">
          </label>
          <label>Stundensatz (2. Hund) €/h
            <input id="s_dayHourlySecond" type="number" step="0.01" inputmode="decimal">
          </label>
          <label>Tagessatz (1. Hund) €
            <input id="s_dayDaily" type="number" step="0.01" inputmode="decimal">
          </label>
          <label>Tagessatz (2. Hund) €
            <input id="s_dayDailySecond" type="number" step="0.01" inputmode="decimal">
          </label>
        </div>
      </details>
    </div>

    <div class="card" style="padding:12px; margin-top:12px">
      <details id="prices_stay">
        <summary style="cursor:pointer; font-weight:900">Pensionshunde</summary>
        <div style="margin-top:10px" class="fg3">
          <label>Sommer ab (TT-MM)
            <input id="s_summerStart" placeholder="01-05" inputmode="numeric">
          </label>
          <label>Winter ab (TT-MM)
            <input id="s_winterStart" placeholder="01-10" inputmode="numeric">
          </label>
          <label>Standard-Mittag (HH:MM)
            <input id="s_stdNoon" placeholder="12:00">
          </label>

          <label>Nacht (Sommer)
            <input id="s_nightSummer" type="number" step="0.01" inputmode="decimal">
          </label>
          <label>Nacht (Winter)
            <input id="s_nightWinter" type="number" step="0.01" inputmode="decimal">
          </label>
          <label>Nacht 2. Hund (Sommer)
            <input id="s_nightSecondSummer" type="number" step="0.01" inputmode="decimal">
          </label>
          <label>Nacht 2. Hund (Winter)
            <input id="s_nightSecondWinter" type="number" step="0.01" inputmode="decimal">
          </label>

          <label>Früh ab (HH:MM)
            <input id="s_earlyThreshold" placeholder="07:00">
          </label>
          <label>Spät ab (HH:MM)
            <input id="s_lateThreshold" placeholder="18:00">
          </label>

          <label>Früh-Zuschlag (Sommer)
            <input id="s_earlyFeeSummer" type="number" step="0.01" inputmode="decimal">
          </label>
          <label>Spät-Zuschlag (Sommer)
            <input id="s_lateFeeSummer" type="number" step="0.01" inputmode="decimal">
          </label>
          <label>Früh-Zuschlag (Winter)
            <input id="s_earlyFeeWinter" type="number" step="0.01" inputmode="decimal">
          </label>
          <label>Spät-Zuschlag (Winter)
            <input id="s_lateFeeWinter" type="number" step="0.01" inputmode="decimal">
          </label>
        </div>
      </details>
    </div>

    <div class="card" style="padding:12px; margin-top:12px">
      <details id="prices_training">
        <summary style="cursor:pointer; font-weight:900">Hundetraining</summary>
        <div style="margin-top:10px" class="fg3">
          <label>Junghundegruppe (€)
            <input id="s_trainingJuenghunde" type="number" step="0.01" inputmode="decimal">
          </label>
          <label>Welpen (€)
            <input id="s_trainingWelpen" type="number" step="0.01" inputmode="decimal">
          </label>
          <label>Einzeltraining (€)
            <input id="s_trainingEinzel" type="number" step="0.01" inputmode="decimal">
          </label>
          <label>Kurse (€)
            <input id="s_trainingKurse" type="number" step="0.01" inputmode="decimal">
          </label>
        </div>
      </details>
    </div>

    <div class="actions-sticky" style="display:flex; gap:8px; align-items:center; justify-content:space-between; margin-top:12px">
      <button id="btn_open_hourpacks" class="btn outline" type="button">Stundenpakete verwalten</button>
      <button id="btn_save_settings" class="btn primary" type="button">Speichern</button>
    </div>
  `;

  wireBack();

  // State anwenden
  applyPanelsFromSavedState();

  const d = byId("prices_day");
  const s = byId("prices_stay");
  const t = byId("prices_training");

  // ✅ toggle: Zustand speichern, auch wenn ALLE zu sind
  d?.addEventListener("toggle", () => {
    if (d.open) settings.ui_prices_last = "day";
    captureAndPersistPanels();
  });
  s?.addEventListener("toggle", () => {
    if (s.open) settings.ui_prices_last = "stay";
    captureAndPersistPanels();
  });
  t?.addEventListener("toggle", () => {
    if (t.open) settings.ui_prices_last = "training";
    captureAndPersistPanels();
  });

  byId("btn_open_hourpacks")?.addEventListener("click", ()=> window.go?.("admin_hourpacks"));
  byId("btn_save_settings")?.addEventListener("click", saveSettings);
}

export function renderSettings(){
  ensureDefaults();
  buildUI();

  // Werte setzen
  setv("s_dayHourly", settings.dayHourly);
  setv("s_dayHourlySecond", settings.dayHourlySecond);
  setv("s_dayDaily", settings.dayDaily);
  setv("s_dayDailySecond", settings.dayDailySecond);

  setv("s_summerStart", normDayMonthTTMM(settings.summerStart));
  setv("s_winterStart", normDayMonthTTMM(settings.winterStart));
  setv("s_stdNoon", settings.stdNoon);

  setv("s_nightSummer", settings.nightSummer);
  setv("s_nightWinter", settings.nightWinter);
  setv("s_nightSecondSummer", settings.nightSecondSummer);
  setv("s_nightSecondWinter", settings.nightSecondWinter);

  setv("s_earlyThreshold", settings.earlyThreshold);
  setv("s_lateThreshold", settings.lateThreshold);

  setv("s_earlyFeeSummer", settings.earlyFeeSummer);
  setv("s_lateFeeSummer", settings.lateFeeSummer);
  setv("s_earlyFeeWinter", settings.earlyFeeWinter);
  setv("s_lateFeeWinter", settings.lateFeeWinter);

  setv("s_trainingJuenghunde", settings.trainingJuenghunde);
  setv("s_trainingWelpen", settings.trainingWelpen);
  setv("s_trainingEinzel", settings.trainingEinzel);
  setv("s_trainingKurse", settings.trainingKurse);
}

export function saveSettings(){
  ensureDefaults();

  settings.dayHourly = num(gv("s_dayHourly")) || 0;
  settings.dayHourlySecond = num(gv("s_dayHourlySecond")) || 0;
  settings.dayDaily = num(gv("s_dayDaily")) || 0;
  settings.dayDailySecond = num(gv("s_dayDailySecond")) || 0;

  settings.summerStart = sanitizeTTMMInput(gv("s_summerStart"));
  settings.winterStart = sanitizeTTMMInput(gv("s_winterStart"));
  settings.stdNoon = str(gv("s_stdNoon"));

  settings.nightSummer = num(gv("s_nightSummer")) || 0;
  settings.nightWinter = num(gv("s_nightWinter")) || 0;
  settings.nightSecondSummer = num(gv("s_nightSecondSummer")) || 0;
  settings.nightSecondWinter = num(gv("s_nightSecondWinter")) || 0;

  settings.earlyThreshold = str(gv("s_earlyThreshold"));
  settings.lateThreshold = str(gv("s_lateThreshold"));

  settings.earlyFeeSummer = num(gv("s_earlyFeeSummer")) || 0;
  settings.lateFeeSummer = num(gv("s_lateFeeSummer")) || 0;
  settings.earlyFeeWinter = num(gv("s_earlyFeeWinter")) || 0;
  settings.lateFeeWinter = num(gv("s_lateFeeWinter")) || 0;

  settings.trainingJuenghunde = num(gv("s_trainingJuenghunde")) || 0;
  settings.trainingWelpen = num(gv("s_trainingWelpen")) || 0;
  settings.trainingEinzel = num(gv("s_trainingEinzel")) || 0;
  settings.trainingKurse = num(gv("s_trainingKurse")) || 0;

  // UI-State mit speichern (falls man "Speichern" drückt, ohne zu togglen)
  captureAndPersistPanels();

  saveAll();
  toast("Einstellungen gespeichert.");
}

window.renderSettings = renderSettings;
window.saveSettings = saveSettings;
window.savePrices = saveSettings;