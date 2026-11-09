import type { Lang } from "./i18n/index.ts";

/** error: the page cannot be found or is read wrong. warn: costs rankings, clicks or citations. info: a recommendation. */
export type Level = "error" | "warn" | "info";

export interface Finding {
  rule: string;
  level: Level;
  /** Public URL the finding is about (with --base, the production URL), or "site" for site-wide findings. */
  where: string;
  /** What we found, in one sentence. */
  message: string;
}

export interface Fetched {
  /** URL as requested (target origin). */
  url: string;
  /** Public URL (base origin): what reports and links show. */
  publicUrl: string;
  status: number;
  headers: Headers;
  body: string;
  /** Network error or timeout, if the request did not complete. */
  error?: string;
  /** Where the request ended after redirects, and whether there were any. */
  finalUrl?: string;
  redirected?: boolean;
}

export interface JsonLdNode {
  [key: string]: unknown;
}

export interface Page {
  fetched: Fetched;
  title: string;
  description: string;
  metaRobots: string;
  canonical: string;
  hreflang: { lang: string; href: string }[];
  /** H1 as a crawler reads it: text nodes joined without separators (textContent). */
  h1: string[];
  /** Inner HTML of each H1, for checks on markup boundaries. */
  h1Html: string[];
  /** Paragraph texts in document order. */
  paragraphs: string[];
  /** All visible text (no script, style, noscript, svg, template). */
  text: string;
  words: number;
  /** Every JSON-LD node, flattened out of @graph and nested objects. */
  jsonLd: JsonLdNode[];
  /** JSON-LD blocks that failed to parse. */
  jsonLdErrors: string[];
  rss: string[];
  /** og:* meta, keys without the prefix: title, description, image… */
  og: Record<string, string>;
  /** H2–H3 in order, for FAQ-like structure. */
  headings: { level: number; text: string }[];
  /** Number of <details> elements. */
  details: number;
  /** <html lang>, empty when missing. */
  htmlLang: string;
  /** <meta name="viewport"> content, empty when missing. */
  viewport: string;
  /** Every H1–H6 in document order. */
  headingsAll: { level: number; text: string }[];
  /** Absolute URLs of <a href> on the page (fragments dropped, mailto: and tel: left out). */
  links: string[];
  /** <img>: absolute src and alt (null when the attribute is missing, "" when empty). */
  images: { src: string; alt: string | null }[];
  /** Absolute URLs of resources the page loads: images, scripts, stylesheets, frames, media. */
  resources: string[];
}

export interface Sitemap {
  urls: { loc: string; lastmod?: string }[];
}

export interface Robots {
  /** Is `path` allowed for this user agent (most specific group, longest match wins)? */
  allows(userAgent: string, path: string): boolean;
  /** Does robots.txt name this user agent in its own group? */
  names(userAgent: string): boolean;
}

export interface Site {
  target: string;
  base: string;
  robots: { fetched: Fetched; parsed: Robots } | null;
  sitemap: Sitemap | null;
  pages: Page[];
  /** Sampled pages that did not answer 200 with HTML: errors, redirects to non-HTML, timeouts. */
  failed: Fetched[];
}

/** Options every rule set has; a rule set extends it with its own. */
export interface Config {
  /** Rule ids to skip. */
  disable: string[];
  /** Pages to audit: a number sampled across templates (default 20), or "all" for every page in the sitemap. */
  maxPages: number | "all";
  /** Report language: en (default), ru. */
  lang: Lang;
}

/**
 * A check. Its title, fix and impact live in the rule set's texts per language; `run` writes messages through `t`.
 * `M` is the rule set's message dictionary, `C` its config and `S` the site with whatever the rule set collected on
 * top of the crawl.
 */
export interface Rule<M = unknown, C = Config, S extends Site = Site> {
  id: string;
  group: string;
  level: Level;
  /**
   * Why the check cannot run on this site («no articles among the audited pages», «no sitemap»), or null when it can.
   * A check that does not apply is shown as «not checked» instead of a green tick.
   */
  applies?(site: S, t: M): string | null;
  run(site: S, config: C, t: M): Finding[];
}
