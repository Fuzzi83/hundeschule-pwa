// /js/components/admin/customers/accordion.js
"use strict";

export function accKeyForCustomer(customerId) {
  return `cust_acc_state_${customerId}`;
}
export function loadAccState(customerId) {
  try {
    const raw = localStorage.getItem(accKeyForCustomer(customerId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function saveAccState(customerId, obj) {
  try {
    localStorage.setItem(accKeyForCustomer(customerId), JSON.stringify(obj || {}));
  } catch {}
}
export function defaultAccState() {
  return { kunde: "open", hunde: "open", karten: "open", rechnungen: "closed" };
}
export function applyAccSection(root, secKey, open) {
  const blk = root.querySelector(`.acc[data-sec="${secKey}"]`);
  if (!blk) return;
  const head = blk.querySelector(".acc-head");
  const body = blk.querySelector(".acc-body");
  if (open) {
    body.classList.remove("hidden");
    head.querySelector(".acc-arrow").textContent = "▾";
  } else {
    body.classList.add("hidden");
    head.querySelector(".acc-arrow").textContent = "▸";
  }
}