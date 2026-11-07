import { REFERENCE_PREVIEW } from "../rules/consumer-reference-preview";
import type { CatalogEntry, GlossaryEntry } from "../rules/consumer-data";
import {
  classLandings,
  codexIndex,
  referenceSections,
} from "../rules/codex-navigation";
import type { Perk, PerkType } from "../types";
import type { RuleIndexEntry } from "../rules/schema";
import { CATALOG, GLOSSARY, plainSummary } from "./library";
import { KIT_COMPENDIUM } from "./kits";
import { PERK_COMPENDIUM, PERK_TYPE_META } from "./perks";

/**
 * Единый справочник: все разделы Справочника живут в каталоге с общей
 * навигацией. Здесь — только данные и адреса, без React и DOM.
 *
 * Каталоги наград берут готовые записи потребителя. Происхождения, карьеры,
 * комплекты и перки собираются из тех же канонических статей и сущностей:
 * карточка списка показывает краткую выжимку, полный текст открывается в
 * панели детали. Глоссарий — обычные термины.
 */

export type CatalogSectionId =
  | "classes"
  | "ancestries"
  | "careers"
  | "kits"
  | "perks"
  | "treasure"
  | "title"
  | "project"
  | "monsters"
  | "retainers"
  | "terrain"
  | "glossary";

export type CatalogSectionKind =
  | "classes"
  | "articles"
  | "perks"
  | "catalog"
  | "glossary";

export interface CatalogSection {
  id: CatalogSectionId;
  title: string;
  kind: CatalogSectionKind;
}

/** Порядок вкладок: сначала материалы создания героя, затем награды. */
export const CATALOG_SECTIONS: readonly CatalogSection[] = [
  { id: "classes", title: "Классы", kind: "classes" },
  { id: "ancestries", title: "Происхождения", kind: "articles" },
  { id: "careers", title: "Карьеры", kind: "articles" },
  { id: "kits", title: "Комплекты", kind: "articles" },
  { id: "perks", title: "Перки", kind: "perks" },
  { id: "treasure", title: "Сокровища", kind: "catalog" },
  { id: "title", title: "Титулы", kind: "catalog" },
  { id: "project", title: "Проекты", kind: "catalog" },
  { id: "monsters", title: "Монстры", kind: "articles" },
  { id: "retainers", title: "Помощники", kind: "articles" },
  { id: "terrain", title: "Местность", kind: "articles" },
  { id: "glossary", title: "Глоссарий", kind: "glossary" },
] as const;

const SECTION_BY_ID = new Map(
  CATALOG_SECTIONS.map((section) => [section.id, section] as const),
);

/** Старые адреса разделов Справочника ведут на те же вкладки каталога. */
const SECTION_ALIASES: Record<string, CatalogSectionId> = {
  treasures: "treasure",
  titles: "title",
  projects: "project",
};

/** Статья перка по его типу: полный текст живёт в одной из шести статей. */
const PERK_ARTICLE_BY_TYPE: Record<PerkType, string> = {
  crafting: "1002",
  exploration: "1003",
  interpersonal: "1004",
  intrigue: "1005",
  lore: "1006",
  supernatural: "1007",
};

export interface CatalogBrowserEntry {
  id: string;
  name: string;
  /** Надпись над названием: категория, тип перка или буква глоссария. */
  eyebrow: string;
  echelon: number | null;
  summary: string;
  /** Нормализуемый текст для поиска по карточке. */
  search: string;
  /** Каноническая статья, если полный текст открывается из неё. */
  articleId?: string;
  catalog?: CatalogEntry;
  perk?: Perk;
  glossary?: GlossaryEntry;
  /** Слаг класса: деталь открывает полную страницу класса. */
  classSlug?: string;
  director?: RuleIndexEntry['director'];
}

