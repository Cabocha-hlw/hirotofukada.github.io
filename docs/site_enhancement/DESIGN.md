# ポートフォリオ SEO / Entity 強化 — 実装要件設計書

- Status: v1.0（2026-09-11）Phase 1 実装完了
- 対象: `hirotofukada.github.io`（GitHub Pages・公開リポジトリ）
- 入力: 「GitHub Portfolio Enhancement Requirements」（要求書。以下 §番号・ID は要求書のもの）
- 本書は要求書を実装可能な要件に落とし、採用したアーキテクチャ・データモデル・検証方法・
  運用手順を記録する。コーディングエージェントはサイト構造・SEO・データ形式を変更する前に
  本書とリポジトリ直下の `CLAUDE.md` を読むこと。

---

## 1. 目的とスコープ

要求書 §1 の通り、本サイトを「Web 上に散在する Hiroto Fukada / 深田大登 のプロフィール・研究成果・
職歴を束ねる Canonical Personal Hub」にする。制御対象は **Google が人物を正しく理解するための
情報品質・構造・Entity consistency** であり、順位や AI Overview 表示の保証は非目標（§11）。

Phase 1（本書の範囲）= 要求書 P0 全部 + P1 のうちコード側で完結するもの（Expertise・Professional Works
詳細化・publication metadata・canonical・日英統一・mobile/performance）。
Search Console 登録（SEO-08）は Google アカウント操作が必要なため **ユーザー実施**とし、
§9 に手順を用意した。

---

## 2. 現状分析（実装前・2026-09-11）

| 観点 | 実装前の状態 | 問題 |
|------|-------------|------|
| コンテンツ配信 | `index.html` は見出しの骨格のみ。本文は `script.js` が `data/*.json` を `fetch` して描画 | 主要情報が JS 実行後にしか存在しない（SEO-04 違反）。`fetch` は `file://` でも失敗 |
| 表示制御 | `.fade-up { opacity: 0 }` を JS が解除 | JS 無効・未実行では本文が不可視 |
| `<title>` / description | `Hiroto Fukada` / `Portfolio of Hiroto Fukada` | 職種・専門が無い（SEO-01/02） |
| 構造化データ・canonical・sitemap・robots | なし | FR-03 / SEO-03 / 06 / 07 未対応 |
| 日本語名 | HTML に `深田大登` が無い（JA 切替時のみ JS が描画） | FR-01 受け入れ基準を満たさない |
| 外部 ID | LinkedIn / Email / GitHub。GitHub リンク `github.com/hirotofukada` は **404**（実アカウントは `Cabocha-hlw`） | ORCID 未掲載、壊れたリンク |
| 連絡先 | 個人 Gmail を `mailto:` で掲載 | 要求書 §8（個人メール非公開）に抵触 |
| 配信 URL | `https://cabocha-hlw.github.io/hirotofukada.github.io/`（プロジェクトサイト・サブパス配信・legacy Jekyll ビルド） | robots.txt はホスト直下しか有効でない（§10） |
| フォント | CSS `@import` で Inter + Instrument Serif + **Noto Sans JP** | CJK Web フォントは重く、`@import` はレンダリングブロックの連鎖 |

---

## 3. 設計方針（ADR）

1. **ビルド時静的生成（SSG）に切り替える。** `data/*.json` を単一情報源のまま、
   `site/build.mjs` が HTML を事前生成する。JS は装飾（進捗バー・フェード・スクロールスパイ・
   New バッジ）のみ。→ SEO-04「JS 実行後しか存在しない主要情報」を構造的に排除。
   既存の `resume/build.mjs`（履歴書ビルド）が `data/works.json` を読むため、データ形式は
   後方互換で拡張する（フィールド追加のみ）。
2. **EN / JA は別 URL（`/` と `/ja/`）で生成し、`hreflang` で連結する。** localStorage 切替を
   廃止。`深田大登` を JA ページの H1 に、EN ページでも H1 内の副表記として常時 HTML に置く。
   → Google が日本語クエリに対して JA ページを、英語クエリに EN ページを返せる。
