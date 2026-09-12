#!/usr/bin/env node
// ============================================================
// サイトビルド（静的生成）
//   data/*.json ──► index.html（EN） / ja/index.html（JA） / sitemap.xml
// 仕様: docs/site_enhancement/DESIGN.md
//
//   node site/build.mjs            # 生成
//   node site/build.mjs --check    # 受け入れチェック + 生成物が最新かの検証（書き込みなし）
//
// 生成物（index.html / ja/index.html / sitemap.xml）は手で編集しない。
// 内容の修正は data/*.json、見た目は style.css、構造はこのファイルに対して行い、
// 再ビルドする。依存パッケージなし（Node 標準モジュールのみ）。
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DATA_DIR = path.join(ROOT, 'data');

const checkOnly = process.argv.includes('--check');

// ---------------------------------------------------------------- data
const profile = readJson('profile.json');
const works = readJson('works.json');
const experience = readJson('experience.json');
const education = readJson('education.json');
const networkSvg = fs.readFileSync(path.join(HERE, 'partials', 'network.svg'), 'utf8').trim();

const SITE_URL = ensureTrailingSlash(profile.url);
const BUILD_DATE = new Date().toISOString().slice(0, 10);
const GA_ID = 'G-W12HECKQ45';

// 言語ごとの出力先。base は各ページから見たサイトルートへの相対パス。
const LANGS = [
  { code: 'en', dir: '', base: '', ogLocale: 'en_US' },
  { code: 'ja', dir: 'ja', base: '../', ogLocale: 'ja_JP' },
];

// ---------------------------------------------------------------- UI strings
const UI = {
  en: {
    skip: 'Skip to content',
    langLabel: 'Language',
    nav: {
      about: 'About', expertise: 'Expertise', work: 'Work', research: 'Research',
      experience: 'Experience', education: 'Education', profiles: 'Profiles',
    },
    eyebrow: {
      about: 'Introduction', expertise: 'Areas of Interest', work: 'Portfolio', research: 'Publications & Talks',
      experience: 'Career', education: 'Academic', profiles: 'Get in Touch',
    },
    section: {
      about: 'About', expertise: 'Expertise', work: 'Selected Work', research: 'Research Outputs',
      experience: 'Professional Experience', education: 'Education', profiles: 'Profiles & Contact',
    },
    cat: {
      projects: 'Professional Projects', recognition: 'Recognition',
      papers: 'Peer-reviewed Papers', presentations: 'Presentations & Awards', upcoming: 'Upcoming',
    },
    facts: { problem: 'Problem', role: 'Role', domain: 'Domain', methods: 'Methods', outcome: 'Outcome' },
    kind: {
      paper: 'Conference paper', poster: 'Poster presentation', oral: 'Oral presentation',
      talk: 'Invited talk', award: 'Award',
    },
    highlights: 'Selected Highlights',
    currently: 'Currently',
    now: 'Now',
    venuePage: 'Conference page',
    topicsLabel: 'Areas of expertise',
    footerTag: 'Open to collaboration',
  },
  ja: {
    skip: '本文へスキップ',
    langLabel: '言語',
    nav: {
      about: 'プロフィール', expertise: '専門領域', work: '実績', research: '研究業績',
      experience: '経歴', education: '学歴', profiles: 'リンク',
    },
    eyebrow: {
      about: 'プロフィール', expertise: '関心領域', work: 'ポートフォリオ', research: '発表・受賞',
      experience: 'キャリア', education: '学術', profiles: 'お問い合わせ',
    },
    section: {
      about: '概要', expertise: '専門領域', work: '主な実績', research: '研究業績',
      experience: '職歴', education: '学歴', profiles: 'プロフィール・連絡先',
    },
    cat: {
      projects: '主なプロジェクト', recognition: '表彰',
      papers: '査読付き論文', presentations: '学会発表・受賞', upcoming: '今後の発表予定',
    },
    facts: { problem: '課題', role: '役割', domain: '領域', methods: '手法・技術', outcome: '成果' },
    kind: { paper: '国際会議論文', poster: 'ポスター発表', oral: '口頭発表', talk: '招待講演', award: '受賞' },
    highlights: '主な実績',
    currently: '現在',
    now: '現在',
    venuePage: '学会ページ',
    topicsLabel: '専門領域',
    footerTag: '共同研究・協業歓迎',
  },
};

