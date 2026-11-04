import { artFor, type ArtKind } from "../../lib/art";
import { ArtworkFigure } from "../Artwork";
import { RuleText } from "../RuleText";
import "./BuilderSelection.css";

export interface BuilderSelectionOption {
  name: string;
  /** Вариант виден в списке, но выбрать его нельзя. */
  disabled?: boolean;
  /** Короткая пометка рядом с названием, например причина блокировки. */
  note?: string;
}

export interface BuilderSelectionDetail {
  name: string;
  description?: string;
  /** Статья Кодекса с полным текстом варианта. */
  articleId?: string;
}

export interface BuilderSelectionProps {
  /** Заголовок группы для списка и подпись над названием в описании. */
  label: string;
  kind: ArtKind;
  options: readonly BuilderSelectionOption[];
  selected: BuilderSelectionDetail | null;
  onSelect: (name: string) => void;
  codexLabel?: string;
}

/**
 * Экран выбора варианта: компактный список слева, а справа — картинка,
 * заголовок, описание и ссылка на Кодекс выбранного варианта.
 */
export function BuilderSelection({
  label,
  kind,
  options,
  selected,
  onSelect,
  codexLabel = "Открыть в Кодексе",
}: BuilderSelectionProps) {
  const art = selected ? artFor(kind, selected.name) : undefined;

  return (
    <div className="builder-selection">
      <div className="builder-selection__list" role="group" aria-label={label}>
        {options.map((option) => {
          const isSelected = selected?.name === option.name;
          return (
            <button
              key={option.name}
              type="button"
              className={`builder-selection__option${isSelected ? " is-selected" : ""}`}
              aria-pressed={isSelected}
              disabled={option.disabled}
              onClick={() => {
                if (!isSelected) onSelect(option.name);
              }}
            >
              <span className="builder-selection__option-name">{option.name}</span>
              {option.note ? (
                <span className="builder-selection__option-note">{option.note}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <aside className="builder-selection__detail" aria-live="polite">
        {selected ? (
          <>
            {art ? (
              <ArtworkFigure
                art={art}
                className="builder-selection__figure"
                overlayCaption
              />
            ) : null}
            <div className="builder-selection__detail-body">
              <span className="eyebrow">{label}</span>
              <h3 className="builder-selection__title">{selected.name}</h3>
              {selected.description ? (
                <div className="builder-selection__copy">
                  <RuleText text={selected.description} />
                </div>
              ) : null}
              {selected.articleId ? (
                <a
                  className="builder-selection__codex"
                  href={`#/codex/${selected.articleId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {codexLabel} ↗
                </a>
              ) : null}
            </div>
          </>
        ) : (
          <div className="builder-selection__empty">
            <span className="eyebrow">{label}</span>
            <p>Выберите вариант из списка — здесь появится описание.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
