# hirotofukada.github.io

Personal portfolio and canonical profile page of Hiroto Fukada (深田大登), hosted on
GitHub Pages: <https://cabocha-hlw.github.io/hirotofukada.github.io/> (English) /
<https://cabocha-hlw.github.io/hirotofukada.github.io/ja/> (日本語).

## How it works

- Content lives in `data/*.json` (profile, works, experience, education).
- `site/build.mjs` pre-renders static HTML (EN + JA), JSON-LD structured data and
  `sitemap.xml`, so everything is readable without JavaScript.
- `index.html`, `ja/index.html` and `sitemap.xml` are generated — edit the data or the
  build script, not the output.

```bash
npm run build   # regenerate
npm run check   # acceptance checks + verify generated files are current
```

Design notes and requirement traceability: [docs/site_enhancement/DESIGN.md](docs/site_enhancement/DESIGN.md).
Resume build pipeline (private data): [docs/resume_design/DESIGN.md](docs/resume_design/DESIGN.md).

## Sections

About · Expertise · Selected Work · Research Outputs · Professional Experience · Education · Profiles & Contact
