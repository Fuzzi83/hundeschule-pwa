// /js/core/hourpacks.js
// Zentrales Repository für Stundenpakete (im settings-Objekt gespeichert)
// Flags:
//   forTraining -> Checkbox "Hundetraining" (vorbereitet; aktuell nicht gefiltert in Day/Stay)
//   forPension  -> Checkbox "Hundepension" (gilt für Tages- und Pensionshunde)

import { settings, saveAll } from "./storage.js";
import { genId } from "./utils.js";

function now() { return new Date().toISOString(); }

function ensureInit() {
  if (!Array.isArray(settings.hourPacks)) settings.hourPacks = [];

  // Migration v1: alte Felder forDay/forStay auf neue Flags abbilden
  settings.hourPacks.forEach(p => {
    const hadOldDay  = typeof p.forDay  !== "undefined";
    const hadOldStay = typeof p.forStay !== "undefined";

    if (p.forTraining === undefined && p.forPension === undefined) {
      if (hadOldDay || hadOldStay) {
        // "Hundepension" deckt Tages- und Pensionshunde ab:
        p.forPension  = !!(p.forStay || p.forDay);
        // Training-Flag aus forDay ableiten (später nutzbar)
        p.forTraining = !!p.forDay;
      } else {
        // Keine Altinformationen -> Standard
        p.forTraining = false;
        p.forPension  = true;
      }
    } else {
      if (p.forTraining === undefined) p.forTraining = false;
      if (p.forPension  === undefined) p.forPension  = true;
    }

    // Aufräumen
    delete p.forDay;
    delete p.forStay;
  });
}

/**
 * Liste aller Pakete.
 * @param {{onlyActive?: boolean, scope?: 'day'|'stay'|'training'}} opt
 */
export function listPacks({ onlyActive = false, scope } = {}) {
  ensureInit();
  let arr = settings.hourPacks.slice();

  if (onlyActive) arr = arr.filter(p => p.aktiv !== false);

  // Regel:
  // - 'day'  -> nur Pakete mit forPension
  // - 'stay' -> nur Pakete mit forPension
  // - 'training' -> nur Pakete mit forTraining (derzeit nicht verwendet)
  if (scope === "day" || scope === "stay") {
    arr = arr.filter(p => !!p.forPension);
  } else if (scope === "training") {
    arr = arr.filter(p => !!p.forTraining);
  }

  return arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export function listPacksForDay({ onlyActive = true } = {}) {
  return listPacks({ onlyActive, scope: "day" });
}
export function listPacksForStay({ onlyActive = true } = {}) {
  return listPacks({ onlyActive, scope: "stay" });
}
export function listPacksForTraining({ onlyActive = true } = {}) {
  return listPacks({ onlyActive, scope: "training" });
}

export function getPackById(id) {
  ensureInit();
  return settings.hourPacks.find(p => p.id === id) || null;
}

export function createPack({
  name, felder, preis,
  aktiv = true,
  forTraining = false,
  forPension = true, // Standard: Pension an
}) {
  ensureInit();

  // Falls beides aus -> Sicherung: Pension aktivieren
  if (!forTraining && !forPension) forPension = true;

  const p = {
    id: genId(),
    name: String(name || "").trim(),
    felder: Math.max(1, parseInt(felder, 10) || 1),
    preis: Number(preis || 0),
    aktiv: !!aktiv,
    forTraining: !!forTraining,
    forPension:  !!forPension,
    createdAt: now(),
    updatedAt: now(),
  };
  settings.hourPacks.push(p);
  saveAll();
  return p;
}

export function updatePack(id, patch) {
  ensureInit();
  const p = getPackById(id);
  if (!p) return null;

  if (patch.name !== undefined)   p.name = String(patch.name).trim();
  if (patch.felder !== undefined) p.felder = Math.max(1, parseInt(patch.felder, 10) || 1);
  if (patch.preis !== undefined)  p.preis = Number(patch.preis || 0);
  if (patch.aktiv !== undefined)  p.aktiv = !!patch.aktiv;
  if (patch.forTraining !== undefined) p.forTraining = !!patch.forTraining;
  if (patch.forPension  !== undefined) p.forPension  = !!patch.forPension;

  if (!p.forTraining && !p.forPension) p.forPension = true;

  p.updatedAt = now();
  saveAll();
  return p;
}

export function deletePack(id) {
  ensureInit();
  const i = settings.hourPacks.findIndex(p => p.id === id);
  if (i >= 0) {
    settings.hourPacks.splice(i, 1);
    saveAll();
    return true;
  }
  return false;
}