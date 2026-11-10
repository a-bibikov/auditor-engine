#!/usr/bin/env node
/**
 * The next release from the commits on main since the last tag: the version and the release notes.
 *
 *   feat            → minor  (0.6.0 → 0.7.0), a breaking feat! too: a major version is only made by hand
 *   fix, bug, docs  → patch  (0.6.0 → 0.6.1)
 *   anything else   → no release (chore, ci, test, refactor, perf, merge commits)
 *   --major         → major  (0.6.0 → 1.0.0), for the manual run of the Release workflow
 *
 * Writes release=true|false, version and tag to $GITHUB_OUTPUT (or prints them) and the notes to release-notes.md.
 * No dependencies: plain git and Node.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const out = (values) => {
  const lines = Object.entries(values).map(([k, v]) => `${k}=${v}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines.join("\n") + "\n");
  console.log(lines.join("\n"));
};

// Release tags are vX.Y.Z; the floating v0 of the GitHub Action is not one of them.
const tags = git("tag", "--list", "v*", "--sort=-v:refname")
  .split("\n")
  .filter((t) => /^v\d+\.\d+\.\d+$/.test(t));
const last = tags[0];
const [major, minor, patch] = last ? last.slice(1).split(".").map(Number) : [0, 0, 0];

// A release commit sits next to main, not on it: its parent is where main was, so count from there. Older tags
// (release-please) sit on main itself: count from the tag.
const onMain = (ref) => {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ref, "HEAD"]);
    return true;
  } catch {
    return false;
  }
};
const range = !last ? "HEAD" : onMain(last) ? `${last}..HEAD` : `${last}^..HEAD`;
const SEP = "\u001e";
const log = git("log", "--no-merges", `--format=%s%x1f%b${SEP}`, range);
const commits = log
  .split(SEP)
  .map((c) => c.trim())
  .filter(Boolean)
  .map((c) => {
    const [subject, body = ""] = c.split("\u001f");
    const m = subject.match(/^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/);
    if (!m) return null;
    const type = m[1].toLowerCase() === "bug" ? "fix" : m[1].toLowerCase();
    return { type, breaking: Boolean(m[3]) || /^BREAKING[ -]CHANGE:/m.test(body), text: m[4] };
  })
  .filter((c) => c && !(c.type === "chore" && /^release\b/i.test(c.text)));

const manual = process.argv.includes("--major");
const feats = commits.filter((c) => c.type === "feat");
const fixes = commits.filter((c) => c.type === "fix");
const docs = commits.filter((c) => c.type === "docs");

const version = manual
  ? `${major + 1}.0.0`
  : feats.length
    ? `${major}.${minor + 1}.0`
    : fixes.length || docs.length
      ? `${major}.${minor}.${patch + 1}`
      : null;

if (!version) {
  out({ release: "false" });
  console.log(`Nothing to release since ${last ?? "the first commit"}: no feat, fix or docs commits.`);
  process.exit(0);
}

const tag = `v${version}`;
const repo = process.env.GITHUB_REPOSITORY;
const section = (title, list) => (list.length ? [`### ${title}`, "", ...list.map((c) => `- ${c.text}`), ""] : []);
const notes = [
  ...section("⚠ Breaking changes", commits.filter((c) => c.breaking)),
  ...section("Features", feats),
  ...section("Fixes", fixes),
  ...section("Documentation", docs),
  ...(repo && last ? [`**Full changelog:** https://github.com/${repo}/compare/${last}...${tag}`, ""] : []),
].join("\n");
writeFileSync("release-notes.md", notes || "Maintenance release.\n");
out({ release: "true", version, tag, previous: last ?? "" });
