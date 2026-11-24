import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLASS_PRESETS } from "../src/data/classes";
import { localizeGameMessage } from "../src/i18n/game-messages";
import { englishClassBasics } from "../src/rules/english-class-basics";

const classes = [
  ["0801", "Fury", 21, 9, 10, "Ferocity"],
  ["0811", "Null", 21, 9, 8, "Discipline"],
  ["0821", "Summoner", 15, 6, 8, "Essence"],
  ["0831", "Conduit", 18, 6, 8, "Piety"],
  ["0841", "Tactician", 21, 9, 10, "Focus"],
  ["0851", "Talent", 18, 6, 8, "Clarity"],
  ["0861", "Shadow", 18, 6, 8, "Insight"],
  ["0871", "Troubadour", 18, 6, 8, "Drama"],
  ["0881", "Censor", 21, 9, 12, "Wrath"],
  ["0891", "Elementalist", 18, 6, 8, "Essence"],
] as const;

const names = { might: "Might", agility: "Agility", reason: "Reason", intuition: "Intuition", presence: "Presence" } as const;

describe("English printed class basics", () => {
  it.each(classes)("preserves the printed facts for %s (%s)", (id, name, stamina, growth, recoveries, resource) => {
    const source = JSON.parse(readFileSync(`content/rules/entities/class/classes/class.${id}.json`, "utf8")).originalDescription as string;
    const result = englishClassBasics(source);
    const preset = CLASS_PRESETS.find(item => item.originalName === name)!;
    expect(result).toBeDefined();
    expect([result!.stamina, result!.growth, result!.recoveries]).toEqual([String(stamina), String(growth), String(recoveries)]);
    expect(result!.basics).toContain(`**Strong Potency:** ${names[preset.potency]}`);
    for (const key of Object.keys(preset.starting) as (keyof typeof names)[]) {
      expect(result!.basics).toMatch(new RegExp(`${names[key]} of 2`));
    }
    const arrays = [...result!.basics.matchAll(/^- ([\d, −-]+)$/gm)].map(match => match[1].replaceAll("−", "-"));
    expect(arrays).toEqual(Object.keys(preset.starting).length === 1
      ? ["2, 2, -1, -1", "2, 1, 1, -1", "2, 1, 0, 0", "1, 1, 1, 0"]
      : ["2, -1, -1", "1, 1, -1", "1, 0, 0"]);
    expect(localizeGameMessage(preset.resource, "en")).toBe(resource);
    expect(result!.introduction).toBeTruthy();
  });

  it("retains the Summoner master-class note after Basics", () => {
    const source = JSON.parse(readFileSync("content/rules/entities/class/classes/class.0821.json", "utf8")).originalDescription as string;
    expect(englishClassBasics(source)?.afterword).toContain("Master Class");
  });
});
