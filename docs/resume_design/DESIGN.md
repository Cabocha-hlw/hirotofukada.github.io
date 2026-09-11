# 職務経歴書・履歴書 作成システム設計書

- Status: Draft v1.0（2026-08-09）
- 対象リポジトリ: `hirotofukada.github.io`（個人ページ・**公開リポジトリ**）
- 本書はコーディングエージェント（Claude Code）が履歴書類を作成・更新・検証する際の
  **仕様書 兼 ランブック**である。エージェントは履歴書関連の作業前に必ず本書を読むこと。
- 設計背景・代替案比較・旧版の分析は非公開の `docs/resume_design/BACKGROUND.md`
  にある（gitignore 対象。このリポジトリには含まれない）。

---

## 1. 目的

1. 個人ページを管理する本リポジトリで、履歴書類も一元管理する。
2. 「データを更新 → ビルド → PDF」の再現可能なパイプラインを整備し、
   コーディングエージェントが更新・生成・検証まで代行できるようにする。
3. 公開サイトのデータ（`data/*.json`）と履歴書の内容を単一情報源で整合させ、
   二重管理と記載ズレをなくす。

### 成果物（出力ターゲット）

| ID | 文書 | 言語 | 想定分量 | 優先度 |
|----|------|------|----------|--------|
| `shokumu` | 職務経歴書（自由書式） | 日本語 | A4 2〜4枚 | 最優先 |
| `rirekisho` | 履歴書（JIS様式準拠のレイアウト） | 日本語 | A4 2枚（見開き相当） | 中 |
| `resume-en` | 英文レジュメ / CV | 英語 | A4 1〜2枚 | 中 |

### 非目標

- 履歴書類をウェブサイト上で公開すること（応募先にのみ提出する私的文書とする）。
- 旧版PDFのデザイン踏襲（内容の移行元としてのみ扱う）。

---

## 2. 前提と制約

- **本リポジトリは公開されており、GitHub Pages として配信される。コミット＝全世界公開。**
  したがって個人情報（住所・電話・生年月日・写真）、勤務先の非公開情報
  （体制人数・社内固有名詞・プロジェクト詳細）、生成した履歴書そのものは
  **絶対にコミットしない**。非公開情報はすべて `docs/resume_design/` 配下
  （gitignore 済み、`DESIGN.md` のみ例外）に置く。
- ローカル環境（macOS）で完結させる。PDF 化は **ヘッドレス Chrome** を使う
  （インストール済み。追加のPDFツール導入は不要）。
- ビルドは Node（インストール済み）。依存は `js-yaml` のみとし、最小に保つ。
- デザインは**シンプル**（白黒基調・装飾最小・可読性優先）。

---

## 3. アーキテクチャ

「構造化データ + テンプレート → HTML → PDF」の一方向パイプライン。
**生成物（HTML/PDF）は手で編集しない。修正は必ずデータかテンプレートに対して行う。**

```
[非公開] docs/resume_design/data/
   master.yaml      職務経歴の全量データ（履歴書側の単一情報源）
   personal.yaml    個人情報（履歴書用: 住所・連絡先・写真パス等）
   variants/*.yaml  応募先別の調整パッチ（選抜・並べ替え・強調）
        │
        │  取り込み・整合チェック
        ▼
[公開]   data/*.json（サイトの単一情報源）
   works.json      → 研究業績セクションとして直接取り込む
   experience.json / education.json → 記載ズレの整合チェック対象
        │
        ▼
[公開]   resume/build.mjs ＋ resume/templates/*.html ＋ resume/styles/print.css
        │
        ▼
[非公開] docs/resume_design/output/
   resume_YYYYMMDD.html / .pdf  等
```

### データ責務の分担

| データ | 場所 | 公開 | 役割 |
|--------|------|------|------|
| `data/*.json` | リポジトリ直下 | 公開 | サイト表示用。公開してよい粒度の経歴・業績 |
| `master.yaml` | 非公開領域 | 非公開 | 履歴書の全量。非公開の詳細（体制・環境・実績数値・プロジェクト）を持つ |
| `personal.yaml` | 非公開領域 | 非公開 | 履歴書（JIS）にのみ必要な個人情報 |
| `variants/*.yaml` | 非公開領域 | 非公開 | master への差分。**事実の追加は禁止**（§7.2） |

