#!/usr/bin/env node
// 履歴書類ビルドスクリプト（仕様: docs/resume_design/DESIGN.md）
//
//   node resume/build.mjs                     # 職務経歴書: HTML + PDF
//   node resume/build.mjs --doc rirekisho     # 履歴書（Phase 4）
//   node resume/build.mjs --doc resume-en     # 英文レジュメ（Phase 5）
//   node resume/build.mjs --variant <name>    # variants/<name>.yaml を適用
//   node resume/build.mjs --check             # 整合チェックのみ（生成なし）
//   node resume/build.mjs --html-only         # PDF 化をスキップ
//
// データはすべて docs/resume_design/data/（非公開）と data/*.json（公開）から
// 読み込む。このファイルおよびテンプレートに個人情報を書かないこと。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PRIVATE_DIR = path.join(ROOT, 'docs', 'resume_design');
const DATA_DIR = path.join(PRIVATE_DIR, 'data');
const OUT_DIR = path.join(PRIVATE_DIR, 'output');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const DOC_NAMES = { shokumu: 'resume', rirekisho: 'rirekisho', 'resume-en': 'resume-en' };

// ---------------------------------------------------------------- args
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };
const doc = val('--doc') ?? 'shokumu';
const variantName = val('--variant');
const checkOnly = has('--check');
const htmlOnly = has('--html-only');

if (!DOC_NAMES[doc]) fail(`未知の --doc: ${doc}（shokumu / rirekisho / resume-en）`);

// ---------------------------------------------------------------- load
const masterPath = path.join(DATA_DIR, 'master.yaml');
if (!fs.existsSync(masterPath)) {
  fail(
    '非公開データが未配置です: docs/resume_design/data/master.yaml が見つかりません。\n' +
    '別マシンで clone した直後の場合は、private リモートまたはバックアップから\n' +
    'docs/resume_design/ を復元してください（手順: docs/resume_design/BACKGROUND.md）。'
  );
}
const masterRaw = fs.readFileSync(masterPath, 'utf8');
const master = yaml.load(masterRaw);
const works = readJson(path.join(ROOT, 'data', 'works.json'));
const siteExp = readJson(path.join(ROOT, 'data', 'experience.json'));
const siteEdu = readJson(path.join(ROOT, 'data', 'education.json'));

if (variantName) {
  const vPath = path.join(DATA_DIR, 'variants', `${variantName}.yaml`);
  if (!fs.existsSync(vPath)) fail(`variant が見つかりません: ${vPath}`);
  applyVariant(master, yaml.load(fs.readFileSync(vPath, 'utf8')));
}

// ---------------------------------------------------------------- check
const warnings = runChecks(master, masterRaw, siteExp, siteEdu);
if (warnings.length) {
  console.warn(`--- 整合チェック: ${warnings.length} 件の警告 ---`);
  for (const w of warnings) console.warn(`  ⚠ ${w}`);
} else {
  console.log('--- 整合チェック: 警告なし ---');
}
if (checkOnly) process.exit(warnings.length ? 2 : 0);

// ---------------------------------------------------------------- build
const tplPath = path.join(HERE, 'templates', `${doc}.html`);
if (!fs.existsSync(tplPath)) fail(`テンプレート未実装です: ${tplPath}（実装フェーズは DESIGN.md §9 参照）`);
const css = fs.readFileSync(path.join(HERE, 'styles', 'print.css'), 'utf8');

const now = new Date();
const ymd = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
const todayJa = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

const view = buildView(master, works, todayJa);
view.css = css;

const html = render(fs.readFileSync(tplPath, 'utf8'), [view]);

fs.mkdirSync(OUT_DIR, { recursive: true });
const base = `${DOC_NAMES[doc]}${variantName ? '_' + variantName : ''}_${ymd}`;
const htmlPath = path.join(OUT_DIR, `${base}.html`);
fs.writeFileSync(htmlPath, html);
console.log(`✓ HTML: ${path.relative(ROOT, htmlPath)}`);

