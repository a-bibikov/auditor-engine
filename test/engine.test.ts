import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { crawl, finder, parsePage, runRules, scoreOf, toMarkdown, type Report, type Rule } from "../src/index.ts";
import { page, serve, words } from "./site.ts";

describe("engine for other rule sets", () => {
  let origin = "";
  let close = async () => {};
  before(async () => {
    const routes: Parameters<typeof serve>[0] = {};
    const s = await serve(routes);
    Object.assign(routes, {
      "/": {
        body: `<!doctype html><html lang="en"><head><title>Home</title><meta name="viewport" content="width=device-width"></head><body>
<h1>Home</h1><h3>Skipped a level</h3><p>${words(200)}</p>
<a href="/about#team">About</a> <a href="mailto:a@b.c">Mail</a> <a href="#top">Top</a> <a href="https://other.test/x">Out</a>
<img src="/a.png" alt="A"><img src="/b.png" alt=""><img src="http://cdn.test/c.png">
<script src="http://cdn.test/app.js"></script></body></html>`,
      },
      "/robots.txt": { type: "text/plain", body: `User-agent: *\nAllow: /\nSitemap: ${s.origin}/sitemap.xml\n` },
      "/sitemap.xml": { type: "application/xml", body: `<urlset><url><loc>${s.origin}/</loc></url><url><loc>${s.origin}/old</loc></url><url><loc>${s.origin}/gone</loc></url></urlset>` },
      "/old": { status: 301, headers: { location: "/about" }, body: "" },
      "/about": { body: page({ title: "About", h1: "About", body: `<p>${words(200)}</p>` }) },
    });
    origin = s.origin;
    close = s.close;
  });
  after(() => close());

  it("audits every sitemap page with maxPages «all»", async () => {
    const site = await crawl(origin, undefined, { maxPages: "all" });
    assert.equal(site.pages.length + site.failed.length, 3);
  });

  it("parses links, images, language, viewport, all headings and resources", async () => {
    const site = await crawl(origin, undefined, { maxPages: 5 });
    const home = site.pages.find((p) => p.fetched.publicUrl === `${origin}/`)!;
    assert.deepEqual(home.links, [`${origin}/about`, "https://other.test/x"]);
    assert.deepEqual(home.images, [
      { src: `${origin}/a.png`, alt: "A" },
      { src: `${origin}/b.png`, alt: "" },
      { src: "http://cdn.test/c.png", alt: null },
    ]);
    assert.equal(home.htmlLang, "en");
    assert.equal(home.viewport, "width=device-width");
    assert.deepEqual(home.headingsAll.map((h) => h.level), [1, 3]);
    assert.ok(home.resources.includes("http://cdn.test/app.js"));
  });

  it("keeps redirects and failed pages", async () => {
    const site = await crawl(origin, undefined, { maxPages: 5 });
    const old = site.pages.find((p) => p.fetched.publicUrl === `${origin}/old`);
    assert.equal(old?.fetched.redirected, true);
    assert.equal(old?.fetched.finalUrl, `${origin}/about`);
    assert.deepEqual(site.failed.map((f) => [f.publicUrl, f.status]), [[`${origin}/gone`, 404]]);
  });

  it("runs any rule set and renders it with its own groups and sections", async () => {
    const site = await crawl(origin, undefined, { maxPages: 5 });
    type M = { skipped: string; few: (n: number) => string };
    const t: M = { skipped: "nothing to check", few: (n) => `${n} images without alt` };
    const set: Rule<M, { disable?: string[] }>[] = [
      {
        id: "S-1",
        group: "S",
        level: "warn",
        run(s, _c, m) {
          const { out, add } = finder(this);
          for (const p of s.pages) {
            const n = p.images.filter((i) => i.alt === null).length;
            if (n) add(p.fetched.publicUrl, m.few(n));
          }
          return out;
        },
      },
      { id: "S-2", group: "S", level: "error", applies: (_s, m) => m.skipped, run: () => [] },
    ];
    const run = runRules(site, set, {}, t, {
      "S-1": { title: "Images have alt", fix: "Add alt.", impact: "Images are invisible to search." },
      "S-2": { title: "Never runs", fix: "-", impact: "-" },
    });
    assert.equal(run.checked, 1);
    assert.equal(run.total, 2);
    const score = scoreOf(run.findings, { pages: site.pages.length, checked: run.checked, total: run.total });
    const report: Report = {
      site: origin,
      lang: "en",
      checkedAt: "2026-11-04T00:00:00.000Z",
      pages: site.pages.map((p) => p.fetched.publicUrl),
      ...score,
      findings: run.findings,
      rules: run.rules,
      groups: { S: "Classic search" },
      sections: [{ name: "Classic search", score: score.score, grade: score.grade, checked: run.checked, total: run.total }],
      chrome: { title: (s) => `Search audit: ${s}` },
      tool: { name: "search-audit", url: "https://github.com/a-bibikov/search-auditor" },
    };
    const md = toMarkdown(report);
    assert.match(md, /^# Search audit: /);
    assert.match(md, /\| Classic search +\| +\d+\/100 \([A-F]\) \| +1 of 2 \|/);
    assert.match(md, /### S\. Classic search\n\n0 of 1 OK · 1 not checked\n\n/);
    assert.match(md, /\| ⚠ +\| S-1 Images have alt +\| 1 warning · 1 of \d+ pages +\|/);
    assert.match(md, /\| – +\| S-2 Never runs +\| not checked: nothing to check +\|/);
    assert.deepEqual(
      report.rules.map((x) => [x.id, x.status, x.counts.warn]),
      [["S-1", "warn", 1], ["S-2", "skipped", 0]],
    );
    assert.match(md, /\[search-audit\]\(https:\/\/github\.com\/a-bibikov\/search-auditor\)/);
    // A rule set without short actions still gets one: the first sentence of the fix.
    assert.match(md, /1\. \*\*Add alt\*\* \(S-1\) {2}\n {3}Found on 1 of \d+ audited pages: `\/[^`]*` {2}\n {3}Why it matters: images are invisible to search\./);
  });

  it("parsePage is exported for page-level tools", () => {
    const p = parsePage({ url: "https://x.test/", publicUrl: "https://x.test/", status: 200, headers: new Headers(), body: "<html lang=ru><body><a href=a>a</a></body></html>" });
    assert.deepEqual([p.htmlLang, p.links], ["ru", ["https://x.test/a"]]);
  });
});
