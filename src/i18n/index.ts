import { en, type ReportMessages } from "./en.ts";
import { ru } from "./ru.ts";

export type { ReportMessages };

/** Report languages. A rule set supports the same ones, so a report never mixes two. */
export const LANGS = { en, ru } satisfies Record<string, ReportMessages>;
export type Lang = keyof typeof LANGS;
export const DEFAULT_LANG: Lang = "en";

export const isLang = (value: unknown): value is Lang => typeof value === "string" && Object.hasOwn(LANGS, value);
export const reportMessages = (lang: Lang = DEFAULT_LANG): ReportMessages => LANGS[lang];