3. **生成物（`index.html` / `ja/index.html` / `sitemap.xml` / `sitemap-gsc.xml`）はコミットする。**
   Pages の配信元（`main` 直下）を変えずに済み、Actions デプロイへの移行という
   外向きの設定変更を伴わない。ドリフト防止として `--check` が「生成物 = ビルド結果」を検証し、
   GitHub Actions（`.github/workflows/check.yml`）で同じチェックを回す（デプロイはしない）。
4. **依存ゼロ。** テンプレートエンジン・フレームワークを導入せず、Node 標準モジュールと
   テンプレートリテラルのみ（`resume/` と同じ思想）。
5. **サイト URL は `data/profile.json` の `url` 一箇所に置く。** canonical / hreflang / OG /
   JSON-LD / sitemap はすべてここから導出（SEO-03「独自ドメイン移行時に同時更新」を 1 箇所の
   変更で満たす）。
6. **公開境界を維持する。** 個人メール・電話・非公開の社内情報はデータにも HTML にも置かない。
   `--check` が `mailto:` とメールアドレス様の文字列を検出して失敗させる。
   非公開の職務詳細は従来どおり `docs/resume_design/`（gitignore）にのみ存在する。

---

## 4. URL・ページ構成

| URL | 言語 | 役割 |
|-----|------|------|
| `https://cabocha-hlw.github.io/hirotofukada.github.io/` | en | canonical（x-default） |
| `https://cabocha-hlw.github.io/hirotofukada.github.io/ja/` | ja | 日本語版（`hreflang=ja`） |
| `…/sitemap.xml` | – | 2 URL + `xhtml:link` alternates |
| `…/sitemap-gsc.xml` | – | `sitemap.xml` と完全同一（GSC 診断用コピー、§10-7） |
| `…/robots.txt` | – | 意図の記録（§10 の制約あり） |

### 見出し階層（SEO-05）

```
H1  Hiroto Fukada（EN） / 深田大登（JA）   ※副表記を同じ H1 内に <span> で併記
 H2 About / 概要                        ← Biography（FR-02）
 H2 Expertise / 専門領域                ← FR-07（H3 = 各領域）
 H2 Selected Work / 主な実績            ← FR-06（H3 Professional Projects / Recognition、H4 = 件名）
 H2 Research Outputs / 研究業績         ← FR-05（H3 Peer-reviewed Papers / Presentations & Awards / Upcoming、H4 = 題目）
 H2 Professional Experience / 職歴      ← H3 = 組織、H4 = 役職
 H2 Education / 学歴
 H2 Profiles & Contact / プロフィール・連絡先 ← FR-04
```

### Identity Block（FR-01）— hero 内、HTML テキストとして

- H1: `Hiroto Fukada` + `深田大登`（JA ページは順序反転）
- 役職行: `Data Scientist · Product Manager · Researcher (PhD Student)`
- 一文の identity statement（`profile.headline`。要求書 FR-01 の例文をそのまま採用）
- 現在の所属（`education` / `experience` の `Present` 該当から自動導出）: SOKENDAI · NII · Septeni Japan
- 専門領域チップ（`expertise[].featured = true` の 5 件、`#expertise` へのアンカー）

### `<head>`

`<title>` / `meta description` / `meta author` / `robots: index, follow, max-image-preview:large` /
`canonical` / `hreflang`(en, ja, x-default) / Open Graph（`og:type=profile`, `profile:first_name/last_name`,
`og:locale` + alternate, 画像 505×505） / Twitter card / JSON-LD / Web フォント `<link>`（`@import` 廃止）/
`google-site-verification`（`profile.seo.googleSiteVerification` が空でなければ出力）/ GA4（既存）。

### JSON-LD（FR-03）

