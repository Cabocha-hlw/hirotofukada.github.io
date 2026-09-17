#!/usr/bin/env node
// ============================================================
// サイトビルド（静的生成）
//   data/*.json ──► index.html（EN） / ja/index.html（JA） / sitemap.xml + sitemap-gsc.xml
// 仕様: docs/site_enhancement/DESIGN.md
//
//   node site/build.mjs            # 生成
//   node site/build.mjs --check    # 受け入れチェック + 生成物が最新かの検証（書き込みなし）
//
// 生成物（index.html / ja/index.html / sitemap.xml / sitemap-gsc.xml）は手で編集しない。
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
const topics = readJson('topics.json');
const networkSvg = fs.readFileSync(path.join(HERE, 'partials', 'network.svg'), 'utf8').trim();

const SITE_URL = ensureTrailingSlash(profile.url);
const BUILD_DATE = new Date().toISOString().slice(0, 10);
const PERSON_ID = `${ensureTrailingSlash(profile.url)}#person`;
const GA_ID = 'G-W12HECKQ45';

// 言語ごとの出力先。各ページからサイトルートへの相対パス（base）は
// 出力パスの深さから計算する（DESIGN_PHASE2.md §5.2）。
const LANGS = [
  { code: 'en', dir: '', ogLocale: 'en_US' },
  { code: 'ja', dir: 'ja', ogLocale: 'ja_JP' },
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
    breadcrumbLabel: 'Breadcrumb',
    home: 'Home',
    researchHub: 'Research Topics',
    researchHubEyebrow: 'Research',
    researchHubLead: 'Research themes that have a page of their own: what the work is, why it matters, how it is done, and where the results were published.',
    topicEyebrow: 'Research topic',
    relatedWorks: 'Related research outputs',
    sourcesHeading: 'Primary sources',
    relatedPages: 'Related pages',
    updated: 'Updated',
    keywordsLabel: 'Keywords',
    backToProfile: 'Back to the profile page',
    moreTopics: 'Read the research topics in depth',
    allTopics: 'All research topics',
    expertiseLink: 'Expertise',
    outputsCount: (n) => `${n} research ${n === 1 ? 'output' : 'outputs'}`,
    publications: 'Publications',
    publicationsEyebrow: 'Research outputs',
    publicationsLead: 'Papers, conference presentations, and upcoming talks, with links to the primary sources.',
    awards: 'Awards & Recognition',
    awardsEyebrow: 'Recognition',
    awardsLead: 'Awards and prizes received for research and professional work, with the awarding body and the work they recognise.',
    publicationEyebrow: 'Publication',
    summaryHeading: 'Summary',
    whyHeading: 'Why it matters',
    resultsHeading: 'Results',
    venueHeading: 'Where it was published',
    details: 'Details',
    allPublications: 'All publications',
    allAwards: 'Awards & recognition',
    relatedTopic: 'Research topic',
    awardLabel: 'Award',
    authorsLabel: 'Authors',
    venueLabel: 'Venue',
    yearLabel: 'Year',
    typeLabel: 'Type',
    publisherLabel: 'Publisher',
    statusLabel: 'Status',
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
    breadcrumbLabel: 'パンくずリスト',
    home: 'トップ',
    researchHub: '研究テーマ',
    researchHubEyebrow: '研究',
    researchHubLead: '固有のページを持つ研究テーマの一覧。何に取り組み、なぜ重要で、どう進め、どこで発表したかを記載する。',
    topicEyebrow: '研究テーマ',
    relatedWorks: '関連する研究成果',
    sourcesHeading: '一次ソース',
    relatedPages: '関連ページ',
    updated: '更新日',
    keywordsLabel: 'キーワード',
    backToProfile: 'プロフィールページに戻る',
    moreTopics: '研究テーマの詳細を読む',
    allTopics: '研究テーマ一覧',
    expertiseLink: '専門領域',
    outputsCount: (n) => `研究成果 ${n} 件`,
    publications: '研究業績',
    publicationsEyebrow: '論文・発表',
    publicationsLead: '論文・学会発表・発表予定の一覧。各項目から一次ソースへリンクする。',
    awards: '受賞',
    awardsEyebrow: '表彰',
    awardsLead: '研究・実務で受けた受賞の一覧。授与組織と対象業績を記載する。',
    publicationEyebrow: '研究業績',
    summaryHeading: '概要',
    whyHeading: 'なぜ重要か',
    resultsHeading: '結果',
    venueHeading: '発表先',
    details: '詳細',
    allPublications: '研究業績一覧',
    allAwards: '受賞一覧',
    relatedTopic: '研究テーマ',
    awardLabel: '受賞',
    authorsLabel: '著者',
    venueLabel: '発表先',
    yearLabel: '年',
    typeLabel: '種別',
    publisherLabel: '出版社',
    statusLabel: 'ステータス',
  },
};

// sitemap は同一内容を 2 つの URL に出す。sitemap-gsc.xml は Search Console 側の
// 「取得できませんでした」が URL 固有の問題かプロパティ側の問題かを切り分けるための
// 診断用コピー（docs/site_enhancement/DESIGN.md 参照）。中身は sitemap.xml と完全同一。
const SITEMAP_FILES = ['sitemap.xml', 'sitemap-gsc.xml'];

// ハブページの <title> / meta description（EN は 120〜160 文字。--check が検査する）
const HUB_SEO = {
  research: {
    title: 'Research Topics | Hiroto Fukada',
    title_ja: '研究テーマ | 深田大登（Hiroto Fukada）',
    description: 'Research topics of Hiroto Fukada (深田大登): supply chain visibility with large language models, knowledge graphs, and network science.',
    description_ja: '深田大登（Hiroto Fukada）の研究テーマ一覧。大規模言語モデル（LLM）によるサプライチェーンの可視化、ナレッジグラフ構築、ネットワーク科学。',
  },
  publications: {
    title: 'Publications | Hiroto Fukada',
    title_ja: '研究業績 | 深田大登（Hiroto Fukada）',
    description: 'Papers, conference presentations, and upcoming talks by Hiroto Fukada (深田大登), covering LLMs, supply chain analysis, and network science.',
    description_ja: '深田大登（Hiroto Fukada）の論文・学会発表・発表予定の一覧。LLM、サプライチェーン分析、ネットワーク科学、因果推論に関する研究業績。',
  },
  awards: {
    title: 'Awards & Recognition | Hiroto Fukada',
    title_ja: '受賞 | 深田大登（Hiroto Fukada）',
    description: 'Awards and prizes received by Hiroto Fukada (深田大登) for research on supply chains and networks, and for data science work in industry.',
    description_ja: '深田大登（Hiroto Fukada）の受賞一覧。ネットワーク生態学シンポジウム優秀ポスター賞、NRI マーケティング分析コンテスト特別賞、全社ソリューション＆テクノロジー賞など。',
  },
};

