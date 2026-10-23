import { Button } from "../../components/ui";
import { useApp } from "../../state/AppContext";
import { codexLink, CODEX_INDEX } from "../../lib/codex";

export function HeaderPanel() {
  const { character, goTo } = useApp();
  const classArticle = CODEX_INDEX.find(
    (a) => a.group === character.className && /1-й Уровень/.test(a.title),
  );
  return (
    <header className="sheet-header">
      <div className="sheet-identity-heading">
        <div>
          <span className="eyebrow">Герой · {character.level} уровень</span>
          <h1>{character.name}</h1>
          <div className="sheet-identity-summary">
            {character.ancestry && (
              <a href={codexLink(character.ancestry)}>{character.ancestry}</a>
            )}
            {character.className && (
              <>
                <span aria-hidden="true">/</span>
                <a
                  href={
                    classArticle ? `#/codex/${classArticle.id}` : "#/codex/0701"
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
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon="edit"
          onClick={() => goTo("hero")}
        >
          Редактировать героя
        </Button>
      </div>
    </header>
  );
}
