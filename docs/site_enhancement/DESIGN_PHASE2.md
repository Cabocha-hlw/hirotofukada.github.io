# Phase 2 — コンテンツページ拡張（固有 URL を持つ研究・業績ページ）設計書

- Status: v0.6（2026-09-17）Phase 2a / 2b / 2c / 2c' + CP-07 実装済み（16 URL）。実装ブランチ `feature/phase2-content-pages`
- 対象: `hirotofukada.github.io`（GitHub Pages・公開リポジトリ）
- 前提: `docs/site_enhancement/DESIGN.md`（Phase 1 = Canonical Personal Hub 化）を読んでいること。
  本書は Phase 1 の §7 トレーサビリティ表で `P2 … 個別ページ ⬜` として積み残した項目を、
  実装可能な要件に落とす。用語・データモデル・検証方針は Phase 1 を継承し、差分のみ記述する。
- 実装前に本書を更新し、実装後に「状態」列を更新すること（Phase 1 §12 の変更管理を継承）。

---

## 0. 確定した判断（2026-09-17）

| 論点 | 決定 |
|------|------|
| 最初のテーマ | **`supply-chain-llm` 単独**で開始する。`causal-inference` は品質基準が固まってから（Phase 2d） |
| 実務案件（DCR/MMM・XYhai） | **個別ページを作る。** トップページは簡易記載（題目 + 要約）に留め、詳細は業績ページ側に置く（§6.3 の重複回避と一致） |
| `/awards/` の粒度 | **一覧 1 ページで十分。** 受賞の個別ページは作らない |
| 独自ドメイン | 取得方法を §10-6 に追記。取得は**個別ページを増やす前**が望ましいが、`profile.url` 追従設計により後からでも実装は壊れない。実施時期はユーザー判断 |

---

## 1. 背景と目的

### 1.1 現状の限界

Phase 1 でサイトは「1 ページの履歴書」として完成したが、**固有 URL を持つページが `/` と `/ja/` の
2 つしかない**。検索エンジンから見た本サイトは次の状態にある。

| 観点 | 現状 | 帰結 |
|------|------|------|
| インデックス対象 URL 数 | 2 | サイト全体の情報量が小さく、クエリとの適合面が 2 つしかない |
| クエリ適合 | 1 ページが「人物 + 7 専門領域 + 11 業績」を同時に主張 | 個々のトピック（例: `snippet-driven supply chain LLM`）に対して専用の適合ページが無い |
| 被リンク先 | 常に `/` または `/ja/` | ORCID・arXiv・GitHub から張れるリンクが 1 点に集中し、トピック単位の権威が育たない |
| 更新シグナル | 業績追加は既存 2 ページの差分 | 「新規ページの追加」という更新シグナルが発生しない |

### 1.2 目的

**実績・研究テーマごとに固有 URL を持つ実体ページを作り、人物エンティティ（Person）と
研究トピック・研究成果を構造的に結びつける。** 非目標は Phase 1 §11 と同じ（順位保証・
AI Overview 表示保証は対象外）。

### 1.3 最上位の制約 — 薄いページを作らない

SEO 目的だけの薄いページを量産しない。これは方針ではなく**ビルドで強制する制約**とする（§7）。

- 各ページは「**何をやったか / なぜ重要か / 結果 / 発表先 / 外部一次ソース**」の 5 点を持つ。
- 本文の実体（語数・文字数）と**外部一次ソースへのリンク 1 本以上**を `--check` が検査し、
  満たさないページは**生成されない**（データが揃うまでトップページの一覧項目のままにする）。
- EN / JA を必ず対で用意する（片方だけのページは作らない）。
- トップページ本文のコピーを個別ページに貼らない（§6.3 の重複回避ルール）。

---

## 2. スコープ

### 2.1 Phase 2 で作るページ

