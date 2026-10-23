import type { Tab } from "../navigation";
import type { SaveStatus } from "../state/AppContext";
import type { Character, CharacterSummary } from "../types";
import { CharacterMenu } from "./CharacterMenu";
import { SaveIndicator } from "./SaveIndicator";
import { RailNav } from "./Sidebar";
import { Button } from "./ui";

export function Topbar({
  tab,
  character,
  characters,
  saveStatus,
  saveError,
  onSelectCharacter,
  onNewCharacter,
  onNavigate,
}: {
  tab: Tab;
  character: Character;
  characters: CharacterSummary[];
  saveStatus: SaveStatus;
  saveError: string;
  onSelectCharacter: (id: string) => void;
  onNewCharacter: () => void;
  onNavigate: (tab: Tab) => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <RailNav tab={tab} onNavigate={onNavigate} />
        <span className="topbar-divider" aria-hidden="true" />
        <CharacterMenu
          saveIndicator={
            <SaveIndicator status={saveStatus} error={saveError} />
          }
          character={character}
          characters={characters}
          onSelect={onSelectCharacter}
          onNew={onNewCharacter}
          onManage={() => onNavigate("settings")}
        />
      </div>

      <div className="topbar-right">
        <Button
          icon="plus"
          variant="soft"
          size="sm"
          aria-label="Новый герой"
          onClick={onNewCharacter}
        >
          <span className="hide-sm">Новый герой</span>
        </Button>
        <Button
          icon="settings"
          iconOnly
          variant={tab === "settings" ? "soft" : "ghost"}
          size="sm"
          aria-label="Настройки"
          aria-current={tab === "settings" ? "page" : undefined}
          title="Настройки"
          onClick={() => onNavigate("settings")}
        />
      </div>
    </header>
  );
}

export function BootError({ message }: { message: string }) {
  return (
    <div className="boot-error">
      <h1>Не удалось подключиться к листу</h1>
      <p className="muted">
        Не удалось загрузить героев. Проверьте подключение и попробуйте ещё раз.
      </p>
      <Button onClick={() => window.location.reload()} variant="primary">
        Попробовать снова
      </Button>
      <p className="mono small" style={{ marginTop: 14 }}>
        {message}
      </p>
    </div>
  );
}

export function LoadingScreen({
  label = "Загрузка героя",
}: {
  label?: string;
}) {
  return (
    <div className="loading-screen" role="status">
      {label}
    </div>
  );
}
