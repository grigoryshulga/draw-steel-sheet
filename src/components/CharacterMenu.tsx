import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useOutsideClick } from "../lib/hooks";
import { useMenuKeyboard } from "../lib/useMenuKeyboard";
import { initials } from "../lib/utils";
import type { Character, CharacterSummary } from "../types";
import { Icon } from "./Icons";

export function CharacterMenu({
  character,
  disabled = false,
  characters,
  onSelect,
  onNew,
  onManage,
  saveIndicator,
}: {
  character: Character;
  disabled?: boolean;
  characters: CharacterSummary[];
  onSelect: (id: string) => void;
  onNew: () => void;
  onManage: () => void;
  /** Статус сохранения — стоит прямо рядом с именем. */
  saveIndicator?: ReactNode;
}) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false), open);
  const onMenuKeyDown = useMenuKeyboard({ open, setOpen, menuRef, triggerRef });

  // A hero switch disables the trigger; an open menu must not stay interactive.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div className="char-switch" ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        className="char-switch-btn"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        aria-label={`Герой: ${character.name || "Без имени"}. Сменить героя`}
        aria-controls={open ? menuId : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="char-avatar" aria-hidden="true">{initials(character.name)}</span>
        <span className="char-switch-text">
          <span className="char-switch-name-row">
            <span className="char-switch-name">
              {character.name || "Без имени"}
            </span>
          </span>
          <span className="char-switch-meta">
            {[
              character.className,
              character.level ? `${character.level} ур.` : "",
            ]
              .filter(Boolean)
              .join(" · ") || "Герой без класса"}
          </span>
        </span>
        <Icon name="chevron-down" size={15} className="chevron" />
      </button>
      {saveIndicator}

      {open && (
        <div
          className="popover char-popover"
          id={menuId}
          role="menu"
          aria-label="Мои герои"
          ref={menuRef}
          onKeyDown={onMenuKeyDown}
        >
          <div className="menu-label" aria-hidden="true">Мои герои · {characters.length}</div>
          <div className="char-list">
            {characters.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`menu-item char-list-item ${item.id === character.id ? "is-active" : ""}`.trim()}
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                  onSelect(item.id);
                }}
                role="menuitem"
                aria-current={item.id === character.id ? "true" : undefined}
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
            role="menuitem"
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
            role="menuitem"
          >
            <Icon name="users" size={16} className="menu-icon" />
            <span>Все персонажи</span>
          </button>
        </div>
      )}
    </div>
  );
}