if (!htmlOnly) {
  const pdfPath = path.join(OUT_DIR, `${base}.pdf`);
  if (!fs.existsSync(CHROME)) fail(`Chrome が見つかりません: ${CHROME}`);
  execFileSync(CHROME, [
    '--headless=new', `--print-to-pdf=${pdfPath}`, '--no-pdf-header-footer', htmlPath,
  ], { stdio: 'pipe' });
  console.log(`✓ PDF : ${path.relative(ROOT, pdfPath)}`);
}

// ================================================================ view
function buildView(m, worksJson, today) {
  const companies = (m.companies ?? []).map((c) => ({
    name: c.name,
    period_label: periodLabel(c.period),
    facts_line: factsLine(c),
    roles: (c.roles ?? []).map((r) => ({
      title: r.title,
      period_label: periodLabel(r.period),
      team: r.team ?? '',
      mission: r.mission ?? '',
      details: r.details ?? [],
    })),
    achievements: c.achievements ?? [],
    env_line: envLines(c.environment).map((e) => `${e.label}：${e.value}`).join('　／　'),
    project_rows: (c.projects ?? []).map((p) => ({
      title: p.title,
      cls: p.featured ? 'featured' : '',
    })),
    media: c.media ?? [],
  }));

  const worksExclude = m.works_exclude ?? [];
  const works_rows = worksJson
    .filter((w) => w.type === 'research')
    .filter((w) => !worksExclude.some((x) => [w.venue, w.venue_ja].some((v) => v && v.includes(x))))
    .sort((a, b) => (b.year - a.year) || ((b.month ?? 0) - (a.month ?? 0)))
    .map((w) => ({
      date: `${w.year}年${w.month ? w.month + '月' : ''}`,
      text: `${w.title}（${w.venue_ja ?? w.venue}${statusLabel(w) ? '、' + statusLabel(w) : ''}）`,
    }));

  return {
    today,
    meta: m.meta ?? {},
    summary: (m.summary ?? '').trim(),
    career_rows: (m.companies ?? []).map((c) => ({
      period: periodLabel(c.period),
      org: c.name,
      role: (c.roles ?? []).map((r) => r.title).join(' / '),
    })),
    companies,
    works_rows,
    education_rows: (m.education ?? []).map((e) => ({
      period: periodLabel(e.period),
      school: e.school,
      program: e.program,
      status: e.period?.to == null ? '在学中' : '卒業',
    })),
    skills: (m.skills ?? []).map((s) => ({ category: s.category, items_line: (s.items ?? []).join('、') })),
    certifications: m.certifications ?? [],
    self_pr: (m.self_pr ?? '').trim(),
  };
}

function statusLabel(w) { return w.status_ja ?? w.status ?? ''; }

function ymLabel(s) {
  const [y, mo] = String(s).split('-').map(Number);
  return `${y}年${mo}月`;
}
function periodLabel(p) {
  if (!p?.from) return '';
  return `${ymLabel(p.from)} 〜 ${p.to ? ymLabel(p.to) : '現在'}`;
}

function factsLine(c) {
  const f = c.facts ?? {};
  const parts = [];
  if (c.business) parts.push(`事業概要：${c.business}`);
  if (f.founded) parts.push(`設立：${f.founded}`);
  if (f.capital) parts.push(`資本金：${f.capital}`);
  if (f.listing) parts.push(`上場区分：${f.listing}`);
  if (f.employees) parts.push(`従業員：${f.employees}`);
  let line = parts.join('　／　');
  if (f.note) line += `　（${f.note}）`;
  return line;
}

function envLines(env) {
  if (!env) return [];
  const ENV_LABELS = [
    ['languages', '使用言語'], ['frameworks', 'フレームワーク'], ['databases', 'データベース'],
    ['bi', 'BIツール'], ['tools', 'その他ツール'], ['os', 'OS'], ['management', '開発管理'],
  ];
  return ENV_LABELS
    .filter(([k]) => env[k] != null && String(env[k]).length)
    .map(([k, label]) => ({ label, value: Array.isArray(env[k]) ? env[k].join('、') : String(env[k]) }));
}

