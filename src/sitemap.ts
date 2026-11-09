import { decode } from "./html.ts";
import type { Sitemap } from "./types.ts";

/** <urlset> entries, or the child sitemaps of a <sitemapindex>. */
export function parseSitemap(xml: string): { urls: Sitemap["urls"]; children: string[] } {
  const entries = (tag: string) =>
    [...xml.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi"))].map((m) => {
      const inner = m[1] ?? "";
      const loc = decode(inner.match(/<loc>\s*([\s\S]*?)\s*<\/loc>/i)?.[1] ?? "").trim();
      const lastmod = inner.match(/<lastmod>\s*([\s\S]*?)\s*<\/lastmod>/i)?.[1]?.trim();
      return { loc, ...(lastmod ? { lastmod } : {}) };
    });
  return { urls: entries("url").filter((u) => u.loc), children: entries("sitemap").map((s) => s.loc).filter(Boolean) };
}

/** Markdown links of llms.txt: [title](url). */
