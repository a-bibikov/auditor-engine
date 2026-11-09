import type { Robots } from "./types.ts";

interface RuleLine {
  allow: boolean;
  path: string;
}

/** robots.txt as RFC 9309 reads it: the agent's own groups, else `*`; the longest matching path wins, ties go to Allow. */
export function parseRobots(text: string): Robots {
  const groups: { agents: string[]; rules: RuleLine[] }[] = [];
  let current: { agents: string[]; rules: RuleLine[] } | null = null;
  let lastWasAgent = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      // An empty Disallow allows everything: it adds no rule.
      if (value) current.rules.push({ allow: key === "allow", path: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }

  const rulesFor = (agent: string) => {
    const name = agent.toLowerCase();
    const own = groups.filter((g) => g.agents.includes(name));
    return (own.length ? own : groups.filter((g) => g.agents.includes("*"))).flatMap((g) => g.rules);
  };

  const matches = (pattern: string, path: string) => {
    const re = new RegExp(
      "^" + pattern.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*").replace(/\\\$$/, "$"),
    );
    return re.test(path);
  };

  return {
    allows(agent, path) {
      let best: RuleLine | null = null;
      for (const rule of rulesFor(agent)) {
        if (!matches(rule.path, path)) continue;
        if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) best = rule;
      }
      return best ? best.allow : true;
    },
    names(agent) {
      return groups.some((g) => g.agents.includes(agent.toLowerCase()));
    },
  };
}