// ================================================================ variant
// variants/<name>.yaml で許可される操作（DESIGN.md §5.3。事実の追加・改変は不可）:
//   summary: <差し替えテキスト> / self_pr: <差し替えテキスト>
//   featured_only: [SEP-06, ...]   # 指定 ID のみ featured にする
function applyVariant(m, v) {
  if (!v) return;
  const allowed = new Set(['summary', 'self_pr', 'featured_only']);
  for (const k of Object.keys(v)) {
    if (!allowed.has(k)) fail(`variant の未対応キー: ${k}（許可: ${[...allowed].join(', ')}）`);
  }
  if (v.summary) m.summary = v.summary;
  if (v.self_pr) m.self_pr = v.self_pr;
  if (Array.isArray(v.featured_only)) {
    for (const c of m.companies ?? []) {
      for (const p of c.projects ?? []) p.featured = v.featured_only.includes(p.id);
    }
  }
}

// ================================================================ checks
function runChecks(m, raw, exp, edu) {
  const warn = [];
  const norm = (s) => String(s ?? '').replace(/[\s　]+/g, '');

  // 1. 職歴: 組織名・期間・肩書 vs data/experience.json
  const siteByOrg = new Map(exp.map((o) => [norm(o.organization_ja), o]));
  for (const c of m.companies ?? []) {
    const site = siteByOrg.get(norm(c.name));
    if (!site) { warn.push(`experience.json に「${c.name}」に一致する組織がない`); continue; }
    siteByOrg.delete(norm(c.name));
    const sp = parseEnPeriod(site.period);
    if (sp) {
      if (sp.from !== c.period?.from) warn.push(`${c.name}: 開始月ズレ（master=${c.period?.from} / site=${sp.from}）`);
      if ((sp.to ?? null) !== (c.period?.to ?? null)) warn.push(`${c.name}: 終了月ズレ（master=${c.period?.to ?? '現在'} / site=${sp.to ?? '現在'}）`);
    } else warn.push(`${c.name}: サイト側 period を解析できない（"${site.period}"）`);
    const siteTitles = new Set((site.roles ?? []).map((r) => norm(r.title_ja)));
    const masterTitles = new Set((c.roles ?? []).map((r) => norm(r.title)));
    for (const t of masterTitles) if (!siteTitles.has(t)) warn.push(`${c.name}: 肩書「${[...(c.roles ?? [])].map((r) => r.title).find((x) => norm(x) === t)}」がサイト側にない`);
    for (const o of site.roles ?? []) if (!masterTitles.has(norm(o.title_ja))) warn.push(`${c.name}: サイト側の肩書「${o.title_ja}」が master にない`);
  }
  for (const [, o] of siteByOrg) warn.push(`master に「${o.organization_ja}」がない（サイト側にのみ存在）`);

  // 2. 学歴 vs data/education.json
  const eduByName = new Map(edu.map((e) => [norm(e.institution_ja), e]));
  for (const e of m.education ?? []) {
    const site = eduByName.get(norm(e.school));
    if (!site) { warn.push(`education.json に「${e.school}」に一致する学校がない`); continue; }
    eduByName.delete(norm(e.school));
    if (norm(site.program_ja) !== norm(e.program)) warn.push(`${e.school}: 課程表記ズレ（master=${e.program} / site=${site.program_ja}）`);
    const sp = parseEnPeriod(site.period);
    if (sp && (sp.from !== e.period?.from || (sp.to ?? null) !== (e.period?.to ?? null))) {
      warn.push(`${e.school}: 期間ズレ（master=${e.period?.from}〜${e.period?.to ?? '現在'} / site=${sp.from}〜${sp.to ?? '現在'}）`);
    }
  }
  for (const [, e] of eduByName) warn.push(`master に「${e.institution_ja}」がない（サイト側にのみ存在）`);

  // 3. 時系列整合（重複は許容、1ヶ月超の空白を警告）
  const spans = (m.companies ?? [])
    .map((c) => ({ name: c.name, from: ymNum(c.period?.from), to: c.period?.to ? ymNum(c.period.to) : Infinity }))
    .sort((a, b) => a.from - b.from);
  let covered = -Infinity, prevName = '';
  for (const s of spans) {
    if (covered !== -Infinity && s.from > covered + 1) {
      warn.push(`空白期間: ${prevName} 終了後〜${s.name} 開始まで ${s.from - covered - 1} ヶ月の空白`);
    }
    if (s.to > covered) { covered = s.to; prevName = s.name; }
  }

  // 4. TODO 残存
  raw.split('\n').forEach((line, i) => {
    if (line.includes('# TODO')) warn.push(`master.yaml:${i + 1} TODO残存: ${line.trim().replace(/^.*# ?/, '')}`);
  });

  return warn;
}