// ---------------------------------------------------------------- page registry
// 「ページ定義 × 言語」の直積が生成物になる。出力先・URL・相対パス・hreflang・
// sitemap・受け入れチェックはすべてこのレジストリから導出する。ページを増やすときは
// PAGE_DEFS に足し、renderMain() に種別の分岐を足す（DESIGN_PHASE2.md §5.1）。
//
//   key   : 一意なキー（チェックのエラーメッセージ用）
//   kind  : renderMain() の分岐先
//   seg   : サイトルートからのディレクトリ（末尾 '/'。トップは ''）
//   seo   : 省略時は profile.seo を使う
/** 個別ページを作れるだけの実体（本文 5 点 + 外部一次ソース）があるか。無ければページを作らない */
function hasDetail(w) {
  const d = w.detail;
  if (!w.slug || !d) return false;
  const filled = (arr) => Array.isArray(arr) && arr.length > 0;
  return Boolean(d.seo)
    && filled(d.summary) && filled(d.summary_ja)
    && filled(d.why) && filled(d.why_ja)
    && filled(d.results) && filled(d.results_ja)
    && (d.sources ?? []).some((src) => /^https?:\/\//.test(src.url ?? ''));
}

const publicationDetails = sortDesc(works.filter((w) => ['paper', 'research', 'upcoming'].includes(w.type) && hasDetail(w)));

/** 受賞一覧に載せる業績（社内表彰 + 受賞を伴う発表） */
function awardWorks() {
  return sortDesc(works.filter((w) => w.type === 'award' || w.kind === 'award'
    || /award|prize|賞/i.test(`${w.status ?? ''} ${w.status_ja ?? ''}`)));
}

const PAGE_DEFS = [
  { key: 'home', kind: 'profile', seg: '' },
  { key: 'research', kind: 'research-hub', seg: 'research/', seo: HUB_SEO.research },
  ...topics.map((topic) => ({
    key: `topic:${topic.id}`,
    kind: 'topic',
    seg: `research/${topic.id}/`,
    seo: topic.seo,
    lastmod: topic.updated,
    data: topic,
  })),
  { key: 'publications', kind: 'publications-hub', seg: 'publications/', seo: HUB_SEO.publications },
  ...publicationDetails.map((w) => ({
    key: `pub:${w.id}`,
    kind: 'publication',
    seg: `publications/${w.slug}/`,
    seo: w.detail.seo,
    lastmod: w.added,
    data: w,
  })),
  { key: 'awards', kind: 'awards', seg: 'awards/', seo: HUB_SEO.awards },
];

/** 業績の個別ページ（無ければ null） */
function detailPageOf(work, lang) {
  const def = PAGE_DEFS.find((d) => ['publication', 'work-detail'].includes(d.kind) && d.data?.id === work.id);
  return def ? makePage(def, lang) : null;
}

/** ページ定義キーから、その言語のページを得る（内部リンク・パンくずの解決に使う） */
function pageOf(key, lang) {
  const def = PAGE_DEFS.find((d) => d.key === key);
  if (!def) throw new Error(`pageOf: 未知のページキー "${key}"`);
  return makePage(def, lang);
}

/** ページ定義 × 言語。生成順は PAGE_DEFS の順 → LANGS の順 */
function pageInstances() {
  return PAGE_DEFS.flatMap((def) => LANGS.map((lang) => makePage(def, lang)));
}

function makePage(def, lang) {
  const dir = `${lang.dir ? `${lang.dir}/` : ''}${def.seg}`;
  return {
    def,
    lang,
    dir,                                   // サイトルートからの相対ディレクトリ（'' / 'ja/' / 'research/x/'）
    file: `${dir}index.html`,
    url: `${SITE_URL}${dir}`,
    base: '../'.repeat(depth(dir)),        // ページからサイトルートへの相対パス
    lastmod: def.lastmod ?? BUILD_DATE,
  };
}

/** 同一ページの全言語版 */
function siblings(page) {
  return LANGS.map((l) => makePage(page.def, l));
}

function depth(dir) {
  return dir ? dir.split('/').filter(Boolean).length : 0;
}

/** ページ間の相対リンク。サブパス配信でも独自ドメインでも壊れない */
function relHref(fromDir, toDir) {
  if (fromDir === toDir) return './';
  const from = fromDir.split('/').filter(Boolean);
  const to = toDir.split('/').filter(Boolean);
  let i = 0;
  while (i < from.length && i < to.length && from[i] === to[i]) i += 1;
  const down = to.slice(i).join('/');
  return `${'../'.repeat(from.length - i)}${down}${down ? '/' : ''}` || './';
}

/** その言語のトップページのディレクトリ */
function homeDir(lang) {
  return lang.dir ? `${lang.dir}/` : '';
}

/** hreflang="x-default" の宛先 = 同一ページの EN 版 */
function xDefaultUrl(page) {
  return siblings(page).find((s) => s.lang.code === 'en').url;
}

/** <title> / meta description。ページ定義が seo を持てばそれを、無ければプロフィールの既定値 */
function pageTitle(page) { return t(page.def.seo ?? profile.seo, 'title', page.lang.code); }
function pageDescription(page) { return t(page.def.seo ?? profile.seo, 'description', page.lang.code); }

// ---------------------------------------------------------------- main
// （ファイル末尾で main() を呼ぶ。ヘルパーの const 宣言より前に実行しないため）
function main() {
  const pages = pageInstances().map((page) => ({ ...page, html: renderPage(page) }));
  const sitemap = renderSitemap(pages);

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
  for (const name of SITEMAP_FILES) {
    fs.writeFileSync(path.join(ROOT, name), sitemap);
    console.log(`✓ ${name}`);
  }
}

// ================================================================ page
function renderPage(page) {
  const { lang } = page;
  const L = UI[lang.code];
  const lc = lang.code;
  const base = page.base;
  const url = page.url;
  const title = pageTitle(page);
  const description = pageDescription(page);
  const isJa = lc === 'ja';
  // トップページ以外では、ナビのアンカーは自言語トップページを指す
  const navBase = page.def.kind === 'profile' ? '' : relHref(page.dir, homeDir(lang));

  const alternates = siblings(page).map(
    (s) => `<link rel="alternate" hreflang="${s.lang.code}" href="${esc(s.url)}">`,
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
  <link rel="alternate" hreflang="x-default" href="${esc(xDefaultUrl(page))}">
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
${JSON.stringify(buildJsonLd(page, title, description), null, 2)}
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
        <a class="header-name" href="${relHref(page.dir, homeDir(lang))}">${esc(profile.name)}</a>
        <nav aria-label="${isJa ? 'メインナビゲーション' : 'Primary'}">
          ${['about', 'expertise', 'work', 'research', 'experience', 'education', 'profiles']
            .map((id) => `<a href="${navBase}#${id}">${esc(L.nav[id])}</a>`).join('\n          ')}
        </nav>
        <div class="lang-toggle" role="group" aria-label="${esc(L.langLabel)}">
          ${LANGS.map((l) => {
            const active = l === lang;
            return `<a class="lang-btn${active ? ' active' : ''}" href="${esc(langHref(page, l))}" hreflang="${l.code}" lang="${l.code}"${active ? ' aria-current="page"' : ''}>${l.code.toUpperCase()}</a>`;
          }).join('\n          ')}
        </div>
      </div>
    </div>
  </header>

  <main id="main">
${renderMain(page)}
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

// ---------------------------------------------------------------- main content
/** ページ種別ごとの <main> の中身。ページ種別を増やすときはここに分岐を足す */
function renderMain(page) {
  switch (page.def.kind) {
    case 'profile': return renderProfileMain(page);
    case 'research-hub': return renderResearchHubMain(page);
    case 'topic': return renderTopicMain(page);
    case 'publications-hub': return renderPublicationsHubMain(page);
    case 'publication': return renderPublicationMain(page);
    case 'awards': return renderAwardsMain(page);
    default: throw new Error(`renderMain: 未知のページ種別 "${page.def.kind}"`);
  }
}

function renderProfileMain(page) {
  const { lang } = page;
  return [
    renderHero(page),
    renderSection(lang, 'about', renderAbout(lang)),
    renderSection(lang, 'expertise', renderExpertise(page)),
    renderSection(lang, 'work', renderWork(page)),
    renderSection(lang, 'research', renderResearch(page)),
    renderSection(lang, 'experience', renderExperience(lang)),
    renderSection(lang, 'education', renderEducation(lang)),
    renderSection(lang, 'profiles', renderProfiles(lang)),
  ].join('\n');
}

// ---------------------------------------------------------------- sub pages
/** パンくずの経路。末尾が現在地（page: null）。JSON-LD の BreadcrumbList と共用する */
function trailOf(page) {
  const { lang } = page;
  const L = UI[lang.code];
  const home = { name: L.home, page: pageOf('home', lang) };
  switch (page.def.kind) {
    case 'research-hub':
      return [home, { name: L.researchHub, page: null }];
    case 'topic':
      return [home, { name: L.researchHub, page: pageOf('research', lang) }, { name: t(page.def.data, 'title', lang.code), page: null }];
    case 'publications-hub':
      return [home, { name: L.publications, page: null }];
    case 'publication':
      return [home, { name: L.publications, page: pageOf('publications', lang) }, { name: t(page.def.data, 'title', lang.code), page: null }];
    case 'awards':
      return [home, { name: L.awards, page: null }];
    default:
      return [];
  }
}

function renderBreadcrumb(page) {
  const L = UI[page.lang.code];
  const items = trailOf(page).map((crumb) => (crumb.page
    ? `          <li><a href="${relHref(page.dir, crumb.page.dir)}">${esc(crumb.name)}</a></li>`
    : `          <li aria-current="page">${esc(crumb.name)}</li>`)).join('\n');
  return `    <nav class="breadcrumb" aria-label="${esc(L.breadcrumbLabel)}">
      <div class="container">
        <ol>
${items}
        </ol>
      </div>
    </nav>`;
}

/** テーマに紐づく業績。存在しない id はビルドを失敗させる */
function relatedWorks(topic) {
  return topic.workIds.map((id) => {
    const w = works.find((x) => x.id === id);
    if (!w) throw new Error(`topics.json "${topic.id}": works.json に id "${id}" が無い`);
    return w;
  });
}

function renderResearchHubMain(page) {
  const { lang } = page;
  const lc = lang.code;
  const L = UI[lc];
  const cards = topics.map((topic) => {
    const tp = pageOf(`topic:${topic.id}`, lang);
    const meta = [L.outputsCount(topic.workIds.length), t(topic, 'keywords', lc).slice(0, 4).join(' · ')].join(' · ');
    return `            <li class="topic-card">
              <h2><a href="${relHref(page.dir, tp.dir)}">${esc(t(topic, 'title', lc))}</a></h2>
              <p>${esc(t(topic, 'lead', lc))}</p>
              <p class="work-meta">${esc(meta)}</p>
            </li>`;
  }).join('\n');

  return `${renderBreadcrumb(page)}
    <article class="page">
      <div class="container">
        <div class="page-inner fade-up">
          <header class="page-header">
            <span class="section-eyebrow">${esc(L.researchHubEyebrow)}</span>
            <h1>${esc(L.researchHub)}</h1>
            <p class="page-lead">${esc(L.researchHubLead)}</p>
          </header>
          <section class="topic-section" aria-label="${esc(L.researchHub)}">
            <ul class="topic-list">
${cards}
            </ul>
          </section>
          <p class="page-back"><a href="${relHref(page.dir, homeDir(lang))}">${esc(L.backToProfile)}</a></p>
        </div>
      </div>
    </article>
`;
}

function renderTopicMain(page) {
  const { lang } = page;
  const lc = lang.code;
  const L = UI[lc];
  const topic = page.def.data;
  const hub = pageOf('research', lang);
  const homeRel = relHref(page.dir, homeDir(lang));

  const body = topic.sections.map((sec) => `            <section class="page-block" id="${esc(sec.id)}">
              <h2>${esc(t(sec, 'heading', lc))}</h2>
${t(sec, 'body', lc).map((para) => `              <p>${esc(para)}</p>`).join('\n')}
            </section>`).join('\n');

  const outputs = relatedWorks(topic).map((w) => renderResearchItem(w, page, 'h3')).join('\n');

  const sources = topic.sources.map((src) => `                <li><a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${esc(t(src, 'label', lc))}</a></li>`).join('\n');

  const related = [
    { href: relHref(page.dir, hub.dir), label: L.allTopics },
    ...topic.expertiseId
      .map((id) => profile.expertise.find((e) => e.id === id))
      .filter(Boolean)
      .map((e) => ({ href: `${homeRel}#expertise-${e.id}`, label: `${L.expertiseLink}: ${t(e, 'name', lc)}` })),
  ].map((l) => `                <li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`).join('\n');

  const meta = `${L.updated} ${topic.updated} · ${L.keywordsLabel}: ${t(topic, 'keywords', lc).join(', ')}`;

  return `${renderBreadcrumb(page)}
    <article class="page">
      <div class="container">
        <div class="page-inner fade-up">
          <header class="page-header">
            <span class="section-eyebrow">${esc(L.topicEyebrow)}</span>
            <h1>${esc(t(topic, 'title', lc))}</h1>
            <p class="page-lead">${esc(t(topic, 'lead', lc))}</p>
            <p class="page-meta">${esc(meta)}</p>
          </header>
          <div class="page-body prose">
${body}
          </div>
          <section class="page-block">
            <h2>${esc(L.relatedWorks)}</h2>
            <ul class="work-list">
${outputs}
            </ul>
          </section>
          <section class="page-block">
            <h2>${esc(L.sourcesHeading)}</h2>
            <ul class="source-list">
${sources}
            </ul>
          </section>
          <section class="page-block">
            <h2>${esc(L.relatedPages)}</h2>
            <ul class="source-list">
${related}
            </ul>
          </section>
          <p class="page-back"><a href="${homeRel}">${esc(L.backToProfile)}</a></p>
        </div>
      </div>
    </article>
`;
}

function renderPublicationsHubMain(page) {
  const { lang } = page;
  const lc = lang.code;
  const L = UI[lc];
  const groups = [
    [L.cat.papers, sortDesc(works.filter((w) => w.type === 'paper'))],
    [L.cat.presentations, sortDesc(works.filter((w) => w.type === 'research'))],
    [L.cat.upcoming, sortAsc(works.filter((w) => w.type === 'upcoming'))],
  ].filter(([, items]) => items.length);

  const blocks = groups.map(([heading, items]) => `          <section class="page-block">
            <h2>${esc(heading)}</h2>
            <ul class="work-list">
${items.map((w) => renderResearchItem(w, page, 'h3')).join('\n')}
            </ul>
          </section>`).join('\n');

  return `${renderBreadcrumb(page)}
    <article class="page">
      <div class="container">
        <div class="page-inner fade-up">
          <header class="page-header">
            <span class="section-eyebrow">${esc(L.publicationsEyebrow)}</span>
            <h1>${esc(L.publications)}</h1>
            <p class="page-lead">${esc(L.publicationsLead)}</p>
          </header>
${blocks}
          <p class="page-back"><a href="${relHref(page.dir, homeDir(lang))}">${esc(L.backToProfile)}</a></p>
        </div>
      </div>
    </article>
`;
}

function renderPublicationMain(page) {
  const { lang } = page;
  const lc = lang.code;
  const L = UI[lc];
  const w = page.def.data;
  const homeRel = relHref(page.dir, homeDir(lang));

  const blocks = [
    [L.summaryHeading, t(w.detail, 'summary', lc)],
    [L.whyHeading, t(w.detail, 'why', lc)],
    [L.resultsHeading, t(w.detail, 'results', lc)],
  ].map(([heading, paras]) => `            <section class="page-block">
              <h2>${esc(heading)}</h2>
${paras.map((para) => `              <p>${esc(para)}</p>`).join('\n')}
            </section>`).join('\n');

  const facts = [
    [L.venueLabel, t(w, 'venue', lc)],
    [L.typeLabel, w.kind ? L.kind[w.kind] ?? '' : ''],
    [L.yearLabel, formatYearMonth(w, lc)],
    [L.publisherLabel, w.publisher ?? ''],
    [L.statusLabel, t(w, 'status', lc)],
  ].filter(([, v]) => v);

  const sources = [
    ...(w.detail.sources ?? []),
    ...(w.venueUrl ? [{ label: L.venuePage, label_ja: L.venuePage, url: w.venueUrl }] : []),
  ];
  const sourceList = sources.map((src) => `                <li><a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${esc(t(src, 'label', lc))}</a></li>`).join('\n');

  const related = [
    ...(w.topics ?? [])
      .map((id) => topics.find((topic) => topic.id === id))
      .filter(Boolean)
      .map((topic) => ({ href: relHref(page.dir, pageOf(`topic:${topic.id}`, lang).dir), label: `${L.relatedTopic}: ${t(topic, 'title', lc)}` })),
    { href: relHref(page.dir, pageOf('publications', lang).dir), label: L.allPublications },
  ].map((l) => `                <li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`).join('\n');

  return `${renderBreadcrumb(page)}
    <article class="page">
      <div class="container">
        <div class="page-inner fade-up">
          <header class="page-header">
            <span class="section-eyebrow">${esc(L.publicationEyebrow)}</span>
            <h1>${esc(t(w, 'title', lc))}</h1>
            <p class="page-lead work-citation">${formatAuthors(w.authors, w.selfAuthors)} (${esc(w.year)}). <em>${esc(t(w, 'venue', lc))}</em>.</p>
          </header>
          <div class="page-body prose">
${blocks}
          </div>
          <section class="page-block">
            <h2>${esc(L.venueHeading)}</h2>
            <dl class="project-facts">
${facts.map(([k, v]) => `              <div class="fact"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('\n')}
            </dl>
          </section>
          <section class="page-block">
            <h2>${esc(L.sourcesHeading)}</h2>
            <ul class="source-list">
${sourceList}
            </ul>
          </section>
          <section class="page-block">
            <h2>${esc(L.relatedPages)}</h2>
            <ul class="source-list">
${related}
            </ul>
          </section>
          <p class="page-back"><a href="${homeRel}">${esc(L.backToProfile)}</a></p>
        </div>
      </div>
    </article>
`;
}

function renderAwardsMain(page) {
  const { lang } = page;
  const lc = lang.code;
  const L = UI[lc];
  const items = awardWorks().map((w) => {
    const award = t(w, 'status', lc) || L.awardLabel;
    // 「… 2021 · 2021」のような重複を避ける（venue に年が入っている場合は年を省く）
    const where = t(w, 'organization', lc) || t(w, 'venue', lc);
    const when = where.includes(String(w.year)) ? '' : formatYearMonth(w, lc);
    const meta = [where, when].filter(Boolean).join(' · ');
    const description = t(w, 'description', lc);
    const authors = (w.authors ?? []).length ? `<p class="work-citation">${formatAuthors(w.authors, w.selfAuthors)}</p>` : '';
    return `                <li>
                  <article class="work-item award-item">
                    <h3 class="work-title">${esc(t(w, 'title', lc))}</h3>
                    <p class="work-meta"><span class="award-badge">${esc(award)}</span> ${esc(meta)}</p>
                    ${authors}${description ? `\n                    <p class="work-description">${esc(description)}</p>` : ''}
${renderLinks(w.links, lc, 20)}
                  </article>
                </li>`;
  }).join('\n');

  return `${renderBreadcrumb(page)}
    <article class="page">
      <div class="container">
        <div class="page-inner fade-up">
          <header class="page-header">
            <span class="section-eyebrow">${esc(L.awardsEyebrow)}</span>
            <h1>${esc(L.awards)}</h1>
            <p class="page-lead">${esc(L.awardsLead)}</p>
          </header>
          <section class="page-block" aria-label="${esc(L.awards)}">
            <ul class="work-list">
${items}
            </ul>
          </section>
          <p class="page-back"><a href="${relHref(page.dir, homeDir(lang))}">${esc(L.backToProfile)}</a></p>
        </div>
      </div>
    </article>
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

function renderHero(page) {
  const { lang } = page;
  const L = UI[lang.code];
  const lc = lang.code;
  const isJa = lc === 'ja';
  const base = page.base;
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

function renderExpertise(page) {
  const { lang } = page;
  const lc = lang.code;
  const L = UI[lc];
  const hub = pageOf('research', lang);
  return `            <ul class="expertise-list">
${profile.expertise.map((e) => `              <li class="expertise-item" id="expertise-${esc(e.id)}">
                <h3>${esc(t(e, 'name', lc))}</h3>
                <p>${esc(t(e, 'description', lc))}</p>
              </li>`).join('\n')}
            </ul>
            <p class="section-more"><a href="${relHref(page.dir, hub.dir)}">${esc(L.moreTopics)}<span aria-hidden="true"> →</span></a></p>`;
}

function renderWork(page) {
  const { lang } = page;
  const L = UI[lang.code];
  const projects = sortDesc(works.filter((w) => w.type === 'professional'));
  const awards = sortDesc(works.filter((w) => w.type === 'award'));
  const more = pageOf('awards', lang);
  return [
    category(L.cat.projects, projects.map((w) => renderProject(w, page))),
    awards.length ? category(L.cat.recognition, awards.map((w) => renderAward(w, page))) : '',
    `            <p class="section-more"><a href="${relHref(page.dir, more.dir)}">${esc(L.allAwards)}<span aria-hidden="true"> →</span></a></p>`,
  ].filter(Boolean).join('\n');
}

function renderResearch(page) {
  const { lang } = page;
  const L = UI[lang.code];
  const papers = sortDesc(works.filter((w) => w.type === 'paper'));
  const research = sortDesc(works.filter((w) => w.type === 'research'));
  const upcoming = sortAsc(works.filter((w) => w.type === 'upcoming'));
  const more = pageOf('publications', lang);
  return [
    papers.length ? category(L.cat.papers, papers.map((w) => renderResearchItem(w, page))) : '',
    research.length ? category(L.cat.presentations, research.map((w) => renderResearchItem(w, page))) : '',
    upcoming.length ? category(L.cat.upcoming, upcoming.map((w) => renderResearchItem(w, page))) : '',
    `            <p class="section-more"><a href="${relHref(page.dir, more.dir)}">${esc(L.allPublications)}<span aria-hidden="true"> →</span></a></p>`,
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

function renderResearchItem(item, page, heading = 'h4') {
  const { lang } = page;
  const L = UI[lang.code];
  const lc = lang.code;
  const detail = page.def.kind === 'publication' ? null : detailPageOf(item, lang);
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
                    <${heading} class="work-title">${esc(t(item, 'title', lc))}</${heading}>
                    <p class="work-citation">${formatAuthors(item.authors, item.selfAuthors)} (${esc(item.year)}). <em>${esc(t(item, 'venue', lc))}</em>.</p>
                    <p class="work-meta">${metaParts.map(esc).join(' · ')}</p>
${renderLinks(links, lc, 20)}${detail ? `\n                    <p class="work-more"><a href="${relHref(page.dir, detail.dir)}">${esc(L.details)}<span aria-hidden="true"> →</span></a></p>` : ''}
                  </article>
                </li>`;
}

function renderProject(item, page) {
  const { lang } = page;
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

function renderAward(item, page) {
  const lc = page.lang.code;
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
/** ページ種別ごとの JSON-LD。Person の @id は全ページで共通（DESIGN_PHASE2.md §5.3） */
function buildJsonLd(page, title, description) {
  switch (page.def.kind) {
    case 'profile': return buildProfileJsonLd(page, title, description);
    case 'research-hub':
    case 'publications-hub':
    case 'awards':
      return buildHubJsonLd(page, title, description);
    case 'publication': return buildPublicationJsonLd(page, title, description);
    case 'topic': return buildTopicJsonLd(page, title, description);
    default: throw new Error(`buildJsonLd: 未知のページ種別 "${page.def.kind}"`);
  }
}

/** サブページに載せる最小 Person ノード（トップページの完全な Person と同じ @id を指す） */
function personRefNode() {
  return {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: profile.name,
    alternateName: profile.alternateNames,
    url: SITE_URL,
    sameAs: profile.profiles.filter((pr) => pr.sameAs).map((pr) => pr.url),
  };
}

/** パンくずの JSON-LD。trail は renderBreadcrumb と同じものを使う */
function breadcrumbNode(page, trail) {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${page.url}#breadcrumb`,
    itemListElement: trail.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      ...(crumb.page ? { item: crumb.page.url } : {}),
    })),
  };
}

function webSiteNode() {
  return { '@type': 'WebSite', '@id': `${SITE_URL}#website`, url: SITE_URL, name: profile.name };
}

function buildProfileJsonLd(page, title, description) {
  const { lang, url } = page;
  const lc = lang.code;
  const personId = PERSON_ID;
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

  const articles = sortDesc(works.filter((w) => w.type === 'paper')).map(workNode);

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

/** 業績 1 件の JSON-LD。@id は DOI > arXiv > 学会ページ の優先順で固定し、全ページで同じ値を使う */
function workNode(w) {
  const arxivUrl = w.arxiv ? `https://arxiv.org/abs/${w.arxiv}` : undefined;
  // 学会ページは「発表そのもの」の URL ではないため、論文以外では @id に昇格させない
  const primaryUrl = w.doi ? `https://doi.org/${w.doi}` : arxivUrl ?? (w.type === 'paper' ? w.venueUrl : undefined);
  return {
    '@type': w.type === 'paper' ? 'ScholarlyArticle' : 'CreativeWork',
    ...(primaryUrl ? { '@id': primaryUrl, url: primaryUrl } : {}),
    headline: w.title,
    name: w.title,
    author: (w.authors ?? []).length
      ? w.authors.map((a) => (w.selfAuthors?.includes(a) ? { '@id': PERSON_ID } : { '@type': 'Person', name: a }))
      : { '@id': PERSON_ID },
    datePublished: String(w.year),
    ...(arxivUrl ? { sameAs: [arxivUrl] } : {}),
    ...(w.publisher ? { publisher: { '@type': 'Organization', name: w.publisher } } : {}),
    ...(w.venue ? { publication: { '@type': 'PublicationEvent', name: w.venue, ...(w.venueUrl ? { url: w.venueUrl } : {}) } } : {}),
    ...(w.organization ? { sourceOrganization: { '@type': 'Organization', name: w.organization } } : {}),
  };
}

function buildHubJsonLd(page, title, description) {
  const { lang, url } = page;
  const lc = lang.code;
  const hasPart = page.def.kind === 'research-hub'
    ? topics.map((topic) => {
        const tp = pageOf(`topic:${topic.id}`, lang);
        return { '@type': 'WebPage', '@id': `${tp.url}#webpage`, url: tp.url, name: t(topic, 'title', lc) };
      })
    : page.def.kind === 'publications-hub'
      ? sortDesc(works.filter((w) => ['paper', 'research', 'upcoming'].includes(w.type))).map(workNode)
      : awardWorks().map((w) => ({ ...workNode(w), ...(t(w, 'status', lc) ? { award: t(w, 'status', lc) } : {}) }));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#webpage`,
        url,
        name: title,
        description,
        inLanguage: lc,
        dateModified: page.lastmod,
        isPartOf: webSiteNode(),
        about: { '@id': PERSON_ID },
        author: { '@id': PERSON_ID },
        breadcrumb: { '@id': `${url}#breadcrumb` },
        ...(hasPart.length ? { hasPart } : {}),
      },
      personRefNode(),
      breadcrumbNode(page, trailOf(page)),
    ],
  };
}

