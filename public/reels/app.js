// reels — renders /reels/reels.json. No framework, no dependencies.
// Safety: every value from JSON goes through textContent / setAttribute,
// never innerHTML, and only https: URLs ever become links.

import { isSafeHttpsUrl, ID_RE, validateData } from "/reels/schema.js";

// Links are shared on the custom domain, never the netlify.app origin.
const PUBLIC_URL = "https://asifurrahaman.com/reels/";
const DATA_URL = "/reels/reels.json";
const HIGHLIGHT_MS = 2400;
const COPIED_MS = 1800;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const $ = (id) => document.getElementById(id);
const els = {
  name: $("profile-name"),
  tagline: $("profile-tagline"),
  profileLinks: $("profile-links"),
  search: $("search"),
  chips: $("tag-chips"),
  status: $("status"),
  list: $("reel-list"),
  empty: $("empty"),
  clear: $("clear-filters"),
  announcer: $("announcer"),
};

const state = { reels: [], query: "", tag: null };
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/* ---------- small DOM helper (text only, never HTML) ---------- */

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const str = (v) => (typeof v === "string" ? v.trim() : "");

function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/* ---------- data normalisation: drop anything unsafe or malformed ---------- */

function normaliseLink(link) {
  if (!link || typeof link !== "object") return null;
  const label = str(link.label);
  if (!label) return null;
  if (typeof link.url === "string") return isSafeHttpsUrl(link.url) ? { label, url: link.url } : null;
  if (str(link.copy)) return { label, copy: str(link.copy) };
  return null; // includes {label, todo} placeholders
}