- **研究業績は `works.json` を唯一の情報源とし、ビルド時に直接取り込む**
  （履歴書側に業績を重複記載しない）。
- 職歴・学歴は履歴書側（master.yaml）が詳細を持つため直接共有できない。
  代わりにビルドの `--check` で組織名・期間・肩書の**整合チェック**を行い、
  サイトと履歴書のズレを検出する（§6）。

---

## 4. ディレクトリ構成と公開境界

```
hirotofukada.github.io/
├── .gitignore                  # 非公開境界の定義（本設計の前提）
├── data/                       # [公開] サイトデータ（既存）
├── docs/
│   └── resume_design/          # ワークスペース（DESIGN.md 以外すべて gitignore）
│       ├── DESIGN.md           # [公開] 本書（唯一のコミット対象）
│       ├── BACKGROUND.md       # [非公開] 設計背景・旧版分析・意思決定記録
│       ├── *.pdf               # [非公開] 過去参照資料（旧職務経歴書）
│       ├── data/
│       │   ├── master.yaml     # [非公開] 職務経歴マスターデータ
│       │   ├── personal.yaml   # [非公開] 個人情報（履歴書用）
│       │   ├── photo.jpg       # [非公開] 履歴書用写真
│       │   └── variants/       # [非公開] 応募先別パッチ
│       └── output/             # [非公開] 生成物（HTML/PDF）
└── resume/                     # [公開] ビルド資材（Phase 2 で作成）
    ├── package.json            # 依存: js-yaml のみ
    ├── build.mjs               # データ読込→テンプレ差し込み→HTML/PDF
    ├── templates/
    │   ├── shokumu.html        # 職務経歴書テンプレート
    │   ├── rirekisho.html      # 履歴書（JIS様式風）テンプレート
    │   └── resume-en.html      # 英文レジュメテンプレート
    └── styles/
        └── print.css           # A4 印刷用の共通スタイル
```

**公開境界の原則**: `resume/` 配下（テンプレート・スクリプト）には個人情報を
一切埋め込まない。個人情報・実データは常に `docs/resume_design/` 配下に置く。
コミットされたファイルは GitHub Pages で配信されうることを常に意識する。

---

## 5. データモデル

### 5.1 `master.yaml`（職務経歴マスター）

スキーマ概要（値はサンプル。実データは非公開領域にのみ書く）:

```yaml
meta:
  name: 深田 大登
  name_en: Hiroto Fukada
  title: データサイエンティスト / プロダクトマネージャー / 博士課程学生

summary: |            # 職務要約（5〜8行。だ・である調で簡潔に）
  ...

companies:            # 新しい順
  - id: sep           # プロジェクトID接頭辞（例: SEP-01）に使う
    name: Septeni Japan株式会社
    period: {from: 2023-02, to: null}    # to: null = 現在
    business: デジタルマーケティング支援事業
    facts: {founded: ..., capital: ..., listing: ..., employees: ...}
    roles:
      - title: プロダクトマネージャー
        period: {from: 2024-07, to: null}
        team: ...     # 所属・体制（非公開情報）
        mission: ...  # 担当業務
        details: [...]# 業務内容の箇条書き
    achievements: [...]   # 実績・受賞（定量値を優先）
    environment:          # 環境（言語/FW/DB/BI/OS/管理）
      languages: [Python, R, SQL]
      frameworks: [...]
    projects:
      - id: SEP-06
        period: {from: 2023-10, to: 2024-08}
        title: ...
        featured: true    # true のみ詳細カードを出力
        overview: ...
        phases: ...       # 担当フェーズ
        details: [...]    # 業務内容
        outcomes: [...]   # 実績・取り組み
        environment: {...}
        scale: {members: ..., role: ...}

education:            # 学歴（履歴書の学歴欄・職務経歴書の末尾に使用）
  - {school: ..., program: ..., period: {...}}

skills:               # 活かせる経験・知識・スキル
  - category: 統計・機械学習
    items: [...]

certifications: [...] # 資格

self_pr: |            # 自己PR
  ...
```

規約:

- 日付は `YYYY-MM` 形式。`to: null` が「現在」。ビルド時に「◯年◯月 〜 現在」へ整形。
- 研究業績はここに**書かない**（`works.json` から取り込む）。ただし履歴書に
  載せたくない業績はトップレベルの `works_exclude:`（venue の部分一致リスト）で
  除外できる（サイト側 `works.json` には影響しない）。