// ---------------------------------------------------------------- main
// （ファイル末尾で main() を呼ぶ。ヘルパーの const 宣言より前に実行しないため）
function main() {
  const pages = LANGS.map((lang) => ({
    lang,
    file: path.join(lang.dir, 'index.html'),
    html: renderPage(lang),
  }));
  const sitemap = renderSitemap();

  if (checkOnly) {
    const failures = runChecks(pages, sitemap);
    if (failures.length) {
      console.error(`--- 受け入れチェック: ${failures.length} 件の失敗 ---`);
      for (const f of failures) console.error(`  ✗ ${f}`);
      process.exit(2);
    }
    console.log(`--- 受け入れチェック: すべて合格（${pages.length} ページ + sitemap） ---`);
    return;
  }

  for (const p of pages) {
    const out = path.join(ROOT, p.file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, p.html);
    console.log(`✓ ${p.file}  (${(Buffer.byteLength(p.html) / 1024).toFixed(1)} KB)`);
  }
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
  console.log('✓ sitemap.xml');
}

// ================================================================ page
function renderPage(lang) {
  const L = UI[lang.code];
  const lc = lang.code;
  const base = lang.base;
  const url = pageUrl(lang);
  const title = t(profile.seo, 'title', lc);
  const description = t(profile.seo, 'description', lc);
  const isJa = lc === 'ja';

  const alternates = LANGS.map(
    (l) => `<link rel="alternate" hreflang="${l.code}" href="${esc(pageUrl(l))}">`,
  ).join('\n  ');

  const verification = profile.seo.googleSiteVerification
    ? `\n  <meta name="google-site-verification" content="${esc(profile.seo.googleSiteVerification)}">`
    : '';

  return `<!DOCTYPE html>
<!-- GENERATED FILE: do not edit by hand. Source = data/*.json + site/build.mjs (run: npm run build) -->
<html lang="${lc}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="author" content="${esc(profile.name)}">
  <meta name="robots" content="index, follow, max-image-preview:large">${verification}
  <link rel="canonical" href="${esc(url)}">
  ${alternates}
  <link rel="alternate" hreflang="x-default" href="${esc(SITE_URL)}">
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="${esc(profile.name)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${esc(abs(profile.photo.src))}">
  <meta property="og:image:width" content="${profile.photo.width}">
  <meta property="og:image:height" content="${profile.photo.height}">
  <meta property="og:image:alt" content="${esc(t(profile.photo, 'alt', lc))}">
  <meta property="og:locale" content="${lang.ogLocale}">
  ${LANGS.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${l.ogLocale}">`).join('\n  ')}
  <meta property="profile:first_name" content="${esc(profile.givenName)}">
  <meta property="profile:last_name" content="${esc(profile.familyName)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(abs(profile.photo.src))}">
  <link rel="icon" href="${favicon()}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="${base}style.css">
  <script>document.documentElement.classList.add('js');</script>
  <script type="application/ld+json">
${JSON.stringify(buildJsonLd(lang, url, title, description), null, 2)}
  </script>

  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_ID}');
  </script>
</head>
<body>
  <a class="skip-link" href="#main">${esc(L.skip)}</a>
  <div class="progress-bar" id="progress-bar" aria-hidden="true"></div>

  <header class="site-header">
    <div class="container">
      <div class="header-inner">
        <a class="header-name" href="${base || './'}">${esc(profile.name)}</a>
        <nav aria-label="${isJa ? 'メインナビゲーション' : 'Primary'}">
          ${['about', 'expertise', 'work', 'research', 'experience', 'education', 'profiles']
            .map((id) => `<a href="#${id}">${esc(L.nav[id])}</a>`).join('\n          ')}
        </nav>
        <div class="lang-toggle" role="group" aria-label="${esc(L.langLabel)}">
          ${LANGS.map((l) => {
            const active = l === lang;
            return `<a class="lang-btn${active ? ' active' : ''}" href="${esc(langHref(lang, l))}" hreflang="${l.code}" lang="${l.code}"${active ? ' aria-current="page"' : ''}>${l.code.toUpperCase()}</a>`;
          }).join('\n          ')}
        </div>
      </div>
    </div>
  </header>

  <main id="main">