```
ProfilePage (@id …/#profilepage, url, name, description, inLanguage, dateModified)
 ├ mainEntity: Person (@id …/#person)
 │    name / alternateName[深田大登, 深田 大登, Hiroto FUKADA, Fukada Hiroto, H. Fukada]
 │    givenName / familyName / url / image / jobTitle[3] / description
 │    sameAs[LinkedIn, ORCID, GitHub]  identifier{ORCID}
 │    affiliation[SOKENDAI(EducationalOrganization), NII, Septeni Japan]  worksFor[NII, Septeni Japan]
 │    alumniOf[Doshisha University]  knowsAbout[expertise 名]  knowsLanguage[ja, en]
 ├ about: {@id person}
 └ hasPart: ScholarlyArticle[]（works.type = paper。author は本人を @id 参照、arXiv を sameAs、
                                 DOI があれば DOI を @id/url に昇格、publication: PublicationEvent(venue)）
```

---

## 5. データモデル

### 5.1 `data/profile.json`（拡張）

| キー | 用途 |
|------|------|
| `name` / `name_ja` / `givenName` / `familyName` / `alternateNames[]` | 氏名の正本（EC-01）。`alternateNames` は JSON-LD のみに出す |
| `url` | サイトの正規 URL（末尾 `/`）。全 URL 導出の起点 |
| `roles[]` / `roles_ja[]` / `roleLine` / `roleLine_ja` | Core Identity（EC-02）。JSON-LD `jobTitle` と hero 役職行 |
| `headline` / `headline_ja` | Identity statement（hero・JSON-LD `description`） |
| `seo.title` / `seo.description`（+`_ja`） | SEO-01 / 02。EN description は 120〜160 文字を `--check` で強制 |
| `seo.googleSiteVerification` | GSC HTML タグ検証用トークン（任意） |
| `bio[]` / `bio_ja[]` | Biography 段落（FR-02）。EN 合計 100〜200 語を `--check` で強制 |
| `expertise[]{id,name,name_ja,featured,description,description_ja}` | FR-07。`knowsAbout` と hero チップの源 |
| `photo{src,webp,width,height,alt,alt_ja}` | `<picture>`（WebP 400px + JPEG フォールバック）、OG 画像 |
| `profiles[]{id,network,url,sameAs,identifier?}` | FR-04。`sameAs=true` のものだけ JSON-LD `sameAs` と `rel="me"` に載せる |
| `contactNote` / `contactNote_ja` | 連絡導線（LinkedIn 経由）。メールは置かない。空文字ならその言語では非表示（現状 `_ja` は空） |
| `callout` / `callout_ja` | 任意の一言。`_ja` が空文字なら JA では非表示 |

### 5.2 `data/works.json`（後方互換で拡張）

| キー | 説明 |
|------|------|
| `type` | `paper` / `research` / `upcoming` / `professional` / **`award`**（新設。社内表彰。履歴書ビルドは `paper`・`research` のみ読むため影響なし） |
| `id` | 安定 ID（アンカー・将来の個別ページ用） |
| `kind` | 発表種別: `paper` / `poster` / `oral` / `talk` / `award` → 表示ラベルはビルド側で言語別に変換（FR-05 Publication type） |
| `venueUrl` | 学会・会議の公式ページ（「Conference page」リンクとして出力） |
| `publisher` / `arxiv` / `doi` | publication metadata。`doi` が入れば JSON-LD の主 URL が DOI に切り替わる |
| `authors[]` / `selfAuthors[]` / `year` / `month` / `title` / `venue`(+`_ja`) / `status`(+`_ja`) / `links[]{label,label_ja?,url}` / `added` | 従来どおり |
| professional 専用: `organization`(+`_ja`) / `role` / `domain` / `problem` / `methods[]` / `outcome`（各 `_ja`） | FR-06 の Problem / Role / Domain / Methods / Outcome を `<dl>` で出力 |

### 5.3 `data/experience.json` / `data/education.json`（追加フィールド）

`formalName`(+`_ja`) / `shortName` / `url` — JSON-LD の Organization 名・URL と hero の所属表記に使う。
`organization_ja` / `period` / `roles[].title_ja` は履歴書ビルドの整合チェックが参照するため変更しない。