function directorEntries(section: 'monsters' | 'retainers' | 'terrain'): CatalogBrowserEntry[] {
  const ids = new Set(articleIds(section));
  return codexIndex.filter(article => ids.has(article.id)).map(article => {
    const d = article.director;
    const summary = [d?.level !== undefined ? `Уровень ${d.level}` : '', d?.organization, d?.role,
      d?.ev ? `БЦ ${d.ev}` : '', d?.size ? `Размер ${d.size}` : ''].filter(Boolean).join(' · ');
    return { id: article.id, articleId: article.id, name: article.title, eyebrow: article.group,
      echelon: null, summary, search: [article.title, d?.originalName, article.group, summary, ...(d?.keywords ?? [])].join(' '), director: d };
  }).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function articleTitle(articleId: string): string {
  return codexIndex.find((entry) => entry.id === articleId)?.title ?? articleId;
}

function articleIds(sectionId: string): string[] {
  return (
    referenceSections.find((section) => section.id === sectionId)?.items ?? []
  );
}

const ancestryByArticle = new Map(
  REFERENCE_PREVIEW.ancestries.map(
    (ancestry) => [ancestry.articleId, ancestry] as const,
  ),
);
const careerByArticle = new Map(
  REFERENCE_PREVIEW.careers.map(
    (career) => [career.articleId, career] as const,
  ),
);

function consumerEntries(kind: CatalogEntry["kind"]): CatalogBrowserEntry[] {
  return CATALOG.filter((entry) => entry.kind === kind).map((entry) => ({
    id: entry.id,
    name: entry.name,
    eyebrow: entry.category,
    echelon: entry.echelon,
    summary: entry.summary,
    search: [
      entry.name,
      entry.category,
      entry.keywords,
      entry.summary,
      entry.markdown,
    ].join(" "),
    articleId: entry.articleId,
    catalog: entry,
  }));
}

function ancestryEntries(): CatalogBrowserEntry[] {
  return articleIds("ancestries").flatMap((articleId) => {
    const ancestry = ancestryByArticle.get(articleId);
    const name = ancestry?.name ?? articleTitle(articleId);
    const summary = ancestry?.summary ?? "";
    return [
      {
        id: articleId,
        name,
        eyebrow: "",
        echelon: null,
        summary,
        search: [name, summary, ancestry?.signature ?? ""].join(" "),
        articleId,
      },
    ];
  });
}

function careerEntries(): CatalogBrowserEntry[] {
  return articleIds("careers").flatMap((articleId) => {
    const career = careerByArticle.get(articleId);
    const name = career?.name ?? articleTitle(articleId);
    const benefits = career?.benefits ?? "";
    return [
      {
        id: articleId,
        name,
        eyebrow: "",
        echelon: null,
        summary: plainSummary(benefits),
        search: [name, benefits].join(" "),
        articleId,
      },
    ];
  });
}

function kitEntries(): CatalogBrowserEntry[] {
  return articleIds("kits").flatMap((articleId) => {
    const name = articleTitle(articleId);
    const kit = KIT_COMPENDIUM.find(
      (candidate) => candidate.name.trim() === name.trim(),
    );
    return [
      {
        id: articleId,
        name,
        eyebrow: "",
        echelon: null,
        summary: kit?.summary ?? "",
        search: [name, kit?.summary ?? "", kit?.equipment ?? ""].join(" "),
        articleId,
      },
    ];
  });
}

function perkEntries(): CatalogBrowserEntry[] {
  return PERK_COMPENDIUM.map((perk) => ({
    id: perk.id,
    name: perk.name,
    eyebrow: PERK_TYPE_META[perk.type].label,
    echelon: null,
    summary: perk.summary,
    search: [perk.name, PERK_TYPE_META[perk.type].label, perk.summary].join(" "),
    articleId: PERK_ARTICLE_BY_TYPE[perk.type],
    perk,
  }));
}

function glossaryEntries(): CatalogBrowserEntry[] {
  return GLOSSARY.map((entry) => ({
    id: entry.id,
    name: entry.name,
    eyebrow: entry.letter,
    echelon: null,
    summary: plainSummary(entry.markdown),
    search: [entry.name, entry.english, entry.markdown].join(" "),
    glossary: entry,
  }));
}

function classEntries(): CatalogBrowserEntry[] {
  return classLandings.map((landing) => {
    const data = REFERENCE_PREVIEW.classes.find(
      (item) => item.name === landing.name,
    );
    const summary = data?.summary ?? "";
    return {
      id: landing.slug,
      name: landing.name,
      eyebrow: "",
      echelon: null,
      summary,
      search: [landing.name, summary, data?.basics ?? ""].join(" "),
      classSlug: landing.slug,
    };
  });
}

const ENTRY_BUILDERS: Partial<
  Record<CatalogSectionId, () => CatalogBrowserEntry[]>
> = {
  classes: classEntries,
  treasure: () => consumerEntries("treasure"),
  title: () => consumerEntries("title"),
  project: () => consumerEntries("project"),
  ancestries: ancestryEntries,
  careers: careerEntries,
  kits: kitEntries,
  perks: perkEntries,
  glossary: glossaryEntries,
  monsters: () => directorEntries('monsters'),
  retainers: () => directorEntries('retainers'),
  terrain: () => directorEntries('terrain'),
};

const ENTRIES = new Map<CatalogSectionId, CatalogBrowserEntry[]>(
  CATALOG_SECTIONS.map((section) => [
    section.id,
    ENTRY_BUILDERS[section.id]?.() ?? [],
  ]),
);

export function catalogSectionEntries(
  section: CatalogSectionId,
): readonly CatalogBrowserEntry[] {
  return ENTRIES.get(section) ?? [];
}

export function catalogSectionCount(section: CatalogSectionId): number {
  return catalogSectionEntries(section).length;
}

export function catalogSectionHref(section: CatalogSectionId): string {
  return `#/catalog/${section}`;
}

export function catalogBrowserEntryHref(
  section: CatalogSectionId,
  id: string,
): string {
  return `${catalogSectionHref(section)}/${encodeURIComponent(id)}`;
}

export interface CatalogRoute {
  section: CatalogSectionId;
  id: string;
}

/**
 * Разбирает адреса #/catalog/<раздел>[/<запись>], старые #/reference/<раздел>
 * и #/glossary/<термин>. Пустой #/reference/ открывает классы, пустой
 * #/catalog/ — сокровища, как было до объединения.
 */
export function resolveCatalogRoute(segments: string[]): CatalogRoute {
  const root = segments[1] ?? "";
  const rawSection =
    root === "glossary"
      ? "glossary"
      : (segments[2] ?? "").split("#")[0];
  const rawId = root === "glossary" ? (segments[2] ?? "") : (segments[3] ?? "");
  const normalized = SECTION_ALIASES[rawSection] ?? rawSection;
  const fallback: CatalogSectionId =
    root === "reference" ? "classes" : "treasure";
  const section = SECTION_BY_ID.has(normalized as CatalogSectionId)
    ? (normalized as CatalogSectionId)
    : fallback;
  return { section, id: rawId };
}
