import type { Finding, Level, Rule } from "./types.ts";

/** Builds findings for one rule; the level defaults to the rule's own. */
export const finder = (rule: Pick<Rule, "id" | "level">) => {
  const out: Finding[] = [];
  const add = (where: string, message: string, level: Level = rule.level) => out.push({ rule: rule.id, level, where, message });
  return { out, add };
};
