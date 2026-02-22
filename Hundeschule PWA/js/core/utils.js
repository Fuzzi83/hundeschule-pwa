// /js/core/utils.js
"use strict";

export function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2200);
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function nowTime() {
  return new Date().toTimeString().slice(0, 5);
}

export function genId() {
  return "id" + Math.random().toString(36).slice(2, 10);
}

export function setv(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v;
}

export function gv(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

export function combineDateTime(dateStr, timeStr) {
  return new Date(
    (dateStr || todayStr()) + "T" + (timeStr || "00:00") + ":00"
  );
}

export function esc(s) {
  s = s ?? "";
  return s
    .toString()
    .replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
}

export function ddmmToDate(baseYear, ddmm) {
  const [dd, mm] = (ddmm || "").split("-").map((x) => parseInt(x, 10));
  return new Date(baseYear, (mm || 1) - 1, dd || 1);
}

export function isSummer(date) {
  const y = date.getFullYear();
  const s = ddmmToDate(y, window.settings?.summerStart || "01-06");
  const w = ddmmToDate(y, window.settings?.winterStart || "01-10");
  if (s <= w) return date >= s && date < w;
  return !(date >= w && date < s);
}

export function parseHHMM(s) {
  const [h, m] = (s || "00:00").split(":").map((x) => parseInt(x, 10));
  return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
}