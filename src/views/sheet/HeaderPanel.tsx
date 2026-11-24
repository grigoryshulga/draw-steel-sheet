import { useLocale } from "../../i18n/locale";
import { identityLabel, titleLabel } from "../../rules/consumer-identity-labels";
import { classPreset } from "../../data/classes";
import { useState } from "react";
import { Button } from "../../components/ui";
import { useApp } from "../../state/AppContext";
import { HeaderDomainChoices } from "./HeaderDomainChoices";
import { codexIndex, codexLink } from "../../rules/codex-navigation";
import { ProgressPanel } from "./ProgressPanel";
import { Portrait } from "./Portrait";

export function HeaderPanel({ compact = false }: { compact?: boolean }) {
  const { t, locale } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const { character } = useApp();
  const className = locale === "en" ? classPreset(character.className)?.originalName || character.className : character.className;
  const titles = character.inventory.filter(
    (item) => item.category === "title",
  );
  const classArticle = codexIndex.find(
    (a) => a.group === character.className && /1-й Уровень/.test(a.title),
  );
  return (
    <header className={`sheet-header${compact ? " is-compact" : ""}`}>
      {compact && (
        <div className="sheet-compact-identity">
          <Portrait />
          <div>
            <h1>{character.name}</h1>
            <p>
              {className} · {t(`${character.level}-й уровень`, `Level ${character.level}`)}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={expanded}
            icon={expanded ? "minus" : "chevron-down"}
            iconOnly
            aria-label={expanded ? t("Свернуть сведения о герое", "Collapse hero details") : t("Развернуть сведения о герое", "Expand hero details")}
            aria-controls="hero-identity-details"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? t("Свернуть", "Collapse") : t("О герое", "About hero")}
          </Button>
        </div>
      )}
      {(!compact || expanded) && (
        <div id="hero-identity-details">
          <div className="sheet-identity-heading">
            {!compact && <Portrait />}
            <div className="sheet-identity-body">
              {!compact && <h1>{character.name}</h1>}
              <div className="sheet-identity-summary">
                {character.ancestry && (
                  <a href={codexLink(character.ancestry)}>
                    {identityLabel(character.ancestry, locale)}
                  </a>
                )}
                {character.className && (
                  <>
                    <span aria-hidden="true">/</span>
                    <a
                      href={
                        classArticle
                          ? `#/codex/${classArticle.id}`
                          : "#/codex/0701"
                      }
                    >
                      {className}
                    </a>
                  </>
                )}
                {character.subclass && <span>· {character.subclass.split(", ").map(value => identityLabel(value, locale, character.className)).join(", ")}</span>}
                {character.career && (
                  <>
                    <span aria-hidden="true">/</span>
                    <a href={codexLink(character.career)}>{identityLabel(character.career, locale)}</a>
                  </>
                )}
                <HeaderDomainChoices key={character.id} />
              </div>
              {titles.length > 0 && (
                <ul className="sheet-identity-titles" aria-label={t("Титулы", "Titles")}>
                  {titles.map((title) => (
                    <li key={title.id}>{titleLabel(title, locale) || t("Без названия", "Untitled")}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="sheet-header-progress">
              <ProgressPanel />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
