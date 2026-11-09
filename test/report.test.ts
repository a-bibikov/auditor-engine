import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { penaltyOf, toMarkdown, type Report, type ReportRule } from "../src/index.ts";

const rule = (r: Omit<ReportRule, "counts" | "pages" | "addresses">, counts: Partial<ReportRule["counts"]> = {}, pages = 0): ReportRule => ({
  ...r,
  counts: { error: 0, warn: 0, info: 0, ...counts },
  pages,
  addresses: 0,
});

const report = (lang: "en" | "ru"): Report => ({
  site: "https://ada.example",
  lang,
  checkedAt: "2026-11-03T00:00:00.000Z",
  pages: ["https://ada.example/", "https://ada.example/cv", "https://ada.example/blog"],
  score: 75,
  grade: "C",
  counts: { error: 1, warn: 2, info: 1 },
  checked: 4,
  total: 5,
  capped: false,
  groups:
    lang === "ru"
      ? { A: "Доступ для AI-агентов", B: "Текст без JavaScript", C: "Сущности и авторство" }
      : { A: "Access for AI agents", B: "Text without JavaScript", C: "Entities and authorship" },
  findings: [
    { rule: "B-3", level: "warn", where: "https://ada.example/", message: "H1 | glued" },
    { rule: "B-3", level: "warn", where: "https://ada.example/cv", message: "H1" },
    { rule: "B-1", level: "error", where: "https://ada.example/", message: "few words" },
    { rule: "A-2", level: "info", where: "site", message: "policy" },
  ],
  rules: [
    rule({ id: "A-1", group: "A", level: "error", status: "ok", title: "Agents allowed", fix: "allow", impact: "AI cannot read." }),
    rule({ id: "A-2", group: "A", level: "info", status: "info", title: "Training policy", fix: "decide", impact: "Undecided." }, { info: 1 }),
    rule({ id: "A-5", group: "A", level: "warn", status: "skipped", skipped: "no feed", title: "Feed declared", fix: "link", impact: "No feed." }),
    rule({ id: "B-1", group: "B", level: "error", status: "error", title: "Text in HTML", todo: "Render on the server", fix: "render", impact: "Empty page for AI." }, { error: 1 }, 1),
    rule({ id: "B-3", group: "B", level: "warn", status: "warn", title: "Headings not glued", todo: "Put a space", fix: "space", impact: "Glued headings." }, { warn: 2 }, 2),
  ],
});

/** Table rows without the padding, to compare content and not spaces. */
const rows = (md: string) => md.split("\n").map((l) => (l.startsWith("|") ? l.replace(/ {2,}/g, " ").replace(/ \|/g, " |") : l)).join("\n");

