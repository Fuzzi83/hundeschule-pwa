// /js/core/navigation.js
// Stable + Training alias

const SECTION_PREFIX = "page_";
const HIDDEN_CLASS = "hidden";

const ALIASES = Object.freeze({
  "": "home",
  home: "home",
  start: "home",

  admin: "admin_home",
  admin_home: "admin_home",
  admincustomers: "admin_customers",
  customers: "admin_customers",

  report: "reports",
  reporting: "reports",

  tageshunde: "day",
  pens: "stay",

  // ✅ neu:
  training: "training",
  hundetraining: "training",
});

function normalize(name) {
  const key = String(name || "").trim().toLowerCase();
  return ALIASES[key] || key;
}

function discoverSections() {
  const sections = {};
  document.querySelectorAll(`.page[id^="${SECTION_PREFIX}"]`).forEach((el) => {
    const name = el.id.substring(SECTION_PREFIX.length).trim().toLowerCase();
    sections[name] = el;
  });
  return sections;
}

function hideAll(sections) {
  Object.values(sections).forEach((el) => el.classList.add(HIDDEN_CLASS));
}

function showSection(sections, state, name) {
  const norm = normalize(name);
  const el = sections[norm];

  if (!el) {
    console.warn("[nav] Unbekannte Section:", name);
    return false;
  }

  if (state.current === norm) return true;

  hideAll(sections);
  el.classList.remove(HIDDEN_CLASS);
  state.current = norm;

  return true;
}

export function makeGo() {
  const state = {
    sections: null,
    current: null,
    suppressHash: false,
  };

  function ensureInit() {
    if (!state.sections) state.sections = discoverSections();
  }

  function go(target, { push = true } = {}) {
    ensureInit();

    const norm = normalize(target);
    const ok = showSection(state.sections, state, norm);

    if (!ok) {
      if (norm !== "home") return go("home");
      return false;
    }

    if (push) {
      state.suppressHash = true;
      location.hash = "#" + norm;
      setTimeout(() => (state.suppressHash = false), 0);
    }

    return true;
  }

  go._state = state;
  return go;
}

export function initNavigation(go) {
  if (typeof go !== "function") {
    throw new Error("initNavigation erwartet eine go()-Funktion.");
  }

  const st = go._state;
  st.sections = discoverSections();

  function onHash() {
    if (st.suppressHash) return;

    const target = normalize(location.hash.replace(/^#/, "") || "home");
    if (!st.sections[target]) {
      console.warn("[nav] Hash-Ziel unbekannt:", target);
      return go("home", { push: true });
    }
    showSection(st.sections, st, target);
  }

  window.addEventListener("hashchange", onHash);

  const initial = normalize(location.hash.replace(/^#/, "") || "home");
  if (!st.sections[initial]) {
    go("home", { push: true });
  } else {
    showSection(st.sections, st, initial);
    st.suppressHash = true;
    location.hash = "#" + initial;
    setTimeout(() => (st.suppressHash = false), 0);
  }

  window.go = go;
  window.showSection = go;

  bindTiles(go);
  console.info("[nav] Navigation bereit.");
}

export function bindTiles(go) {
  document.querySelectorAll("[data-target]").forEach((el) => {
    const target = el.getAttribute("data-target");
    el.addEventListener("click", (e) => {
      e.preventDefault();
      go(target);
    });
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
  });
}