/**
 * English report text: the reference for every other language. A new language is a file that satisfies the
 * `ReportMessages` type below (TypeScript lists what is missing) plus one line in ./index.ts.
 * Rule sets bring their own texts: titles, fixes and messages of their checks, and the names of their groups.
 */
export const en = {
  report: {
    /** Rule sets give their own title, «nothing to fix» line and footer (Report.chrome); these are the defaults. */
    title: (site: string) => `Site audit: ${site}`,
    summary: (o: { score: number; grade: string; checked: number; total: number; errors: number; warnings: number; notes: number; pages: number }) =>
      `**${o.score}/100 (${o.grade})** · ${o.checked} of ${o.total} checks run · ${o.errors} errors · ${o.warnings} warnings · ${o.notes} notes · ${o.pages} pages`,
    capped: (checked: number, total: number) => `Grade capped at B: only ${checked} of ${total} checks could run on this site.`,
    priorities: "What to do first",
    /** Column headers of the report tables. */
    col: {
      part: "Part",
      score: "Score",
      checks: "Checks run",
      errors: "✖ Errors",
      warnings: "⚠ Warnings",
      notes: "ℹ Notes",
      check: "Check",
      result: "Result",
      severity: "Severity",
      todo: "What to do",
      comment: "Comment",
    },
    /** «12 of 20» in a table cell. */
    of: (n: number, total: number) => `${n} of ${total}`,
    ok: "OK",
    /** Under a group heading: how many of its checks passed, and how many could not run. */
    groupLine: (ok: number, checked: number, skipped: number) =>
      [checked && `${ok} of ${checked} OK`, skipped && `${skipped} not checked`].filter(Boolean).join(" · "),
    recommendations: "Recommendations",
    /** Severity in the recommendations table. */
    level: { error: "error", warn: "warning", info: "note" },
    /** Scale of a problem in the priorities: «on 12 of 20 pages». */
    scale: (n: number, total: number) => `${n} of ${total} pages`,
    /** Second line of a priority: on how many of the audited pages the problem was found, then their addresses. */
    found: (n: number, total: number) => `Found on ${n} of ${total} audited ${total === 1 ? "page" : "pages"}`,
    /** Second line of a priority about the site as a whole: robots.txt, sitemap, structured data. */
    foundSite: "Affects the site as a whole",
    /** Second line of a priority whose addresses go beyond the audited pages: sitemap entries, linked pages. */
    foundAt: (n: number) => `Found at ${n} ${n === 1 ? "address" : "addresses"}`,
    /** Addresses beyond the audited pages in a table cell: «85 addresses». */
    addresses: (n: number) => `${n} ${n === 1 ? "address" : "addresses"}`,
    /** Label of the third line of a priority: what the problem costs. */
    why: "Why it matters",
    clean: "Nothing to fix.",
    more: (n: number) => `…and ${n} more`,
    /** After the first addresses in a priority: «and 9 more». */
    andMore: (n: number) => `and ${n} more`,
    checklist: "Checklist",
    legend: "✓ OK · ✖ error · ⚠ warning · ℹ note · – not checked",
    notChecked: "not checked",
    /** Findings of one rule in the checklist: «2 errors, 1 warning». */
    count: (o: { errors: number; warnings: number; notes: number }) =>
      [
        o.errors && `${o.errors} ${o.errors === 1 ? "error" : "errors"}`,
        o.warnings && `${o.warnings} ${o.warnings === 1 ? "warning" : "warnings"}`,
        o.notes && `${o.notes} ${o.notes === 1 ? "note" : "notes"}`,
      ]
        .filter(Boolean)
        .join(", "),
    site: "site",
    footer: (pages: number, date: string) => `Checked ${pages} pages on ${date}.`,
  },
};

export type ReportMessages = typeof en;
