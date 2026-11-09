import { placesOf } from "./score.ts";
import type { Config, Finding, Level, Rule, Site } from "./types.ts";

/** What a report says about a rule, in the report's language. */
export interface RuleTexts {
  title: string;
  /** What to do, in a few words: the first line of «What to do first». The first sentence of `fix` when absent. */
  todo?: string;
  /** How to fix it, one or two sentences. */
  fix: string;
  /** What it costs the business, one sentence: used in «What to do first». */
  impact: string;
}

/** Outcome of one check: passed, the worst level it found, or not run on this site. */
export type RuleStatus = "ok" | Level | "skipped";

export interface ReportRule extends RuleTexts {
  id: string;
  group: string;
  level: Level;
  status: RuleStatus;
  /** Findings of this check by level. */
  counts: Record<Level, number>;
  /** Audited pages with a finding at the check's worst level. */
  pages: number;
  /** Other addresses with such a finding: sitemap entries, linked pages and files beyond the audited sample. */
  addresses: number;
  /** Why the check did not run on this site; absent when it ran. */
  skipped?: string;
}

export interface RunResult {
  findings: Finding[];
  rules: ReportRule[];
  /** Checks that ran and all active checks. */
  checked: number;
  total: number;
}

/**
 * Runs a rule set on a crawled site. A rule that does not apply is returned with its reason, never as passed.
 */
export function runRules<M, C extends Pick<Config, "disable"> | { disable?: string[] }, S extends Site>(site: S, rules: Rule<M, C, S>[], config: C, t: M, texts: Record<string, RuleTexts>): RunResult {
  const active = rules.filter((r) => !(config.disable ?? []).includes(r.id));
  const skipped = new Map(active.map((r) => [r.id, r.applies?.(site, t) ?? null]));
  const findings = active.filter((r) => !skipped.get(r.id)).flatMap((r) => r.run(site, config, t));
  return {
    findings,
    rules: active.map(({ id, group, level }) => {
      const text = texts[id];
      if (!text) throw new Error(`No title, fix and impact for rule ${id}`);
      const reason = skipped.get(id);
      const found = findings.filter((f) => f.rule === id);
      const counts = { error: 0, warn: 0, info: 0 };
      for (const f of found) counts[f.level]++;
      const status: RuleStatus = reason ? "skipped" : counts.error ? "error" : counts.warn ? "warn" : counts.info ? "info" : "ok";
      const places = placesOf(found, site.pages.map((p) => p.fetched.publicUrl));
      return { id, group, level, ...text, status, counts, ...places, ...(reason ? { skipped: reason } : {}) };
    }),
    checked: active.filter((r) => !skipped.get(r.id)).length,
    total: active.length,
  };
}
