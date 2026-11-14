// Shared validation for reels.json.
// Used by the browser (reels/app.js) and by CI (scripts/validate.mjs) so the
// rules can never drift apart. Pure functions, no DOM, no Node APIs.

export const ID_RE = /^\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True only for absolute https: URLs without embedded credentials. */
export function isSafeHttpsUrl(value) {
  if (typeof value !== "string" || value.trim() !== value || value === "") return false;
  let u;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  return u.protocol === "https:" && u.hostname !== "" && u.username === "" && u.password === "";
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const isNonEmptyString = (v) => typeof v === "string" && v.trim() !== "";
const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function checkKeys(obj, allowed, where, errors) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) errors.push(`${where}: unknown field "${key}"`);
  }
}

/**
 * A link is {label, url} or {label, copy}. A profile link may instead be
 * {label, todo} as a placeholder: it is skipped when rendering and reported
 * as a warning, not an error.
 */
function checkLink(link, where, errors, warnings, { allowTodo = false } = {}) {
  if (!isPlainObject(link)) {
    errors.push(`${where}: must be an object`);
    return;
  }
  checkKeys(link, allowTodo ? ["label", "url", "copy", "todo"] : ["label", "url", "copy"], where, errors);
  if (!isNonEmptyString(link.label)) errors.push(`${where}: "label" must be a non-empty string`);

  const kinds = ["url", "copy", "todo"].filter((k) => k in link);
  if (kinds.length !== 1) {
    errors.push(`${where}: needs exactly one of "url" or "copy"${allowTodo ? ' (or a "todo" placeholder)' : ""}`);
    return;
  }
  if ("url" in link && !isSafeHttpsUrl(link.url)) {
    errors.push(`${where}: "url" must be an absolute https:// URL (got ${JSON.stringify(link.url)})`);
  }
  if ("copy" in link && !isNonEmptyString(link.copy)) {
    errors.push(`${where}: "copy" must be a non-empty string`);
  }
  if ("todo" in link) warnings.push(`${where}: TODO placeholder "${link.label}" is not shown on the page yet`);
}

/** Returns {errors: string[], warnings: string[]}. Valid when errors is empty. */
export function validateData(data) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(data)) return { errors: ["root: must be a JSON object"], warnings };
  checkKeys(data, ["profile", "reels"], "root", errors);

  const p = data.profile;
  if (!isPlainObject(p)) {
    errors.push(`profile: must be an object`);
  } else {
    checkKeys(p, ["name", "tagline", "links"], "profile", errors);
    if (!isNonEmptyString(p.name)) errors.push(`profile.name: must be a non-empty string`);
    if (!isNonEmptyString(p.tagline)) errors.push(`profile.tagline: must be a non-empty string`);
    if (!Array.isArray(p.links)) errors.push(`profile.links: must be an array`);
    else p.links.forEach((l, i) => checkLink(l, `profile.links[${i}]`, errors, warnings, { allowTodo: true }));
  }

  if (!Array.isArray(data.reels)) {
    errors.push(`reels: must be an array`);
    return { errors, warnings };
  }

  const seen = new Set();
  data.reels.forEach((r, i) => {
    const where = `reels[${i}]`;
    if (!isPlainObject(r)) {
      errors.push(`${where}: must be an object`);
      return;
    }
    checkKeys(r, ["id", "title", "date", "tags", "summary", "links"], where, errors);
    if (typeof r.id !== "string" || !ID_RE.test(r.id)) {
      errors.push(`${where}.id: must be a 2-digit string like "07" (got ${JSON.stringify(r.id)})`);
    } else if (seen.has(r.id)) {
      errors.push(`${where}.id: duplicate id "${r.id}"`);
    } else {
      seen.add(r.id);
    }
    if (!isNonEmptyString(r.title)) errors.push(`${where}.title: must be a non-empty string`);
    if (!isIsoDate(r.date)) errors.push(`${where}.date: must be a real date as YYYY-MM-DD (got ${JSON.stringify(r.date)})`);
    if (!Array.isArray(r.tags) || !r.tags.every(isNonEmptyString)) {
      errors.push(`${where}.tags: must be an array of non-empty strings`);
    }
    if (!isNonEmptyString(r.summary)) errors.push(`${where}.summary: must be a non-empty string`);
    if (!Array.isArray(r.links)) errors.push(`${where}.links: must be an array`);
    else r.links.forEach((l, j) => checkLink(l, `${where}.links[${j}]`, errors, warnings));
  });

  return { errors, warnings };
}
