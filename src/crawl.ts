import { fetchUrl, isSameSite, pool, toPublic, type Origins } from "./fetch.ts";
import { parsePage } from "./html.ts";
import { parseRobots } from "./robots.ts";
import { parseSitemap } from "./sitemap.ts";
import type { Fetched, Page, Site, Sitemap } from "./types.ts";

export interface CrawlOptions {
  /** A number sampled across templates, or "all" for every page in the sitemap. */
  maxPages: number | "all";
  /** Explicit page list instead of the sitemap. */
  urls?: string[];
  concurrency?: number;
  log?: (line: string) => void;
}

const origin = (url: string) => new URL(url).origin;

/**
 * Reads a page limit from a flag or a config file: "all", or a whole number above 0 ("5", 5).
 * Returns null for anything else, so the caller can say what is wrong before any request is made.
 */
export function parsePages(value: unknown): number | "all" | null {
  if (typeof value === "string" && value.trim().toLowerCase() === "all") return "all";
  const n = typeof value === "number" ? value : typeof value === "string" && /^\s*\d+\s*$/.test(value) ? Number(value) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Picks pages so that every template is seen: URLs grouped by their path with the last segment masked
 * (/blog/a and /blog/b are one group), then taken round-robin, home page first.
 * Sites that repeat one page under many prefixes (/moscow/prices, /kazan/prices…) would fill the sample with copies,
 * so a page whose path after the first segment was already picked waits until every other page had its turn.
 * Language prefixes (/ru/, /en-us/) are not treated as such copies: other languages are worth auditing.
 */
export function pickPages(home: string, urls: string[], max: number): string[] {
  // https://site.com and https://site.com/ are the same page: compare without the trailing slash.
  const norm = (u: string) => u.replace(/\/$/, "");
  const segments = (u: string) => new URL(u).pathname.split("/").filter(Boolean);
  const tailOf = (u: string) => {
    const segs = segments(u);
    return segs.length >= 2 && !/^[a-z]{2}(-[a-z]{2,4})?$/i.test(segs[0]!) ? segs.slice(1).join("/") : null;
  };
  const seen = new Set([norm(home)]);
  const groups = new Map<string, string[]>();
  for (const url of urls) {
    if (seen.has(norm(url))) continue;
    seen.add(norm(url));
    const segs = segments(url);
    const key = segs.length <= 1 ? `/${segs.join("/")}` : `/${segs.slice(0, -1).join("/")}/*`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(url);
  }
  const picked = [home];
  const tails = new Set<string>();
  const later: string[] = [];
  const lists = [...groups.values()];
  for (let round = 0; picked.length < max && lists.some((l) => l.length > round); round++) {
    for (const list of lists) {
      const url = list[round];
      if (!url || picked.length >= max) continue;
      const tail = tailOf(url);
      if (tail && tails.has(tail)) {
        later.push(url);
        continue;
      }
      if (tail) tails.add(tail);
      picked.push(url);
    }
  }
  for (const url of later) if (picked.length < max) picked.push(url);
  return picked;
}

const isHtml = (f: Fetched) => f.status === 200 && /html/i.test(f.headers.get("content-type") ?? "html");

/**
 * Reads robots.txt and the sitemap, picks the pages and fetches them: what every rule set needs. A rule set that needs
 * more (llms.txt, linked pages, images) requests it after the crawl and keeps it next to the site.
 */
export async function crawl(targetInput: string, baseInput: string | undefined, opts: CrawlOptions): Promise<Site> {
  const target = origin(targetInput);
  const base = baseInput ? origin(baseInput) : target;
  const o: Origins = { target, base };
  const log = opts.log ?? (() => {});
  const conc = opts.concurrency ?? 4;

  log(`robots.txt, sitemap.xml`);
  const robotsF = await fetchUrl(`${target}/robots.txt`, o, { accept: "text/plain" });
  const robots = robotsF.status === 200 ? { fetched: robotsF, parsed: parseRobots(robotsF.body) } : null;

  let sitemap: Sitemap | null = null;
  if (!opts.urls) {
    const declared = robotsF.status === 200 ? [...robotsF.body.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((m) => m[1]!) : [];
    const first = await fetchUrl(declared[0] ?? `${target}/sitemap.xml`, o, { accept: "application/xml,text/xml" });
    if (first.status === 200) {
      const parsed = parseSitemap(first.body);
      const urls = [...parsed.urls];
      const children = await pool(parsed.children.slice(0, 5), conc, (u) => fetchUrl(u, o, { accept: "application/xml,text/xml" }));
      for (const c of children) if (c.status === 200) urls.push(...parseSitemap(c.body).urls);
      sitemap = { urls };
    }
  }

  const home = `${base}/`;
  const candidates = opts.urls ?? sitemap?.urls.map((u) => u.loc).filter((u) => isSameSite(u, o)) ?? [];
  const list = pickPages(home, candidates.map((u) => toPublic(u, o)), opts.maxPages === "all" ? Infinity : opts.maxPages);
  log(`${list.length} pages`);
  const fetched = await pool(list, conc, (u) => fetchUrl(u, o));
  const pages: Page[] = fetched.filter(isHtml).map(parsePage);
  const failed = fetched.filter((f) => !isHtml(f));
  for (const f of failed) log(`skip ${f.publicUrl}: ${f.error ?? f.status}`);
  if (!pages.length) {
    const first = fetched[0];
    throw new Error(`${home} is not reachable: ${first?.error ?? `HTTP ${first?.status}`}`);
  }

  return { target, base, robots, sitemap, pages, failed };
}