| URL（EN / JA） | 種別 | 内容 | 件数 |
|---|---|---|---|
| `/research/` · `/ja/research/` | ハブ | 研究テーマ一覧（各テーマ 2〜3 文の要約 + 関連業績数） | 1 |
| `/research/supply-chain-llm/` · `/ja/research/supply-chain-llm/` | テーマ | LLM によるサプライチェーン可視化（Supply Chain OSINT Agent） | 1 |
| `/research/causal-inference/` · `/ja/research/causal-inference/` | テーマ | 因果推論によるマーケティング効果測定（DML / HTE / MMM） | 1 |
| `/publications/` · `/ja/publications/` | ハブ | 論文・発表の一覧（年降順・種別ラベル付き） | 1 |
| `/publications/<slug>/` · `/ja/publications/<slug>/` | 業績詳細 | 論文・発表 1 件の詳細（§4.3 の構成） | 1〜4 |
| `/work/<slug>/` · `/ja/work/<slug>/` | 実務案件詳細 | 公開済み一次ソースを持つ実務案件の詳細（§4.5） | 2 |
| `/awards/` · `/ja/awards/` | 一覧 | 受賞・表彰の一覧（個別ページは作らない） | 1 |

合計: 生成 URL 数 **2 → 最大 24**（EN/JA 各 12）。Phase 2 の最小構成（必須）は
`/research/`・`/research/supply-chain-llm/`・`/publications/`・`/publications/snippet-driven-supply-chain/`・
`/awards/` の 5 系統 = 10 URL。

### 2.2 Phase 2 で作らないもの

- 受賞の個別ページ（1 件あたりの一次情報が少なく §1.3 を満たさない。`/awards/` 一覧に集約）
- ブログ / 記事投稿機能・RSS（Phase 3 候補）
- `/experience/`・`/education/` の個別ページ（トップの情報で足り、重複になる）
- 専門領域 7 件すべてのテーマページ（実績と一次ソースが揃うものだけを作る。§3.1）
- 独自ドメイン移行（Phase 1 §10-2 のまま保留。移行しても本設計は `profile.url` 追従で壊れない）

---

## 3. データモデル

単一情報源は引き続き `data/*.json`。**追加のみ**で後方互換を保ち、`resume/build.mjs`
（`works.json` の `paper` / `research` を読む）に影響を与えない。

### 3.1 `data/topics.json`（新設）— 研究テーマ

テーマページの本文はここに置く。**配列に存在するテーマだけがページになる。**
`expertise[]` の部分集合として `expertiseId` で紐づけるが、1:1 にはしない。

```jsonc
[
  {
    "id": "supply-chain-llm",          // = URL スラッグ（不変。§6.2）
    "expertiseId": ["llm", "supply-chain", "network-science"],
    "title": "Supply Chain Visibility with Large Language Models",
    "title_ja": "大規模言語モデルによるサプライチェーンの可視化",
    "seo": { "title": "…", "description": "…", "description_ja": "…" },  // 未指定ならタイトルから生成
    "lead": "…",                        // 1〜2 文。ハブとトップページの要約に使う（本文とは別文）
    "lead_ja": "…",
    "sections": [                       // 本文。順序 = 表示順。§4.2 の 5 点に対応
      { "id": "what",      "heading": "What I did",        "heading_ja": "取り組み",   "body": ["…"], "body_ja": ["…"] },
      { "id": "why",       "heading": "Why it matters",    "heading_ja": "なぜ重要か", "body": ["…"], "body_ja": ["…"] },
      { "id": "approach",  "heading": "Approach",          "heading_ja": "アプローチ", "body": ["…"], "body_ja": ["…"] },
      { "id": "results",   "heading": "Results",           "heading_ja": "結果",       "body": ["…"], "body_ja": ["…"] }
    ],
    "workIds": ["cifer2026", "jsai2026", "netsci2026", "cssj2026", "neteco2026"],  // works.json の id
    "sources": [                        // 外部一次ソース（1 本以上必須）
      { "label": "arXiv:2605.27845", "url": "https://arxiv.org/abs/2605.27845", "primary": true }
    ],
    "keywords": ["supply chain", "large language models", "OSINT", "network science", "China"],
    "updated": "2026-09-17"
  }
]
```

