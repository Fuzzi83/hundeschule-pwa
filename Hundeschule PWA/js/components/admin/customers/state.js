// /js/components/admin/customers/state.js
"use strict";

/** Welcher Kunde wird gerade bearbeitet? (null = Neuanlage) */
export let editCustomerId = null;

export function setEditCustomerId(id) {
  editCustomerId = id;
}

export function getEditCustomerId() {
  return editCustomerId;
}
``