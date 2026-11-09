import { reportMessages } from "./i18n/index.ts";
import type { Report, ReportSection } from "./index.ts";
import { pagesOf, penaltyOf, placesOf } from "./score.ts";
import type { ReportRule, RuleStatus } from "./engine.ts";
import type { Level } from "./types.ts";

const ICON: Record<RuleStatus, string> = { ok: "✓", error: "✖", warn: "⚠", info: "ℹ", skipped: "–" };
const ORDER: Record<Level, number> = { error: 0, warn: 1, info: 2 };
/** Different findings of one check shown in its comment; the rest are counted. */
const MAX_GROUPS = 3;
const MAX_PRIORITIES = 3;
/** Addresses named in a priority; the rest are counted: «and 9 more». */
const MAX_PLACES = 5;

/** «Pages compete…» → «pages compete…» after a label; names and acronyms (ChatGPT, AI-поиск) stay as they are. */
const lowerFirst = (s: string) => {
  const word = s.split(" ")[0] ?? "";
  return /^[A-ZА-ЯЁ][a-zа-яё-]*[,:]?$/.test(word) ? s[0]!.toLowerCase() + s.slice(1) : s;
};

/** The action of a rule: its own short text, or the first sentence of the fix for rule sets without one. */
const todoOf = (rule: { todo?: string; fix: string }) =>
  rule.todo ?? rule.fix.split(/(?<=[.!?])\s+(?=[A-ZА-ЯЁ«`])/)[0]!.replace(/[.!?]$/, "");

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, "en", { numeric: true });

/**
 * Bare HTML tags in report text become code: «<title>» or «<html lang>» outside backticks would be read by a
 * Markdown viewer as real markup and swallow the text after it, rows of a table included.
 */
export function codeTags(s: string): string {
  return s
    .split("`")
    .map((part, i) => (i % 2 ? part : part.replace(/<\/?[a-z!][^<>`]*>/gi, (tag) => `\`${tag}\``)))
    .join("`");
}

/** A cell never breaks the table: no pipes, no line breaks, no bare tags. */
const cell = (s: string) => codeTags(s.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " "));
/** Width as a terminal shows it: letters with marks and the status icons take one column each. */
const width = (s: string) => [...s].length;

/** Narrowest a wrapped column gets: below this, words break into pieces too small to read. */
const MIN_COLUMN = 12;

/** Splits text into lines of at most `max` characters, at spaces; a word longer than a line is cut. */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (let word of text.split(" ")) {
    while (width(word) > max) {
      if (line) lines.push(line), (line = "");
      lines.push([...word].slice(0, max).join(""));
      word = [...word].slice(max).join("");
    }
    if (!line) line = word;
    else if (width(line) + 1 + width(word) <= max) line += ` ${word}`;
    else lines.push(line), (line = word);
  }
  if (line || !lines.length) lines.push(line);
  return lines;
}

/**
 * Column widths that fit `limit` characters: the widest column gives way first, down to MIN_COLUMN,
 * so short columns (an id, a status) keep their width and long text wraps.
 */
function fit(natural: number[], limit: number): number[] {
  const w = [...natural];
  // Each column adds «| » before it and « » after it, and the row ends with «|».
  const total = () => w.reduce((s, n) => s + n + 3, 1);
  // One character at a time from the widest: two long columns end up sharing the room evenly.
  while (total() > limit) {
    const widest = w.indexOf(Math.max(...w));
    if (w[widest]! <= MIN_COLUMN) break;
    w[widest]!--;
  }
  return w;
}

/**
 * A Markdown table padded to equal columns, so it reads as a table in a terminal and renders as one on GitHub.
 * `align` marks columns to right-align (numbers). With `limit`, the table fits that many characters: long cells
 * wrap onto continuation rows with the other cells empty, which a terminal shows as text wrapping inside its cell.
 */
function table(head: string[], rows: string[][], align: boolean[] = [], limit?: number): string[] {
  const all = [head, ...rows].map((r) => r.map(cell));
  const natural = head.map((_, i) => Math.max(3, ...all.map((r) => width(r[i] ?? ""))));
  const w = limit ? fit(natural, limit) : natural;
  const pad = (s: string, i: number) => (align[i] ? " ".repeat(w[i]! - width(s)) + s : s + " ".repeat(Math.max(0, w[i]! - width(s))));
  const line = (r: string[]) => `| ${r.map(pad).join(" | ")} |`;
  // One table row may take several lines: each cell wrapped to its column, shorter cells padded with empty lines.
  const lines = (r: string[]) => {
    const cells = r.map((c, i) => (width(c) > w[i]! ? wrap(c, w[i]!) : [c]));
    const height = Math.max(...cells.map((c) => c.length));
    return Array.from({ length: height }, (_, k) => line(cells.map((c) => c[k] ?? "")));
  };
  const rule = `|${w.map((n, i) => (align[i] ? "-".repeat(n + 1) + ":" : "-".repeat(n + 2))).join("|")}|`;
  return [...lines(all[0]!), rule, ...all.slice(1).flatMap(lines)];
}

export interface MarkdownOptions {
  /**
   * Fit tables into this many characters, for a terminal: long cells wrap inside their column. Leave it out for
   * Markdown that a viewer renders (a file, a PR summary): there each row stays one line and the viewer wraps text.
   */
  width?: number;
}

/** Markdown report for a terminal, a PR summary or a file, in the report's language. */
export function toMarkdown(r: Report, opts: MarkdownOptions = {}): string {
  const limit = opts.width && opts.width >= 40 ? opts.width : undefined;
  const t = { ...reportMessages(r.lang).report, ...r.chrome };
  const groups: Record<string, string> = r.groups;
  const short = (where: string) => (where === "site" ? t.site : where.startsWith(r.site) ? where.slice(r.site.length) || "/" : where);
  const n = r.pages.length;
  const lines: string[] = [
    `# ${t.title(r.site)}`,
    "",
    t.summary({ score: r.score, grade: r.grade, checked: r.checked, total: r.total, errors: r.counts.error, warnings: r.counts.warn, notes: r.counts.info, pages: n }),
    "",
  ];

  const rulesOf = (gs: string[]) => r.rules.filter((rule) => gs.includes(rule.group));
  const sum = (list: ReportRule[], level: Level) => list.reduce((s, rule) => s + (rule.counts?.[level] ?? 0), 0);
  const parts: ReportSection[] = r.sections ?? [];
  // Parts split the checklist only when each says which groups are its own.
  const split = parts.length > 0 && parts.every((p) => p.groups?.length);

  if (parts.length) {
    lines.push(
      ...table(
        [t.col.part, t.col.score, t.col.checks, t.col.errors, t.col.warnings, t.col.notes],
        parts.map((p) => {
          const list = split ? rulesOf(p.groups!) : [];
          const count = (level: Level) => (split ? String(sum(list, level)) : "");
          return [p.name, `${p.score}/100 (${p.grade})`, t.of(p.checked, p.total), count("error"), count("warn"), count("info")];
        }),
        [false, true, true, true, true, true],
        limit,
      ),
      "",
    );
  }
  if (r.capped) lines.push(t.capped(r.checked, r.total), "");

  const byRule = new Map<string, Report["findings"]>();
  for (const f of r.findings) byRule.set(f.rule, [...(byRule.get(f.rule) ?? []), f]);
  const found = (id: string) => byRule.get(id) ?? [];
  // Older reports (JSON from before 0.5) have no status on rules: work it out from the findings.
  const statusOf = (rule: ReportRule): RuleStatus => {
    if (rule.status) return rule.status;
    if (rule.skipped) return "skipped";
    const list = found(rule.id);
    return list.length ? list.reduce<Level>((w, f) => (ORDER[f.level] < ORDER[w] ? f.level : w), "info") : "ok";
  };

  // The few changes worth the most points, in plain words: what it costs the business, then the check.
  const top = r.rules
    .map((rule) => ({ rule, list: found(rule.id) }))
    .map((x) => ({ ...x, cost: penaltyOf(x.list, n, r.pages), pages: pagesOf(x.list, r.pages) }))
    .filter((x) => x.cost > 0)
    .sort((a, b) => b.cost - a.cost || b.pages - a.pages || byId(a.rule, b.rule))
    .slice(0, MAX_PRIORITIES);
  // Each priority says what to do, where, and why: the action first, so it reads as a to-do list.
  if (top.length) {
    lines.push(`## ${t.priorities}`, "");
    top.forEach(({ rule, list }, i) => {
      const worst = list.reduce<Level>((w, f) => (ORDER[f.level] < ORDER[w] ? f.level : w), "info");
      const where = [...new Set(list.filter((f) => f.level === worst && f.where !== "site").map((f) => short(f.where)))];
      const shown = where.slice(0, MAX_PLACES).map((w) => `\`${w}\``).join(", ");
      const rest = where.length > MAX_PLACES ? `, ${t.andMore(where.length - MAX_PLACES)}` : "";
      // «Found on 4 of 20 audited pages» only when they are audited pages; sitemap entries and linked pages that
      // were not in the sample are counted as addresses, or the share could read «85 of 20».
      const places = placesOf(list, r.pages);
      const label = !places.addresses ? t.found(places.pages, n) : t.foundAt(places.pages + places.addresses);
      const at = where.length ? `${label}: ${shown}${rest}` : t.foundSite;
      // Two trailing spaces: a line break on GitHub, invisible in a terminal.
      lines.push(`${i + 1}. **${todoOf(rule)}** (${rule.id})  `, `   ${at}  `, `   ${t.why}: ${lowerFirst(rule.impact)}`);
    });
    lines.push("");
  }
  if (!r.findings.length) lines.push(t.clean, "");

  // Every check, one table per group: what is fine and what is not, at a glance.
  const result = (rule: ReportRule, status: RuleStatus) => {
    if (status === "skipped") return `${t.notChecked}: ${rule.skipped ?? ""}`;
    if (status === "ok") return t.ok;
    const list = found(rule.id);
    const c = (level: Level) => rule.counts?.[level] ?? list.filter((f) => f.level === level).length;
    const { pages, addresses } = placesOf(list, r.pages);
    const where = [pages && t.scale(pages, n), addresses && t.addresses(addresses)].filter(Boolean).join(" · ");
    return `${t.count({ errors: c("error"), warnings: c("warn"), notes: c("info") })}${where ? ` · ${where}` : ""}`;
  };
  const groupTable = (g: string) => {
    const list = r.rules.filter((rule) => rule.group === g).sort(byId);
    if (!list.length) return;
    const statuses = list.map(statusOf);
    const skipped = statuses.filter((s) => s === "skipped").length;
    const ok = statuses.filter((s) => s === "ok").length;
    lines.push(`### ${g}. ${groups[g] ?? g}`, "", t.groupLine(ok, list.length - skipped, skipped), "");
    lines.push(...table(["", t.col.check, t.col.result], list.map((rule, i) => [ICON[statuses[i]!], `${rule.id} ${rule.title}`, result(rule, statuses[i]!)]), [], limit), "");
  };

  if (split) {
    lines.push(t.legend, "");
    for (const p of parts) {
      lines.push(`## ${p.name} · ${p.score}/100 (${p.grade})`, "");
      for (const g of p.groups!) groupTable(g);
    }
  } else {
    lines.push(`## ${t.checklist}`, "", t.legend, "");
    for (const g of Object.keys(groups)) groupTable(g);
  }

  // What was found and where, in one cell: the same message on several pages is said once, with the pages.
  const commentOf = (list: Report["findings"], worst: Level) => {
    const groups = new Map<string, string[]>();
    for (const f of list) {
      const key = `${f.level === worst ? "" : `${ICON[f.level]} `}${f.message}`;
      groups.set(key, [...(groups.get(key) ?? []), f.where]);
    }
    const parts = [...groups].slice(0, MAX_GROUPS).map(([message, wheres]) => {
      const places = wheres.filter((w) => w !== "site").map((w) => `\`${short(w)}\``);
      if (!places.length) return message;
      const shown = places.slice(0, MAX_PLACES).join(", ") + (places.length > MAX_PLACES ? `, ${t.andMore(places.length - MAX_PLACES)}` : "");
      return `${shown} — ${message}`;
    });
    if (groups.size > MAX_GROUPS) parts.push(t.more(groups.size - MAX_GROUPS));
    return parts.join("; ");
  };

  // Groups in the order the checklist shows them: by part when the report is split, else as listed.
  const groupOrder = split ? parts.flatMap((p) => p.groups!) : Object.keys(groups);
  const groupRank = (g: string) => (groupOrder.includes(g) ? groupOrder.indexOf(g) : groupOrder.length);

  // One table of recommendations in checklist order: the check, how serious, what to do, and what was found where.
  const failed = r.rules
    .map((rule) => ({ rule, status: statusOf(rule), list: found(rule.id) }))
    .filter((x) => x.list.length)
    // In checklist order: group by group as they appear above (IDX, SEC… then A–G), and by number within a group.
    .sort((a, b) => groupRank(a.rule.group) - groupRank(b.rule.group) || byId(a.rule, b.rule));
  if (failed.length) {
    lines.push(`## ${t.recommendations}`, "");
    const rows = failed.map(({ rule, status, list }) => [
      rule.id,
      `${ICON[status]} ${t.level[status as Level]}`,
      `**${todoOf(rule)}.** ${rule.fix}`,
      commentOf(list, status as Level),
    ]);
    lines.push(...table([t.col.check, t.col.severity, t.col.todo, t.col.comment], rows, [], limit), "");
  }

  lines.push(
    "---",
    "",
    t.footer(n, r.checkedAt.slice(0, 10)),
    "",
    ...(r.tool ? [`[${r.tool.name}](${r.tool.url})`, ""] : []),
  );
  // Table lines are already safe (cell); headings, priorities and notes get the same treatment.
  return lines.map((l) => (l.startsWith("|") ? l : codeTags(l))).join("\n");
}
