// /js/core/storage.js
// Zentrale Persistenz (localStorage) für Hundepension PWA
// Exportiert: settings, customers, visits, stays, *_Trash, appMeta, saveAll, getCustomerById

const LS_KEY = "hp_store_v1";

// ---------- Default-Werte ----------
const DEFAULT_SETTINGS = {
  // Tagesbetreuung
  dayHourly: 0,
  dayHourlySecond: 0,
  dayDaily: 0,
  dayDailySecond: 0,

  // Saison
  summerStart: "05-01",
  winterStart: "10-01",

  // 10er-Karte
  tenSize: 10,
  tenPrice: 0,

  // Pension/Nacht
  nightSummer: 0,
  nightWinter: 0,
  nightSecondSummer: 0,
  nightSecondWinter: 0,

  // Zeitfenster / Zuschläge
  earlyThreshold: "07:00",
  lateThreshold: "18:00",
  stdNoon: "12:00",

  earlyFeeSummer: 0,
  lateFeeSummer: 0,
  earlyFeeWinter: 0,
  lateFeeWinter: 0
};

const DEFAULT_APP_META = {
  version: "3.6",
  lastExportAt: null,
  lastExportMode: null,   // "download" | "folder"
  lastImportAt: null,
  lastImportMode: null    // "manual-file" | "auto-folder"
};

// ---------- In-Memory-Objekte (werden exportiert) ----------
export const settings = {};
export const customers = [];
export const visits = [];
export const stays = [];
export const customersTrash = [];
export const visitsTrash = [];
export const staysTrash = [];
export const appMeta = {}; // <— wichtig für admin-backup.js

// ---------- Laden aus localStorage ----------
(function loadAll() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      // Defaults setzen
      Object.assign(settings, DEFAULT_SETTINGS);
      Object.assign(appMeta, DEFAULT_APP_META);
      return;
    }

    const data = JSON.parse(raw);

    Object.assign(settings, { ...DEFAULT_SETTINGS, ...(data.settings || {}) });

    (data.customers || []).forEach(x => customers.push(x));
    (data.visits || []).forEach(x => visits.push(x));
    (data.stays || []).forEach(x => stays.push(x));

    (data.customersTrash || []).forEach(x => customersTrash.push(x));
    (data.visitsTrash || []).forEach(x => visitsTrash.push(x));
    (data.staysTrash || []).forEach(x => staysTrash.push(x));

    Object.assign(appMeta, { ...DEFAULT_APP_META, ...(data.appMeta || {}) });
  } catch (e) {
    console.error("[storage] loadAll() Fehler, setze Defaults", e);
    Object.assign(settings, DEFAULT_SETTINGS);
    Object.assign(appMeta, DEFAULT_APP_META);
  }
})();

// ---------- Speichern in localStorage ----------
export function saveAll() {
  try {
    const data = {
      settings,
      customers,
      visits,
      stays,
      customersTrash,
      visitsTrash,
      staysTrash,
      appMeta
    };
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("[storage] saveAll() Fehler", e);
  }
}

// ---------- Helper ----------
export function getCustomerById(id) {
  return customers.find(c => c.id === id);
}