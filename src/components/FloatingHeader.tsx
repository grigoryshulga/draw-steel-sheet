import { CharacterMenu } from "./CharacterMenu";
import { SaveIndicator } from "./SaveIndicator";
import { SiteLogo } from "./SiteLogo";
import { Button } from "./ui";
import type { SaveStatus } from "../state/AppContext";
import type { Character, CharacterSummary } from "../types";
import { isHeroTab, isLibraryTab, type Tab, type HeroTab, type LibraryTab } from "../navigation";
import { useAccount } from "../state/StorageScope";

import "./FloatingHeader.css";


/**
 * Плавающая панель-таблетка по центру сверху: герой и его переключатель,
 * две основные вкладки и иконка сайта. Инвентарь, журнал и спутники живут
 * во вкладках листа.
 */
export function FloatingHeader({
  tab,
  heroTab = "sheet",
  libraryTab = "codex",
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
  libraryTab?: LibraryTab;
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
            Герой
          </button>
          <button
            type="button"
            className={codexActive ? "is-active" : ""}
            aria-current={codexActive ? "page" : undefined}
            onClick={() => onNavigate(libraryTab)}
          >
            Кодекс
          </button>
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