### 3.2 `data/works.json`（追加フィールド）

```jsonc
{
  "id": "cifer2026",
  "slug": "snippet-driven-supply-chain",   // 個別ページのスラッグ（不変）。無ければページを作らない
  "topics": ["supply-chain-llm"],          // topics.json の id。相互リンクに使う
  "detail": {                              // これが無い業績は一覧にのみ載る（= 薄いページを作らない）
    "summary":   ["…"], "summary_ja":   ["…"],   // 何をやったか（2〜4 段落）
    "why":       ["…"], "why_ja":       ["…"],   // なぜ重要か
    "results":   ["…"], "results_ja":   ["…"],   // 結果
    "sources":   [ { "label": "IEEE Xplore", "url": "…", "primary": true } ]  // 一次ソース 1 本以上
  }
}
```

- `venue` / `venueUrl` / `publisher` / `arxiv` / `doi` / `authors` は既存フィールドをそのまま「発表先」
  として個別ページに出す（新規フィールド不要）。
- `type: "professional"`（実務案件）に `detail` を付ける場合、**公開済みの一次ソース
  （プレスリリース・公開記事）を持つものに限る**。非公開の職務詳細は Phase 1 §3-6 のとおり
  `docs/resume_design/`（gitignore）にのみ置き、`data/` には入れない。

### 3.3 `data/profile.json`（追加）

```jsonc
"seo": { "…既存…", "sectionDescriptions": { "research": "…", "publications": "…", "awards": "…" } }
```
ハブページの `meta description` を持たせる。未指定時はビルドが定型文から生成する。

---

## 4. ページ構成

### 4.1 共通レイアウト（全サブページ）

Phase 1 のトップページと同じヘッダー・フッター・`style.css` を再利用し、以下を追加する。

```
header（サイト名 → トップへ / 言語トグル → 対応する他言語ページ）
main
  nav.breadcrumb   Home › Research › <テーマ名>        ← BreadcrumbList と対応
  article
    H1  ページ固有のタイトル（サイト名でも人物名でもない）
    p.page-lead     lead
    dl.page-meta    更新日 / 種別 / 関連テーマ
    H2 …            §4.2 / §4.3 の見出し
    section.sources 外部一次ソース（一次ソースであることを明示）
    section.related 関連ページ（テーマ ↔ 業績 ↔ トップの該当セクション）
footer（既存）
```

- **人物名の露出**: 本文中に `Hiroto Fukada` / `深田大登` を自然な文で最低 1 回含める
  （著者表記・「本研究は〜が NII / SOKENDAI で行ったもの」等）。キーワードの羅列はしない。
- 言語トグルは**同一内容の他言語ページ**を指す（トップに戻さない）。
- ヘッダーのサイト名リンクは**自言語のトップページ**を指す。Phase 1 では JA ページのサイト名が
  EN トップ（サイトルート）を指していたため、Phase 2a で修正した（`ja/index.html` の差分はこれ）。
- ナビゲーションのアンカーリンク（`#about` 等）は、サブページでは
  `<相対ルート><言語ディレクトリ>#about` に解決する（§5.2）。

### 4.2 研究テーマページ `/research/<id>/`

| ブロック | 出典 | 必須 |
|---|---|---|
| H1 = テーマ名 | `topics[].title` | ✅ |
| リード文 | `topics[].lead` | ✅ |
| H2 取り組み / なぜ重要か / アプローチ / 結果 | `topics[].sections[]` | ✅（4 つ全部） |
| H2 関連する研究成果 | `workIds` から解決した業績のリスト（題目・著者・年・発表先・個別ページまたは外部リンク） | ✅ 1 件以上 |
| H2 外部一次ソース | `topics[].sources[]` | ✅ 1 本以上 |
| 関連リンク | 他テーマ / トップの Expertise 該当項目 | ✅ |

### 4.3 業績個別ページ `/publications/<slug>/`

