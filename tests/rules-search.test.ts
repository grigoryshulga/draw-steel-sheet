import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  createRuleSearcher,
  createSearchSequencer,
  normalizeSearchText,
} from "../src/rules/search";
import type { RuleIndexEntry, RuleSearchIndex } from "../src/rules/schema";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function entry(
  id: string,
  title: string,
  chapter = "08. Классы",
  group = "",
): RuleIndexEntry {
  return {
    id,
    title,
    chapter,
    group,
    path: `${chapter}/${id}.md`,
    packId: "chapter-08",
    headings: [{ id, title, level: 1 }],
    hasText: true,
  };
}

const index: RuleIndexEntry[] = [
  entry("e1", "Свирепость", "08. Классы", "Неистовый"),
  entry("e2", "Свирепость героя", "08. Классы", "Неистовый"),
  entry("e3", "Особый приём", "08. Классы", "Неистовый"),
  entry("e4", "Основы боя", "02. Основы", "Общее"),
];

const documents: RuleSearchIndex = {
  schemaVersion: 1,
  articles: [
    {
      id: "e1",
      text: "Свирепость Неистовый Ваша свирепость растёт, когда враг рядом.",
    },
    {
      id: "e2",
      text: "Свирепость героя Неистовый Вы получаете свирепость за удар.",
    },
    {
      id: "e3",
      text: "Особый приём Неистовый Тяжёлый удар наносит **урон** и даёт Свирепость союзнику.",
    },
    {
      id: "e4",
      text: "Основы боя Общее Бой идёт по раундам. Тяжёлый удар не упоминается.",
    },
  ],
};

function searcher() {
  return createRuleSearcher(index, documents);
}

describe("search normalization", () => {
  it("folds Russian case, ё and repeated whitespace", () => {
    expect(normalizeSearchText("  ТЯЖЁЛЫЙ\tУдар  ")).toBe("тяжелый удар");
    expect(normalizeSearchText("ЁЖ")).toBe("еж");
  });
});

describe("rule search", () => {
  it("returns nothing for an empty or whitespace query", () => {
    expect(searcher().search("")).toEqual([]);
    expect(searcher().search("   \n\t ")).toEqual([]);
  });

  it("matches every word in any casing or ё spelling", () => {
    const matches = searcher().search("ТЯЖЁЛЫЙ удар");
    expect(matches.map((match) => match.entry.id)).toEqual(["e3", "e4"]);
    expect(searcher().search("тяжелый свирепость").map((m) => m.entry.id)).toEqual(
      ["e3"],
    );
    expect(searcher().search("свирепость")).toHaveLength(3);
  });

  it("ranks title matches above group and body matches", () => {
    const matches = searcher().search("свирепость");
    expect(matches.map((match) => match.entry.id)).toEqual([
      "e1",
      "e2",
      "e3",
    ]);
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
    expect(matches[1].score).toBeGreaterThan(matches[2].score);
  });

  it("keeps the original casing in excerpts and strips Markdown markers", () => {
    const [match] = searcher().search("свирепость");
    expect(match.excerpt.startsWith("Свирепость")).toBe(true);
    // Регистр сохраняется как в оригинале: заголовок с заглавной, проза — как есть.
    expect(match.excerpt).toContain("Ваша свирепость растёт");

    const marked = searcher()
      .search("тяжелый удар")
      .find((item) => item.entry.id === "e3");
    expect(marked?.excerpt).toContain("Тяжёлый удар");
    expect(marked?.excerpt).not.toContain("**");
  });

  it("adds an ellipsis when the match is far into the article", () => {
    const long = entry("long", "Длинная статья");
    const text = `${"Вступление без ключевого слова. ".repeat(12)}Свирепость в конце.`;
    const result = createRuleSearcher([long], {
      schemaVersion: 1,
      articles: [{ id: "long", text }],
    }).search("свирепость");
    expect(result[0].excerpt.startsWith("…")).toBe(true);
    expect(result[0].excerpt).toContain("Свирепость в конце.");
  });

  it("honours chapter, group, and bookmark filters", () => {
    expect(
      searcher().search("свирепость", { chapter: "02. Основы" }),
    ).toEqual([]);
    expect(
      searcher()
        .search("свирепость", { chapter: "08. Классы", group: "Неистовый" })
        .map((match) => match.entry.id),
    ).toEqual(["e1", "e2", "e3"]);
    expect(
      searcher()
        .search("свирепость", { bookmarks: ["e2"], onlyBookmarks: true })
        .map((match) => match.entry.id),
    ).toEqual(["e2"]);
  });

  it("ignores duplicate and unknown search documents", () => {
    const duplicated = createRuleSearcher(index, {
      schemaVersion: 1,
      articles: [...documents.articles, ...documents.articles, { id: "ghost", text: "свирепость" }],
    });
    expect(duplicated.search("свирепость").map((match) => match.entry.id)).toEqual([
      "e1",
      "e2",
      "e3",
    ]);
  });
});

describe("search request sequencing", () => {
  it("keeps only the newest request current", () => {
    const sequencer = createSearchSequencer();
    const first = sequencer.begin();
    const second = sequencer.begin();
    expect(sequencer.isCurrent(first)).toBe(false);
    expect(sequencer.isCurrent(second)).toBe(true);
    expect(sequencer.isCurrent(second + 1)).toBe(false);
  });
});

describe("lazy search loading boundary", () => {
  it("loads the corpus only through a dynamic import in the repository", () => {
    const repository = fs.readFileSync(
      path.join(ROOT, "src/rules/repository.ts"),
      "utf8",
    );
    expect(repository).toContain(
      'import("../generated/rules/search.json")',
    );
    expect(repository).not.toMatch(
      /^\s*import\s+[^;]*generated\/rules\/search\.json/m,
    );

    const view = fs.readFileSync(
      path.join(ROOT, "src/views/CodexView.tsx"),
      "utf8",
    );
    expect(view).not.toContain("generated/rules/search.json");
    expect(view).not.toContain("generated/rules/manifest.json");
  });

  it("lets no other module import the search corpus statically", () => {
    const needle = "generated/rules/search.json";
    const offenders: string[] = [];
    function walk(directory: string) {
      for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, item.name);
        if (item.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(item.name)) continue;
        const source = fs.readFileSync(full, "utf8");
        if (!source.includes(needle)) continue;
        const relative = path.relative(ROOT, full).replaceAll(path.sep, "/");
        const staticImport = new RegExp(
          `^\\s*import\\s+[^;]*${needle.replace(".", "\\.")}`,
          "m",
        );
        if (relative !== "src/rules/repository.ts" || staticImport.test(source)) {
          offenders.push(relative);
        }
      }
    }
    walk(path.join(ROOT, "src"));
    expect(offenders).toEqual([]);
  });
});
