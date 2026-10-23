import { useRef, useState } from "react";
import { useOutsideClick } from "../lib/hooks";
import { initials } from "../lib/utils";
import type { Character, CharacterSummary } from "../types";
import { Icon } from "./Icons";

export function CharacterMenu({
  character,
  characters,
  onSelect,
  onNew,
  onManage,
}: {
  character: Character;
  characters: CharacterSummary[];
  onSelect: (id: string) => void;
  onNew: () => void;
  onManage: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false), open);

  return (
    <div className="char-switch" ref={ref}>
      <button
        type="button"
        className="char-switch-btn"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="char-avatar">{initials(character.name)}</span>
        <span className="char-switch-text">
          <span className="char-switch-name">{character.name || "Без имени"}</span>
          <span className="char-switch-meta">
            {[character.className, character.level ? `${character.level} ур.` : ""]
              .filter(Boolean)
              .join(" · ") || "Герой без класса"}
          </span>
        </span>
        <Icon name="chevron-down" size={15} className="chevron" />
      </button>

      {open && (
        <div className="popover char-popover" role="menu">
          <div className="menu-label">Мои герои</div>
          <div className="char-list">
            {characters.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`menu-item char-list-item ${item.id === character.id ? "is-active" : ""}`.trim()}
                onClick={() => {
                  setOpen(false);
                  onSelect(item.id);
                }}
                role="menuitem"
              >
                <span className="char-avatar small">{initials(item.name)}</span>
                <span className="char-list-text">
                  <span className="char-list-name">{item.name}</span>
                  <span className="char-list-meta">
                    {[item.className, item.level ? `${item.level} ур.` : ""]
                      .filter(Boolean)
                      .join(" · ") || "Без класса"}
                  </span>
                </span>
                {item.id === character.id && <Icon name="check" size={15} />}
              </button>
            ))}
          </div>

          <div className="menu-sep" />
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setOpen(false);
              onNew();
            }}
          >
            <Icon name="plus" size={16} className="menu-icon" />
            <span>Новый герой</span>
          </button>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setOpen(false);
              onManage();
            }}
          >
            <Icon name="users" size={16} className="menu-icon" />
            <span>Все персонажи</span>
          </button>
        </div>
      )}
    </div>
  );
}