| ブロック | 出典 | 必須 |
|---|---|---|
| H1 = 論文・発表の題目 | `works[].title` | ✅ |
| 引用行（著者・年・発表先） | `authors` / `year` / `venue` | ✅ |
| H2 概要（何をやったか） | `detail.summary` | ✅ |
| H2 なぜ重要か | `detail.why` | ✅ |
| H2 結果 | `detail.results` | ✅ |
| H2 発表先 | `venue` / `venueUrl` / `publisher` / `kind` / `status` | ✅ |
| H2 一次ソース | `arxiv` / `doi` / `detail.sources` / `links` | ✅ 1 本以上 |
| 関連リンク | `topics[]` のテーマページ・同テーマの他業績 | ✅ |

CIFEr 論文の例では、本文中に `Hiroto Fukada` / `Snippet-Driven Supply Chain Discovery with LLMs` /
`IEEE CIFEr 2026` / `supply chain` / `LLM` / `NII` が**自然な文の一部として**現れ、
arXiv・IEEE Xplore（DOI 付与後）・学会ページへリンクする。

### 4.4 実務案件ページ `/work/<slug>/`

`works[].type = "professional"` のうち、**公開済みの一次ソース（プレスリリース・公開記事）を持つもの**だけが
個別ページを持つ（現状 `dcr-mmm` と `xyhai-dml` の 2 件）。構成は §4.3 に準じ、既存の
Problem / Role / Domain / Methods / Outcome を H2 として展開したうえで `detail` の本文を加える。

- **トップページ側は簡易記載にする。** `<dl class="project-facts">`（5 項目の全文）は
  個別ページを持つ案件では題目 + `description` の 1〜2 文 + 「詳細」リンクに置き換え、
  詳細は個別ページへ移す（§6.3 の重複回避。Phase 1 FR-06 の要求は個別ページ側で満たす）。
  個別ページを持たない案件は従来どおりトップに `<dl>` を出す。
- 個別ページの H1 とパンくずには `detail.heading`（+`_ja`）を使う。プレスリリースの原題は
  見出しには長すぎるため、短縮した見出しを別に持ち、原題はリード行に出す。
- 非公開の職務詳細は引き続き `data/` に入れない（Phase 1 §3-6）。

### 4.5 ハブページ `/research/` `/publications/`、一覧 `/awards/`

- `/research/`: テーマ一覧（H2 = テーマ名リンク + lead + 関連業績数）。
- `/publications/`: 全業績を年降順・種別ラベル付きで列挙。`detail` を持つものは個別ページへ、
  持たないものは外部リンク（arXiv・学会ページ）へ。トップの Research Outputs より**網羅的**にする。
- `/awards/`: `works.type = award` と `research` のうち受賞（`kind: award`・`status` に賞名）を集約し、
  受賞名・授与組織・年・対象業績・一次ソースを列挙。

---

## 5. ビルド設計（`site/build.mjs` の変更）

### 5.1 ページレジストリへの一般化

現在の `LANGS.map(...)` によるハードコードをやめ、**(ページ定義 × 言語) の直積**を
1 つのレジストリに畳む。sitemap・hreflang・`--check`・内部リンク解決はすべてここから導出する。

```js
// pages: { key, path(lang) -> 'research/supply-chain-llm/', render(ctx), sitemap: true }
const PAGE_DEFS = [
  { key: 'home',        kind: 'profile',     seg: () => '' },
  { key: 'research',    kind: 'hub',         seg: () => 'research/' },
  ...topics.map((t) => ({ key: `topic:${t.id}`, kind: 'topic', seg: () => `research/${t.id}/`, data: t })),
  { key: 'publications', kind: 'hub',        seg: () => 'publications/' },
  ...publishablePubs().map((w) => ({ key: `pub:${w.id}`, kind: 'publication', seg: () => `publications/${w.slug}/`, data: w })),
  { key: 'awards',      kind: 'list',        seg: () => 'awards/' },
];
```

