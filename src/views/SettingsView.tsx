import { useRef, useState } from "react";
import { Icon } from "../components/Icons";
import { Button, EmptyState, Modal, Panel, Toggle } from "../components/ui";
import { useApp } from "../state/AppContext";
import type { ThemeChoice } from "../lib/theme";
import { initials } from "../lib/utils";
import type { CharacterSummary, OmarchyTheme } from "../types";
import "./SettingsView.css";
import { ART_ASSETS } from "../lib/art";

export function SettingsView({
  characters,
  currentId,
  themes,
  currentTheme,
  themeChoice,
  onThemeChoice,
  onSelect,
  onNew,
  onDelete,
  onDuplicate,
  onExport,
  onImport,
}: {
  characters: CharacterSummary[];
  currentId: string;
  themes: OmarchyTheme[];
  currentTheme: string;
  themeChoice: ThemeChoice;
  onThemeChoice: (choice: ThemeChoice) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
  onExport: (id: string) => Promise<void>;
  onImport: (file: File) => Promise<void>;
}) {
  const { character, notify } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<CharacterSummary | null>(
    null,
  );
  const [busyId, setBusyId] = useState("");

  const activeTheme =
    themeChoice.mode === "manual" ? themeChoice.name : currentTheme;

  const dateFormat = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="settings-view">
      <header className="page-head">
        <h1 className="page-title">
          <Icon name="settings" size={26} />
          Настройки
        </h1>
      </header>

      <Panel title="Тема Omarchy" icon="palette">
        <div className="theme-auto-row">
          <strong>Следовать за Omarchy</strong>
          <Toggle
            checked={themeChoice.mode === "auto"}
            onChange={(checked) =>
              onThemeChoice(
                checked
                  ? { mode: "auto" }
                  : {
                      mode: "manual",
                      name: currentTheme || themes[0]?.name || "",
                    },
              )
            }
            label="Следовать за темой Omarchy"
          />
        </div>

        <div className="theme-grid">
          {themes.map((theme) => {
            const active = activeTheme === theme.name;
            return (
              <button
                key={theme.name}
                type="button"
                className={`theme-card ${active ? "is-active" : ""}`.trim()}
                onClick={() =>
                  onThemeChoice({ mode: "manual", name: theme.name })
                }
                aria-pressed={active}
              >
                <span
                  className="theme-card-preview"
                  style={{ background: theme.colors.background }}
                >
                  <span
                    className="theme-card-panel"
                    style={{ background: theme.colors.lighter_background }}
                  />
                  <span className="theme-dots">
                    {["accent", "red", "green", "blue", "magenta"].map(
                      (key) => (
                        <i
                          key={key}
                          style={{ background: theme.colors[key] }}
                        />
                      ),
                    )}
                  </span>
                </span>
                <span className="theme-card-name">{theme.name}</span>
                <span className="theme-card-meta">
                  {theme.mode === "light" ? "светлая" : "тёмная"}
                  {theme.name === currentTheme ? " · сейчас" : ""}
                </span>
                {active && (
                  <Icon name="check" size={15} className="theme-card-check" />
                )}
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel
        title="Мои персонажи"
        icon="users"
        actions={
          <Button icon="plus" size="sm" variant="soft" onClick={onNew}>
            Новый герой
          </Button>
        }
      >
        {characters.length === 0 ? (
          <EmptyState
            icon="users"
            title="Пока ни одного героя"
            action={
              <Button icon="plus" variant="primary" onClick={onNew}>
                Создать героя
              </Button>
            }
          />
        ) : (
          <ul className="character-list">
            {characters.map((item) => (
              <li
                key={item.id}
                className={`character-row ${item.id === currentId ? "is-current" : ""}`.trim()}
              >
                <span className="char-avatar">{initials(item.name)}</span>
                <div className="character-row-text">
                  <button
                    type="button"
                    className="character-row-name"
                    onClick={() => onSelect(item.id)}
                  >
                    {item.name}
                  </button>
                  <span className="character-row-meta">
                    {[item.ancestry, item.className, `${item.level} ур.`]
                      .filter(Boolean)
                      .join(" · ")}
                    {item.updatedAt &&
                      ` · изменён ${dateFormat.format(new Date(item.updatedAt))}`}
                  </span>
                </div>
                <div className="character-row-actions">
                  <Button
                    size="sm"
                    variant={item.id === currentId ? "soft" : "ghost"}
                    onClick={() => onSelect(item.id)}
                  >
                    {item.id === currentId ? "Открыт" : "Открыть"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="copy"
                    iconOnly
                    title="Дублировать"
                    aria-label={`Дублировать ${item.name}`}
                    disabled={busyId === item.id}
                    onClick={async () => {
                      setBusyId(item.id);
                      try {
                        await onDuplicate(item.id);
                      } finally {
                        setBusyId("");
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="download"
                    iconOnly
                    title="Экспорт JSON"
                    aria-label={`Экспортировать ${item.name}`}
                    onClick={() => void onExport(item.id)}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="trash"
                    iconOnly
                    title="Удалить"
                    aria-label={`Удалить ${item.name}`}
                    disabled={busyId === item.id}
                    onClick={() => setDeleteTarget(item)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Данные" icon="cloud">
        <div className="data-actions">
          <strong>Резервная копия</strong>
          <div className="hstack wrap">
            <Button icon="download" onClick={() => void onExport(character.id)}>
              Экспорт текущего
            </Button>
            <Button icon="upload" onClick={() => fileRef.current?.click()}>
              Импорт JSON
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onImport(file);
                event.target.value = "";
              }}
            />
          </div>
        </div>
      </Panel>

      <Panel title="О листе" icon="book">
        <div className="about-grid">
          <div>
            <span className="eyebrow">Правила</span>
            <p>
              Переведённые правила Draw Steel из репозитория{" "}
              <a
                href="https://github.com/grigoryshulga/drawsteel-ru"
                target="_blank"
                rel="noreferrer"
              >
                drawsteel-ru
              </a>
              .
            </p>
          </div>
          <div>
            <span className="eyebrow">Лист</span>
            <p>
              Вдохновлён официальным листом MCDM и проектом Forge Steel.
              Независимый фан-проект, не связанный с MCDM Productions, LLC.
            </p>
          </div>
          <div>
            <span className="eyebrow">Иллюстрации</span>
            <p>
              Официальная основа: © MCDM Productions, LLC, из{" "}
              <a
                href="https://www.mcdmproductions.com/press"
                target="_blank"
                rel="noreferrer"
              >
                пресс-материалов MCDM
              </a>{" "}
              и{" "}
              <a
                href="https://shop.mcdmproductions.com/products/draw-steel-heroes-pdf"
                target="_blank"
                rel="noreferrer"
              >
                превью книги
              </a>
              . Иллюстрации адаптированы с AI. Дополнительные арты созданы для
              листа с AI. Источник каждой иллюстрации указан в Кодексе.
            </p>
            <details className="art-credits">
              <summary>Источники иллюстраций ({ART_ASSETS.length})</summary>
              <ul>
                {ART_ASSETS.map((art) => (
                  <li key={`${art.kind}:${art.name}`}>
                    {art.name} —{" "}
                    {art.sourceUrl ? (
                      <a href={art.sourceUrl} target="_blank" rel="noreferrer">
                        {art.credit}
                      </a>
                    ) : (
                      art.credit
                    )}
                  </li>
                ))}
              </ul>
            </details>
          </div>
          <div>
            <span className="eyebrow">Версия</span>
            <p className="mono">
              1.0.0 · Draw Steel™ &amp; © 2025 MCDM Productions LLC
            </p>
          </div>
        </div>
      </Panel>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Удалить персонажа?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => void confirmDelete()}
            >
              Удалить навсегда
            </Button>
          </>
        }
      >
        <p>
          Персонаж <strong>{deleteTarget?.name}</strong> будет удалён с сервера.
          Сначала можно сделать экспорт JSON — отменить удаление нельзя.
        </p>
        {deleteTarget && (
          <Button
            variant="soft"
            icon="download"
            onClick={async () => {
              await onExport(deleteTarget.id);
              notify("Резервная копия сохранена", "success");
            }}
          >
            Сначала экспортировать
          </Button>
        )}
      </Modal>
    </div>
  );
}
