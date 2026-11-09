import type { Report } from "./index.ts";
import type { Finding } from "./types.ts";

/** A finding that reads on its own: what the check is, what was found, why it is a problem and how to fix it. */
export interface JsonFinding extends Finding {
  /** The check, as in the report: «Meta description». */
  title: string;
  /** Why this is a problem: what it costs in search. */
  why: string;
  /** How to fix it. */
  fix: string;
}

/** The report as written by --json: findings carry their check's texts, report-rendering fields are left out. */
export interface JsonReport extends Omit<Report, "findings" | "chrome"> {
  findings: JsonFinding[];
}

export function toJSON(r: Report): JsonReport {
  const rules = new Map(r.rules.map((x) => [x.id, x]));
  const { chrome: _chrome, findings, ...rest } = r;
  return {
    ...rest,
    findings: findings.map((f) => {
      const rule = rules.get(f.rule);
      return { rule: f.rule, level: f.level, title: rule?.title ?? f.rule, where: f.where, message: f.message, why: rule?.impact ?? "", fix: rule?.fix ?? "" };
    }),
  };
}
