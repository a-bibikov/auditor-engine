import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_LANG, LANGS, isLang } from "../src/index.ts";
import { en } from "../src/i18n/en.ts";

const keys = (o: object, prefix = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

describe("report languages", () => {
  it("every language has every string of English", () => {
    for (const [lang, t] of Object.entries(LANGS)) assert.deepEqual(keys(t).sort(), keys(en).sort(), lang);
  });

  it("knows its languages", () => {
    assert.equal(DEFAULT_LANG, "en");
    assert.ok(isLang("ru") && !isLang("de") && !isLang("toString"));
  });
});
