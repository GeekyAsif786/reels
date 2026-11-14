import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isSafeHttpsUrl, isIsoDate, validateData } from "../../public/reels/schema.js";

const base = () => ({
  profile: { name: "A", tagline: "B", links: [{ label: "GitHub", url: "https://github.com/x" }] },
  reels: [{ id: "01", title: "T", date: "2026-11-13", tags: ["x"], summary: "S", links: [{ label: "L", url: "https://a.b" }] }],
});

test("the real reels.json is valid", async () => {
  const data = JSON.parse(await readFile(new URL("../../public/reels/reels.json", import.meta.url), "utf8"));
  assert.deepEqual(validateData(data).errors, []);
});

test("only https URLs are allowed", () => {
  assert.ok(isSafeHttpsUrl("https://example.com/path?q=1"));
  for (const bad of [
    "http://example.com",
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox",
    "//example.com",
    "/reels/",
    "https://user:pass@example.com",
    "ftp://example.com",
    "",
    null,
    42,
  ]) {
    assert.equal(isSafeHttpsUrl(bad), false, `should reject ${JSON.stringify(bad)}`);
  }
});

test("non-https link URLs are errors", () => {
  for (const url of ["javascript:alert(1)", "http://example.com", "data:text/html,x"]) {
    const d = base();
    d.reels[0].links[0].url = url;
    assert.match(validateData(d).errors.join("\n"), /https/);
    const p = base();
    p.profile.links[0].url = url;
    assert.match(validateData(p).errors.join("\n"), /https/);
  }
});

test("ids must be unique 2-digit strings", () => {
  const d = base();
  d.reels.push({ ...d.reels[0] });
  assert.match(validateData(d).errors.join("\n"), /duplicate id "01"/);
  for (const id of ["1", "001", 1, "ab", "1a"]) {
    const e = base();
    e.reels[0].id = id;
    assert.match(validateData(e).errors.join("\n"), /2-digit/, `id ${JSON.stringify(id)}`);
  }
});

test("dates must be real ISO dates", () => {
  assert.ok(isIsoDate("2026-11-14"));
  assert.ok(isIsoDate("2028-02-29"));
  for (const bad of ["2026-13-01", "2026-02-30", "14-11-2026", "2026/11/14", "2026-11-14T00:00:00Z", ""]) {
    assert.equal(isIsoDate(bad), false, bad);
  }
});

test("links need exactly one of url/copy; todo only on profile links", () => {
  const d = base();
  d.reels[0].links = [{ label: "both", url: "https://a.b", copy: "x" }, { label: "none" }, { label: "t", todo: "x" }];
  const { errors } = validateData(d);
  assert.equal(errors.filter((e) => /exactly one/.test(e)).length, 2);
  assert.match(errors.join("\n"), /unknown field "todo"/);

  const p = base();
  p.profile.links.push({ label: "LinkedIn", todo: "fill me" });
  const res = validateData(p);
  assert.deepEqual(res.errors, []);
  assert.equal(res.warnings.length, 1);
});

test("unknown fields and missing required fields are reported", () => {
  const d = base();
  d.reels[0].titel = "typo";
  delete d.reels[0].summary;
  const errs = validateData(d).errors.join("\n");
  assert.match(errs, /unknown field "titel"/);
  assert.match(errs, /summary/);
});
