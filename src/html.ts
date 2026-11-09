import type { Fetched, JsonLdNode, Page } from "./types.ts";

/**
 * A small HTML reader for what crawlers see without JavaScript. Regex-based on purpose: no dependencies, and the
 * checks need only titles, meta, links, headings, paragraphs, JSON-LD and the visible text.
 */

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", laquo: "«", raquo: "»",
  hellip: "…", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", copy: "©", shy: "\u00AD", zwj: "‍", zwnj: "‌",
};

export const decode = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });

/** Attributes of one tag, names lower-cased (hrefLang → hreflang). */
export const attrs = (tag: string): Record<string, string> => {
  const out: Record<string, string> = {};
  const inner = tag.replace(/^<[a-z0-9-]+/i, "").replace(/\/?>$/, "");
  for (const m of inner.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    out[m[1]!.toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
};

const tags = (html: string, name: string) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((m) => attrs(m[0]));

const blocks = (html: string, name: string) =>
  [...html.matchAll(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "gi"))].map((m) => m[1] ?? "");

/** textContent: tags removed, nothing inserted between text nodes. */
export const textContent = (html: string) => decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

const HIDDEN = /<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi;

/** Visible text: hidden blocks dropped, every tag becomes a space (block layout, like a reader view). */
export const visibleText = (html: string) =>
  decode(html.replace(/<!--[\s\S]*?-->/g, "").replace(HIDDEN, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

export const countWords = (text: string) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** Every node of a JSON-LD value: @graph entries and nested objects, so `author` or `mainEntity` are found too. */
export const flattenJsonLd = (value: unknown, out: JsonLdNode[] = []): JsonLdNode[] => {
  if (Array.isArray(value)) for (const v of value) flattenJsonLd(v, out);
  else if (value && typeof value === "object") {
    const node = value as JsonLdNode;
    if ("@type" in node || "@id" in node) out.push(node);
    for (const v of Object.values(node)) flattenJsonLd(v, out);
  }
  return out;
};

export const types = (node: JsonLdNode): string[] => {
  const t = node["@type"];
  return Array.isArray(t) ? t.map(String) : t ? [String(t)] : [];
};

export function parsePage(fetched: Fetched): Page {
  const html = fetched.body.replace(/<!--[\s\S]*?-->/g, "");
  const head = html.match(/<head\b[\s\S]*?<\/head>/i)?.[0] ?? html;
  const meta = tags(head, "meta");
  const links = tags(head, "link");
  const metaContent = (name: string) => meta.find((m) => (m.name ?? m.property ?? "").toLowerCase() === name)?.content ?? "";

  const jsonLd: JsonLdNode[] = [];
  const jsonLdErrors: string[] = [];
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      flattenJsonLd(JSON.parse(m[1] ?? ""), jsonLd);
    } catch (e) {
      jsonLdErrors.push((e as Error).message);
    }
  }

  const body = html.match(/<body\b[\s\S]*<\/body>/i)?.[0] ?? html;
  const shown = body.replace(HIDDEN, " ");
  const h1Html = blocks(shown, "h1");
  const text = visibleText(body);
  const title = textContent(blocks(head, "title")[0] ?? "");
  const abs = (href: string | undefined) => {
    if (!href) return "";
    try {
      return new URL(href.trim(), fetched.publicUrl).href.replace(/#.*$/, "");
    } catch {
      return "";
    }
  };
  const anchors = tags(body, "a")
    .map((a) => a.href ?? "")
    .filter((h) => h && !/^(mailto|tel|javascript|data):/i.test(h.trim()) && !h.trim().startsWith("#"))
    .map(abs)
    .filter(Boolean);
  const imgs = tags(body, "img").map((i) => ({ src: abs(i.src ?? i["data-src"]), alt: "alt" in i ? (i.alt ?? "") : null }));
  const resources = [
    ...imgs.map((i) => i.src),
    ...["script", "iframe", "source", "video", "audio"].flatMap((name) => tags(html, name).map((x) => abs(x.src))),
    ...links.filter((l) => /stylesheet|preload|icon/i.test(l.rel ?? "")).map((l) => abs(l.href)),
  ].filter(Boolean);

  return {
    fetched,
    title,
    description: metaContent("description"),
    metaRobots: meta.filter((m) => /^(robots|googlebot|bingbot|gptbot)$/i.test(m.name ?? "")).map((m) => m.content ?? "").join(", "),
    canonical: links.find((l) => l.rel?.toLowerCase() === "canonical")?.href ?? "",
    hreflang: links.filter((l) => l.rel?.toLowerCase() === "alternate" && l.hreflang).map((l) => ({ lang: l.hreflang!, href: l.href ?? "" })),
    h1: h1Html.map(textContent),
    h1Html,
    paragraphs: blocks(shown, "p").map(textContent).filter(Boolean),
    text,
    words: countWords(text),
    jsonLd,
    jsonLdErrors,
    og: Object.fromEntries(meta.filter((m) => /^og:/i.test(m.property ?? "")).map((m) => [m.property!.slice(3).toLowerCase(), m.content ?? ""])),
    headings: [...shown.matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({ level: Number(m[1]), text: textContent(m[2] ?? "") })),
    details: (shown.match(/<details\b/gi) ?? []).length,
    rss: links.filter((l) => l.rel?.toLowerCase() === "alternate" && /rss|atom/i.test(l.type ?? "")).map((l) => l.href ?? ""),
    htmlLang: attrs(html.match(/<html\b[^>]*>/i)?.[0] ?? "<html>").lang ?? "",
    viewport: metaContent("viewport"),
    headingsAll: [...shown.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({ level: Number(m[1]), text: textContent(m[2] ?? "") })),
    links: [...new Set(anchors)],
    images: imgs,
    resources: [...new Set(resources)],
  };
}