${renderHero(lang)}
${renderSection(lang, 'about', renderAbout(lang))}
${renderSection(lang, 'expertise', renderExpertise(lang))}
${renderSection(lang, 'work', renderWork(lang))}
${renderSection(lang, 'research', renderResearch(lang))}
${renderSection(lang, 'experience', renderExperience(lang))}
${renderSection(lang, 'education', renderEducation(lang))}
${renderSection(lang, 'profiles', renderProfiles(lang))}
  </main>

  <footer class="site-footer">
    <div class="container">
      <div class="footer-inner">
        <p class="footer-copy">© ${esc(profile.name)}（${esc(profile.name_ja)}）</p>
        <span class="footer-tag"><span aria-hidden="true"></span>${esc(L.footerTag)}</span>
      </div>
    </div>
  </footer>

  <script src="${base}script.js" defer></script>
</body>
</html>
`;
}

// ---------------------------------------------------------------- sections
function renderSection(lang, id, content) {
  const L = UI[lang.code];
  return `    <section id="${id}" class="section" aria-labelledby="${id}-heading">
      <div class="container">
        <div class="section-inner fade-up">
          <div class="section-heading">
            <span class="section-eyebrow">${esc(L.eyebrow[id])}</span>
            <h2 id="${id}-heading">${esc(L.section[id])}</h2>
          </div>
          <div class="section-content">
${content}
          </div>
        </div>
      </div>
    </section>
`;
}

function renderHero(lang) {
  const L = UI[lang.code];
  const lc = lang.code;
  const isJa = lc === 'ja';
  const base = lang.base;
  const primary = isJa ? profile.name_ja : profile.name;
  const secondary = isJa ? profile.name : profile.name_ja;
  const affil = currentAffiliations().map((o) => o.shortName).join(' · ');
  const callout = t(profile, 'callout', lc);
  const topics = profile.expertise.filter((e) => e.featured);
  const photo = profile.photo;

  return `    <section class="hero" id="top" aria-labelledby="profile-name">
      <div class="hero-network" aria-hidden="true">
        ${networkSvg}
      </div>
      <div class="container">
        <div class="hero-inner">
          <div class="hero-text">
            <h1 id="profile-name">
              <span class="name-primary" lang="${isJa ? 'ja' : 'en'}">${esc(primary)}</span>
              <span class="name-secondary" lang="${isJa ? 'en' : 'ja'}">${esc(secondary)}</span>
            </h1>
            <p class="hero-roles">${esc(t(profile, 'roleLine', lc))}</p>
            <p class="hero-identity">${esc(t(profile, 'headline', lc))}</p>
            <p class="hero-affil"><span class="hero-affil-label">${esc(L.currently)}</span> ${esc(affil)}</p>
            <ul class="hero-topics" aria-label="${esc(L.topicsLabel)}">
              ${topics.map((e) => `<li><a class="topic-tag" href="#expertise">${esc(t(e, 'name', lc))}</a></li>`).join('\n              ')}
            </ul>${callout ? `\n            <p class="hero-callout">${esc(callout)}</p>` : ''}
          </div>
          <div class="hero-photo-wrap">
            <picture>
              ${photo.webp ? `<source type="image/webp" srcset="${base}${esc(photo.webp)}">` : ''}
              <img class="hero-photo" src="${base}${esc(photo.src)}" width="${photo.width}" height="${photo.height}" alt="${esc(t(photo, 'alt', lc))}" fetchpriority="high" decoding="async">
            </picture>
          </div>
        </div>
      </div>
    </section>
`;
}

function renderAbout(lang) {
  const paras = t(profile, 'bio', lang.code);
  return `            <div class="prose" id="profile-about">
${paras.map((p) => `              <p>${esc(p)}</p>`).join('\n')}
            </div>`;
}

function renderExpertise(lang) {
  const lc = lang.code;
  return `            <ul class="expertise-list">
