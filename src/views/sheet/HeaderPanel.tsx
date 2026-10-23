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
      <svg
        className="sheet-crest"
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="60"
          cy="60"
          r="45"
          stroke="currentColor"
          strokeWidth=".75"
        />
        <path
          d="M60 5 65 15 60 25 55 15ZM60 95 65 105 60 115 55 105ZM5 60 15 55 25 60 15 65ZM95 60 105 55 115 60 105 65Z"
          stroke="currentColor"
          strokeWidth=".75"
        />
        <path
          d="M28 28 36 36M84 84 92 92M28 92 36 84M84 36 92 28"
          stroke="currentColor"
        />
        <path
          d="M60 30 65 41 62 72H58L55 41ZM46 73Q60 67 74 73M60 73V88M56 88H64"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M38 44Q30 60 42 78M82 44Q90 60 78 78"
          stroke="currentColor"
          strokeWidth=".75"
        />
      </svg>
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