---

## 6. Entity Consistency の正本（EC-01〜03）

本サイトの `data/profile.json` を正本とし、他媒体をこれに合わせる。

| 項目 | 正本の値 |
|------|---------|
| Primary name | `Hiroto Fukada` |
| Secondary name | `深田大登` |
| Core Identity（EC-02） | Data Scientist / Product Manager / Researcher |
| Core keywords（EC-03） | Causal Inference / Large Language Models / Network Science / Supply Chain Analysis / Marketing Science / Applied AI & Data Science / Product Management |
| 一文プロフィール | `profile.headline`（要求書 FR-01 の例文） |

### 他媒体で確認した現状と、ユーザーが合わせるべき点

| 媒体 | 確認結果（2026-09-11） | 推奨アクション |
|------|----------------------|---------------|
| ORCID `0009-0009-2126-4842` | 氏名一致、所属 NII / SOKENDAI、キーワード LLM・Supply Chain・Knowledge Graph・Network Science、Researcher URL に本サイト URL 登録済み。**Biography 空** | Biography に `profile.bio` 第 1・2 段落を貼る。キーワードに Causal Inference / Marketing Science を追加。Works に arXiv 2605.27845 を追加 |
| LinkedIn | 認証壁のため未確認 | Headline を `Data Scientist · Product Manager · Researcher` 系に、About を `profile.bio` と同旨に。Website 欄に本サイト URL |
| GitHub `Cabocha-hlw` | 表示名 `hiro0x407`、website 空 | 表示名を `Hiroto Fukada` に、website に本サイト URL を設定（sameAs の相互リンクが成立する） |
| arXiv | 著者識別子ページ `arxiv.org/a/fukada_h_1` は **404**（未クレーム） | arXiv アカウントで著者 ID を有効化したら `profiles[].arxiv.url` を差し替え、`sameAs: true` にする |

---

## 7. 要求トレーサビリティ

状態: ✅ 実装・検証済み / 🟡 実装済み・ユーザー操作待ち / ⬜ 未着手（P2）

| ID | 要求 | 実装 | 検証 | 状態 |
|----|------|------|------|------|
| FR-01 | Identity Block | hero（§4） | `--check`: H1 単一・`Hiroto Fukada` 含む・`深田大登` 本文存在 | ✅ |
| FR-02 | Biography 100–200 words | `profile.bio`（182 語・3 段落）+ JA | `--check`: 語数 | ✅ |
| FR-03 | JSON-LD ProfilePage/Person | `buildJsonLd()` | `--check`: パース・必須キー・sameAs（LinkedIn/ORCID/GitHub） | ✅（Rich Results Test はデプロイ後に §9） |
| FR-04 | 外部 Identity リンク | Profiles セクション、リンク文言は `network` 名のみ（`LinkedIn` / `ORCID` …）、`rel="me"` | `--check`: 全 profiles の href 存在 | ✅ |
| FR-05 | Research Outputs 構造化 | 題目 H4 / 著者 / 年 / venue / 種別 / 学会ページ・arXiv リンク | `--check`: 全 works 題目がテキストに存在 | ✅ |
| FR-06 | Professional Work の Problem/Role/Domain/Methods/Outcome | `works.type=professional` の `<dl>` | 目視 | ✅ |
| FR-07 | Expertise セクション | 7 領域・各 1〜2 文 | 目視 | ✅ |
| SEO-01 | title | `Hiroto Fukada | Data Scientist, Product Manager & Researcher` | `--check` | ✅ |
| SEO-02 | meta description 120–160 | 152 文字（JA 141） | `--check` | ✅ |
| SEO-03 | canonical | `profile.url` から導出、hreflang 併設 | `--check` | ✅ |
| SEO-04 | semantic HTML | `header/nav/main/section/article/footer`、JS 非依存 | `--check`: 要素存在、`.fade-up` は `.js` 配下のみ | ✅ |
| SEO-05 | 見出し階層 | §4 | `--check`: H2 の並び | ✅ |
| SEO-06 | sitemap.xml | ビルド生成（2 URL + alternates） | `--check` | ✅ |
| SEO-07 | robots.txt | `Allow: /` + Sitemap 行 | `--check` + §10 の制約 | ✅（ホスト直下は 404 = 全許可を確認済み） |
| SEO-08 | Search Console | §9 手順・`googleSiteVerification` 出力口 | ユーザー実施 | 🟡 |
| EC-01〜03 | 名前・役職・専門の統一 | §6 | 他媒体はユーザー更新 | 🟡 |
| UX-01 | 5 秒で 名前/職種/専門/所属 | hero 4 行 + チップ | 目視（EN/JA・desktop/mobile） | ✅ |
| UX-02 | ナビ | About/Expertise/Work/Research/Experience/Education/Profiles + 言語リンク | 目視 | ✅ |
| UX-03 | Mobile | 1 カラム化、`<dl>` 縦積み、ナビ縮小 | 390px 描画を目視 | ✅ |
| §7 Perf | JS 削減 / 画像 / フォント | 描画 JS 撤廃（装飾のみ）、`<picture>` WebP 25KB + width/height + `fetchpriority`、Noto Sans JP 廃止、`@import`→`<link>` | ファイルサイズ・目視 | ✅ |
| §8 Privacy | 個人情報非掲載 | Email 削除、連絡は LinkedIn 経由 | `--check`: `mailto:`・メール様文字列を禁止 | ✅ |
| §9 Analytics | GSC 主・GA4 補助 | GA4 継続、KPI 定義は §9 | ユーザー運用 | 🟡 |
| P2 | 独自ドメイン / Scholar / 個別ページ / RSS 等 | — | — | ⬜ |