${profile.expertise.map((e) => `              <li class="expertise-item" id="expertise-${esc(e.id)}">
                <h3>${esc(t(e, 'name', lc))}</h3>
                <p>${esc(t(e, 'description', lc))}</p>
              </li>`).join('\n')}
            </ul>`;
}

function renderWork(lang) {
  const L = UI[lang.code];
  const projects = sortDesc(works.filter((w) => w.type === 'professional'));
  const awards = sortDesc(works.filter((w) => w.type === 'award'));
  return [
    category(L.cat.projects, projects.map((w) => renderProject(w, lang))),
    awards.length ? category(L.cat.recognition, awards.map((w) => renderAward(w, lang))) : '',
  ].filter(Boolean).join('\n');
}

function renderResearch(lang) {
  const L = UI[lang.code];
  const papers = sortDesc(works.filter((w) => w.type === 'paper'));
  const research = sortDesc(works.filter((w) => w.type === 'research'));
  const upcoming = sortAsc(works.filter((w) => w.type === 'upcoming'));
  return [
    papers.length ? category(L.cat.papers, papers.map((w) => renderResearchItem(w, lang))) : '',
    research.length ? category(L.cat.presentations, research.map((w) => renderResearchItem(w, lang))) : '',
    upcoming.length ? category(L.cat.upcoming, upcoming.map((w) => renderResearchItem(w, lang))) : '',
  ].filter(Boolean).join('\n');
}

function category(heading, items) {
  return `            <div class="work-category">
              <h3>${esc(heading)}</h3>
              <ul class="work-list">
${items.join('\n')}
              </ul>
            </div>`;
}

function renderResearchItem(item, lang) {
  const L = UI[lang.code];
  const lc = lang.code;
  const kindLabel = item.kind ? L.kind[item.kind] ?? '' : '';
  const status = t(item, 'status', lc);
  const links = [...(item.links ?? [])];
  if (item.venueUrl) links.push({ label: L.venuePage, url: item.venueUrl });
  // 「Poster presentation · Poster Presentation」のような重複を避ける
  const metaParts = [kindLabel, status]
    .filter(Boolean)
    .filter((s, i, arr) => arr.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i);
  return `                <li>
                  <article class="work-item research-item"${item.added ? ` data-added="${esc(item.added)}"` : ''}>
                    <h4 class="work-title">${esc(t(item, 'title', lc))}</h4>
                    <p class="work-citation">${formatAuthors(item.authors, item.selfAuthors)} (${esc(item.year)}). <em>${esc(t(item, 'venue', lc))}</em>.</p>
                    <p class="work-meta">${metaParts.map(esc).join(' · ')}</p>
${renderLinks(links, lc, 20)}
                  </article>
                </li>`;
}

function renderProject(item, lang) {
  const L = UI[lang.code];
  const lc = lang.code;
  const methods = t(item, 'methods', lc);
  const facts = [
    ['problem', t(item, 'problem', lc)],
    ['role', t(item, 'role', lc)],
    ['domain', t(item, 'domain', lc)],
    ['methods', Array.isArray(methods) ? methods.join(', ') : methods],
    ['outcome', t(item, 'outcome', lc)],
  ].filter(([, v]) => v);
  const metaLine = [t(item, 'organization', lc), formatYearMonth(item, lc)].filter(Boolean).join(' · ');
  return `                <li>
                  <article class="work-item project-item">
                    <h4 class="work-title">${esc(t(item, 'title', lc))}</h4>
                    <p class="work-meta">${esc(metaLine)}</p>
                    <dl class="project-facts">
${facts.map(([k, v]) => `                      <div class="fact"><dt>${esc(L.facts[k])}</dt><dd>${esc(v)}</dd></div>`).join('\n')}
                    </dl>
${renderLinks(item.links, lc, 20)}
                  </article>
                </li>`;
}

function renderAward(item, lang) {
  const lc = lang.code;
  const metaLine = [t(item, 'organization', lc), t(item, 'role', lc), item.year].filter(Boolean).join(' · ');
  return `                <li>
                  <article class="work-item award-item">
                    <h4 class="work-title">${esc(t(item, 'title', lc))}</h4>
                    <p class="work-meta">${esc(metaLine)}</p>
                    <p class="work-description">${esc(t(item, 'description', lc))}</p>
${renderLinks(item.links, lc, 20)}
                  </article>
                </li>`;
}

function renderExperience(lang) {
  const L = UI[lang.code];
  const lc = lang.code;
  const groups = sortDesc(experience.map((g) => ({ ...g, ...parsePeriodStart(g.period) })));
  return `            <div id="experience-list" class="timeline">
