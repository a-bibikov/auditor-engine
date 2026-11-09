import type { ReportMessages } from "./en.ts";

/** 1 страница, 2 страницы, 5 страниц. */
const plural = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const dd = n % 100;
  return d === 1 && dd !== 11 ? one : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many;
};


/** Отчёт на русском. Тип ReportMessages не даст пропустить строку: если в en.ts что-то добавили, здесь будет ошибка компиляции. */
export const ru: ReportMessages = {
  report: {
    title: (site: string) => `Аудит сайта: ${site}`,
    summary: (o) =>
      `**${o.score}/100 (${o.grade})** · проверено: ${o.checked} из ${o.total} · ошибок: ${o.errors} · предупреждений: ${o.warnings} · заметок: ${o.notes} · страниц: ${o.pages}`,
    capped: (checked: number, total: number) => `Оценка ограничена B: на этом сайте удалось выполнить только ${checked} проверок из ${total}.`,
    priorities: "Что сделать в первую очередь",
    col: {
      part: "Раздел",
      score: "Оценка",
      checks: "Проверено",
      errors: "✖ Ошибки",
      warnings: "⚠ Предупреждения",
      notes: "ℹ Заметки",
      check: "Проверка",
      result: "Результат",
      severity: "Критичность",
      todo: "Что сделать",
      comment: "Комментарий",
    },
    of: (n, total) => `${n} из ${total}`,
    ok: "в порядке",
    groupLine: (ok, checked, skipped) => [checked && `в порядке: ${ok} из ${checked}`, skipped && `не проверено: ${skipped}`].filter(Boolean).join(" · "),
    recommendations: "Рекомендации",
    level: { error: "ошибка", warn: "предупреждение", info: "заметка" },
    scale: (n: number, total: number) => `${n} ${plural(n, "страница", "страницы", "страниц")} из ${total}`,
    found: (n: number, total: number) => `Найдено на ${n} ${n % 10 === 1 && n % 100 !== 11 ? "странице" : "страницах"} из ${total} проверенных`,
    foundSite: "Касается сайта целиком",
    foundAt: (n: number) => `Найдено по ${n} ${n % 10 === 1 && n % 100 !== 11 ? "адресу" : "адресам"}`,
    addresses: (n: number) => `${n} ${plural(n, "адрес", "адреса", "адресов")}`,
    why: "Чем это плохо",
    clean: "Исправлять нечего.",
    more: (n: number) => `…и ещё ${n}`,
    andMore: (n: number) => `и ещё ${n}`,
    checklist: "Чек-лист",
    legend: "✓ в порядке · ✖ ошибка · ⚠ предупреждение · ℹ заметка · – не проверено",
    notChecked: "не проверено",
    count: (o) =>
      [
        o.errors && `${o.errors} ${plural(o.errors, "ошибка", "ошибки", "ошибок")}`,
        o.warnings && `${o.warnings} ${plural(o.warnings, "предупреждение", "предупреждения", "предупреждений")}`,
        o.notes && `${o.notes} ${plural(o.notes, "заметка", "заметки", "заметок")}`,
      ]
        .filter(Boolean)
        .join(", "),
    site: "сайт",
    footer: (pages: number, date: string) => `Проверено страниц: ${pages}, ${date}.`,
  },
};
