import type { Score } from "./score.ts";

/** What a badge needs from a report: the score and the grade. */
export type BadgeScore = Pick<Score, "score" | "grade">;

export interface BadgeOptions {
  /** Left part of the badge: «AI search», «SEO». */
  label: string;
}

/** Badge colors by grade, the same as shields.io uses for brightgreen … red. */
export const GRADE_COLORS: Record<Score["grade"], string> = {
  A: "#4c1",
  B: "#97ca00",
  C: "#dfb317",
  D: "#fe7d37",
  F: "#e05d44",
};

/** The right part of the badge: «92/100». */
export const badgeMessage = (s: BadgeScore) => `${s.score}/100`;

// Verdana 11px advance widths, the font shields.io badges are drawn in. Close enough for a label of a few words;
// any other character counts as a wide one, so the text never overflows its box.
const NARROW: Record<string, number> = { " ": 3.9, "/": 4.9, ".": 4.3, ",": 4.3, ":": 4.9, "-": 5.4, i: 3.1, l: 3.1, j: 3.4, f: 3.9, t: 4.4, r: 4.8, I: 4.6, J: 5.0 };
const WIDE: Record<string, number> = { m: 10.7, w: 9.0, M: 9.9, W: 11.2 };
function charWidth(c: string): number {
  if (c in NARROW) return NARROW[c]!;
  if (c in WIDE) return WIDE[c]!;
  if (/[0-9]/.test(c)) return 7.0;
  if (/[a-z]/.test(c)) return 6.6;
  if (/[A-Z]/.test(c)) return 7.6;
  return 8.0;
}
export const textWidth = (text: string) => [...text].reduce((w, c) => w + charWidth(c), 0);

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A flat badge in the shields.io style: «AI search | 92/100», colored by grade. A plain SVG with no scripts and no
 * external fonts, so it renders in a GitHub README as an image.
 */
export function toBadge(s: BadgeScore, { label }: BadgeOptions): string {
  const message = badgeMessage(s);
  const color = GRADE_COLORS[s.grade];
  const pad = 6;
  const lw = Math.round(textWidth(label) + pad * 2);
  const mw = Math.round(textWidth(message) + pad * 2);
  const w = lw + mw;
  const title = `${label}: ${message} (${s.grade})`;
  // Text is drawn at 10× and scaled down, as shields.io does, for crisp kerning; the shadow line sits 1px lower.
  const text = (x: number, value: string, width: number) =>
    `<text aria-hidden="true" x="${x * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${width * 10}">${escape(value)}</text>` +
    `<text x="${x * 10}" y="140" transform="scale(.1)" fill="#fff" textLength="${width * 10}">${escape(value)}</text>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${escape(title)}">` +
    `<title>${escape(title)}</title>` +
    `<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>` +
    `<clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>` +
    `<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#555"/><rect x="${lw}" width="${mw}" height="20" fill="${color}"/><rect width="${w}" height="20" fill="url(#s)"/></g>` +
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">` +
    text(lw / 2, label, lw - pad * 2) +
    text(lw + mw / 2, message, mw - pad * 2) +
    `</g></svg>\n`
  );
}

/** The same badge as a shields.io endpoint: serve this JSON and point https://img.shields.io/endpoint?url=… at it. */
export function toBadgeEndpoint(s: BadgeScore, { label }: BadgeOptions) {
  return { schemaVersion: 1, label, message: badgeMessage(s), color: GRADE_COLORS[s.grade].replace("#", "") };
}

/** The Markdown to paste into a README: the badge image, linked to the tool that drew it. */
export function badgeMarkdown(s: BadgeScore, { label, image, link }: BadgeOptions & { image: string; link: string }): string {
  return `[![${label}: ${badgeMessage(s)}](${image})](${link})`;
}