- 出力先 = `<lang.dir>/<seg>index.html`（EN は `<seg>index.html`）。
- `base`（ルートへの相対パス）は出力パスの深さから**計算**する（現在の `LANGS[].base` の固定値を廃止）。
  例: `ja/research/supply-chain-llm/index.html` → `base = '../../../'`。
- `publishablePubs()` は `slug` と `detail`（必須項目すべて）が揃う業績のみを返す。
  **データが薄ければページ自体が存在しない**（§1.3 の機械的強制）。

### 5.2 URL とリンク解決

- すべてのページ URL は `profile.url` から導出（Phase 1 ADR-5 を維持）。
- 内部リンクは**相対パス**で出す（サブパス配信でも、独自ドメイン移行でも壊れない）。
  ヘルパー `rel(fromPage, toPage)` を追加し、ハードコードされた `../` を書かない。
- 末尾スラッシュ付きディレクトリ URL（`/research/supply-chain-llm/`）に統一。
  GitHub Pages はディレクトリの `index.html` を返すため追加設定は不要。
- `.nojekyll` は現状のまま（`_` 始まりのパスを作らない）。

### 5.3 JSON-LD

| ページ | ルートノード |
|---|---|
| トップ（既存） | `ProfilePage` + `Person`(full) + `hasPart`: **全コンテンツページ（WebPage）** + `ScholarlyArticle[]`。`Person.subjectOf` ではなく `ProfilePage.hasPart` を使う（Google の ProfilePage はプロフィールの構成コンテンツを `hasPart` で示す形を想定しており、「人物についての著作」を意味する `subjectOf` より正確） |
| テーマ | `WebPage`（`@id <url>#webpage`）: `about: DefinedTerm`（テーマ名 + keywords）, `author`/`creator`: `{@id …#person}`, `hasPart`: 関連 `ScholarlyArticle` の `@id` 参照, `isPartOf: WebSite` |
| 業績詳細 | `WebPage` + `mainEntity: ScholarlyArticle`（フルの著者・venue・publisher・sameAs） |
| ハブ / 一覧 | `CollectionPage` + `hasPart` の `@id` 参照 |
| 全サブページ共通 | `BreadcrumbList` と、`{'@type':'Person','@id': …#person, name, url, sameAs}` の**最小 Person ノード**（`@id` はトップと同一） |

- **`@id` の一意性ルール**: 業績ノードの `@id` は `DOI > arXiv > 個別ページ URL` の優先順で 1 つに固定し、
  どのページでも同じ値を使う（`workNode()` に集約）。学会ページ URL は「発表そのもの」の URL では
  ないため、論文以外では `@id` に昇格させない（DOI も arXiv も無い発表は `@id` 無しの `CreativeWork`）。
- Person の `@id` は常に `<SITE_URL>#person`。サブページでは最小ノード + `sameAs` のみを出し、
  矛盾する属性を二重定義しない。

### 5.4 sitemap / robots

- `sitemap.xml` と `sitemap-gsc.xml`（Phase 1 §10-7 の診断用コピー）はレジストリから全 URL を出力する。
  各 URL に EN/JA の `xhtml:link` alternates と `x-default` を付ける（現在と同じ形式）。
- 件数が増えるため `<lastmod>` を**ページ単位**にする（テーマは `topics[].updated`、業績は `added`、
  無ければビルド日）。ビルドのたびに全 URL の `lastmod` が動くのを避ける。
- `robots.txt` は変更不要（Phase 1 §10-1 の制約も変わらない）。

### 5.5 スタイル・スクリプト

- `style.css` に `/* ── Sub pages ── */` ブロックを追加（breadcrumb・article prose・sources・related）。
  既存トークンとセクション意匠を再利用し、新しいデザイン言語は導入しない。
- `script.js` は変更しない。スクロールスパイは `nav a[href^="#"]` のみを対象とするため、
  サブページでは自然に無効化される（JS 非依存の原則は維持）。

---

## 6. 内部リンクと重複回避

### 6.1 リンク構造（すべて HTML の `<a>`、JS 非依存）