${groups.map((group) => {
    const active = isPresent(group);
    const roles = group.roles.map((role) => `                <div class="role-item">
                  <h4>${esc(t(role, 'title', lc))}</h4>${role.period ? `\n                  <p class="role-period">${esc(formatPeriod(role.period, lc))}</p>` : ''}
                  <p>${esc(t(role, 'description', lc))}</p>
                </div>`).join('\n');
    const highlights = t(group, 'highlights', lc) || [];
    const hl = highlights.length ? `
                <div class="experience-highlights">
                  <h4>${esc(L.highlights)}</h4>
                  <ul>
${highlights.map((h) => `                    <li>${esc(h)}</li>`).join('\n')}
                  </ul>
                </div>` : '';
    return `              <article class="experience-group${active ? ' is-active' : ''}">
                <h3>${esc(t(group, 'organization', lc))}${active ? ` <span class="badge-now">${esc(L.now)}</span>` : ''}</h3>
                <p class="experience-meta">${esc(formatPeriod(group.period, lc))}</p>
${roles}${hl}
              </article>`;
  }).join('\n')}
            </div>`;
}

function renderEducation(lang) {
  const L = UI[lang.code];
  const lc = lang.code;
  const items = sortDesc(education.map((e) => ({ ...e, ...parsePeriodStart(e.period) })));
  return `            <div id="education-list" class="timeline">
${items.map((item) => {
    const active = isPresent(item);
    return `              <article class="education-item${active ? ' is-active' : ''}">
                <h3>${esc(t(item, 'institution', lc))}${active ? ` <span class="badge-now">${esc(L.now)}</span>` : ''}</h3>
                <p class="education-meta">${esc(t(item, 'program', lc))} / ${esc(formatPeriod(item.period, lc))}</p>
                <p>${esc(t(item, 'description', lc))}</p>
              </article>`;
  }).join('\n')}
            </div>`;
}

function renderProfiles(lang) {
  const lc = lang.code;
  const note = t(profile, 'contactNote', lc);
  return `            <ul class="profile-list" id="contact-list">
${profile.profiles.map((p) => `              <li><a href="${esc(p.url)}" rel="${p.sameAs ? 'me ' : ''}noopener noreferrer" target="_blank">${esc(p.network)}</a></li>`).join('\n')}
            </ul>${note ? `\n            <p class="contact-note">${esc(note)}</p>` : ''}`;
}

function renderLinks(links = [], lc, indent = 0) {
  const valid = links.filter((l) => l.url && l.url.trim() !== '');
  if (valid.length === 0) return '';
  const pad = ' '.repeat(indent);
  return `${pad}<p class="work-links">
${valid.map((l) => `${pad}  <a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(t(l, 'label', lc))}</a>`).join('\n')}
${pad}</p>`;
}

// ---------------------------------------------------------------- JSON-LD
function buildJsonLd(lang, url, title, description) {
  const lc = lang.code;
  const personId = `${SITE_URL}#person`;
  const actives = currentAffiliations();
  const orgLd = (o, type) => ({
    '@type': type,
    name: o.formalName ?? o.organization ?? o.institution,
    ...(o.shortName && o.shortName !== (o.formalName ?? '') ? { alternateName: o.shortName } : {}),
    ...(o.url ? { url: o.url } : {}),
  });

  const person = {
    '@type': 'Person',
    '@id': personId,
    name: profile.name,
    alternateName: profile.alternateNames,
    givenName: profile.givenName,
    familyName: profile.familyName,
    url: SITE_URL,
    image: abs(profile.photo.src),
    jobTitle: profile.roles,
    description: t(profile, 'headline', lc),
    sameAs: profile.profiles.filter((p) => p.sameAs).map((p) => p.url),
    identifier: profile.profiles
      .filter((p) => p.identifier)
      .map((p) => ({ '@type': 'PropertyValue', propertyID: p.network, value: p.identifier })),
    affiliation: actives.map((o) => orgLd(o, o.institution ? 'EducationalOrganization' : 'Organization')),
    worksFor: actives.filter((o) => o.organization).map((o) => orgLd(o, 'Organization')),
    alumniOf: education.filter((e) => !isPresent(e)).map((e) => orgLd(e, 'CollegeOrUniversity')),
    knowsAbout: profile.expertise.map((e) => e.name),
    knowsLanguage: profile.knowsLanguage,
  };

  const articles = sortDesc(works.filter((w) => w.type === 'paper')).map((w) => {
    const arxivUrl = w.arxiv ? `https://arxiv.org/abs/${w.arxiv}` : undefined;
    const primaryUrl = w.doi ? `https://doi.org/${w.doi}` : arxivUrl ?? w.venueUrl;
    return {
      '@type': 'ScholarlyArticle',
      ...(primaryUrl ? { '@id': primaryUrl, url: primaryUrl } : {}),
      headline: w.title,
      name: w.title,
      author: w.authors.map((a) => (w.selfAuthors?.includes(a) ? { '@id': personId } : { '@type': 'Person', name: a })),
      datePublished: String(w.year),
      ...(arxivUrl ? { sameAs: [arxivUrl] } : {}),
      ...(w.publisher ? { publisher: { '@type': 'Organization', name: w.publisher } } : {}),
      publication: { '@type': 'PublicationEvent', name: w.venue, ...(w.venueUrl ? { url: w.venueUrl } : {}) },
    };
  });

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        '@id': `${url}#profilepage`,
        url,
        name: title,
        description,
        inLanguage: lc,
        dateModified: BUILD_DATE,
        mainEntity: person,
        about: { '@id': personId },
        ...(articles.length ? { hasPart: articles } : {}),
      },
    ],
  };
}