function normalise(data) {
  const profile = data && typeof data.profile === "object" && data.profile ? data.profile : {};
  const reels = (Array.isArray(data && data.reels) ? data.reels : [])
    .filter((r) => r && typeof r === "object" && ID_RE.test(r.id) && str(r.title))
    .map((r) => ({
      id: r.id,
      title: str(r.title),
      date: /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : "",
      tags: Array.isArray(r.tags) ? r.tags.map(str).filter(Boolean) : [],
      summary: str(r.summary),
      links: (Array.isArray(r.links) ? r.links : []).map(normaliseLink).filter(Boolean),
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return {
    profile: {
      name: str(profile.name),
      tagline: str(profile.tagline),
      links: (Array.isArray(profile.links) ? profile.links : []).map(normaliseLink).filter((l) => l && l.url),
    },
    reels,
  };
}

/* ---------- clipboard ---------- */

function legacyCopy(text) {
  const active = document.activeElement;
  const ta = h("textarea", { class: "offscreen", readonly: true, "aria-hidden": "true", tabindex: "-1" });
  ta.value = text;
  document.body.append(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  if (active && typeof active.focus === "function") active.focus({ preventScroll: true });
  return ok;
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to the legacy path */
    }
  }
  return legacyCopy(text);
}

function announce(msg) {
  els.announcer.textContent = "";
  // Re-set on the next frame so repeated identical messages are still read out.
  requestAnimationFrame(() => (els.announcer.textContent = msg));
}

function wireCopyButton(button, text, idleLabel, announceWhat) {
  const labelEl = button.querySelector(".btn-label");
  let timer;
  button.addEventListener("click", async () => {
    const ok = await copyText(text);
    clearTimeout(timer);
    button.dataset.state = ok ? "copied" : "failed";
    labelEl.textContent = ok ? "Copied" : "Copy failed";
    announce(ok ? `Copied ${announceWhat}` : `Could not copy ${announceWhat}. Select it and copy manually.`);
    timer = setTimeout(() => {
      delete button.dataset.state;
      labelEl.textContent = idleLabel;
    }, COPIED_MS);
  });
}

/* ---------- icons (static markup, no user data) ---------- */

const SVG_NS = "http://www.w3.org/2000/svg";
const ICONS = {
  link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  arrow: "M7 17 17 7M8 7h9v9",
};

function icon(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", "icon");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", ICONS[name]);
  svg.append(path);
  return svg;
}

/* ---------- rendering ---------- */

function renderProfile(profile) {
  if (profile.name) {
    els.name.textContent = profile.name;
    document.title = `Reels · ${profile.name}`;
  }
  if (profile.tagline) els.tagline.textContent = profile.tagline;
  els.profileLinks.replaceChildren(
    ...profile.links.map((l) =>
      h("li", {}, h("a", { class: "pill-link", href: l.url, rel: "me noopener" }, l.label, icon("arrow"))),
    ),
  );
}

function renderLink(link, reel) {
  if (link.url) {
    return h(
      "li",
      { class: "link-item" },
      h("a", { class: "link-btn", href: link.url, rel: "noopener" }, h("span", {}, link.label), icon("arrow")),
    );
  }
  const btn = h(
    "button",
    { type: "button", class: "copy-btn", "aria-label": `Copy ${link.label} command` },
    icon("copy"),
    h("span", { class: "btn-label" }, "Copy"),
  );
  wireCopyButton(btn, link.copy, "Copy", `${link.label} command for reel #${reel.id}`);
  return h(
    "li",
    { class: "copy-item" },
    h("span", { class: "copy-label" }, link.label),
    h("div", { class: "copy-row" }, h("code", { class: "copy-code" }, link.copy), btn),
  );
}

function renderReel(reel) {
  const titleId = `reel-${reel.id}-title`;
  const share = h(
    "button",
    { type: "button", class: "share-btn", "aria-label": `Copy link to reel #${reel.id}` },
    icon("link"),
    h("span", { class: "btn-label" }, "Copy link"),
  );
  wireCopyButton(share, `${PUBLIC_URL}#${reel.id}`, "Copy link", `link to reel #${reel.id}`);

  const article = h(
    "article",
    { class: "reel", id: reel.id, tabindex: "-1", "aria-labelledby": titleId },
    h(
      "div",
      { class: "reel-head" },
      h("span", { class: "badge", "aria-hidden": "true" }, h("span", { class: "badge-hash" }, "#"), reel.id),
      h(
        "div",
        { class: "reel-heading" },
        h("h2", { id: titleId, class: "reel-title" }, h("span", { class: "visually-hidden" }, `Reel ${reel.id}: `), reel.title),
        reel.date && h("p", { class: "reel-date" }, h("time", { datetime: reel.date }, formatDate(reel.date))),
      ),
    ),
    reel.tags.length > 0 &&
      h("ul", { class: "tags", "aria-label": "Tags" }, reel.tags.map((t) => h("li", { class: "tag" }, t))),
    reel.summary && h("p", { class: "summary" }, reel.summary),
    reel.links.length > 0 && h("ul", { class: "links" }, reel.links.map((l) => renderLink(l, reel))),
    h("div", { class: "reel-foot" }, share),
  );
  return h("li", { class: "reel-item", "data-id": reel.id }, article);
}

function haystack(reel) {
  return [`#${reel.id}`, reel.title, reel.summary, ...reel.tags, ...reel.links.map((l) => l.label)]
    .join(" \n ")
    .toLowerCase();
}

function renderChips() {
  const counts = new Map();
  for (const r of state.reels) for (const t of r.tags) counts.set(t, (counts.get(t) || 0) + 1);
  const tags = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
  const chip = (label, value) => {
    const b = h("button", { type: "button", class: "chip", "aria-pressed": String(state.tag === value) }, label);
    b._value = value;
    b.addEventListener("click", () => {
      state.tag = state.tag === value ? null : value;
      applyFilters();
    });
    return b;
  };
  els.chips.replaceChildren(chip("All", null), ...tags.map((t) => chip(t, t)));
}

function applyFilters() {
  const q = state.query.trim().toLowerCase().replace(/^#/, "");
  let shown = 0;
  for (const item of els.list.children) {
    const reel = state.reels.find((r) => r.id === item.dataset.id);
    const match = (!state.tag || reel.tags.includes(state.tag)) && (!q || reel._text.includes(q));
    item.hidden = !match;
    if (match) shown++;
  }
  for (const b of els.chips.children) b.setAttribute("aria-pressed", String(b._value === state.tag));
  const total = state.reels.length;
  const noun = total === 1 ? "reel" : "reels";
  els.status.textContent = shown === total ? `${total} ${noun}` : `Showing ${shown} of ${total} ${noun}`;
  els.empty.hidden = shown !== 0;
}

function clearFilters() {
  state.query = "";
  state.tag = null;
  els.search.value = "";
  applyFilters();
}

/* ---------- deep links: /reels/#02 ---------- */

function focusReelFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!ID_RE.test(id)) return;
  const article = document.getElementById(id);
  if (!article || !article.classList.contains("reel")) return;
  if (article.parentElement.hidden) clearFilters();

  article.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
  article.focus({ preventScroll: true });
  article.classList.remove("is-highlighted");
  void article.offsetWidth; // restart the highlight animation on repeat visits
  article.classList.add("is-highlighted");
  clearTimeout(article._hl);
  article._hl = setTimeout(() => article.classList.remove("is-highlighted"), HIGHLIGHT_MS);
}

/* ---------- boot ---------- */

async function main() {
  let raw;
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.json();
  } catch (err) {
    els.status.textContent = "Couldn't load the reels. Please refresh to try again.";
    els.status.classList.add("is-error");
    console.error("reels: failed to load data", err);
    return;
  }

  const { errors } = validateData(raw);
  if (errors.length) console.warn("reels: reels.json has problems; invalid entries were skipped:\n" + errors.join("\n"));

  const data = normalise(raw);
  state.reels = data.reels.map((r) => Object.assign(r, { _text: haystack(r) }));

  renderProfile(data.profile);
  renderChips();
  els.list.replaceChildren(...state.reels.map(renderReel));
  applyFilters();
  document.documentElement.classList.add("is-ready");

  els.search.addEventListener("input", () => {
    state.query = els.search.value;
    applyFilters();
  });
  els.clear.addEventListener("click", () => {
    clearFilters();
    els.search.focus();
  });
  window.addEventListener("hashchange", focusReelFromHash);
  focusReelFromHash();
}

main();
