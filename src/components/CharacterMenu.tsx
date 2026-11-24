import { classPreset } from "../data/classes";
import { useLocale } from "../i18n/locale";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useOutsideClick } from "../lib/hooks";
import { useMenuKeyboard } from "../lib/useMenuKeyboard";
import type { Character, CharacterSummary } from "../types";
import { CharacterAvatar } from "./CharacterAvatar";
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
  const { t } = useLocale();
  const classLabel = (name: string) => t(name, classPreset(name)?.originalName || name);
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
        aria-label={t(`Герой: ${character.name || "Без имени"}. Сменить героя`, `Hero: ${character.name || "Unnamed hero"}. Switch hero`)}
        aria-controls={open ? menuId : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <CharacterAvatar name={character.name} url={character.avatar?.url} />
        <span className="char-switch-text">
          <span className="char-switch-name-row">
            <span className="char-switch-name">
              {character.name || t("Без имени", "Unnamed hero")}
            </span>
          </span>
          <span className="char-switch-meta">
            {[
              classLabel(character.className),
              character.level ? t(`${character.level} ур.`, `Level ${character.level}`) : "",
            ]
              .filter(Boolean)
              .join(" · ") || t("Герой без класса", "Hero without a class")}
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
          aria-label={t("Мои герои", "My heroes")}
          ref={menuRef}
          onKeyDown={onMenuKeyDown}
        >
          <div className="menu-label" aria-hidden="true">{t("Мои герои", "My heroes")} · {characters.length}</div>
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
                <CharacterAvatar name={item.name} url={item.avatarUrl} className="small" />
                <span className="char-list-text">
                  <span className="char-list-name">{item.name}</span>
                  <span className="char-list-meta">
                    {[classLabel(item.className), item.level ? t(`${item.level} ур.`, `Level ${item.level}`) : ""]
                      .filter(Boolean)
                      .join(" · ") || t("Без класса", "No class")}
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
            <span>{t("Новый герой", "New hero")}</span>
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
            <span>{t("Все персонажи", "All characters")}</span>
          </button>
        </div>
      )}
    </div>
  );
}
