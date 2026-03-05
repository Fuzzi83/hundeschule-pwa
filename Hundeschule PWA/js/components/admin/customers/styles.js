// /js/components/admin/customers/styles.js
"use strict";

export function insertStylesOnce() {
  if (document.getElementById("adminCustomersStylesFixed")) return;

  const css = `
  :root{
    --bg:#fff; --muted:#666; --border:#dfdfdf; --head:#f4efe3; --soft:#faf7f0;
    --accent:#2b2b2b; --err:#b3261e; --warn:#ef6c00; --ok:#0a7f2e; --blue:#1565c0;
  }

  /* ===== Overlay + Modal ===== */
  #dlg_customer{
    position:fixed;
    inset:0;
    display:none;
    z-index:9999;
    overflow:hidden;
    padding:28px 20px;
    box-sizing:border-box;
    align-items:flex-start;
    justify-content:center;
    gap:0;
  }
  #dlg_customer.show{ display:flex; }

  #dlg_customer .backdrop{
    position:absolute;
    inset:0;
    background:rgba(0,0,0,.35);
    z-index:0;
  }

  #dlg_customer .dlg{
    position:relative;
    z-index:1;
    width:min(980px, calc(100vw - 40px));
    max-height:calc(100vh - 56px);
    background:var(--bg);
    border-radius:14px;
    box-shadow:0 20px 60px rgba(0,0,0,.25);
    padding:18px 20px 22px;
    overflow-y:auto;
    overflow-x:hidden;
    -webkit-overflow-scrolling:touch;
  }

  #dlg_customer h3{
    margin:0 0 12px;
    font-size:22px;
    font-weight:800;
  }

  /* ===== Accordion ===== */
  .acc{
    border:1px solid var(--border);
    border-radius:12px;
    background:#fff;
    margin:12px 0;
    overflow:visible;
  }
  .acc-head{
    display:flex;
    justify-content:space-between;
    align-items:center;
    cursor:pointer;
    user-select:none;
    padding:12px 14px;
    background:var(--head);
    border-bottom:1px solid var(--border);
    border-radius:12px;
  }
  .acc-title{ font-weight:800; color:#222; }
  .acc-sub{ color:#1f4d96; font-weight:600; margin-left:8px; }
  .acc-arrow{ color:#777; }
  .acc-body{ padding:14px; overflow:visible; }
  .acc-body.hidden{ display:none; }

  /* ✅ Damit "Neue Karte" und "Archiv" immer exakt gleich Abstand haben */
  .cards-stack{ display:grid; gap:10px; }

  /* ===== Responsive Grid-Forms ===== */
  .fg2, .fg3, .fg4{ display:grid; gap:10px 12px; }
  .fg2{ grid-template-columns: 1fr; }
  .fg3{ grid-template-columns: 1fr; }
  .fg4{ grid-template-columns: 1fr; }

  @media (min-width: 900px){
    .fg2{ grid-template-columns: 1fr 1fr; }
    .fg3{ grid-template-columns: 1fr 1fr 1fr; }
    .fg4{ grid-template-columns: 1fr 1fr 1fr 1fr; }
  }

  .fg2 label, .fg3 label, .fg4 label{
    display:flex;
    flex-direction:column;
    gap:6px;
    min-width:0;
  }

  .fg2 input, .fg2 select, .fg2 textarea,
  .fg3 input, .fg3 select, .fg3 textarea,
  .fg4 input, .fg4 select, .fg4 textarea{
    width:100%;
    min-width:0;
    box-sizing:border-box;
    padding:10px 12px;
    border:1px solid var(--border);
    border-radius:8px;
    background:#fff;
  }

  .muted{ color:var(--muted); }

  .btn{
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding:8px 12px;
    border:1px solid var(--border);
    border-radius:8px;
    background:#fff;
    cursor:pointer;
  }
  .btn.primary{ background:#2b2b2b; color:#fff; border-color:#2b2b2b; }
  .btn.danger{ background:#fff0f0; color:#a30000; border-color:#ffc3c3; }

  /* ===== Kundenliste ===== */
  .cust-row{ cursor:pointer; border:1px solid var(--border); border-radius:12px; padding:12px; background:#fff; }
  .cust-row:hover{ background:#faf9f7; }
  .cust-top{ display:flex; justify-content:space-between; align-items:center; gap:8px; }
  .cust-name{ font-weight:800; }
  .chip{ display:inline-block; padding:3px 8px; border-radius:999px; font-size:12px; line-height:1; border:1px solid transparent; }
  .chip-red{ background:#ffe9e7; color:#b50000; border-color:#ffc9c3; }
  .chip-blue{ background:#e6f0ff; color:#0d47a1; border-color:#c8ddff; }
  .chip-yellow{ background:#fff4d6; color:#8a6d00; border-color:#ffe3a1; }

  /* ===== Kartenpanel (Stempel) ===== */
  .card-panel{ background:#fff; border:1px solid var(--border); border-radius:10px; padding:12px; }
  .stamp-row{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin:8px 0; }

  .stamp-wrap{
    position:relative;
    display:inline-flex;
    align-items:center;
    justify-content:center;
  }

  .stamp{
    width:34px; height:34px; border-radius:50%; font-weight:700;
    display:flex; align-items:center; justify-content:center;
    border:2px solid #cfcfcf; color:#666; background:#fff; cursor:pointer; user-select:none;
    transition: transform .12s ease;
  }
  .stamp:hover{ transform:scale(1.12); }
  .stamp.used{ background:#ff9f3d; border-color:#ff9f3d; color:#fff; }

  /* ✅ Halb-Stempel: links halb gefüllt */
  .stamp.half{
    border-color:#ff9f3d;
    background:linear-gradient(90deg, #ff9f3d 50%, #ffffff 50%);
    color:#333;
  }

  /* ✅ ½ Button */
  .half-btn{
    position:absolute;
    right:-7px;
    bottom:-7px;
    width:18px;
    height:18px;
    border-radius:999px;
    border:1px solid #d9d9d9;
    background:#fff;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:11px;
    font-weight:900;
    line-height:1;
    cursor:pointer;
    user-select:none;
    box-shadow:0 2px 6px rgba(0,0,0,.08);
  }
  .half-btn:hover{ transform:scale(1.06); }

  .stamp-info{ margin-top:6px; color:#555; }

  /* ===== Tabellen ===== */
  table.clean{ width:100%; border-collapse:collapse; }
  table.clean th, table.clean td{ padding:8px 10px; border-bottom:1px solid #eee; text-align:left; }
  tr.open-row{ background:#fff7e9; }

  /* ===== Signature ===== */
  .sig-wrap{
    display:flex;
    align-items:flex-end;
    gap:10px;
    flex-wrap:wrap;
  }
  .sig-cv{
    border:1px dashed #bbb;
    border-radius:8px;
    background:#fff;
    width:100%;
    height:160px;
    touch-action:none;
    flex: 1 1 520px;
    min-width:260px;
  }
  #btn_sig_clear{
    flex: 0 0 auto;
    white-space:nowrap;
  }

  @media (max-width: 520px){
    #btn_sig_clear{
      width:100%;
      justify-content:center;
    }
  }
  `;

  const style = document.createElement("style");
  style.id = "adminCustomersStylesFixed";
  style.textContent = css;
  document.head.appendChild(style);
}