// ---------------------------------------------------------------- sitemap
function renderSitemap() {
  const urls = LANGS.map((lang) => {
    const links = LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.code}" href="${esc(pageUrl(l))}"/>`).join('\n');
    return `  <url>
    <loc>${esc(pageUrl(lang))}</loc>
    <lastmod>${BUILD_DATE}</lastmod>
${links}
    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(SITE_URL)}"/>
  </url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

// ================================================================ checks
// 要求書「Definition of Done」に対応する機械検査。docs/site_enhancement/DESIGN.md §8 参照。
function runChecks(pagesToCheck, sitemapXml) {
  const fails = [];
  const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');

  for (const p of pagesToCheck) {
    const { html, file, lang } = p;
    const tag = `[${file}]`;

    // FR-01: H1 は 1 つ、Hiroto Fukada を含む。深田大登 が本文に存在する
    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
    if (h1s.length !== 1) fails.push(`${tag} h1 が ${h1s.length} 個（1 個であること）`);
    else if (!h1s[0][1].replace(/<[^>]+>/g, '').includes('Hiroto Fukada')) fails.push(`${tag} h1 に "Hiroto Fukada" がない`);
    if (!text(html).includes('深田大登')) fails.push(`${tag} 本文に "深田大登" がない`);

    // SEO-01/02: title / meta description
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    if (!title.includes('Hiroto Fukada')) fails.push(`${tag} <title> に "Hiroto Fukada" がない`);
    const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
    if (!desc) fails.push(`${tag} meta description がない`);
    if (lang.code === 'en' && (desc.length < 120 || desc.length > 160)) {
      fails.push(`${tag} meta description の長さ ${desc.length}（120〜160 であること）`);
    }

    // SEO-03: canonical / hreflang
    if (!html.includes(`<link rel="canonical" href="${pageUrl(lang)}">`)) fails.push(`${tag} canonical が不正`);
    for (const l of LANGS) if (!html.includes(`hreflang="${l.code}"`)) fails.push(`${tag} hreflang=${l.code} がない`);
    if (!html.includes('hreflang="x-default"')) fails.push(`${tag} hreflang=x-default がない`);

    // FR-03: JSON-LD ProfilePage / Person
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    if (ld.length === 0) fails.push(`${tag} JSON-LD がない`);
    for (const block of ld) {
      let data;
      try { data = JSON.parse(block); } catch (e) { fails.push(`${tag} JSON-LD がパースできない: ${e.message}`); continue; }
      const graph = data['@graph'] ?? [data];
      const page = graph.find((n) => n['@type'] === 'ProfilePage');
      if (!page) { fails.push(`${tag} JSON-LD に ProfilePage がない`); continue; }
      const person = page.mainEntity;
      if (!person || person['@type'] !== 'Person') { fails.push(`${tag} ProfilePage.mainEntity が Person でない`); continue; }
      for (const k of ['name', 'alternateName', 'url', 'jobTitle', 'description', 'sameAs']) {
        if (person[k] == null || (Array.isArray(person[k]) && person[k].length === 0)) fails.push(`${tag} Person.${k} が空`);
      }
      const sameAs = person.sameAs ?? [];
      if (!sameAs.some((u) => u.includes('linkedin.com/in/'))) fails.push(`${tag} Person.sameAs に LinkedIn がない`);
      if (!sameAs.some((u) => /^https:\/\/orcid\.org\/\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(u))) fails.push(`${tag} Person.sameAs に ORCID がない`);
      if (!sameAs.some((u) => u.includes('github.com/'))) fails.push(`${tag} Person.sameAs に GitHub がない`);
      if (!Array.isArray(person.alternateName) || !person.alternateName.includes('深田大登')) fails.push(`${tag} Person.alternateName に 深田大登 がない`);
    }

    // SEO-04: semantic HTML
    for (const el of ['main', 'nav', 'footer', 'section', 'article', 'header']) {
      if (!new RegExp(`<${el}[\\s>]`).test(html)) fails.push(`${tag} <${el}> がない`);
    }
    // SEO-05: H2 の順序
    const h2s = [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => m[1]);
    const expected = ['about', 'expertise', 'work', 'research', 'experience', 'education', 'profiles'].map((k) => esc(UI[lang.code].section[k]));
    if (JSON.stringify(h2s) !== JSON.stringify(expected)) fails.push(`${tag} h2 の並びが想定と異なる: ${h2s.join(' | ')}`);

    // FR-05: 研究成果のタイトルが HTML テキストとして存在する
    for (const w of works) {
      const ttl = t(w, 'title', lang.code);
      if (!html.includes(esc(ttl))) fails.push(`${tag} works "${ttl.slice(0, 40)}" がテキストとして見つからない`);
    }
    // FR-02: Biography
    const bioWords = (profile.bio ?? []).join(' ').split(/\s+/).filter(Boolean).length;
    if (bioWords < 100 || bioWords > 200) fails.push(`profile.bio の語数 ${bioWords}（100〜200 語であること）`);
    if (!html.includes('id="profile-about"')) fails.push(`${tag} Biography ブロックがない`);
    // FR-04: 外部プロフィールリンク
    for (const pr of profile.profiles) if (!html.includes(`href="${esc(pr.url)}"`)) fails.push(`${tag} プロフィールリンク ${pr.network} がない`);

    // §8 Privacy: メールアドレス・電話番号を出さない
    if (/mailto:/i.test(html)) fails.push(`${tag} mailto: リンクが含まれている（要求書 §8）`);
    if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text(html))) fails.push(`${tag} メールアドレスらしき文字列が本文にある（要求書 §8）`);
    // テンプレート不具合の検出
    for (const bad of ['undefined', '[object Object]', 'NaN']) {
      if (text(html).includes(bad)) fails.push(`${tag} 本文に "${bad}" が出力されている`);
    }
    // 画像に width/height と alt
    for (const img of html.matchAll(/<img\b[^>]*>/g)) {
      if (!/\swidth="\d+"/.test(img[0]) || !/\sheight="\d+"/.test(img[0])) fails.push(`${tag} <img> に width/height がない: ${img[0].slice(0, 60)}`);
      if (!/\salt="[^"]+"/.test(img[0])) fails.push(`${tag} <img> に alt がない: ${img[0].slice(0, 60)}`);
    }
    // 参照している静的ファイルの実在
    for (const rel of [`${lang.base}style.css`, `${lang.base}script.js`, `${lang.base}${profile.photo.src}`, ...(profile.photo.webp ? [`${lang.base}${profile.photo.webp}`] : [])]) {
      if (!fs.existsSync(path.join(ROOT, lang.dir, rel))) fails.push(`${tag} 参照ファイルが存在しない: ${rel}`);
    }

    // 生成物が最新か（日付のみ差異を許容）
    const onDisk = readIfExists(path.join(ROOT, file));
    if (onDisk == null) fails.push(`${tag} 生成物が存在しない（npm run build を実行）`);
    else if (normalizeDates(onDisk) !== normalizeDates(html)) fails.push(`${tag} 生成物が data/・site/ と一致しない（npm run build を実行してコミット）`);
  }

  // SEO-06/07: sitemap / robots
  for (const lang of LANGS) if (!sitemapXml.includes(`<loc>${pageUrl(lang)}</loc>`)) fails.push(`sitemap に ${pageUrl(lang)} がない`);
  const sitemapOnDisk = readIfExists(path.join(ROOT, 'sitemap.xml'));
  if (sitemapOnDisk == null) fails.push('sitemap.xml が存在しない');
  else if (normalizeDates(sitemapOnDisk) !== normalizeDates(sitemapXml)) fails.push('sitemap.xml が最新でない（npm run build を実行）');
  const robots = readIfExists(path.join(ROOT, 'robots.txt')) ?? '';
  if (!/^User-agent:\s*\*/m.test(robots) || !/^Allow:\s*\/\s*$/m.test(robots)) fails.push('robots.txt に "User-agent: *" / "Allow: /" がない');
  if (/^Disallow:\s*\/\s*$/m.test(robots)) fails.push('robots.txt がサイト全体を Disallow している');
  if (!robots.includes(`Sitemap: ${SITE_URL}sitemap.xml`)) fails.push('robots.txt に Sitemap 行がない');
  if (!fs.existsSync(path.join(ROOT, '.nojekyll'))) fails.push('.nojekyll がない');

  return fails;
}

// ================================================================ helpers
/** 多言語フィールドの取得。JA では `key_ja` が定義されていればそれを使う（空文字も「JA では非表示」として尊重） */
function t(obj, key, lc) {
  if (lc === 'ja' && obj[`${key}_ja`] !== undefined) return obj[`${key}_ja`];
  return obj[key] ?? '';
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function formatAuthors(authors = [], selfAuthors = []) {
  return authors.map((a) => (selfAuthors.includes(a) ? `<strong>${esc(a)}</strong>` : esc(a))).join(', ');
}

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const MONTH_NAMES = Object.keys(MONTHS);

/** "Oct 2025 – Present" → JA: "2025年10月 – 現在" */
function formatPeriod(period, lc) {
  if (lc !== 'ja') return period;
  return String(period)
    .replace(/([A-Z][a-z]{2}) (\d{4})/g, (_, m, y) => `${y}年${MONTHS[m]}月`)
    .replace(/Present/, '現在');
}

function formatYearMonth(item, lc) {
  if (!item.year) return '';
  if (!item.month) return String(item.year);
  return lc === 'ja' ? `${item.year}年${item.month}月` : `${MONTH_NAMES[item.month - 1]} ${item.year}`;
}

function parsePeriodStart(period) {
  const m = String(period ?? '').match(/([A-Z][a-z]{2}) (\d{4})/);
  return m ? { year: Number(m[2]), month: MONTHS[m[1]] } : { year: 0, month: 0 };
}

function isPresent(o) { return String(o.period ?? '').includes('Present'); }

/** 現在の所属（学歴 → 職歴の順） */
function currentAffiliations() {
  return [...education.filter(isPresent), ...experience.filter(isPresent)];
}

const sortValue = (w) => (w.year ?? 0) * 100 + (w.month ?? 0);
function sortDesc(items) { return [...items].sort((a, b) => sortValue(b) - sortValue(a)); }
function sortAsc(items) { return [...items].sort((a, b) => sortValue(a) - sortValue(b)); }

function pageUrl(lang) { return lang.dir ? `${SITE_URL}${lang.dir}/` : SITE_URL; }
function abs(rel) { return `${SITE_URL}${rel}`; }
/** 言語切替リンク（相対パス。サブパス配信でも壊れないよう絶対パスは使わない） */
function langHref(from, to) {
  if (to === from) return './';
  return to.dir ? `${from.base}${to.dir}/` : from.base || './';
}
function ensureTrailingSlash(u) { return u.endsWith('/') ? u : `${u}/`; }

function favicon() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='%236366f1'/><text x='32' y='42' text-anchor='middle' font-family='Georgia,serif' font-size='30' fill='white'>HF</text></svg>`;
  return `data:image/svg+xml,${svg.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23').replace(/"/g, "'")}`;
}

function normalizeDates(s) { return s.replace(/\d{4}-\d{2}-\d{2}/g, 'DATE'); }
function readIfExists(p) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
function readJson(name) { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8')); }

main();
