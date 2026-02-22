// /js/components/admin/customers/index.js
"use strict";

// Alle Teilmodule zusammenführen
export * from "./state.js";
export * from "./utils.js";
export * from "./list.js";
export * from "./dialog.js";
export * from "./signature.js";
export * from "./cards.js";
export * from "./openitems.js";
export * from "./revenue.js";

// --- window-Bindings für inline onclick (wichtig für dein HTML) ---
import {
  renderCustomerList, openNewCustomer, openCustomer, closeCustomerDlg,
  addDogRow, saveCustomer, deleteCustomer,
  buyTenCard, renderActiveCardBlock, renderTenHistoryDlg,
  renderCustomerOpenInvoices, renderCustomerRevenue,
  editTen, markPurchasePaid,
  markVisitPaid, editVisit, delVisit, markStayPaid, editStay,
  sigSetReadonlyUI, sigUpdatePreview, initSignaturePad, requireAgbForSignature
} from "./index.js"; // Import über Re-Exports

// Funktionen global verfügbar machen
window.renderCustomerList = renderCustomerList;
window.openNewCustomer = openNewCustomer;
window.openCustomer = openCustomer;
window.closeCustomerDlg = closeCustomerDlg;
window.addDogRow = addDogRow;
window.saveCustomer = saveCustomer;
window.deleteCustomer = deleteCustomer;

window.buyTenCard = buyTenCard;
window.renderActiveCardBlock = renderActiveCardBlock;
window.renderTenHistoryDlg = renderTenHistoryDlg;
window.renderCustomerOpenInvoices = renderCustomerOpenInvoices;
window.renderCustomerRevenue = renderCustomerRevenue;
window.editTen = editTen;
window.markPurchasePaid = markPurchasePaid;

window.markVisitPaid = markVisitPaid;
window.editVisit = editVisit;
window.delVisit = delVisit;
window.markStayPaid = markStayPaid;
window.editStay = editStay;

window.sigSetReadonlyUI = sigSetReadonlyUI;
window.sigUpdatePreview = sigUpdatePreview;
window.initSignaturePad = initSignaturePad;
window.requireAgbForSignature = requireAgbForSignature;

// Optional: Initial einmal rendern, wenn die Page schon sichtbar ist
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("custList") && window.renderCustomerList) {
    window.renderCustomerList();
  }
});
``