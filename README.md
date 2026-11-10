# auditor-engine

The engine behind [search-auditor](https://github.com/a-bibikov/search-auditor) (classic SEO) and [ai-search-auditor](https://github.com/a-bibikov/ai-search-audit) (AI search): crawl a site once, run a rule set on it, score it and render the report in Markdown or JSON. No dependencies. Node.js 22.18+.

```bash
npm i auditor-engine
```

You need it to build your own audit. To audit a site, use one of the two packages above.

## What it does

- **Crawl.** Reads robots.txt and the sitemap (sitemap index included), picks pages so that every template is seen (`maxPages`: a number or `"all"`), fetches them and parses each one: title, description, meta robots, canonical, hreflang, headings, paragraphs, visible text, JSON-LD, Open Graph, links, images, resources. With a `base`, a local build is crawled and the report shows the public addresses.
- **Run a rule set.** Each rule says when it applies; one that cannot run on a site is reported as «not checked» with the reason, never as passed. Each rule gets its status, counts, and the number of audited pages and other addresses it found something on.
- **Score.** 100 minus 15 for each check with an error and 5 for each check with a warning; a warning on at least half of the audited pages costs 10. A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F below; if fewer than two thirds of the checks could run, the grade is capped at B.
- **Report.** Markdown: the score, what to do first, a table per group, one table of recommendations. Fits a terminal width or stays plain for files and CI summaries. JSON: every finding with the title of its check, why it is a problem and how to fix it. English and Russian.
- **Badge.** The score as a flat SVG badge colored by grade, or as JSON for a shields.io endpoint.

## A rule set

```ts
import { crawl, finder, runRules, scoreOf, toMarkdown, type Report, type Rule } from "auditor-engine";

const texts = { tooFew: (n: number) => `${n} words, should be at least 300` };

const rules: Rule<typeof texts>[] = [
  {
    id: "T-1",
    group: "T",
    level: "warn",
    run(site, _config, t) {
      const { out, add } = finder(this);
      for (const p of site.pages) if (p.words < 300) add(p.fetched.publicUrl, t.tooFew(p.words));
      return out;
    },
  },
];

const config = { disable: [], maxPages: 20, lang: "en" as const };
const site = await crawl("https://example.com", undefined, { maxPages: config.maxPages });
const run = runRules(site, rules, config, texts, {
  "T-1": { title: "Pages have enough text", fix: "Write at least 300 words.", impact: "Thin pages rank lower." },
});
const audited = site.pages.map((p) => p.fetched.publicUrl);

const report: Report = {
  site: site.base,
  lang: config.lang,
  checkedAt: new Date().toISOString(),
  pages: audited,
  ...scoreOf(run.findings, { pages: audited.length, audited, checked: run.checked, total: run.total }),
  findings: run.findings,
  rules: run.rules,
  groups: { T: "Text" },
  chrome: { title: (s) => `Text audit: ${s}` },
};
console.log(toMarkdown(report));
```

A rule set that needs more than the pages (linked pages, images, llms.txt) requests it after the crawl with `fetchUrl` and `pool`, and adds it to the site: `Rule` takes the site type as its third parameter.

## Exports

| | |
|---|---|
| `crawl`, `parsePages`, `pickPages` | The crawl and the page sample |
| `runRules`, `finder` | Running a rule set, building findings |
| `scoreOf`, `penaltyOf`, `pagesOf`, `placesOf` | The score |
| `toMarkdown`, `toJSON`, `codeTags` | The report |
| `toBadge`, `toBadgeEndpoint`, `badgeMarkdown`, `GRADE_COLORS` | A score badge: SVG, shields.io endpoint JSON, the README line |
| `fetchUrl`, `pool`, `toPublic`, `toTarget`, `isSameSite`, `DEFAULT_UA` | Requests |
| `parsePage`, `textContent`, `visibleText`, `countWords`, `decode`, `attrs`, `flattenJsonLd`, `jsonLdTypes` | HTML |
| `parseRobots`, `parseSitemap` | robots.txt and sitemaps |
| `LANGS`, `DEFAULT_LANG`, `isLang`, `reportMessages` | Report languages |

## License

MIT