```
/            ─┬─► /research/            ─► /research/<topic>/ ─┬─► /publications/<slug>/
              ├─► /publications/        ─► /publications/<slug>/ ┘
              └─► /awards/
/research/<topic>/    ─► 関連業績・他テーマ・/（Expertise 該当項目のアンカー）
/publications/<slug>/ ─► 所属テーマ・同テーマの他業績・/
```

- トップの Research Outputs / Selected Work の各項目に、個別ページがある場合のみ
  「Details / 詳細」リンクを出す。
- トップに `Research Topics` の導線を追加する（既存 H2 の並びは `--check` が検査しているため、
  **Expertise セクション内のリンク**として追加し、H2 構成は変えない）。
- 孤立ページを禁止（`--check` で検査。§7-9）。

### 6.2 URL の不変性

- `topics[].id` と `works[].slug` は**公開後に変更しない**。やむを得ず変える場合は旧 URL に
  `<meta http-equiv="refresh">` + `canonical` を置いた残置ページを生成する
  （GitHub Pages は 301 を設定できない。Phase 1 §10-2 と同じ制約）。
- スラッグは英小文字・ハイフン・トピック名ベース。日付や連番を含めない。

### 6.3 重複コンテンツの回避

- トップページの各項目は**題目 + 1〜2 文の要約**まで。詳細本文は個別ページにのみ置く。
- `topics[].lead` はハブとトップで再利用してよいが、`sections[].body` は個別ページ専用。
- EN ページと JA ページは hreflang で対にする（既存規則）。JA は Phase 1 と同じく **常体**で書く
  （リポジトリ `CLAUDE.md` の文体規約。ですます調は不可）。

---

## 7. 受け入れ条件（DoD）と `--check` の拡張

既存の検査（Phase 1 §8 の 1〜10）は全ページに対して実行する。加えて以下を追加する。

| # | 検査 | 失敗条件 |
|---|---|---|
| 11 | **本文の実体** | テーマページ: EN 本文 < 400 語 または JA 本文 < 800 文字。業績ページ: EN < 200 語 または JA < 400 文字 |
| 12 | **一次ソース** | `sources`（+ `arxiv`/`doi`/`venueUrl`）由来の**外部**リンクが 1 本も無い |
| 13 | **5 点構成** | テーマ: `what`/`why`/`approach`/`results` のいずれか欠落。業績: `summary`/`why`/`results` のいずれか欠落 |
| 14 | **EN/JA 対** | 片方の言語しか生成されない、または一方の本文が空 |
| 15 | **H1** | ページごとに H1 が 1 つでない / H1 がサイト名・人物名と同一 |
| 16 | **title / description** | `<title>` がページ固有でない（他ページと完全一致）/ EN description が 120〜160 文字外 |
| 17 | **canonical / hreflang** | canonical が自 URL でない / EN・JA・x-default が揃わない |
| 18 | **内部リンク解決** | 生成 HTML 内の相対リンク先ファイルが実在しない |
| 19 | **孤立ページ禁止** | あるページがどのページからもリンクされていない（トップを除く） |
| 20 | **sitemap 網羅** | レジストリの全 URL が sitemap に無い / sitemap に未生成 URL がある |
| 21 | **JSON-LD** | BreadcrumbList がパース不可 / Person の `@id` がトップと不一致 / 業績ノードの `@id` がページ間で不一致 |
| 22 | **スラッグ** | `topics[].id` / `works[].slug` の重複・不正文字・空 |
| 23 | **人物名の露出** | サブページ本文に `Hiroto Fukada`（JA は `深田大登`）が 1 回も現れない |
| 24 | **公開境界** | 既存の `mailto:` / メールアドレス様文字列検査を全ページに適用 |

`npm run build` / `npm run check` のインターフェースは変えない（CI もそのまま）。

---

## 8. 実装フェーズ