describe("report tables", () => {
  it("has a table per group with the status, the check and the result", () => {
    const md = rows(toMarkdown(report("en")));
    const list = md.slice(md.indexOf("## Checklist"), md.indexOf("## Details"));
    assert.match(list, /### A\. Access for AI agents\n\n1 of 2 OK · 1 not checked\n\n\| \| Check \| Result \|/);
    assert.match(list, /\| ✓ \| A-1 Agents allowed \| OK \|/);
    assert.match(list, /\| ℹ \| A-2 Training policy \| 1 note \|/);
    assert.match(list, /\| – \| A-5 Feed declared \| not checked: no feed \|/);
    const allSkipped = rows(toMarkdown({ ...report("en"), rules: [report("en").rules[2]!] }));
    assert.match(allSkipped, /### A\. Access for AI agents\n\n1 not checked\n/, "no «0 of 0 OK»");
    assert.match(list, /\| ⚠ \| B-3 Headings not glued \| 2 warnings · 2 of 3 pages \|/);
    assert.doesNotMatch(list, /Entities and authorship/, "groups without audited checks are left out");
    assert.match(md, /✓ OK · ✖ error/);
  });

  it("pads columns, so the table reads as one in a terminal", () => {
    const lines = toMarkdown(report("en")).split("\n");
    const start = lines.findIndex((l) => l.startsWith("| ") && l.includes("Check"));
    const block = lines.slice(start, start + 5);
    assert.ok(block.every((l) => [...l].length === [...block[0]!].length), block.join("\n"));
  });

  it("ends with one table of recommendations: check, severity, what to do, comment", () => {
    const md = rows(toMarkdown(report("en")));
    const block = md.slice(md.indexOf("## Recommendations"));
    assert.ok(md.indexOf("## Recommendations") > md.indexOf("## Checklist"), "after the checklist");
    assert.match(block, /\| Check \| Severity \| What to do \| Comment \|/);
    assert.match(block, /\| B-1 \| ✖ error \| \*\*Render on the server\.\*\* render \| `\/` — few words \|/);
    // The same message on several pages is said once, with its pages; a pipe in a message does not break the table.
    assert.match(block, /\| B-3 \| ⚠ warning \| \*\*Put a space\.\*\* space \| `\/` — H1 \\\| glued; `\/cv` — H1 \|/);
    assert.match(block, /\| A-2 \| ℹ note \| \*\*decide\.\*\* decide \| policy \|/, "no todo: the first sentence of the fix");
    assert.ok(block.indexOf("| A-2 ") < block.indexOf("| B-1 ") && block.indexOf("| B-1 ") < block.indexOf("| B-3 "), "in checklist order: group, then number");
    assert.doesNotMatch(md, /## Details|### ✖/);
  });

  it("groups the same finding on many pages and counts the rest", () => {
    const r = report("ru");
    const many = ["/", "/a", "/b", "/c", "/d", "/e", "/f"].map((p) => ({ rule: "B-3", level: "warn" as const, where: `https://ada.example${p}`, message: "нет og:image" }));
    const md = rows(toMarkdown({ ...r, findings: [...r.findings.filter((f) => f.rule !== "B-3"), ...many] }));
    assert.match(md, /\| B-3 \| ⚠ предупреждение \| \*\*Put a space\.\*\* space \| `\/`, `\/a`, `\/b`, `\/c`, `\/d`, и ещё 2 — нет og:image \|/);
  });

  it("fits a terminal: tables take the given width, long cells wrap inside their column", () => {
    const md = toMarkdown(report("ru"), { width: 70 });
    const tables = md.split("\n").filter((l) => l.startsWith("|"));
    assert.ok(tables.every((l) => [...l].length <= 70), tables.find((l) => [...l].length > 70));
    // A wrapped row continues on lines whose first cells are empty, so the check id stands once.
    const rec = md.slice(md.indexOf("## Рекомендации")).split("\n").filter((l) => l.startsWith("|"));
    assert.ok(rec.some((l) => /^\| +\| +\| \S/.test(l)), "continuation lines");
    assert.equal(rec.filter((l) => /^\| B-3 /.test(l)).length, 1);
  });

  it("keeps plain Markdown without a width: one line per row, for files and CI summaries", () => {
    const md = toMarkdown(report("ru"));
    const rec = md.slice(md.indexOf("## Рекомендации")).split("\n").filter((l) => l.startsWith("|"));
    assert.equal(rec.length, 2 + report("ru").rules.filter((x) => report("ru").findings.some((f) => f.rule === x.id)).length);
  });

  it("shows bare HTML tags as code, so a Markdown viewer does not swallow the table", () => {
    const r = report("en");
    r.rules = r.rules.map((x) => (x.id === "B-1" ? { ...x, title: "Content sits in <main>", fix: "Give every page a unique <title> of 10–60 characters; `<meta name=\"description\">` stays as it is." } : x));
    const md = toMarkdown(r);
    assert.match(md, /`<title>`/);
    assert.match(md, /B-1 Content sits in `<main>`/);
    assert.match(md, /`<meta name="description">` stays/, "code that is already code is left alone");
    assert.doesNotMatch(md.replace(/`[^`]*`/g, ""), /<(title|main|meta)\b/, "no tag outside code");
  });

  it("is translated", () => {
    const md = rows(toMarkdown(report("ru")));
    assert.match(md, /## Чек-лист/);
    assert.match(md, /в порядке: 1 из 2 · не проверено: 1/);
    assert.match(md, /\| ⚠ \| B-3 Headings not glued \| 2 предупреждения · 2 страницы из 3 \|/);
    assert.match(md, /## Рекомендации/);
    assert.match(md, /\| Проверка \| Критичность \| Что сделать \| Комментарий \|/);
    assert.match(md, /\| A-2 \| ℹ заметка \|/);
  });

  it("starts with what to do first, costliest first, with the scale", () => {
    const md = toMarkdown(report("en"));
    const block = md.slice(md.indexOf("## What to do first"), md.indexOf("## Checklist"));
    // B-1 error costs 15; B-3 warns on 2 of 3 pages, a site-wide problem that costs 10; A-2 is a note and costs nothing.
    assert.match(
      block,
      /1\. \*\*Render on the server\*\* \(B-1\) {2}\n {3}Found on 1 of 3 audited pages: `\/` {2}\n {3}Why it matters: empty page for AI\.\n2\. \*\*Put a space\*\* \(B-3\) {2}\n {3}Found on 2 of 3 audited pages: `\/`, `\/cv` {2}\n {3}Why it matters: glued headings\.\n\n/,
    );
    assert.doesNotMatch(block, /Undecided/);
  });

  it("names the first five pages of a priority and counts the rest", () => {
    const r = report("ru");
    const paths = ["/", "/a", "/b", "/c", "/d", "/e", "/f"];
    const many = paths.map((p) => ({ rule: "B-3", level: "warn" as const, where: `https://ada.example${p}`, message: "H1" }));
    const md = toMarkdown({ ...r, pages: paths.map((p) => `https://ada.example${p}`).concat("https://ada.example/g"), findings: [...r.findings.filter((f) => f.rule !== "B-3"), ...many] });
    assert.match(md, /Найдено на 7 страницах из 8 проверенных: `\/`, `\/a`, `\/b`, `\/c`, `\/d`, и ещё 2 {2}\n/);
  });

  it("names one page in the singular and keeps names capitalised after the label", () => {
    const md = toMarkdown({ ...report("ru"), rules: report("ru").rules.map((x) => (x.id === "B-1" ? { ...x, impact: "ChatGPT видит пустую страницу." } : x)) });
    assert.match(md, /Найдено на 1 странице из 3 проверенных: `\/` {2}\n {3}Чем это плохо: ChatGPT видит пустую страницу\./);
  });

  it("counts addresses beyond the audited pages as addresses, not as a share of the pages", () => {
    const r = report("ru");
    const extra = Array.from({ length: 5 }, (_, i) => ({ rule: "B-3", level: "warn" as const, where: `https://ada.example/tag/${i}`, message: "not in the sitemap" }));
    const md = toMarkdown({ ...r, findings: [...r.findings.filter((f) => f.rule !== "B-3"), ...extra] });
    assert.match(md, /Найдено по 5 адресам: `\/tag\/0`/);
    assert.match(rows(md), /\| ⚠ \| B-3 Headings not glued \| 2 предупреждения · 5 адресов \|/);
    assert.doesNotMatch(md, /5 (страниц|страницах) из 3/, "never «5 of 3»");
    // A wide warning is weighed by audited pages only: five addresses outside the sample are not «most of the site».
    assert.equal(penaltyOf(extra, 3, r.pages), 5);
  });

  it("says when a priority is about the site as a whole", () => {
    const r = report("ru");
    const md = toMarkdown({ ...r, findings: [{ rule: "B-1", level: "error", where: "site", message: "no JSON-LD" }] });
    assert.match(md, /\*\*Render on the server\*\* \(B-1\) {2}\n {3}Касается сайта целиком {2}\n/);
  });

  it("shows coverage in the summary and says when the grade is capped", () => {
    const md = toMarkdown({ ...report("ru"), checked: 12, total: 20, capped: true, grade: "B", score: 95 });
    assert.match(md, /\*\*95\/100 \(B\)\*\* · проверено: 12 из 20 ·/);
    assert.match(md, /Оценка ограничена B: на этом сайте удалось выполнить только 12 проверок из 20\./);
  });

  it("orders recommendations by the groups of the checklist, parts included", () => {
    const r = report("en");
    const md = rows(
      toMarkdown({
        ...r,
        groups: { S: "Sitemap", A: "Access for AI agents", B: "Text without JavaScript" },
        rules: [...r.rules, rule({ id: "S-1", group: "S", level: "info", status: "info", title: "Sitemap exists", fix: "add", impact: "Late." }, { info: 1 })],
        findings: [...r.findings, { rule: "S-1", level: "info", where: "site", message: "no sitemap" }],
        sections: [
          { name: "Classic search", score: 100, grade: "A", checked: 1, total: 1, groups: ["S"] },
          { name: "AI search", score: 75, grade: "C", checked: 4, total: 5, groups: ["A", "B"] },
        ],
      }),
    );
    const block = md.slice(md.indexOf("## Recommendations"));
    const ids = [...block.matchAll(/^\| ([A-Z]+-\d+) /gm)].map((m) => m[1]);
    assert.deepEqual(ids, ["S-1", "A-2", "B-1", "B-3"], "a note of the first group comes before an error of a later one");
  });

  it("splits the checklist by part when the parts list their groups", () => {
    const md = rows(
      toMarkdown({
        ...report("en"),
        groups: { S: "Sitemap", A: "Access for AI agents", B: "Text without JavaScript" },
        rules: [...report("en").rules, rule({ id: "S-1", group: "S", level: "warn", status: "ok", title: "Sitemap exists", fix: "add", impact: "Late." })],
        sections: [
          { name: "Classic search", score: 100, grade: "A", checked: 1, total: 1, groups: ["S"] },
          { name: "AI search", score: 75, grade: "C", checked: 4, total: 5, groups: ["A", "B"] },
        ],
      }),
    );
    assert.match(md, /\| Part \| Score \| Checks run \| ✖ Errors \| ⚠ Warnings \| ℹ Notes \|/);
    assert.match(md, /\| Classic search \| 100\/100 \(A\) \| 1 of 1 \| 0 \| 0 \| 0 \|/);
    assert.match(md, /\| AI search \| 75\/100 \(C\) \| 4 of 5 \| 1 \| 2 \| 1 \|/);
    assert.match(md, /## Classic search · 100\/100 \(A\)[\s\S]*### S\. Sitemap[\s\S]*## AI search · 75\/100 \(C\)[\s\S]*### A\. Access/);
    assert.doesNotMatch(md, /## Checklist/);
  });

  it("reads reports saved before rules had a status", () => {
    const old = report("en");
    old.rules = old.rules.map(({ status: _s, counts: _c, pages: _p, addresses: _a, ...rest }) => rest as ReportRule);
    const md = rows(toMarkdown(old));
    assert.match(md, /\| ⚠ \| B-3 Headings not glued \| 2 warnings · 2 of 3 pages \|/);
    assert.match(md, /\| – \| A-5 Feed declared \| not checked: no feed \|/);
  });
});

describe("JSON report", () => {
  it("tells for each finding what the check is and why it is a problem", async () => {
    const { toJSON } = await import("../src/index.ts");
    const report = {
      site: "https://example.com",
      lang: "en",
      checkedAt: "2026-01-01T00:00:00.000Z",
      pages: ["https://example.com/"],
      findings: [{ rule: "X-1", level: "info", where: "https://example.com/", message: "description of 185 characters, should be 50–160" }],
      rules: [{ id: "X-1", group: "X", level: "info", status: "info", counts: { error: 0, warn: 0, info: 1 }, pages: 1, addresses: 0, title: "Meta description", fix: "Write 50–160 characters.", impact: "The snippet gets cut." }],
      chrome: { title: () => "t" },
      score: 99, grade: "A", counts: { error: 0, warn: 0, info: 1 }, checked: 1, total: 1,
    } as unknown as Parameters<typeof toJSON>[0];
    const json = toJSON(report);
    assert.deepEqual(json.findings[0], {
      rule: "X-1", level: "info", title: "Meta description", where: "https://example.com/",
      message: "description of 185 characters, should be 50–160", why: "The snippet gets cut.", fix: "Write 50–160 characters.",
    });
    assert.ok(!("chrome" in json));
    assert.doesNotThrow(() => JSON.stringify(json));
  });
});
