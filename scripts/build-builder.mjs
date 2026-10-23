#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const articles = JSON.parse(
  readFileSync(join(root, "src/data/codex.generated.json"), "utf8"),
);
const clean = (text) =>
  text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*/g, "")
    .trim();
function sections(text, level = 4) {
  const matches = [...text.matchAll(new RegExp(`^#{${level}} (.+)$`, "gm"))];
  return matches.map((m, i) => ({
    name: clean(m[1]),
    text: text
      .slice(m.index + m[0].length, matches[i + 1]?.index ?? text.length)
      .trim(),
  }));
}
const ancestries = articles
  .filter((a) => a.chapter.startsWith("04.") && a.id !== "0401")
  .map((a) => {
    const matches = [
      ...a.markdown.matchAll(/^\*\*(.+?)\s*\((\d+)\s*очк[^)]*\)\*\*\s*:?/gm),
    ];
    const traits = matches.map((m, i) => ({
      name: m[1],
      cost: Number(m[2]),
      text: a.markdown
        .slice(
          m.index + m[0].length,
          matches[i + 1]?.index ?? a.markdown.length,
        )
        .trim(),
    }));
    const signature = sections(a.markdown).filter((s) =>
      /знаков/i.test(s.name),
    );
    return {
      name: a.title,
      articleId: a.id,
      summary: clean(a.markdown.split("\n\n")[0]),
      signature: signature.map((s) => `#### ${s.name}\n${s.text}`).join("\n\n"),
      budget: Number(
        a.markdown.match(
          /(?:есть|имеете)\s+(\d+)\s+очк[ао]?\s+происхождения/i,
        )?.[1] || 3,
      ),
      traits,
    };
  });
const cultures = Object.fromEntries(
  ["0502", "0503", "0504"].map((id, i) => {
    const a = articles.find((a) => a.id === id);
    return [
      ["environment", "organization", "upbringing"][i],
      sections(a.markdown).map((s) => ({ ...s, articleId: id })),
    ];
  }),
);
const careers = articles
  .filter((a) => a.chapter.startsWith("06."))
  .map((a) => ({
    name: a.title,
    articleId: a.id,
    benefits: a.markdown.split("\n---")[0],
    renown: Number(
      a.markdown.match(/\*\*Известность\*\*:?\s*:?\s*\+?(\d+)/)?.[1] || 0,
    ),
    wealth: Number(
      a.markdown.match(/\*\*Богатство\*\*:?\s*:?\s*\+?(\d+)/)?.[1] || 0,
    ),
    incidents: [
      ...a.markdown.matchAll(/^\|\s*\d+\s*\|\s*(.+?)\s*\|\s*$/gm),
    ].map((m) => clean(m[1])),
  }));
const classes = articles
  .filter((a) => a.chapter.startsWith("08.") && /1-й Уровень/.test(a.title))
  .map((a) => ({
    name: a.group,
    articleId: a.id,
    summary: clean(a.markdown.split("\n\n")[0]),
    basics:
      a.markdown
        .match(/## Основы\s*([\s\S]*?)(?=######|\n---|$)/)?.[1]
        ?.trim() || "",
    features: a.markdown.slice(
      a.markdown.indexOf("## Особенности 1-го уровня"),
    ),
    featureChoices: sections(a.markdown)
      .filter((s) =>
        /^(Молитва|Оберег |Зачарование|Псионическая аугментация)/i.test(s.name),
      )
      .map((s) => ({
        name: s.name,
        text: s.text.split(/^##### /m)[0].trim(),
        options: sections(s.text, 5),
      }))
      .filter((s) => s.options.length > 0),
    subclasses: (() => {
      const first = sections(a.markdown)[0]?.text || "";
      if (a.group === "Талант")
        return ["Хронопатия", "Телекинез", "Телепатия"].map((name) => ({
          name,
          text: "",
        }));
      if (a.group === "Элементалист")
        return ["Земля", "Огонь", "Зелень", "Пустота"].map((name) => ({
          name,
          text: "",
        }));
      if (a.group === "Проводник")
        return [
          "Созидание",
          "Смерть",
          "Судьба",
          "Знание",
          "Жизнь",
          "Любовь",
          "Природа",
          "Защита",
          "Буря",
          "Солнце",
          "Хитрость",
          "Война",
        ].map((name) => ({ name, text: "" }));
      return [...first.matchAll(/^- \*\*(.+?):\*\*\s*(.+)$/gm)].map((m) => ({
        name: clean(m[1]).replace(/\s*\([^)]*\)/g, ""),
        text: m[2],
      }));
    })(),
  }));
const complications = articles
  .filter((a) => a.chapter.startsWith("11.") && /Нюансы \d/.test(a.title))
  .flatMap((a) => sections(a.markdown).map((s) => ({ ...s, articleId: a.id })));
writeFileSync(
  join(root, "src/data/builder.generated.json"),
  JSON.stringify({ ancestries, cultures, careers, classes, complications }),
);
console.log(
  `Конструктор: ${ancestries.length} происхождений, ${careers.length} карьер, ${classes.length} классов, ${complications.length} нюансов`,
);
