import { codexIndex } from "../../rules/codex-navigation";
import { loadRuleArticle } from "../../rules/repository";

/** Resolve old saved slugs without changing custom group names. */
export function monsterGroupName(group: string): string {
  return codexIndex.find((entry) => entry.director?.groupSlug === group && entry.group)?.group ?? group;
}

export interface MonsterSeed {
  sourceId: string;
  name: string;
  level: number;
  organization: string;
  role: string;
  encounterValue: number;
  maxStamina: number;
  group: string;
  kind: "monster" | "retainer" | "terrain";
}

export interface MonsterSeedFilters {
  level?: number;
  role?: string;
  organization?: string;
  kind?: string;
}

const normalize = (value: string) =>
  value.toLocaleLowerCase("ru").normalize("NFKC");
const recordKind = (
  entry: (typeof codexIndex)[number] | undefined,
): MonsterSeed["kind"] | undefined => {
  if (!entry) return undefined;
  const section = entry.director?.section;
  if (section === "terrain")
    return entry.director?.recordType === "dynamic-terrain"
      ? "terrain"
      : undefined;
  if (section !== "monsters" && section !== "retainers") return undefined;
  if (entry.director?.recordType !== "statblock") return undefined;
  return section === "retainers" ? "retainer" : "monster";
};

/** Lightweight navigation rows use 0 stamina; loadMonsterSeed reads the printed value. */
export function searchMonsterSeeds(
  query: string,
  filters: MonsterSeedFilters = {},
): Omit<MonsterSeed, "maxStamina">[] {
  const needle = normalize(query.trim());
  return codexIndex.flatMap((entry) => {
    const director = entry.director;
    const kind = recordKind(entry);
    if (!director || !kind || typeof director.level !== "number") return [];
    if (filters.level !== undefined && director.level !== filters.level)
      return [];
    if (
      filters.role &&
      normalize(director.role ?? "") !== normalize(filters.role)
    )
      return [];
    if (
      filters.organization &&
      normalize(director.organization ?? "") !== normalize(filters.organization)
    )
      return [];
    if (filters.kind && kind !== filters.kind) return [];
    if (
      needle &&
      !normalize(
        `${entry.title} ${director.originalName} ${director.groupSlug}`,
      ).includes(needle)
    )
      return [];
    const ev = encounterValue(director.ev, entry.id);
    return [
      {
        sourceId: entry.id,
        name: entry.title,
        level: director.level,
        organization: director.organization ?? "",
        role: director.role ?? "",
        encounterValue: ev,
        group: entry.group || monsterGroupName(director.groupSlug),
        kind,
      },
    ];
  });
}

function parseNumeric(
  value: string | undefined,
  label: string,
  id: string,
  allowUnit = false,
): number {
  if (!value || /^\s*[-—]\s*$/.test(value)) return 0;
  const pattern = allowUnit
    ? /^\s*(\d+(?:[.,]\d+)?)(?=\s|$)/
    : /^\s*(\d+(?:[.,]\d+)?)\s*$/;
  const match = value.match(pattern);
  if (!match)
    throw new Error(
      `Неоднозначное числовое значение ${label} для «${id}»: ${value}`,
    );
  const number = Number(match[1].replace(",", "."));
  if (!Number.isFinite(number) || number < 0)
    throw new Error(`Некорректное значение ${label} для «${id}».`);
  return number;
}

function encounterValue(value: string | undefined, id: string): number {
  const number = parseNumeric(value, "БЦ", id, true);
  // The printed minion price buys four creatures, unlike an ordinary monster.
  return /for (?:four|4) minions/i.test(value ?? "") ? number / 4 : number;
}

/** Loads the canonical article/entity text. This adapter provides manual scene counters only. */
export async function loadMonsterSeed(articleId: string): Promise<MonsterSeed> {
  const { article, entities } = await loadRuleArticle(articleId);
  const kind = recordKind(codexIndex.find((entry) => entry.id === articleId));
  if (!kind || !article.director)
    throw new Error(`Статья «${articleId}» не является записью каталога.`);
  const entity = Object.values(entities).find((item) => item.kind === kind);
  if (!entity)
    throw new Error(
      `В статье «${articleId}» не найдена каноническая сущность ${kind}.`,
    );
  const metadata = article.director;
  const ev = encounterValue(metadata.ev, articleId);
  const staminaMatches = [
    ...entity.markdown.matchAll(
      /(?:\*\*)?(\d+)(?:\*\*)?\s*(?:<br>\s*)?Выносливость/giu,
    ),
  ];
  const listedStamina = entity.markdown.match(
    /^\s*-\s*\*\*Выносливость:\*\*\s*(\d+)(?:\s|$)/mu,
  );
  const stamina = listedStamina
    ? Number(listedStamina[1])
    : kind === "terrain" && !staminaMatches.length
      ? 0
      : staminaMatches.length === 1
        ? Number(staminaMatches[0][1])
        : NaN;
  if (!Number.isFinite(stamina) || stamina < 0)
    throw new Error(`Неоднозначная Выносливость для «${articleId}».`);
  return {
    sourceId: articleId,
    name: article.title,
    level: parseNumeric(String(metadata.level), "уровень", articleId),
    organization: metadata.organization ?? "",
    role: metadata.role ?? "",
    encounterValue: ev,
    maxStamina: stamina,
    group: article.group || monsterGroupName(metadata.groupSlug),
    kind,
  };
}
