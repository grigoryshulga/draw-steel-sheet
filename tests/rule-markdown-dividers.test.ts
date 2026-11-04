import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RuleMarkdown } from "../src/components/rules/RuleMarkdown";

describe("RuleMarkdown dividers", () => {
  it("не выводит горизонтальные линии из источника", () => {
    const html = renderToStaticMarkup(
      createElement(RuleMarkdown, {
        text: [
          "Первый абзац.",
          "",
          "---",
          "",
          "## Второй раздел",
          "",
          "Текст после разделителя.",
          "",
          "***",
          "",
          "Текст после второго разделителя.",
        ].join("\n"),
      }),
    );

    expect(html).not.toContain("<hr");
    expect(html).toContain("Первый абзац.");
    expect(html).toContain("Второй раздел");
    expect(html).toContain("Текст после второго разделителя.");
  });
});
