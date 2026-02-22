// /js/components/admin/customers/utils.js
"use strict";

import { settings } from "../../core/storage.js";

/** Alle Kartenkäufe (chronologisch) eines Kunden */
export function getPurchases(c) {
  return (c.tenHistory ?? [])
    .filter(h => h.type === "purchase")
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/** Gibt es eine aktuell nicht vollständig verbrauchte Karte? */
export function hasActiveCard(c) {
  return getPurchases(c).some(
    p => (p.used ?? 0) < (p.size ?? settings.tenSize ?? 10)
  );
}

/** Liefert die zuletzt noch freie Karte oder null */
export function getActiveCard(c) {
  const P = getPurchases(c);
  for (let i = P.length - 1; i >= 0; i--) {
    if ((P[i].used ?? 0) < (P[i].size ?? settings.tenSize ?? 10)) return P[i];
  }
  return null;
}