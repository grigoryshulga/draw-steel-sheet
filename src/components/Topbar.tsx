import type { Tab } from "../navigation";
import type { SaveStatus } from "../state/AppContext";
import type { ThemeChoice } from "../lib/theme";
import type { AppTheme, Character, CharacterSummary } from "../types";
import { CharacterMenu } from "./CharacterMenu";
import { ThemeMenu } from "./ThemeMenu";
import { Button } from "./ui";

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: "Черновик",
  pending: "Есть изменения",
  saving: "Сохранение…",
  saved: "Сохранено",
  error: "Не сохранено",
};

export function Topbar({
  character,
  characters,
  saveStatus,
  saveError,
  themes,
  themeChoice,
  onThemeChoice,
  onSelectCharacter,
  onNewCharacter,
  onNavigate,
}: {
  character: Character;
  characters: CharacterSummary[];
  saveStatus: SaveStatus;
  saveError: string;
  themes: AppTheme[];
  themeChoice: ThemeChoice;
  onThemeChoice: (choice: ThemeChoice) => void;
  onSelectCharacter: (id: string) => void;
  onNewCharacter: () => void;
  onNavigate: (tab: Tab) => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <CharacterMenu
          character={character}
          characters={characters}
          onSelect={onSelectCharacter}
          onNew={onNewCharacter}
          onManage={() => onNavigate("settings")}
        />
        <div
          className={`save-state is-${saveStatus}`}
          title={saveStatus === "error" ? saveError : SAVE_LABEL[saveStatus]}
          role="status"
          aria-live="polite"
        >
          <span className="save-dot" />
          <span>{SAVE_LABEL[saveStatus]}</span>
        </div>
      </div>

      <div className="topbar-right">
        <ThemeMenu
          themes={themes}
          choice={themeChoice}
          onChoose={onThemeChoice}
        />
        <Button
          icon="plus"
          variant="soft"
          size="sm"
          aria-label="Новый герой"
          onClick={onNewCharacter}
        >
          <span className="hide-sm">Новый герой</span>
        </Button>
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
