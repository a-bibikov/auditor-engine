import type { ReportRule } from "./engine.ts";
import type { Lang, ReportMessages } from "./i18n/index.ts";
import type { Score } from "./score.ts";
import type { Config, Finding } from "./types.ts";

export type { Config, Fetched, Finding, JsonLdNode, Level, Page, Robots, Rule, Site, Sitemap } from "./types.ts";
export { DEFAULT_LANG, LANGS, isLang, reportMessages, type Lang, type ReportMessages } from "./i18n/index.ts";
export { crawl, parsePages, pickPages, type CrawlOptions } from "./crawl.ts";
export { runRules, type ReportRule, type RuleStatus, type RuleTexts, type RunResult } from "./engine.ts";
export { scoreOf, penaltyOf, pagesOf, placesOf, type Score, type ScoreContext } from "./score.ts";
export { toMarkdown, codeTags, type MarkdownOptions } from "./report.ts";
export { toJSON, type JsonFinding, type JsonReport } from "./json.ts";
export { toBadge, toBadgeEndpoint, badgeMarkdown, badgeMessage, textWidth, GRADE_COLORS, type BadgeOptions, type BadgeScore } from "./badge.ts";
export { fetchUrl, pool, toPublic, toTarget, isSameSite, DEFAULT_UA, type Origins, type FetchOptions } from "./fetch.ts";
export { parsePage, textContent, visibleText, countWords, decode, attrs, flattenJsonLd, types as jsonLdTypes } from "./html.ts";
export { parseRobots } from "./robots.ts";
export { parseSitemap } from "./sitemap.ts";
export { finder } from "./finder.ts";

export const defaultConfig: Config = { disable: [], maxPages: 20, lang: "en" };

/** A score for one part of a combined report: «Classic search 82/100 (B)». */
export interface ReportSection extends Pick<Score, "score" | "grade" | "checked" | "total"> {
  name: string;
  /** Groups of this part, in order: the checklist is split by part when every part lists its groups. */
  groups?: string[];
}

export interface Report extends Score {
  site: string;
  /** Language of every text in the report: rule titles, fixes, messages. */
  lang: Lang;
  checkedAt: string;
  pages: string[];
  findings: Finding[];
  rules: ReportRule[];
  /** Group ids and names in checklist order. */
  groups: Record<string, string>;
  /** Scores of the parts of a combined report, shown under the summary. */
  sections?: ReportSection[];
  /** Report texts of the rule set: the title, the «nothing to fix» line, the footer. */
  chrome?: Partial<Pick<ReportMessages["report"], "title" | "clean" | "footer">>;
  /** The tool linked at the end of the report. */
  tool?: { name: string; url: string };
}