- 受賞・実績は可能な限り定量値（規模・伸長率・売上・回数）を添える。
- 下書き中の未確認情報は `# TODO:` コメントを付け、確認が取れるまで出力対象にしない。

### 5.2 `personal.yaml`（履歴書専用）

氏名ふりがな・生年月日・住所・電話・メール・写真パス・通勤時間・扶養等、
JIS様式の欄に対応するキーのみを持つ。`shokumu` / `resume-en` からは参照しない。

### 5.3 `variants/<応募先>.yaml`（応募別調整）

master に対する**表示調整のパッチ**。できる操作は以下に限る:

- プロジェクトの選抜（`featured` の上書き）・並べ替え
- summary / self_pr の差し替え（応募先に合わせた強調）
- セクションの表示/非表示

**事実（経歴・数値・実績）の新規追加・改変は不可。** 事実の変更は必ず master に行う。

---

## 6. ビルドと PDF 化

### コマンド体系（Phase 2 で実装）

```bash
cd resume && npm install        # 初回のみ（js-yaml）

node resume/build.mjs                     # 職務経歴書: HTML + PDF を output/ へ
node resume/build.mjs --doc rirekisho     # 履歴書
node resume/build.mjs --doc resume-en     # 英文レジュメ
node resume/build.mjs --variant <name>    # variants/<name>.yaml を適用
node resume/build.mjs --check             # 整合チェックのみ（生成なし）
node resume/build.mjs --html-only         # PDF 化をスキップ
```

### 実装要件

- テンプレートは素の HTML。差し込みは `{{path.to.value}}` 形式の単純置換と
  配列セクションの繰り返しのみ（テンプレートエンジンは導入しない）。
- PDF 化はヘッドレス Chrome を子プロセスで呼ぶ:

  ```
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --headless=new --print-to-pdf=<出力先> --no-pdf-header-footer <HTMLパス>
  ```

- 出力ファイル名は ASCII のみとし、`resume_YYYYMMDD.pdf` 形式（variant 適用時は
  `resume_<variant>_YYYYMMDD.pdf`。`rirekisho` / `resume-en` は接頭辞を各 doc 名にする）。
  文書内の「YYYY年MM月DD日現在」はビルド日で自動挿入する。
- `master.yaml` が存在しない場合は「非公開データが未配置。BACKGROUND.md の
  復元手順を参照」と明示してエラー終了する（別マシンでの clone 直後を想定）。

### `--check`（整合チェック）の検査項目

1. `master.yaml` の各社の組織名・期間・肩書が `data/experience.json` と一致するか
   （サイト側が新しい/履歴書側が新しい、の双方向でズレを報告）。
2. `education` と `data/education.json` の一致。
3. 期間の時系列整合（重複は許容、意図しない空白期間を警告）。
4. `# TODO:` コメントの残存検出。

---

## 7. コーディングエージェント運用フロー

### 7.1 更新フロー（経歴・実績が増えたとき）

1. ユーザーから更新内容を聞き取る（または `data/*.json` の差分から変更を検知する）。
2. `master.yaml` を編集する。**推測で事実を書かない。不明点は必ずユーザーに確認する。**
3. `--check` を実行し、サイトデータとのズレを解消する
   （公開してよい情報なら `data/*.json` にも反映し、サイトと履歴書を同時に最新化する）。
4. ビルドして PDF を生成する。
5. **生成 PDF をエージェント自身が開いて目視検証する**（§7.3）。
6. 結果報告（ページ数・主な変更点・チェック結果）。コミットは §7.4 のゲートを通す。

### 7.2 応募別テーラリング・フロー

1. ユーザーから応募先情報（求人票・JD）を受け取る。
2. JD の要求と master の内容を突き合わせ、強調すべき経験・プロジェクトを提案する。
3. 合意した方針を `variants/<応募先>.yaml` として作成する（§5.3 の操作のみ）。
4. `--variant` 付きでビルドし、master 版との差分（何を削り何を強調したか）を報告する。

### 7.3 検証チェックリスト（ビルド後に毎回実施）

