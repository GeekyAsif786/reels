import { test, expect } from "@playwright/test";

const PUBLIC_URL = "https://asifurrahaman.com/reels/";

// Fail any test that logs a console error, throws, or touches another origin.
test.beforeEach(async ({ page, baseURL }, testInfo) => {
  const origin = new URL(baseURL).origin;
  const problems = [];
  page.on("console", (msg) => msg.type() === "error" && problems.push(`console.error: ${msg.text()}`));
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  page.on("request", (req) => {
    const url = req.url();
    if (url.startsWith("data:")) return;
    if (new URL(url).origin !== origin) problems.push(`external request: ${url}`);
  });
  testInfo.problems = problems;
});

test.afterEach(async ({}, testInfo) => {
  expect(testInfo.problems, "console errors / external requests").toEqual([]);
});

const cards = (page) => page.locator("#reel-list > li:not([hidden]) article.reel");

test("bare root and /reels redirect to /reels/", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/reels\/$/);
  await page.goto("/reels");
  await expect(page).toHaveURL(/\/reels\/$/);
  await expect(page.locator(".badge")).toHaveCount(2);
});

test("/reels/ loads with profile, canonical and CSP", async ({ page }) => {
  const res = await page.goto("/reels/");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-security-policy"]).toContain("default-src 'self'");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", PUBLIC_URL);
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
    "content",
    /default-src 'self'/,
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Asifur Rahaman");
  const profile = page.locator("#profile-links a");
  await expect(profile).toHaveText(["GitHub", "X", "Blog"]); // LinkedIn TODO is hidden
  for (const href of await profile.evaluateAll((as) => as.map((a) => a.href))) {
    expect(href).toMatch(/^https:\/\//);
  }
});

test("cards render newest first with badge, date, tags and links", async ({ page }) => {
  await page.goto("/reels/");
  await expect(cards(page)).toHaveCount(2);
  await expect(page.locator(".badge")).toHaveText(["#02", "#01"]);
  await expect(page.locator("#status")).toHaveText("2 reels");

  const r2 = page.locator("article#\\30 2");
  await expect(r2.getByRole("heading", { level: 2 })).toContainText("Who's using port 3000?");
  await expect(r2.locator("time")).toHaveAttribute("datetime", "2026-11-14");
  await expect(r2.locator("time")).toHaveText("14 Nov 2026");
  await expect(r2.locator(".tag")).toHaveText(["dev tools", "rust", "open source"]);
  await expect(r2.locator(".copy-code")).toHaveText([
    "brew install GeekyAsif786/tap/whatsup",
    "npx whatsup-cli",
    "cargo install whatsup-cli",
  ]);
  await expect(r2.getByRole("link", { name: "GitHub repo" })).toHaveAttribute(
    "href",
    "https://github.com/GeekyAsif786/whatsup",
  );
  const allHrefs = await page.locator("main a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(allHrefs.length).toBeGreaterThan(0);
  for (const href of allHrefs) expect(href).toMatch(/^https:\/\//);
});

test("/reels/#02 scrolls to and highlights that card", async ({ page }) => {
  await page.goto("/reels/#02");
  const card = page.locator("article#\\30 2");
  await expect(card).toHaveClass(/is-highlighted/);
  await expect(card).toBeFocused();
  await expect(card).toBeInViewport();
  await expect(card).not.toHaveClass(/is-highlighted/, { timeout: 5000 });

  // Changing the hash on the same page works too, and clears filters hiding the target.
  await page.getByRole("button", { name: "rust" }).click();
  await page.evaluate(() => (location.hash = "#01"));
  const r1 = page.locator("article#\\30 1");
  await expect(r1).toBeVisible();
  await expect(r1).toHaveClass(/is-highlighted/);
});

test("search and tag filters narrow the list, with an empty state", async ({ page }) => {
  await page.goto("/reels/");
  const search = page.getByRole("searchbox", { name: "Search reels" });

  await search.fill("port");
  await expect(page.locator(".badge:visible")).toHaveText(["#02"]);
  await expect(page.locator("#status")).toHaveText("Showing 1 of 2 reels");

  await search.fill("#01");
  await expect(page.locator(".badge:visible")).toHaveText(["#01"]);

  await search.fill("zzz-no-such-reel");
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByText("No reels match that.")).toBeVisible();
  await page.getByRole("button", { name: "Clear search and filters" }).click();
  await expect(cards(page)).toHaveCount(2);
  await expect(search).toHaveValue("");

  const exams = page.getByRole("button", { name: "exams" });
  await exams.click();
  await expect(exams).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".badge:visible")).toHaveText(["#01"]);
  await search.fill("port"); // tag + search combine
  await expect(cards(page)).toHaveCount(0);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.locator(".badge:visible")).toHaveText(["#02"]);
});

test.describe("copy buttons", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("copies a command and the public reel link", async ({ page }) => {
    await page.goto("/reels/");
    const r2 = page.locator("article#\\30 2");

    const brew = r2.getByRole("button", { name: "Copy Homebrew command" });
    await brew.click();
    await expect(brew).toHaveText("Copied");
    await expect(page.locator("#announcer")).toContainText("Copied Homebrew command");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("brew install GeekyAsif786/tap/whatsup");
    await expect(brew).toHaveText("Copy", { timeout: 4000 });

    const share = r2.getByRole("button", { name: "Copy link to reel #02" });
    await share.click();
    await expect(share).toHaveText("Copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${PUBLIC_URL}#02`);
  });

  test("falls back to execCommand when the Clipboard API is unavailable", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "clipboard", { get: () => undefined, configurable: true });
      window.__copied = [];
      document.execCommand = (cmd) => {
        if (cmd !== "copy") return false;
        window.__copied.push(document.activeElement.value);
        return true;
      };
    });
    await page.goto("/reels/");
    const npx = page.getByRole("button", { name: "Copy npm command" });
    await npx.click();
    await expect(npx).toHaveText("Copied");
    await expect(npx).toBeFocused();
    expect(await page.evaluate(() => window.__copied)).toEqual(["npx whatsup-cli"]);
    await expect(page.locator("textarea")).toHaveCount(0);
  });
});

test("unsafe URLs in reels.json are never rendered as links", async ({ page }, testInfo) => {
  await page.route("**/reels/reels.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        profile: {
          name: "<img src=x onerror=alert(1)>",
          tagline: "t",
          links: [
            { label: "evil", url: "javascript:alert(1)" },
            { label: "ok", url: "https://example.com" },
          ],
        },
        reels: [
          {
            id: "03",
            title: "<b>bold</b>",
            date: "2026-11-15",
            tags: ["x"],
            summary: "s",
            links: [
              { label: "js", url: "javascript:alert(1)" },
              { label: "http", url: "http://example.com" },
              { label: "data", url: "data:text/html,hi" },
              { label: "good", url: "https://example.com/good" },
            ],
          },
        ],
      }),
    }),
  );
  await page.goto("/reels/");
  await expect(page.locator(".badge")).toHaveText(["#03"]);
  // Markup in data is shown as text, not parsed.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("<img src=x onerror=alert(1)>");
  await expect(page.locator("h1 img, h2 b")).toHaveCount(0);
  const hrefs = await page.locator("main a, header a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(hrefs.sort()).toEqual(["https://example.com", "https://example.com/good"]);
});

test("respects prefers-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/reels/#01");
  const card = page.locator("article#\\30 1");
  await expect(card).toHaveClass(/is-highlighted/);
  expect(await card.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});

test("layout has no horizontal scroll", async ({ page }) => {
  await page.goto("/reels/");
  await expect(cards(page)).toHaveCount(2);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
