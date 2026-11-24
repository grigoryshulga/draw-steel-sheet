import { useLocale } from "../../i18n/locale";
import { BUILDER_DATA } from "../../lib/character-builder";
import { lazy, Suspense, useState } from "react";
import {
  catalogSectionEntries,
  type CatalogSectionId,
} from "../../data/reference-catalog";
import { searchText } from "../../lib/codex";
import type { ArtKind } from "../../lib/art";
import type { BuilderDraft } from "../../lib/character-builder";
import { useBuilderStep } from "./BuilderStepContext";
import { ReferenceList } from "../rules/ReferenceList";
import { RuleText } from "../RuleText";
import { RuleArticleReader } from "../rules/RuleArticleReader";
import "./BuilderSelection.css";

const ClassReference = lazy(() =>
  import("../../views/ClassLandingView").then((m) => ({
    default: m.ClassLandingView,
  })),
);
const sections: Partial<Record<ArtKind, CatalogSectionId>> = {
  ancestry: "ancestries",
  career: "careers",
  class: "classes",
  kit: "kits",
};
export interface BuilderSelectionOption {
  id?: string;
  name: string;
  originalName?: string;
  originalDescription?: string;
  disabled?: boolean;
  note?: string;
  description?: string;
  articleId?: string;
}
export interface BuilderSelectionDetail {
  name: string;
  description?: string;
  articleId?: string;
}
export interface BuilderSelectionProps {
  label: string;
  layout?: "sidebar" | "tiles";
  kind?: ArtKind;
  options: readonly BuilderSelectionOption[];
  selected: BuilderSelectionDetail | null;
  changesFor: (name: string) => Partial<BuilderDraft> | void;
}

/** Строка выбирает вариант; мастер применяет его при переходе «Далее». */
export function BuilderSelection({
  label,
  layout = "sidebar",
  kind,
  options,
  selected,
  changesFor,
}: BuilderSelectionProps) {
  const { locale, t } = useLocale();
  const { stageChoice } = useBuilderStep();
  const [viewedName, setViewedName] = useState(selected?.name ?? "");
  const viewed =
    options.find((option) => option.name === viewedName) ?? options[0];
  const section = kind ? sections[kind] : undefined;
  const catalogEntries = section ? catalogSectionEntries(section) : [];
  const matches = (name: string, other: string) =>
    searchText(name.trim()) === searchText(other.trim());
  const entry = catalogEntries.find((item) =>
    matches(item.name, viewed?.name ?? ""),
  );
  const originals = [...BUILDER_DATA.ancestries, ...BUILDER_DATA.careers,
    ...BUILDER_DATA.classes, ...Object.values(BUILDER_DATA.cultures).flat()];
  const listEntries = options.map((option) => {
    const catalog = catalogEntries.find((item) => matches(item.name, option.name));
    const original = originals.find((item) => item.name === option.name);
    return { ...(catalog ?? option), id: catalog?.id ?? option.id ?? option.name, canonicalName: option.name,
      name: locale === "en" && (option.originalName || original?.originalName) ? (option.originalName || original?.originalName || option.name) : option.name,
      ...(locale === "en" ? { summary: undefined } : {}) };
  });
  const articleId = viewed?.articleId ?? entry?.articleId;
  return (
    <div className={`builder-selection${layout === "tiles" ? " builder-selection--tiles" : ""}`}>
      <div className="builder-selection__list">
        <ReferenceList
          entries={listEntries}
          label={label}
          artKind={kind}
          selectedId={
            listEntries.find((item) => matches(item.canonicalName, viewedName))?.id ??
            viewedName
          }
          metaFor={(item) =>
            options.find((option) => matches(option.name, item.canonicalName))?.note
          }
          onSelect={(item) => {
            const option = options.find((option) =>
              matches(option.name, item.canonicalName),
            );
            if (!option) return;
            setViewedName(option.name);
            stageChoice(
              option.name === selected?.name
                ? {}
                : (changesFor(option.name) ?? {}),
              option.disabled ? option.note || t("Этот вариант недоступен.", "This option is unavailable.") : "",
            );
          }}
        />
      </div>
      <section
        className="builder-selection__detail"
        aria-label={`${t("Описание", "Description")}: ${viewed?.name ?? label}`}
      >
        {viewed && (
          <>
            <div className="builder-selection__reader">
              {entry?.classSlug ? (
                <Suspense fallback={<p role="status">{t("Загружаем класс…", "Loading class…")}</p>}>
                  <ClassReference
                    key={entry.classSlug}
                    slug={entry.classSlug}
                    embedded
                    creation
                  />
                </Suspense>
              ) : articleId ? (
                <RuleArticleReader
                  key={articleId}
                  articleId={articleId}
                  entityName={entry?.entityName ?? (kind ? undefined : viewed.name)}
                />
              ) : (
                <>
                  <h3 className="builder-selection__title">{locale === "en" ? viewed.originalName || viewed.name : viewed.name}</h3>
                  {locale === "en" && !viewed.originalDescription && viewed.description && <span className="muted small">Russian</span>}
                  <RuleText
                    text={
                      (locale === "en" ? viewed.originalDescription || undefined : undefined) ?? viewed.description ??
                      entry?.summary ??
                      selected?.description ??
                      ""
                    }
                  />
                </>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