| Phase | 内容 | 成果物 | 目安 |
|---|---|---|---|
| **2a** | ビルド基盤: ページレジストリ・`base` 計算・`rel()`・BreadcrumbList・sitemap 一般化・サブページ CSS・検査 11〜24 の枠 | 既存 2 ページの出力が**バイト等価**（差分ゼロ）であることを確認してからマージ | 最初のコミット |
| **2b** | `data/topics.json` 新設 + `/research/` + `/research/supply-chain-llm/`（EN/JA） | テーマページ 1 系統 | 本文執筆が主作業 |
| **2c** | `/publications/` + `/publications/snippet-driven-supply-chain/`（CIFEr）+ `/awards/` | 業績詳細 1 件 + 一覧 2 件 | |
| **2c'** | `/work/dcr-mmm/` `/work/xyhai-dml/` + トップの Selected Work を簡易記載へ | 実務案件ページ 2 件（§4.4） | |
| **2d** | `/research/causal-inference/` + 業績詳細を jsai2026 / netsci2026 / neteco2026 へ拡張 | 記述できる一次ソースがある分だけ | |
| **2e** | トップからの相互リンク・`Person.subjectOf`・GSC へ sitemap 再送信と URL 検査、外部プロフィール（ORCID / arXiv / GitHub / LinkedIn）からテーマページへの被リンク設定 | 運用作業（§9） | ユーザー実施を含む |

2a を独立コミットにし、「出力が変わらないリファクタ」と「コンテンツ追加」を混ぜない。

---

## 9. 運用（Phase 1 §9 への追記）

1. テーマ追加: `data/topics.json` に追記 → `npm run build && npm run check` → 生成物を同一コミットに含める。
2. 業績の個別ページ化: `works.json` の該当エントリに `slug` と `detail` を追加（一次ソースが公開されてから）。
3. デプロイ後、GSC で**新規 URL を URL 検査 → インデックス登録をリクエスト**。sitemap は再送信不要
   （同一 URL の内容更新として扱われる）が、Phase 1 §10-7 の切り分け中は状態を確認する。
4. 外部プロフィールからの被リンク（効果が大きい順）:
   - ORCID の各 Work に個別ページ URL を追加、Researcher URL にテーマページを追加
   - arXiv 著者 ID ページ（有効化後）・GitHub プロフィール website・リポジトリ README
   - LinkedIn の投稿・Featured にテーマページ URL
5. KPI 追加（Phase 1 §9.2 に追加）: インデックス済み URL 数（目標 10+）、非ブランドクエリの
   表示回数、テーマページ単位の表示回数・CTR（GSC「ページ」でフィルタ）。

---

## 10. リスクと判断事項

1. **執筆コストがボトルネック。** 本設計の作業量の大半はビルドではなく**本文（EN/JA 各 4 ブロック）**。
   ページを増やす前にテーマ 1 本を完成させ、品質基準を確定させる（Phase 2b を先行させる理由）。
2. **薄いページのリスク。** §7 の検査 11〜13 で機械的に防ぐが、語数を満たしても中身が無ければ
   逆効果になりうる。一次ソース（arXiv・プレスリリース・学会ページ）が**公開済み**であることを
   ページ作成の前提条件とする。
3. **未公開情報の混入。** 業績ページは実務案件にも及びうる。公開済み一次ソースのある案件のみとし、
   `--check` の公開境界検査を全ページに適用する（検査 24）。
4. **CIFEr の DOI 未付与。** 現在 `doi` は空。DOI が付いた時点で業績ノードの `@id` が arXiv URL から
   DOI に切り替わる（§5.3）。**外部から個別ページに張ったリンクは変わらない**ため、
   個別ページを作っておくことが URL 安定性の面でも有利。
5. **重複コンテンツ判定。** トップと個別ページで同じ文を出さない（§6.3）。特に JA/EN の機械的な
   焼き直しは避け、各言語で独立に書く。
6. **URL 長。** `cabocha-hlw.github.io/hirotofukada.github.io/research/supply-chain-llm/` は長い。
   独自ドメイン移行（Phase 1 §10-2）を行うなら、**個別ページを増やす前**のほうが移行コストが小さい。
   移行しても `profile.url` 1 箇所の変更で全 URL が追従する設計は維持する。
