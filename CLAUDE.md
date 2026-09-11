# CLAUDE.md — hirotofukada.github.io

Personal portfolio / canonical profile hub, served by GitHub Pages at
`https://cabocha-hlw.github.io/hirotofukada.github.io/` (project site under a sub-path;
Pages source = `main` branch root). Design + requirement traceability:
`docs/site_enhancement/DESIGN.md`. Read it before changing structure or SEO.

## Architecture (read this first)

- `data/*.json` is the **single source of truth** (profile, works, experience, education).
- `site/build.mjs` (zero dependencies, Node ≥ 20) pre-renders
  `index.html` (EN), `ja/index.html` (JA) and `sitemap.xml`.
- **`index.html`, `ja/index.html`, `sitemap.xml` are generated. Never edit them by hand.**
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
- Name / role / expertise wording is the entity "source of truth" for LinkedIn and ORCID
  as well (DESIGN.md §6). Change it here first, then mirror it to the other profiles.
- Adding a research output: append to `data/works.json` (fields in DESIGN.md §5), then
  `npm run build && npm run check`.
- The site URL lives only in `data/profile.json` → `url`. Changing it (custom domain,
  repo rename) updates canonical, hreflang, OG, JSON-LD, sitemap and robots.txt in one build
  (robots.txt is hand-maintained — update its `Sitemap:` line too).
- Commit identity: GitHub noreply address (see `~/.claude/CLAUDE.md`).
