// /js/components/admin/admin-backup.js
// Backup-Modul – überarbeitete, robuste Version (2026-02-16)

import {
  saveAll,
  customers,
  visits,
  stays,
  customersTrash,
  visitsTrash,
  staysTrash,
  appMeta
} from "../../core/storage.js";
import { toast, todayStr } from "../../core/utils.js";

let backupDir = null;

/* -------------------------------------------------------------
 * Stats
 * ------------------------------------------------------------- */
export function renderStats() {
  const el = document.getElementById("bk_stats");
  if (!el) return;
  el.innerHTML = `
    <div class="muted">
      Kunden: <strong>${customers.length}</strong> ·
      Tagesbuchungen: <strong>${visits.length}</strong> ·
      Pension: <strong>${stays.length}</strong>
    </div>
  `;
}

/* -------------------------------------------------------------
 * Folder verbinden (optional)
 * ------------------------------------------------------------- */
export async function connectBackupFolder() {
  try {
    if (!window.showDirectoryPicker) {
      toast("Dein Browser unterstützt Ordnerzugriff nicht. Nutze den Dateiexport.");
      return;
    }
    backupDir = await window.showDirectoryPicker();
    toast("Backup‑Ordner verbunden.");
  } catch (e) {
    console.error(e);
    toast("Ordner konnte nicht geöffnet werden.");
  }
  renderFsSection();
}

export async function checkBackupFolder() {
  if (!backupDir) {
    toast("Kein Ordner verbunden.");
    return;
  }
  try {
    // einfache Abfrage: Name lesen
    // (weitere Berechtigungsprüfungen bei Bedarf ergänzen)
    // eslint-disable-next-line no-unused-expressions
    backupDir.name;
    toast("Ordner ist verfügbar.");
  } catch (e) {
    console.error(e);
    toast("Auf den Ordner kann nicht zugegriffen werden.");
  }
}

/* -------------------------------------------------------------
 * Backup jetzt – in verbundenen Ordner schreiben
 * ------------------------------------------------------------- */
export async function runFolderBackupNow() {
  if (!backupDir) {
    toast("Bitte zuerst einen Backup‑Ordner verbinden oder 'Export' nutzen.");
    return;
  }

  const data = getAllData();
  const fileName = `backup_${todayStr()}.json`;

  try {
    const handle = await backupDir.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();

    appMeta.lastExportAt = new Date().toISOString();
    appMeta.lastExportMode = "folder";
    saveAll();

    toast("Backup erfolgreich im Ordner gespeichert.");
  } catch (e) {
    console.error(e);
    toast("Fehler beim Schreiben in den Ordner.");
  }
}

/* -------------------------------------------------------------
 * Export als Download (JSON)
 * ------------------------------------------------------------- */
export function exportAll() {
  const data = getAllData();

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `hundepension_backup_${todayStr()}.json`;
  a.click();

  URL.revokeObjectURL(url);

  appMeta.lastExportAt = new Date().toISOString();
  appMeta.lastExportMode = "download";
  saveAll();
  toast("Backup heruntergeladen.");
}

/* -------------------------------------------------------------
 * Import aus Datei (JSON)
 * ------------------------------------------------------------- */
export function importAll() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "application/json,.json";

  inp.onchange = async () => {
    const file = inp.files?.[0];
    if (!file) return;

    try {
      const txt = await file.text();
      const data = JSON.parse(txt);
      if (!isValidBackup(data)) {
        toast("Ungültiges Backup-Format.");
        return;
      }
      doImport(data, "manual-file");
    } catch (e) {
      console.error(e);
      toast("Fehler beim Import.");
    }
  };

  inp.click();
}

/* -------------------------------------------------------------
 * Import aus verbundenem Ordner (neueste Datei)
 * ------------------------------------------------------------- */
export async function importFromEntry() {
  if (!backupDir) {
    toast("Kein Backup‑Ordner verbunden.");
    return;
  }

  try {
    const files = [];
    for await (const entry of backupDir.values()) {
      if (entry.kind === "file" && entry.name.toLowerCase().endsWith(".json")) {
        files.push(entry);
      }
    }

    if (files.length === 0) {
      toast("Keine JSON‑Backups im Ordner gefunden.");
      return;
    }

    files.sort((a, b) => (a.name > b.name ? -1 : 1));
    const file = await files[0].getFile();
    const txt = await file.text();
    const data = JSON.parse(txt);

    if (!isValidBackup(data)) {
      toast("Ungültiges Backup-Format in Ordnerdatei.");
      return;
    }

    doImport(data, "auto-folder");
  } catch (e) {
    console.error(e);
    toast("Import aus Ordner fehlgeschlagen.");
  }
}

/* -------------------------------------------------------------
 * Import durchführen
 * ------------------------------------------------------------- */
export function doImport(data, mode) {
  try {
    // Bestehende Inhalte leeren
    customers.length = 0;
    visits.length = 0;
    stays.length = 0;
    customersTrash.length = 0;
    visitsTrash.length = 0;
    staysTrash.length = 0;

    // Inhalte übernehmen
    (data.customers ?? []).forEach((x) => customers.push(x));
    (data.visits ?? []).forEach((x) => visits.push(x));
    (data.stays ?? []).forEach((x) => stays.push(x));
    (data.customersTrash ?? []).forEach((x) => customersTrash.push(x));
    (data.visitsTrash ?? []).forEach((x) => visitsTrash.push(x));
    (data.staysTrash ?? []).forEach((x) => staysTrash.push(x));

    appMeta.lastImportAt = new Date().toISOString();
    appMeta.lastImportMode = mode;

    saveAll();
    toast("Import erfolgreich.");
    renderStats();
  } catch (e) {
    console.error(e);
    toast("Import-Fehler.");
  }
}

/* -------------------------------------------------------------
 * UI-Helfer
 * ------------------------------------------------------------- */
export function renderFsSection() {
  const el = document.getElementById("bk_fs");
  if (!el) return;

  if (backupDir) {
    el.innerHTML = `
      <div class="muted">Ordner verbunden: <strong>${backupDir.name || "—"}</strong></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn" onclick="runFolderBackupNow()">Backup in Ordner</button>
        <button class="btn outline" onclick="importFromEntry()">Aus Ordner importieren</button>
        <button class="btn ghost" onclick="checkBackupFolder()">Ordner prüfen</button>
      </div>
    `;
  } else {
    el.innerHTML = `
      <div class="muted">Kein Ordner verbunden.</div>
      <button class="btn" onclick="connectBackupFolder()">Ordner verbinden</button>
    `;
  }
}

/* -------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------- */
function getAllData() {
  return {
    customers,
    visits,
    stays,
    customersTrash,
    visitsTrash,
    staysTrash,
    appMeta,
    exportedAt: new Date().toISOString(),
  };
}

function isValidBackup(d) {
  // sehr simple, bewusste Prüfung
  return d && "customers" in d && "visits" in d && "stays" in d;
}

/* -------------------------------------------------------------
 * Globale Exporte für onclick in HTML
 * ------------------------------------------------------------- */
window.renderStats = renderStats;
window.connectBackupFolder = connectBackupFolder;
window.checkBackupFolder = checkBackupFolder;
window.runFolderBackupNow = runFolderBackupNow;
window.exportAll = exportAll;
window.importAll = importAll;
window.importFromEntry = importFromEntry;
window.renderFsSection = renderFsSection;