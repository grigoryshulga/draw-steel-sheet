import { useLibraryLocation } from "../lib/library-location";
import { isDirectorSection } from "../navigation";
import { useRef, useState } from "react";
import { CharacterMenu } from "./CharacterMenu";
import { Icon } from "./Icons";
import { SaveIndicator } from "./SaveIndicator";
import { SiteLogo } from "./SiteLogo";
import { Button } from "./ui";
import type { SaveStatus } from "../state/AppContext";
import type { Character, CharacterSummary } from "../types";
import { isHeroTab, isLibraryTab, type Tab, type HeroTab } from "../navigation";
import { useAccount } from "../state/StorageScope";

import "./FloatingHeader.css";

const LIBRARY_OPTIONS = [
  { id: "codex", label: "Книга", icon: "book" },
  { id: "reference", label: "Справочник", icon: "library" },
  { id: "director", label: "Ведущему", icon: "book" },
] as const;


/**
 * Плавающая панель-таблетка по центру сверху: герой и его переключатель,
 * две основные вкладки и иконка сайта. Инвентарь, журнал и спутники живут
 * во вкладках листа.
 */
export function FloatingHeader({
  tab,
  heroTab = "sheet",
  busy = false,
  character,
  characters,
  saveStatus,
  saveError,
  onSelectCharacter,
  onNewCharacter,
  onNavigate,
}: {
  tab: Tab;
  heroTab?: HeroTab;
  busy?: boolean;
  character: Character | null;
  characters: CharacterSummary[];
  saveStatus: SaveStatus;
  saveError: string;
  onSelectCharacter: (id: string) => void;
  onNewCharacter: () => void;
  onNavigate: (tab: Tab) => void;
}) {
  const heroActive = isHeroTab(tab);
  const codexActive = isLibraryTab(tab);
  const account = useAccount();
  const location = useLibraryLocation();
  const librarySection = tab === "codex" ? "codex" : isDirectorSection(location[2] ?? "") ? "director" : "reference";
  const libraryTrigger = useRef<HTMLButtonElement>(null);
  const libraryMenu = useRef<HTMLDivElement>(null);
  const skipNextFocus = useRef(false);
  const [libraryMenuOpen, setLibraryMenuOpen] = useState(false);

  const closeLibraryMenu = (returnFocus = false) => {
    if (returnFocus) {
      skipNextFocus.current = true;
      libraryTrigger.current?.focus();
    }
    setLibraryMenuOpen(false);
    window.requestAnimationFrame(() => {
      skipNextFocus.current = false;
    });
  };
  const selectLibrarySection = (next: "codex" | "reference" | "director") => {
    closeLibraryMenu(true);
    if (next === "director") window.location.hash = "#/catalog/monsters";
    else onNavigate(next);
  };

  return (
    <header className="floating-header">
      <div className="floating-header-inner">
        <div className="floating-header-left">
          <button
            type="button"
            className="floating-header-logo"
            aria-label="Достать листы! На главную"
            title="На главную"
            onClick={() => onNavigate("sheet")}
          >
            <SiteLogo variant="mark" />
          </button>
        </div>

        <nav className="floating-header-nav" aria-label="Основные разделы">
          <button
            type="button"
            className={heroActive ? "is-active" : ""}
            aria-current={heroActive ? "page" : undefined}
            onClick={() => onNavigate(heroTab)}
          >
            <Icon name="hero" size={15} aria-hidden="true" />
            Герой
          </button>
          <div
            className="floating-header-library"
            onMouseEnter={() => setLibraryMenuOpen(true)}
            onMouseLeave={() => {
              const wrapper = libraryMenu.current?.parentElement;
              if (!wrapper?.contains(document.activeElement))
                setLibraryMenuOpen(false);
            }}
            onFocusCapture={() => {
              if (!skipNextFocus.current) setLibraryMenuOpen(true);
            }}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                setLibraryMenuOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && libraryMenuOpen) {
                event.preventDefault();
                closeLibraryMenu(true);
              }
            }}
          >
            <button
              ref={libraryTrigger}
              type="button"
              className={`floating-header-library-trigger${codexActive ? " is-active" : ""}`}
              aria-current={codexActive ? "page" : undefined}
              aria-haspopup="listbox"
              aria-expanded={libraryMenuOpen}
              aria-controls="floating-library-menu"
              onClick={() => setLibraryMenuOpen(true)}
            >
              <Icon name="book" size={15} aria-hidden="true" />
              Кодекс
              <Icon
                name="chevron-down"
                size={12}
                aria-hidden="true"
                className="floating-header-library-chevron"
              />
            </button>
            <div
              ref={libraryMenu}
              className={`floating-header-library-menu${libraryMenuOpen ? " is-open" : ""}`}
            >
              <ul id="floating-library-menu" role="listbox" aria-label="Разделы Кодекса">
                {LIBRARY_OPTIONS.map((option) => {
                  const selected = librarySection === option.id;
                  return (
                    <li key={option.id} role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`library-option${selected ? " is-selected" : ""}`}
                        onClick={() => selectLibrarySection(option.id)}
                      >
                        <Icon name={option.icon} size={16} aria-hidden="true" />
                        <span>{option.label}</span>
                        {selected && (
                          <Icon
                            name="check"
                            size={14}
                            aria-hidden="true"
                            className="library-option-check"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </nav>

        <div className="floating-header-right">
          {character ? (
            <CharacterMenu
              disabled={busy}
              character={character}
              characters={characters}
              onSelect={onSelectCharacter}
              onNew={onNewCharacter}
              onManage={() => onNavigate("settings")}
              saveIndicator={
                <SaveIndicator status={saveStatus} error={saveError} />
              }
            />
          ) : (
            <Button
              size="sm"
              variant="soft"
              icon="plus"
              disabled={busy}
              onClick={onNewCharacter}
            >
              Новый герой
            </Button>
          )}
          {character ? (
            <Button
              icon="settings"
              iconOnly
              size="sm"
              variant={tab === "settings" ? "soft" : "ghost"}
              aria-label="Настройки"
              title="Настройки"
              aria-current={tab === "settings" ? "page" : undefined}
              onClick={() => onNavigate("settings")}
            />
          ) : account ? (
            <Button
              icon="logout"
              iconOnly
              size="sm"
              variant="ghost"
              aria-label="Выйти"
              title={`Выйти (${account.email})`}
              disabled={account.signingOut}
              onClick={account.signOut}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