function buildPublicationJsonLd(page, title, description) {
  const { lang, url } = page;
  const lc = lang.code;
  const w = page.def.data;
  const article = {
    ...workNode(w),
    abstract: (w.detail.summary ?? [])[0],
    inLanguage: 'en',
    ...(w.topics?.length ? { about: w.topics.map((id) => {
      const topic = topics.find((x) => x.id === id);
      return topic ? { '@type': 'DefinedTerm', name: t(topic, 'title', lc) } : null;
    }).filter(Boolean) } : {}),
  };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: title,
        description,
        inLanguage: lc,
        dateModified: page.lastmod,
        isPartOf: webSiteNode(),
        author: { '@id': PERSON_ID },
        breadcrumb: { '@id': `${url}#breadcrumb` },
        mainEntity: article,
      },
      personRefNode(),
      breadcrumbNode(page, trailOf(page)),
    ],
  };
}

function buildTopicJsonLd(page, title, description) {
  const { lang, url } = page;
  const lc = lang.code;
  const topic = page.def.data;
  const related = relatedWorks(topic).map(workNode);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: title,
        description,
        inLanguage: lc,
        dateModified: topic.updated,
        isPartOf: webSiteNode(),
        about: {
          '@type': 'DefinedTerm',
          name: t(topic, 'title', lc),
          description: t(topic, 'lead', lc),
        },
        keywords: t(topic, 'keywords', lc).join(', '),
        author: { '@id': PERSON_ID },
        creator: { '@id': PERSON_ID },
        mentions: { '@id': PERSON_ID },
        breadcrumb: { '@id': `${url}#breadcrumb` },
        ...(related.length ? { hasPart: related } : {}),
      },
      personRefNode(),
      breadcrumbNode(page, trailOf(page)),
    ],
  };
}