---

## 8. ビルドと検証

```bash
npm run build      # index.html, ja/index.html, sitemap.xml, sitemap-gsc.xml を再生成
npm run check      # 受け入れチェック（下記）+ 生成物がソースと一致するか（書き込みなし）
node resume/build.mjs --check   # 履歴書側との整合（非公開 master.yaml が必要）
```

`--check` の検査項目（要求書 §12 Definition of Done に対応）:

1. H1 が 1 つで `Hiroto Fukada` を含む／本文に `深田大登`
2. `<title>` に `Hiroto Fukada`／meta description 存在、EN は 120〜160 文字
3. canonical が自ページ URL／hreflang en・ja・x-default
4. JSON-LD がパース可能／`ProfilePage.mainEntity` が `Person`／`name, alternateName, url, jobTitle, description, sameAs` 非空／sameAs に LinkedIn・ORCID・GitHub／alternateName に `深田大登`
5. `header nav main section article footer` の存在／H2 の並びが §4 と一致
6. 全 `works` 題目が HTML テキストに存在／Biography 100〜200 語／全 profiles リンクの存在
7. `mailto:` 無し・メールアドレス様文字列無し／`undefined` `[object Object]` `NaN` の漏れ無し
8. `<img>` に width/height/alt／参照する css・js・画像ファイルの実在
9. sitemap に 2 URL／robots.txt に `User-agent: *` `Allow: /` `Sitemap:`／`.nojekyll` 存在
10. 生成物がビルド結果と一致（日付のみ差異許容）

目視検証（ヘッドレス Chrome）:

```bash
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$C" --headless=new --disable-gpu --hide-scrollbars --window-size=1280,5400 \
     --screenshot=/tmp/desktop.png "file://$PWD/index.html"
# モバイルは Chrome の最小ウィンドウ幅の制約があるため、390px の iframe で包んだ HTML を撮る
```

---

## 9. 運用ランブック

### 9.1 Google Search Console 登録（SEO-08・ユーザー実施）

1. https://search.google.com/search-console → プロパティ追加 → **URL プレフィックス**
   `https://cabocha-hlw.github.io/hirotofukada.github.io/`（ドメインプロパティは DNS 不可のため不可）
