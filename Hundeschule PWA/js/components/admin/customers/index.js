// /js/components/admin/customers/index.js
"use strict";

import { renderCustomerList } from "./list.js";
import {
  openCustomer,
  openNewCustomer,
  closeCustomerDlg,
  saveCustomer,
  deleteCustomer,
} from "./dialog.js";
import { buyHourPack } from "./cards.js";
import { addDogRow } from "./dogs.js";
import { initSignaturePad, requireAgbForSignature } from "./signature.js";
import { renderCheckoutStamps } from "./cards.js";

// Window-Exports wie vorher
window.renderCustomerList = renderCustomerList;

window.openCustomer = openCustomer;
window.openNewCustomer = openNewCustomer;
window.closeCustomerDlg = closeCustomerDlg;
window.saveCustomer = saveCustomer;
window.deleteCustomer = deleteCustomer;

window.addDogRow = addDogRow;
window.initSignaturePad = initSignaturePad;
window.requireAgbForSignature = requireAgbForSignature;

window.buyHourPack = buyHourPack;
window.renderCheckoutStamps = renderCheckoutStamps;