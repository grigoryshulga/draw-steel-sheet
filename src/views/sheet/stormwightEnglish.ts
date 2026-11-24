import type { StormwightForm } from "../../types";

/** Extract only the selected kit/form section from the canonical English pack. */
export function stormwightEnglishForm(markdown: string, kit: string, form: StormwightForm): string | undefined {
  if (form === "true" || !kit.trim()) return undefined;
  const lines = markdown.split(/\r?\n/);
  const kitStart = lines.findIndex(line => line.trim().toLowerCase() === `## ${kit.trim().toLowerCase()}`);
  if (kitStart < 0) return undefined;
  const nextKit = lines.findIndex((line, index) => index > kitStart && /^##\s+/.test(line));
  const end = nextKit < 0 ? lines.length : nextKit;
  const heading = form === "animal" ? "animal form:" : "hybrid form:";
  const start = lines.findIndex((line, index) => index > kitStart && index < end && line.trim().toLowerCase().startsWith(`### ${heading}`));
  if (start < 0) return undefined;
  const nextSection = lines.findIndex((line, index) => index > start && index <= end && /^#{1,3}\s+/.test(line));
  const text = lines.slice(start + 1, nextSection < 0 ? end : nextSection).join("\n").trim();
  return text || undefined;
}