function parseEnPeriod(str) {
  const EN_MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  const mt = String(str ?? '').match(/([A-Z][a-z]{2})\s+(\d{4})\s*[–—-]\s*(?:([A-Z][a-z]{2})\s+(\d{4})|Present)/);
  if (!mt) return null;
  return {
    from: `${mt[2]}-${pad2(EN_MONTHS[mt[1]])}`,
    to: mt[3] ? `${mt[4]}-${pad2(EN_MONTHS[mt[3]])}` : null,
  };
}
function ymNum(s) { const [y, mo] = String(s).split('-').map(Number); return y * 12 + (mo - 1); }

// ================================================================ template
// {{path}}（HTMLエスケープ置換）/ {{{path}}}（raw置換。cssのみ）/
// {{#each path}}...{{/each}} / {{#if path}}...{{/if}}
// テンプレートエンジンは導入しない（DESIGN.md §6）。
function render(src, scopes) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{{', i);
    if (open === -1) { out += src.slice(i); break; }
    out += src.slice(i, open);
    if (src.startsWith('{{#', open)) {
      const tagEnd = src.indexOf('}}', open);
      const [kind, pathExpr] = src.slice(open + 3, tagEnd).trim().split(/\s+/);
      let depth = 1, j = tagEnd + 2, bodyEnd = -1;
      while (depth > 0) {
        const nextOpen = src.indexOf('{{#', j);
        const nextClose = src.indexOf('{{/', j);
        if (nextClose === -1) throw new Error(`閉じられていないブロック: ${kind} ${pathExpr}`);
        if (nextOpen !== -1 && nextOpen < nextClose) { depth++; j = src.indexOf('}}', nextOpen) + 2; }
        else { depth--; j = src.indexOf('}}', nextClose) + 2; if (depth === 0) bodyEnd = nextClose; }
      }
      const body = src.slice(tagEnd + 2, bodyEnd);
      const v = lookup(pathExpr, scopes);
      if (kind === 'each') {
        for (const item of Array.isArray(v) ? v : []) out += render(body, [...scopes, item]);
      } else if (kind === 'if') {
        if (Array.isArray(v) ? v.length > 0 : Boolean(v)) out += render(body, scopes);
      } else {
        throw new Error(`未知のブロック種別: ${kind}`);
      }
      i = j;
    } else if (src.startsWith('{{{', open)) {
      const end = src.indexOf('}}}', open);
      out += String(lookup(src.slice(open + 3, end).trim(), scopes) ?? '');
      i = end + 3;
    } else {
      const end = src.indexOf('}}', open);
      out += escapeHtml(lookup(src.slice(open + 2, end).trim(), scopes));
      i = end + 2;
    }
  }
  return out;
}
function lookup(pathExpr, scopes) {
  if (pathExpr === '.') return scopes[scopes.length - 1];
  const parts = pathExpr.split('.');
  for (let s = scopes.length - 1; s >= 0; s--) {
    let v = scopes[s];
    let ok = true;
    for (const p of parts) {
      if (v != null && typeof v === 'object' && p in v) v = v[p];
      else { ok = false; break; }
    }
    if (ok) return v;
  }
  return undefined;
}
function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

// ================================================================ util
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function pad2(n) { return String(n).padStart(2, '0'); }
function fail(msg) { console.error(`エラー: ${msg}`); process.exit(1); }