- [ ] ビルドが正常終了し、`--check` の警告がゼロ
- [ ] PDF のページ数が目標内（職務経歴書 2〜4 / 履歴書 2 / 英文 1〜2）
- [ ] 生成 PDF を Read で読み、レイアウト崩れがない
      （文字のはみ出し・表の分断・ページ末尾の孤立見出し・余白の異常）
- [ ] 日付表記が統一され、時系列に矛盾がない
- [ ] 全記載が master.yaml / works.json に由来する（出力にしかない記述がない）
- [ ] 誤字脱字・表記ゆれ（社名の正式表記、全角半角）がない

### 7.4 ガードレール（禁止事項とコミット前ゲート)

- **事実の創作・誇張の禁止。** データにない実績・数値・肩書を出力に足さない。
- **非公開領域の外に個人情報を書かない。** テンプレート・スクリプト・本書への
  実データ埋め込み禁止。コード例・スキーマ例もプレースホルダーで書く。
- **生成物の直接編集禁止。** 修正は data / templates / styles に対して行う。
- **コミット前ゲート**（履歴書関連の変更をコミットする前に必ず実行）:
  1. `git status --short` に `docs/resume_design/` 配下が `DESIGN.md` 以外
     現れないことを確認
  2. `git check-ignore docs/resume_design/data/master.yaml` が無視判定を返すことを確認
  3. ステージ対象の差分に個人情報・社内情報が含まれないことを目視確認

---

## 8. デザイン方針（シンプル指向）

- A4 縦・余白 18〜20mm・1 カラム。白黒基調、罫線と太字のみで階層を表現
  （背景色ベタ塗りの見出しは使わない）。
- フォント: `"Hiragino Kaku Gothic ProN", "Hiragino Sans", sans-serif`
  （macOS 標準。本文 10.5pt 前後、見出し 12〜14pt、行間 1.5〜1.6）。
- 職務経歴書の章立て（日本の慣行に準拠）:
  1. 職務要約
  2. 職務経歴（一覧表: 期間・組織・職種）
  3. 組織別詳細（所属・担当・業務内容・実績・環境・プロジェクト例。
     プロジェクト例は箇条書きで、`featured: true` の項目は太字で強調する。
     詳細カードは出力しない — 詳細データは master.yaml に保持し、
     必要になれば応募先別 variant で復活させる）
  4. 研究業績・受賞（`works.json` から自動生成）
  5. 活かせる経験・スキル
  6. 資格
  7. 自己PR
- 印刷 CSS: `@page { size: A4; margin: ... }`、`break-inside: avoid` を
  カード・表の行に適用し、見出し直後の改ページを防ぐ。

---

## 9. 実装フェーズ計画

| Phase | 内容 | 完了条件 |
|-------|------|----------|
| 0 | 公開境界の設定（.gitignore）と本設計書 | ignore 検証済み・本書コミット |
| 1 | `master.yaml` の起こし。旧PDF＋`data/*.json`＋ユーザーへの確認で全量データ化。旧PDF以降の差分（進学・現職の変化・新規業績）を反映 | ユーザーレビュー済みの master.yaml |
| 2 | `resume/`（テンプレート・build.mjs・print.css）実装、職務経歴書 PDF 生成 | §7.3 チェック全通過の PDF |
| 3 | `--check` 整合チェック実装 | サイトデータとのズレ検出が機能 |
| 4 | 履歴書（JIS様式風）テンプレート | 同上 |
| 5 | 英文レジュメ テンプレート | 同上 |
| 6 | テーラリング運用（variants）開始 | 初回の応募別 PDF 生成 |

Phase 1 と 2 は独立に進められる（テンプレートはサンプルデータで開発可能）。

---

## 10. バックアップと複数マシン運用

非公開領域は git 履歴を持たないため、消失リスクに備える:

- **推奨**: `docs/resume_design/` を独立した **private リポジトリ**として初期化し、
  private リモートへ push する（親リポジトリは同領域を ignore しているため干渉しない）。
- 代替: Google Drive 等へ定期コピー。
- 別マシンで作業する場合は、clone 後に非公開領域を private リモートまたは
  バックアップから復元する（手順詳細は `BACKGROUND.md`）。

---

## 11. 本書の変更管理

- パイプライン・公開境界・運用フローの変更時は本書を更新してからコミットする。
- 本書には公開して問題のない情報のみを書く。背景・分析・実データに関わるメモは
  `BACKGROUND.md`（非公開）へ。