7. **`resume/build.mjs` との整合。** `topics.json` は履歴書側が読まない。`works.json` は追加フィールドのみ。
   実装後に `node resume/build.mjs --check` が通ることを確認する。

### 判断事項の結果

§0 のとおり確定済み。以降の変更は本書の §0 を更新してから行う。

### 独自ドメイン取得の手順（§10-6 の補足）

1. レジストラでドメインを取得（Cloudflare Registrar / お名前.com / Value-Domain 等）。
   人物名と一致する `hirotofukada.com` 系が Entity 的に最も効く。
2. DNS: apex なら A レコード `185.199.108.153` / `185.199.109.153` / `185.199.110.153` /
   `185.199.111.153`（+ 対応する AAAA）、`www` を正にするなら CNAME → `cabocha-hlw.github.io`。
3. リポジトリ Settings → Pages → Custom domain（`CNAME` ファイルがコミットされる）→ 伝播後に
   Enforce HTTPS。
4. `data/profile.json` の `url` を新ドメインに変更 → `npm run build` で canonical / hreflang / OG /
   JSON-LD / sitemap が一括追従。`robots.txt` の `Sitemap:` 行のみ手で更新。
5. GSC に新 URL のプロパティを追加して sitemap を再送信。旧 `github.io` URL からのリダイレクトは
   GitHub Pages 側の仕様で行われるが、**移行時に実測で確認する**（Phase 1 §10-2 は「301 を設定できない」と
   書いているが、これはリポジトリ内で制御できないという意味であり、独自ドメイン設定時の
   github.io → 独自ドメインのリダイレクトとは別の話）。
6. 副次効果: プロジェクトサイトに独自ドメインを設定すると配信がドメイン直下になり、
   `/hirotofukada.github.io/` のパス接頭辞が消える。ホスト直下の `robots.txt` が有効になるため
   Phase 1 §10-1 の制約も解消する。

---

## 11. 未実装チェックリスト（Phase 1 §7 の続き）

状態: ⬜ 未着手 / 🟡 実装中 / ✅ 完了

| ID | 要求 | 実装先 | 状態 |
|----|------|--------|------|
| CP-01 | ページレジストリによる複数ページ生成 | `site/build.mjs` §5.1 | ✅ 2a |
| CP-02 | 相対リンク解決 `relHref()` と `base` 計算 | `site/build.mjs` §5.2 | ✅ 2a |
| CP-03 | 研究テーマページ（EN/JA） | `data/topics.json` §4.2 | ✅ 2b（`supply-chain-llm`） |
| CP-04 | 業績個別ページ（EN/JA） | `works[].detail` §4.3 | ✅ 2c（CIFEr 2026） |
| CP-05 | ハブ `/research/` `/publications/` と `/awards/` | §4.5 | ✅ 2c |
| CP-05b | 実務案件ページ `/work/<slug>/` とトップの簡易記載化 | §4.4 | ✅ 2c'（dcr-mmm / xyhai-dml） |
| CP-06 | BreadcrumbList / WebPage / CollectionPage の JSON-LD | §5.3 | ✅ 2b |
| CP-07 | `ProfilePage.hasPart` によるプロフィールと各ページの接続 | §5.3 | ✅ |
| CP-08 | sitemap の全 URL 化・ページ単位 `lastmod` | §5.4 | ✅ 2a（6 URL） |
| CP-09 | 薄いページ防止の機械検査（11〜13） | §7 | ✅ 2c（テーマ・業績の両方） |
| CP-10 | 内部リンク・孤立ページ・sitemap 網羅の検査（18〜20） | §7 | ✅ 2b（トップからの到達可能性を BFS で検査） |
| CP-11 | サブページのスタイル | `style.css` §5.5 | ✅ 2b |
| CP-12 | 外部プロフィールからの被リンク | §9-4 | ⬜（ユーザー実施） |