2. 所有権確認は次のいずれか
   - **Google アナリティクス**: `<head>` に GA4 タグ（`G-W12HECKQ45`）があるため、同じ Google
     アカウントが GA プロパティの編集権限を持っていれば即時に通る（コード変更不要）
   - **HTML タグ**: 表示されたトークンを `data/profile.json` → `seo.googleSiteVerification` に入れ、
     `npm run build` → コミット → デプロイ後に「確認」
3. サイトマップ: `https://cabocha-hlw.github.io/hirotofukada.github.io/sitemap.xml` を送信。
   ステータスが「取得できませんでした」のまま数日続く場合は `sitemap-gsc.xml` も追加送信し、
   §10-7 の切り分けを行う
4. URL 検査: `/` と `/ja/` をそれぞれ検査 →「クロール済みのページを表示」で H1・本文が HTML に
   含まれることを確認 →「インデックス登録をリクエスト」
5. 設定 → robots.txt レポートで `cabocha-hlw.github.io/robots.txt` が **未検出（404）** = 全許可で
   あることを確認（§10）
6. 構造化データ: https://search.google.com/test/rich-results と https://validator.schema.org/ に
   `/` を入力し、ProfilePage / Person にエラーが無いことを確認
7. 2〜4 週間後に「検索パフォーマンス」でクエリ `hiroto fukada` / `深田大登` の表示回数を確認

### 9.2 KPI（要求書 §9）

| KPI | 取得元 |
|-----|--------|
| `Hiroto Fukada` / `深田大登` の impressions・CTR | GSC 検索パフォーマンス → クエリでフィルタ |
| Non-branded impressions（例: `supply chain OSINT LLM`） | GSC クエリ一覧からブランド語を除外 |
| Indexed pages（目標 2） | GSC ページのインデックス登録 |
| 外部プロフィール / 研究成果クリック | GA4 拡張計測「離脱クリック」イベント（`click` + `outbound=true`、`link_domain` で linkedin.com / orcid.org / arxiv.org 等を区別） |

### 9.3 更新フロー

1. `data/*.json` を編集（研究成果は `works.json` に追記。§5.2 のフィールド）
2. `npm run build && npm run check`
3. 必要なら `node resume/build.mjs --check` で履歴書側とのズレを確認
4. 生成物（`index.html` / `ja/index.html` / `sitemap.xml` / `sitemap-gsc.xml`）をソースと**同じコミット**に含める
5. デプロイ後、GSC で URL 検査 → インデックス登録をリクエスト（新規業績のときのみで十分）

---

## 10. 既知の制約とユーザー判断事項

1. **サブパス配信と robots.txt。** 本サイトは `cabocha-hlw.github.io` のサブパスで配信されるため、
   クローラが読む robots.txt は **ホスト直下** `https://cabocha-hlw.github.io/robots.txt` であり、
   リポジトリ内の `robots.txt` は効かない。現在ホスト直下は 404（= 全許可）なので遮断は無い。
   ただし将来 `Cabocha-hlw.github.io` リポジトリ（ユーザーサイト）を作ると、その robots.txt が
   本サイトにも適用されることに注意。sitemap は GSC に直接送信するため問題ない。
2. **URL の見え方。** `cabocha-hlw.github.io/hirotofukada.github.io/` は人物名と一致せず長い。
   要求書 P2「独自ドメイン」を実施すると canonical・OG・sitemap は `profile.url` の 1 箇所変更で
   追従する（`robots.txt` の Sitemap 行だけ手で更新）。代替として、リポジトリを
   `Cabocha-hlw.github.io` に改名してユーザーサイト（ホスト直下）にする案もある。いずれも
   GSC で新 URL を別プロパティとして再登録し、旧 URL からの 301 は GitHub Pages では設定できない
   （`<meta http-equiv="refresh">` + canonical で代替）。
3. **GitHub リンクの変更。** 旧リンク `github.com/hirotofukada` は 404 だったため
   `github.com/Cabocha-hlw` に差し替えた。表示名が `hiro0x407` のままだと sameAs の相互性が
   弱いので、GitHub プロフィールの Name を `Hiroto Fukada`、Website を本サイト URL にすることを推奨。
