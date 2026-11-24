import { readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { englishClassBasics } from "../src/rules/english-class-basics";
import { ClassBasics } from "../src/views/ClassLandingView";

const packs = readdirSync("src/generated/rules/packs")
  .filter((name) => name.startsWith("chapter-08-"))
  .map((name) => JSON.parse(readFileSync(`src/generated/rules/packs/${name}`, "utf8")) as {
    entities: { id: string; kind: string; name: string; originalDescription: string }[];
  });
const classes = packs.flatMap((pack) => pack.entities.filter((entity) => entity.kind === "class"));

function text(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}

function sourceCells(line: string): string[] {
  return line.trim().slice(1, -1).split("|").map((cell) => cell.trim()
    .replace(/<br\s*\/?>/gi, " ").replace(/\*\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"));
}

describe("English class basics", () => {
  it("covers all ten class originals, including Summoner", () => {
    expect(classes).toHaveLength(10);
    expect(classes.map((entity) => entity.id)).toContain("class.summoner");
  });

  it.each(classes)("renders every skill and advancement cell for $id", (entity) => {
    const edition = englishClassBasics(entity.originalDescription);
    expect(edition).toBeDefined();
    const html = renderToStaticMarkup(createElement(ClassBasics, {
      name: entity.name, basics: edition!.basics, edition, articleId: entity.id,
    }));
    const skills = html.match(/<section class="class-basics-card class-basics-skills">([\s\S]*?)<\/section>/)?.[1];
    const sourceSkill = /^\*\*Skills:\*\*\s*([^\n]+)/m.exec(edition!.basics)?.[1];
    expect(sourceSkill).toBeTruthy();
    expect(skills).toBeTruthy();
    // The skills section must stop at the advancement heading; the table has its own section.
    expect(skills).not.toContain("<table");
    expect(text(skills!).replace(/\s/g, "")).toContain(text(sourceSkill!.replace(/\*/g, "")).replace(/\s/g, ""));

    const sourceTable = edition!.basics.match(/^#{2,6}\s+.+ Advancement[^\n]*\n([\s\S]*?)(?=\n#{1,6}\s|(?![\s\S]))/m)?.[1];
    expect(sourceTable).toBeTruthy();
    const lines = sourceTable!.split("\n").filter((line) => /^\|.*\|$/.test(line.trim()));
    const headers = sourceCells(lines[0]);
    const rows = lines.slice(2).map(sourceCells);
    expect(rows).toHaveLength(10);
    const renderedRows = [...html.matchAll(/<div class="class-development-row"[^>]*>([\s\S]*?)(?=<div class="class-development-row"|<\/section>)/g)];
    expect(renderedRows).toHaveLength(10);
    for (const [index, row] of rows.entries()) {
      expect(row).toHaveLength(headers.length);
      const rendered = text(renderedRows[index][1]);
      expect(rendered).toMatch(new RegExp(`^${index + 1}\\b`));
      const renderedCells = renderedRows[index][1].split('<div class="class-development-cell">').slice(1);
      expect(renderedCells).toHaveLength(headers.length - 1);
      for (const [column, cell] of row.slice(1).entries()) {
        const renderedCell = text(renderedCells[column]);
        expect(renderedCell).toContain(headers[column + 1]);
        for (const item of cell.split(/\s*,\s*/).filter((value) => value && value !== "-" && value !== "—")) {
          expect(renderedCell).toContain(item.replace(/\.$/, ""));
        }
      }
    }
  });
});
