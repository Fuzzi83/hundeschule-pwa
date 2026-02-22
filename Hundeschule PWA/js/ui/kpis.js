// /js/ui/kpis.js
import { customers, appMeta } from '../core/storage.js';
import { esc } from '../core/utils.js';

export function renderKPIs(){
  const kpi=document.getElementById('cust_kpi'); if(kpi) kpi.textContent=`Kunden: ${customers.length}`;
  const bk=document.getElementById('backup_kpi');
  if(bk){
    const imp=appMeta.lastImportAt? new Date(appMeta.lastImportAt).toLocaleString(): '—';
    const exp=appMeta.lastExportAt? new Date(appMeta.lastExportAt).toLocaleString(): '—';
    bk.textContent=`Letzter Import: ${esc(imp)}${appMeta.lastImportMode?(' ('+esc(appMeta.lastImportMode)+')'):''} · Letzter Export: ${esc(exp)}`;
  }
}
``