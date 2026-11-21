# 🏠 caozhijun.top

Personal homepage of **Aaron Zhijun Cao (曹植竣)**, live at [caozhijun.top](https://caozhijun.top).

A hand-written static site with **no build step**: edit the HTML, push to `main`, and GitHub Pages publishes it behind Cloudflare. It loads nothing from external CDNs or Google Fonts, which are unreachable from mainland China.

## ✨ Highlights

- 🌐 English and Chinese on one URL, switched in place with `?lang=zh-CN`
- 📐 Fluid layout down to 700px; phones scale the 700px layout to fit
- 🖼️ Gallery with marquee and list views, plus a WebGL liquid-glass loupe
- 🗺️ Dotted visitor map and GitHub star counts, served by a Cloudflare Worker

## 🗂️ Structure

```
├── index.html          Home page
├── gallery/index.html  Gallery, served at /gallery/
├── assets/
│   ├── css/style.css   Site styles; design tokens are at the top
│   ├── js/             i18n, nav, reveal, glass (loupe), worldmap, ghstars
│   ├── fonts/          Self-hosted Gelasio (Charis and Inter are kept but unused)
│   ├── img/ pdf/ video/
├── worker/             Cloudflare Worker + D1 behind /api/*
└── docs/               Deployment, asset and visitor-map guides
```

## 💻 Local preview

```bash
python3 -m http.server 8000
```

`/api/*` only exists in production, so the visitor map stays hidden and star counts don't appear locally.

## ✏️ Common edits

| To change | Edit |
|---|---|
| News | `<ul class="news">` in `index.html`, newest first; add `class="news-hidden" hidden` to fold an item |
| Publications | Copy an `<article class="pub">` block in `index.html` |
| Chinese text | `assets/js/i18n.js`, under the same key as the element's `data-i18n` |
| Colors, type, radius | CSS variables at the top of `style.css` |
| CV, images, gallery photos | See [docs/ASSETS.md](docs/ASSETS.md) |
| Add a page | Also add a `<url>` to `sitemap.xml` |

## 🌐 Languages

English lives in the HTML and Chinese in `assets/js/i18n.js`. Mark an element with `data-i18n="key"`, or use `data-i18n-title`, `-alt`, `-aria-label` or `-content` for attributes, then add the key to `zh`. Text built by scripts updates on the `languagechange` event.

In Chinese copy, put a half-width space between Chinese and Latin text or digits, and no extra space around full-width punctuation.

## 🚀 Deploy

Pushing to `main` publishes in 1–2 minutes.

> ⚠️ Cloudflare caches static files for 4 hours. After changing CSS or JS, bump that file's `?v=` in **both** HTML pages. Wait for the deploy to finish before requesting the new URL, or Cloudflare may cache a 404.

## 📚 Docs

These guides are in Chinese:

- [docs/DEPLOY.md](docs/DEPLOY.md): hosting, DNS, ICP filing, search engines, cache busting
- [docs/ASSETS.md](docs/ASSETS.md): CV, paper figures, gallery photo export
- [docs/VISITOR-MAP.md](docs/VISITOR-MAP.md): Worker and D1 setup, privacy, star counts

## 🙏 Credits

- Loupe shader adapted from [ybouane/liquidglass](https://github.com/ybouane/liquidglass) (MIT)
- [Gelasio](https://github.com/SorkinType/Gelasio) font (SIL OFL 1.1, see `assets/fonts/OFL-Gelasio.txt`)
- Translate icon from Google Material Icons (Apache 2.0)
- Map outline from [Natural Earth](https://www.naturalearthdata.com/) (public domain)
