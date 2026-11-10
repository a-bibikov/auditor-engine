import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { badgeMarkdown, toBadge, toBadgeEndpoint, GRADE_COLORS } from "../src/index.ts";

describe("badge", () => {
  it("shows the label and the score, colored by grade", () => {
    const svg = toBadge({ score: 92, grade: "A" }, { label: "AI search" });
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /<title>AI search: 92\/100 \(A\)<\/title>/);
    assert.match(svg, />AI search<\/text>/);
    assert.match(svg, />92\/100<\/text>/);
    assert.match(svg, new RegExp(`fill="${GRADE_COLORS.A}"`));
    assert.match(toBadge({ score: 41, grade: "F" }, { label: "SEO" }), new RegExp(`fill="${GRADE_COLORS.F}"`));
  });

  it("grows with the label and escapes it", () => {
    const width = (svg: string) => Number(/width="(\d+)"/.exec(svg)![1]);
    assert.ok(width(toBadge({ score: 80, grade: "B" }, { label: "Classic search" })) > width(toBadge({ score: 80, grade: "B" }, { label: "SEO" })));
    assert.match(toBadge({ score: 80, grade: "B" }, { label: "A&B <x>" }), />A&amp;B &lt;x&gt;<\/text>/);
  });

  it("has a shields.io endpoint and a README snippet", () => {
    assert.deepEqual(toBadgeEndpoint({ score: 75, grade: "C" }, { label: "SEO" }), { schemaVersion: 1, label: "SEO", message: "75/100", color: "dfb317" });
    assert.equal(
      badgeMarkdown({ score: 100, grade: "A" }, { label: "AI search", image: "badge.svg", link: "https://github.com/a-bibikov/ai-search-audit" }),
      "[![AI search: 100/100](badge.svg)](https://github.com/a-bibikov/ai-search-audit)",
    );
  });
});
