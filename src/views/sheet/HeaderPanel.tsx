import { useState } from "react";
import { Button } from "../../components/ui";
import { useApp } from "../../state/AppContext";
import { HeaderDomainChoices } from "./HeaderDomainChoices";
import { codexIndex, codexLink } from "../../rules/codex-navigation";
import { ProgressPanel } from "./ProgressPanel";
import { Portrait } from "./Portrait";

export function HeaderPanel({ compact = false }: { compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { character } = useApp();
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
              {character.className} · {character.level}-й уровень
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={expanded}
            icon={expanded ? "minus" : "chevron-down"}
            iconOnly
            aria-label={expanded ? "Свернуть сведения о герое" : "Развернуть сведения о герое"}
            aria-controls="hero-identity-details"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Свернуть" : "О герое"}
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
                    {character.ancestry}
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
                      {character.className}
                    </a>
                  </>
                )}
                {character.subclass && <span>· {character.subclass}</span>}
                {character.career && (
                  <>
                    <span aria-hidden="true">/</span>
                    <a href={codexLink(character.career)}>{character.career}</a>
                  </>
                )}
                <HeaderDomainChoices key={character.id} />
              </div>
              {titles.length > 0 && (
                <ul className="sheet-identity-titles" aria-label="Титулы">
                  {titles.map((title) => (
                    <li key={title.id}>{title.name || "Без названия"}</li>
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
