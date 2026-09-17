# CLAUDE.md — hirotofukada.github.io

Personal portfolio / canonical profile hub, served by GitHub Pages at
`https://cabocha-hlw.github.io/hirotofukada.github.io/` (project site under a sub-path;
Pages source = `main` branch root). Design + requirement traceability:
`docs/site_enhancement/DESIGN.md` (Phase 1: the profile page itself) and
`docs/site_enhancement/DESIGN_PHASE2.md` (Phase 2: research / publication / work pages
with their own URLs). Read them before changing structure or SEO.

## Architecture (read this first)

- `data/*.json` is the **single source of truth** (profile, works, experience, education,
  research topics).
- `site/build.mjs` (zero dependencies, Node ≥ 20) pre-renders every page from a page
  registry (`PAGE_DEFS` × languages), plus `sitemap.xml` and `sitemap-gsc.xml`:
  `/` and `/ja/` (profile), `/research/` + `/research/<topic>/`, `/publications/` +
  `/publications/<slug>/`, `/work/<slug>/`, `/awards/` — each with a JA counterpart
  under `/ja/`.
- **A detail page exists only when its content does.** A research topic needs the four
  sections in `data/topics.json`; a publication or project needs `slug` + a complete
  `detail` block in `data/works.json` (summary / why / results in both languages + an
  external primary source). `npm run check` enforces the word and character minimums
  and refuses orphan pages. Do not create a page to hold thin content.
- `sitemap-gsc.xml` is a byte-identical copy of `sitemap.xml` at a second URL, used to
  diagnose Search Console's "Couldn't fetch" state (DESIGN.md §10-7). Both come from
  `SITEMAP_FILES` in `site/build.mjs` — never copy the file by hand.
- **Every `index.html` under the repo root (`/`, `ja/`, `research/`, `publications/`,
  `work/`, `awards/` and their `ja/` counterparts), `sitemap.xml` and `sitemap-gsc.xml`
  are generated. Never edit them by hand.**
  Change `data/` (content), `site/build.mjs` (structure / JSON-LD), or `style.css` (look),
  then rebuild and commit the regenerated files together with the source.
- `script.js` is progressive enhancement only (progress bar, fade-in, scrollspy,
  "New" badge). Page content must never depend on JavaScript.
- `resume/` builds private resume PDFs from `docs/resume_design/` (gitignored) and
  `data/works.json`. Read `docs/resume_design/DESIGN.md` before touching it.

## Commands

```bash
npm run build                    # regenerate index.html, ja/index.html, sitemap.xml
npm run check                    # acceptance checks (DoD) + "generated files are current" (CI runs this)
node resume/build.mjs --check    # resume ↔ site data consistency (needs private master.yaml)
```

## Rules

- Public repository: never put a personal email, phone, address, or non-public employer
  details into `data/` or HTML. `npm run check` fails on `mailto:`.
- **Japanese content in `data/*.json` (every `*_ja` field) is written in 常体 —
  plain / だ・である style, assertive and declarative. Never ですます調.** This is the
  site's published voice, not just chat style, and it matches the resume's `master.yaml`.
  Noun-ending (体言止め) is fine for short descriptions.
- Name / role / expertise wording is the entity "source of truth" for LinkedIn and ORCID
  as well (DESIGN.md §6). Change it here first, then mirror it to the other profiles.
- Adding a research output: append to `data/works.json` (fields in DESIGN.md §5), then
  `npm run build && npm run check`. It appears on the profile page and in
  `/publications/`; it gets its own page only once `slug` + `detail` are filled in
  (DESIGN_PHASE2.md §3.2).
- Adding a research topic page: append to `data/topics.json` (DESIGN_PHASE2.md §3.1).
  Slugs (`topics[].id`, `works[].slug`) are public URLs — never change them after
  release.
- The site URL lives only in `data/profile.json` → `url`. Changing it (custom domain,
  repo rename) updates canonical, hreflang, OG, JSON-LD, sitemap and robots.txt in one build
  (robots.txt is hand-maintained — update its `Sitemap:` line too).
- Commit identity: GitHub noreply address (see `~/.claude/CLAUDE.md`).
