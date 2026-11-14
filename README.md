# reels

Resources page for my Instagram reels, live at **https://asifurrahaman.com/reels/**.
Each reel's caption says "link at asifurrahaman.com/reels, #02" and viewers land on that card.

Plain HTML/CSS/JS, no framework, no build step, no runtime dependencies, no analytics.
The page makes no requests to any other origin (fonts are self-hosted, and the CSP enforces it).

```
public/          ← Netlify publishes only this folder
  reels/
    index.html     page shell
    app.js         renders reels.json (textContent only, https-only links)
    schema.js      validation rules shared by the page and CI
    styles.css
    reels.json     ← the only file you edit to add a reel
    404.html
    fonts/         Poppins + JetBrains Mono (woff2, latin) and their OFL licenses
scripts/
  validate.mjs   checks reels.json (CI runs it)
  serve.mjs      local static server with the same headers as netlify.toml
tests/           node:test unit tests + Playwright smoke tests
netlify.toml     publish "public", security headers, redirects
```

## Adding a reel

1. Open `public/reels/reels.json` and add an object to `reels` (the order doesn't matter; the page sorts newest first):

   ```json
   {
     "id": "03",
     "title": "Short hook from the reel",
     "date": "2026-11-20",
     "tags": ["dev tools"],
     "summary": "One or two sentences on what this is.",
     "links": [
       { "label": "Open the thing", "url": "https://example.com" },
       { "label": "Install", "copy": "npm i -g example" }
     ]
   }
   ```

   - `id`: two digits, unique. It's the number in the caption and the URL: `asifurrahaman.com/reels/#03`.
   - `date`: `YYYY-MM-DD`.
   - `links`: each one has a `label` and **either** `url` (must be `https://`) **or** `copy` (text shown with a Copy button).
2. Check it: `npm run validate`.
3. Open a PR. CI runs validation and the tests. Merging to `main` deploys via Netlify.

**LinkedIn:** `profile.links` has a placeholder `{ "label": "LinkedIn", "todo": "…" }`. It's hidden on the
page (validation prints a warning). Replace `"todo": …` with `"url": "https://www.linkedin.com/in/<you>"`.

## Local development

```sh
npm install
npm start              # http://localhost:4173/reels/
npm test               # validate + unit tests + Playwright (Chromium, mobile and desktop)
```

First Playwright run: `npx playwright install chromium`.

## Netlify site settings

Create a separate Netlify site from this repo (Add new site → Import from Git):

| Setting | Value |
| --- | --- |
| Base directory | *(empty)* |
| Build command | *(empty)* |
| Publish directory | `public` |
| Production branch | `main` |
| Functions / plugins / forms / analytics | none |

Everything else comes from `netlify.toml`:

- Security headers on `/*`: CSP (`default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`),
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a minimal `Permissions-Policy`.
  The same CSP is in a `<meta>` tag in `index.html` in case the proxy drops headers (minus `frame-ancestors`, which browsers ignore in meta tags).
- `/` → `/reels/` (301), so the bare `*.netlify.app` URL lands on the page.
- Anything that doesn't exist gets `/reels/404.html` with a 404 status. Only `public/` is published, so repo files
  (`README.md`, `package.json`, `scripts/`, …) are never on the site.

`<link rel="canonical" href="https://asifurrahaman.com/reels/">` keeps search engines on the custom domain,
and "Copy link" buttons always copy `https://asifurrahaman.com/reels/#NN`.

## Blog redirect snippet

Add this to the **blog's** `netlify.toml` (replace `YOUR-REELS-SITE` with this site's Netlify subdomain).
Put it above any catch-all rules in the blog:

```toml
[[redirects]]
  from = "/reels"
  to = "/reels/"
  status = 301
  force = true

[[redirects]]
  from = "/reels/*"
  to = "https://YOUR-REELS-SITE.netlify.app/reels/:splat"
  status = 200
  force = true
```

Or the `_redirects` equivalent:

```
/reels     /reels/                                          301!
/reels/*   https://YOUR-REELS-SITE.netlify.app/reels/:splat  200!
```

## Fonts

Poppins and JetBrains Mono, from [Fontsource](https://fontsource.org) (latin subset, woff2), licensed under the
SIL Open Font License 1.1. See `public/reels/fonts/OFL-Poppins.txt` and `public/reels/fonts/OFL-JetBrainsMono.txt`.