4. **メールアドレスの削除。** 要求書 §8 に従い Contact から Gmail を外し、連絡導線を LinkedIn に
   一本化した。専用の公開用アドレスを設ける場合は `profile.profiles` にではなく `contactNote` の
   文言に含める（`--check` の `mailto:` 禁止は維持し、必要なら検査を緩める判断をユーザーが行う）。
5. **CIFEr 2026 のステータス。** 会期（2026-09-10〜11）が到来しているため、掲載後に
   `works.json` の `status` を `Published` 等へ、DOI が付与されたら `doi` に登録する
   （JSON-LD の主 URL が DOI に切り替わる）。
6. **ZENKIGEN の開始月。** 履歴書側 `master.yaml`（2021-09）とサイト（2021-08）の不一致は
   既存の TODO。本件の範囲外だが、`--check` の警告として残っている。
7. **sitemap「取得できませんでした」の切り分け（2026-09-17〜）。** GSC に送信した
   `sitemap.xml` が 5 日以上「取得できませんでした（Couldn't fetch）」のままのため、内容が
   完全に同一のコピーを `sitemap-gsc.xml` として別 URL に配置し、両方を送信して比較する。
   両ファイルは `site/build.mjs` の `SITEMAP_FILES` から同一文字列を書き出しており、
   `npm run check` が両者とも最新であることを検査する（手でコピーしない）。
   判定:
   - `sitemap.xml` = 失敗 / `sitemap-gsc.xml` = 成功 → 特定 sitemap URL に対する GSC 側の
     状態・キャッシュの問題。以後 `sitemap-gsc.xml` を正とし、`sitemap.xml` は残す。
   - 両方とも失敗 → URL 単位ではなくプロパティ側の sitemap processing の問題。GSC の
     プロパティ再作成、または robots.txt レポート・URL 検査の Live Test で実際の取得可否を確認する。
   - 両方とも成功 → 単なる伝播遅延だったと判断し、`sitemap-gsc.xml` は次の変更時に削除してよい
     （削除時は `SITEMAP_FILES` から外して再ビルド）。
   なお sitemap の取得状態はランキングとは独立であり、2 ページ・被リンクほぼゼロの新規サイトが
   上位に出ないこと自体は sitemap の問題ではない（§9.1-7 の 2〜4 週間の計測を継続する）。

---

## 11. Definition of Done（要求書 §12）

| 条件 | 状態 |
|------|------|
| Googlebot から主要プロフィール情報が HTML として取得できる | ✅ 静的生成 |
| H1 に Hiroto Fukada が存在する | ✅ |
| 深田大登 が本文に存在する | ✅ |
| Biography が存在する | ✅ 182 語 |
| 専門領域が明示されている | ✅ Expertise 7 領域 + hero チップ |
| JSON-LD の ProfilePage / Person が valid | ✅ パース・必須キー検証済み／Rich Results Test はデプロイ後（§9.1-6） |
| LinkedIn と ORCID が sameAs で接続されている | ✅ |
| Research Outputs が HTML テキストで取得可能 | ✅ |
| title / meta description が設定されている | ✅ |
| sitemap.xml が存在する | ✅ |
| robots.txt がクロールを阻害していない | ✅（§10-1） |
| Search Console に登録済み | 🟡 ユーザー実施（§9.1） |
| URL Inspection でレンダリング結果を確認済み | 🟡 ユーザー実施（§9.1） |
| Mobile 表示に重大な問題がない | ✅ 390px 目視 |
| 公開してはいけない個人情報が含まれていない | ✅ `--check` で機械検査 |

---

## 12. 変更管理

- サイト構造・JSON-LD・データ形式・公開境界を変える場合は本書を更新してからコミットする。
- 本書には公開して問題のない情報のみを書く（非公開の職務詳細は `docs/resume_design/` 側）。