// ---------------------------------------------------------------- sitemap
function renderSitemap(pages) {
  const urls = pages.filter((p) => p.def.sitemap !== false).map((page) => {
    const links = siblings(page).map((s) => `    <xhtml:link rel="alternate" hreflang="${s.lang.code}" href="${esc(s.url)}"/>`).join('\n');
    return `  <url>
    <loc>${esc(page.url)}</loc>
    <lastmod>${page.lastmod}</lastmod>
${links}
    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(xDefaultUrl(page))}"/>
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
    const { html, file, lang, def } = p;
    const tag = `[${file}]`;
    const isProfile = def.kind === 'profile';  // トップページ固有の検査

    // FR-01: H1 は 1 つ、Hiroto Fukada を含む。深田大登 が本文に存在する
    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
    if (h1s.length !== 1) fails.push(`${tag} h1 が ${h1s.length} 個（1 個であること）`);
    else if (isProfile && !h1s[0][1].replace(/<[^>]+>/g, '').includes('Hiroto Fukada')) fails.push(`${tag} h1 に "Hiroto Fukada" がない`);
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
    if (!html.includes(`<link rel="canonical" href="${p.url}">`)) fails.push(`${tag} canonical が不正`);
    for (const l of LANGS) if (!html.includes(`hreflang="${l.code}"`)) fails.push(`${tag} hreflang=${l.code} がない`);
    if (!html.includes('hreflang="x-default"')) fails.push(`${tag} hreflang=x-default がない`);

    // FR-03: JSON-LD ProfilePage / Person
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    if (ld.length === 0) fails.push(`${tag} JSON-LD がない`);
    for (const block of (isProfile ? ld : [])) {
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

    if (!isProfile) {
      // サブページ: BreadcrumbList / Person の @id / WebPage.url（検査 21）
      for (const block of ld) {
        let data;
        try { data = JSON.parse(block); } catch (e) { fails.push(`${tag} JSON-LD がパースできない: ${e.message}`); continue; }
        const graph = data['@graph'] ?? [data];
        if (!graph.some((n) => n['@type'] === 'BreadcrumbList')) fails.push(`${tag} JSON-LD に BreadcrumbList がない`);
        const person = graph.find((n) => n['@type'] === 'Person');
        if (!person) fails.push(`${tag} JSON-LD に Person ノードがない`);
        else if (person['@id'] !== PERSON_ID) fails.push(`${tag} Person.@id がトップページと一致しない: ${person['@id']}`);
        const web = graph.find((n) => n['@type'] === 'WebPage' || n['@type'] === 'CollectionPage');
        if (!web) fails.push(`${tag} JSON-LD に WebPage / CollectionPage がない`);
        else if (web.url !== p.url) fails.push(`${tag} WebPage.url がページ URL と一致しない: ${web.url}`);
      }
      // 検査 15: H1 はページ固有（サイト名・人物名そのものにしない）
      const h1Text = (h1s[0]?.[1] ?? '').replace(/<[^>]+>/g, '').trim();
      if (h1Text === profile.name || h1Text === profile.name_ja) fails.push(`${tag} h1 が人物名そのものになっている`);
      // 検査 23: 人物名が本文に自然な形で現れる
      const needle = lang.code === 'ja' ? '深田大登' : 'Hiroto Fukada';
      if (!text(html).includes(needle)) fails.push(`${tag} 本文に "${needle}" がない`);
    }

    // SEO-04: semantic HTML
    for (const el of ['main', 'nav', 'footer', 'section', 'article', 'header']) {
      if (!new RegExp(`<${el}[\\s>]`).test(html)) fails.push(`${tag} <${el}> がない`);
    }
    // SEO-05: H2 の順序
    if (isProfile) {
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
    }

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
    for (const rel of [`${p.base}style.css`, `${p.base}script.js`, `${p.base}${profile.photo.src}`, ...(profile.photo.webp ? [`${p.base}${profile.photo.webp}`] : [])]) {
      if (!fs.existsSync(path.join(ROOT, p.dir, rel))) fails.push(`${tag} 参照ファイルが存在しない: ${rel}`);
    }

    // 生成物が最新か（日付のみ差異を許容）
    const onDisk = readIfExists(path.join(ROOT, file));
    if (onDisk == null) fails.push(`${tag} 生成物が存在しない（npm run build を実行）`);
    else if (normalizeDates(onDisk) !== normalizeDates(html)) fails.push(`${tag} 生成物が data/・site/ と一致しない（npm run build を実行してコミット）`);
  }

  // 検査 16: <title> は言語ごとにページ固有
  const seenTitles = new Map();
  for (const p of pagesToCheck) {
    const title = p.html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    const key = `${p.lang.code}::${title}`;
    if (seenTitles.has(key)) fails.push(`<title> が重複している: ${p.file} と ${seenTitles.get(key)}`);
    else seenTitles.set(key, p.file);
  }

  // 検査 18/19: 内部リンクがすべて解決でき、全ページがトップページから到達できる
  const byFile = new Map(pagesToCheck.map((p) => [p.file, p]));
  const linkGraph = new Map();
  for (const p of pagesToCheck) {
    const targets = new Set();
    for (const m of p.html.matchAll(/href="([^"]+)"/g)) {
      const href = m[1];
      if (/^(https?:|mailto:|data:|#|\/\/)/.test(href)) continue;
      const target = resolveHref(p.dir, href);
      if (!target) continue;
      if (byFile.has(target) || fs.existsSync(path.join(ROOT, target))) targets.add(target);
      else fails.push(`[${p.file}] 内部リンクの参照先が存在しない: ${href} → ${target}`);
    }
    linkGraph.set(p.file, targets);
  }
  const reached = new Set();
  const queue = pagesToCheck.filter((p) => p.def.kind === 'profile').map((p) => p.file);
  while (queue.length) {
    const file = queue.shift();
    if (reached.has(file)) continue;
    reached.add(file);
    for (const next of linkGraph.get(file) ?? []) if (byFile.has(next) && !reached.has(next)) queue.push(next);
  }
  for (const p of pagesToCheck) {
    if (!reached.has(p.file)) fails.push(`${p.file} がトップページからリンクで到達できない（孤立ページ）`);
  }

  // 検査 11〜14 / 22: 研究テーマの中身（薄いページを作らないための機械的な下限）
  const MIN_TOPIC_WORDS = 400;
  const MIN_TOPIC_CHARS = 800;
  const seenTopicIds = new Set();
  for (const topic of topics) {
    const id = topic.id;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) fails.push(`topics "${id}": id が不正（英小文字・数字・ハイフンのみ）`);
    if (seenTopicIds.has(id)) fails.push(`topics "${id}": id が重複している`);
    seenTopicIds.add(id);
    for (const key of ['what', 'why', 'approach', 'results']) {
      if (!topic.sections.some((sec) => sec.id === key)) fails.push(`topics "${id}": 必須セクション "${key}" が無い`);
    }
    for (const sec of topic.sections) {
      if (!(sec.body ?? []).length || !(sec.body_ja ?? []).length) fails.push(`topics "${id}": セクション "${sec.id}" の EN/JA 本文が揃っていない`);
    }
    const enWords = topic.sections.flatMap((sec) => sec.body ?? []).join(' ').split(/\s+/).filter(Boolean).length;
    const jaChars = topic.sections.flatMap((sec) => sec.body_ja ?? []).join('').replace(/\s+/g, '').length;
    if (enWords < MIN_TOPIC_WORDS) fails.push(`topics "${id}": EN 本文が ${enWords} 語（${MIN_TOPIC_WORDS} 語以上であること）`);
    if (jaChars < MIN_TOPIC_CHARS) fails.push(`topics "${id}": JA 本文が ${jaChars} 文字（${MIN_TOPIC_CHARS} 文字以上であること）`);
    if (!(topic.sources ?? []).some((src) => /^https?:\/\//.test(src.url ?? ''))) fails.push(`topics "${id}": 外部の一次ソースが 1 本も無い`);
    if (!(topic.workIds ?? []).length) fails.push(`topics "${id}": 関連する研究成果が無い`);
  }

  // 検査 11〜13 / 22: 個別ページを持つ業績の中身
  const MIN_DETAIL_WORDS = 200;
  const MIN_DETAIL_CHARS = 400;
  const seenSlugs = new Set();
  for (const w of works.filter((x) => x.slug || x.detail)) {
    if (!hasDetail(w)) {
      fails.push(`works "${w.id}": slug / detail が不完全なため個別ページが生成されない（本文 5 点と外部一次ソースが必要）`);
      continue;
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(w.slug)) fails.push(`works "${w.id}": slug が不正（英小文字・数字・ハイフンのみ）`);
    if (seenSlugs.has(w.slug)) fails.push(`works "${w.id}": slug "${w.slug}" が重複している`);
    seenSlugs.add(w.slug);
    const enWords = [...w.detail.summary, ...w.detail.why, ...w.detail.results].join(' ').split(/\s+/).filter(Boolean).length;
    const jaChars = [...w.detail.summary_ja, ...w.detail.why_ja, ...w.detail.results_ja].join('').replace(/\s+/g, '').length;
    if (enWords < MIN_DETAIL_WORDS) fails.push(`works "${w.id}": EN 本文が ${enWords} 語（${MIN_DETAIL_WORDS} 語以上であること）`);
    if (jaChars < MIN_DETAIL_CHARS) fails.push(`works "${w.id}": JA 本文が ${jaChars} 文字（${MIN_DETAIL_CHARS} 文字以上であること）`);
    for (const id of w.topics ?? []) {
      if (!topics.some((topic) => topic.id === id)) fails.push(`works "${w.id}": topics "${id}" が topics.json に無い`);
    }
  }

  // SEO-06/07: sitemap / robots
  for (const p of pagesToCheck) {
    if (p.def.sitemap === false) continue;
    if (!sitemapXml.includes(`<loc>${p.url}</loc>`)) fails.push(`sitemap に ${p.url} がない`);
  }
  const locCount = (sitemapXml.match(/<loc>/g) ?? []).length;
  const expectedLocs = pagesToCheck.filter((p) => p.def.sitemap !== false).length;
  if (locCount !== expectedLocs) fails.push(`sitemap の URL 数 ${locCount}（生成ページ数 ${expectedLocs} と一致すること）`);
  for (const name of SITEMAP_FILES) {
    const onDisk = readIfExists(path.join(ROOT, name));
    if (onDisk == null) fails.push(`${name} が存在しない`);
    else if (normalizeDates(onDisk) !== normalizeDates(sitemapXml)) fails.push(`${name} が最新でない（npm run build を実行）`);
  }
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

function abs(rel) { return `${SITE_URL}${rel}`; }
/** 言語切替リンク = 同一ページの他言語版（相対パス。絶対パスは使わない） */
function langHref(page, to) {
  if (to === page.lang) return './';
  return relHref(page.dir, makePage(page.def, to).dir);
}
function ensureTrailingSlash(u) { return u.endsWith('/') ? u : `${u}/`; }

/** HTML 内の相対リンクを、サイトルートからのファイルパスに解決する（ディレクトリは index.html） */
function resolveHref(fromDir, href) {
  const pathPart = href.split('#')[0].split('?')[0];
  if (!pathPart) return null;
  let resolved = path.posix.normalize(path.posix.join(fromDir, pathPart));
  if (resolved === '.' || resolved === './') resolved = '';
  if (pathPart.endsWith('/') || resolved === '') {
    resolved = `${resolved && !resolved.endsWith('/') ? `${resolved}/` : resolved}index.html`;
  }
  return resolved;
}

function favicon() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='%236366f1'/><text x='32' y='42' text-anchor='middle' font-family='Georgia,serif' font-size='30' fill='white'>HF</text></svg>`;
  return `data:image/svg+xml,${svg.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23').replace(/"/g, "'")}`;
}

function normalizeDates(s) { return s.replace(/\d{4}-\d{2}-\d{2}/g, 'DATE'); }
function readIfExists(p) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
function readJson(name) { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8')); }

main();
