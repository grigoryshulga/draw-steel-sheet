import type { Ability, AbilityTier, ActionType, CharacteristicKey } from "../types";
import { ACTION_TYPES } from "../data/actions";
import { CHARACTERISTICS } from "./rules";

/**
 * Черты происхождения в книге, которые дают знаковую способность, хранятся
 * как markdown-цитата с таблицей и тирами. Билдеру нужна настоящая карточка
 * способности, поэтому разбираем только этот известный формат: одиночная
 * цитата с таблицей действия и броском силы. Всё остальное возвращает null,
 * и текст черты показывается как раньше.
 */
export function ancestryTraitAbility(text: string, traitName: string): Ability | null {
  const block = text
    .split(/\r?\n/)
    .filter((line) => line.trimStart().startsWith(">"))
    .map((line) => line.replace(/^\s*>\s?/, ""));
  if (block.length === 0) return null;

  const titleLines = block.filter(
    (line) =>
      /^\*\*[^*]+\*\*$/.test(line.trim()) &&
      !/^(Бросок силы|Эффект|Триггер)/i.test(line.replace(/\*/g, "").trim()),
  );
  if (titleLines.length !== 1) return null;
  const name = titleLines[0].trim().replace(/^\*\*|\*\*$/g, "").trim();
  if (!name) return null;

  const tableRows = block
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && !/^\|[\s:|-]+\|$/.test(line))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.replace(/\*\*/g, "").trim()),
    );
  if (tableRows.length < 2) return null;
  const [keywordRow, targetRow] = tableRows;
  if (keywordRow.length < 2 || targetRow.length < 2) return null;

  const actionLabel = keywordRow[1];
  const actionType =
    ACTION_TYPES.find((item) => item.label === actionLabel)?.key ??
    (actionLabel.includes("Основное")
      ? "main"
      : actionLabel.includes("Маневр")
        ? "maneuver"
        : actionLabel.includes("Триггер")
          ? "trigger"
          : "none");

  const cleanCell = (value: string) => value.replace(/[📏🎯]/g, "").trim();
  const distance = cleanCell(targetRow[0]);
  const target = cleanCell(targetRow[1]);
  if (!distance || !target) return null;

  const rollLine = block.find((line) => /Бросок силы/i.test(line));
  if (!rollLine) return null;
  const rollPart = rollLine.replace(/\*\*/g, "").split(/[:：]/)[0];
  const rollNames = rollPart
    .replace(/^.*?Бросок силы\s*\+?\s*/i, "")
    .split(/\s+или\s+|,/)
    .map((value) => value.trim())
    .filter(Boolean);
  const rollCharacteristics = CHARACTERISTICS.filter((characteristic) =>
    rollNames.some((value) => value.toLowerCase() === characteristic.label.toLowerCase()),
  ).map((characteristic) => characteristic.key) as CharacteristicKey[];
  if (rollCharacteristics.length === 0) return null;

  const tiers: AbilityTier[] = [];
  for (const line of block) {
    const match = line.match(/^-\s*\*\*(.+?):\*\*\s*(.+)$/);
    if (!match) continue;
    const [, range, rawValue] = match;
    if (!/^[≤<]?\s*\d|^\d+\s*[-–]\s*\d|^\d+\+/.test(range.trim())) continue;
    const value = rawValue.replace(/\*\*/g, "").trim();
    const damageMatch = value.match(/^(\d+(?:d\d+)?)(?:\s*урона)?/i);
    const damage = damageMatch && /урона/i.test(value) ? damageMatch[1] : "";
    const effect = damage
      ? value.replace(/^\d+(?:d\d+)?\s*урона\s*;?\s*/i, "").trim()
      : value;
    tiers.push({ damage, effect });
  }
  if (tiers.length === 0) return null;
  while (tiers.length < 3) tiers.push({ damage: "", effect: "" });

  const flavor =
    block
      .map((line) => line.trim())
      .find((line) => /^_.+_$/.test(line))
      ?.replace(/^_|_$/g, "")
      .trim() ?? "";

  const keywords = keywordRow[0]
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  const effect = block
    .filter((line) => line.trim() && !line.startsWith(">"))
    .map((line) => line.trim())
    .find((line) => /^\*\*Эффект:?\*\*/i.test(line))
    ?.replace(/^\*\*Эффект:?\*\*\s*/i, "")
    .trim();

  return {
    id: `ancestry-trait-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    flavor,
    actionType: actionType as ActionType,
    kind: "signature",
    keywords,
    distance,
    target,
    rollCharacteristics,
    preferredCharacteristic: rollCharacteristics[0] ?? "",
    rollBonus: 0,
    resourceCost: 0,
    trigger: "",
    tiers: [tiers[0], tiers[1], tiers[2]],
    effect: effect ?? "",
    source: `Происхождение · ${traitName}`,
    notes: "",
  };
}
