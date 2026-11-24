import { useLocale } from "../i18n/locale";
import { useRef, useState } from "react";
import { CharacterAvatar } from "../components/CharacterAvatar";
import { Icon } from "../components/Icons";
import { Button, EmptyState, Modal, Panel } from "../components/ui";
import { useApp } from "../state/AppContext";
import { useAccount } from "../state/StorageScope";
import type { ThemeChoice } from "../lib/theme";
import type { AppTheme, CharacterSummary } from "../types";
import "./SettingsView.css";
import { useLocalizedData } from "../i18n/use-localized-data";
import { loadEnglishArticleTitles } from "../rules/repository";
import { readerLabel } from "../components/rules/reader-labels";
import { ART_ASSETS, artworkCredit } from "../lib/art";

const englishThemeNames: Record<string, string> = {
  "Стальная ночь": "Steel Night",
  "Тёплый костёр": "Warm Campfire",
  "Лиловые сумерки": "Lilac Twilight",
  "Светлый пергамент": "Light Parchment",
  "Синяя глубина": "Blue Depths",
  "Вечер с Котучино": "Catppuccin Evening",
  "Тёмная классика": "Dark Classic",
  "Светлая классика": "Light Classic",
  "Обитель некроманта": "Necromancer’s Lair",
  "Чёрный бархат": "Black Velvet",
  "Полярная ночь": "Polar Night",
  "Лунная роза": "Moon Rose",
  "Неоновый драйв": "Neon Drive",
  "Медный закат": "Copper Sunset",
  "Чистый лист": "Blank Page",
  "Утренний латте": "Morning Latte",
  "Хвойный лес": "Pine Forest"
};

export function SettingsView({
  characters,
  currentId,
  themes,
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
  themes: AppTheme[];
  themeChoice: ThemeChoice;
  onThemeChoice: (choice: ThemeChoice) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
  onExport: (id: string) => Promise<void>;
  onImport: (file: File) => Promise<void>;
}) {
  const { t, locale } = useLocale();
  const { character, notify } = useApp();
  const account = useAccount();
  const fileRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<CharacterSummary | null>(
    null,
  );
  const [busyId, setBusyId] = useState("");

  const titles = useLocalizedData(locale, loadEnglishArticleTitles);
  const activeTheme = themeChoice.name;

  const dateFormat = new Intl.DateTimeFormat(locale, {
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
    } catch {
      // The workspace reports the error; keep the confirmation open for retry.
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="settings-view">
      <header className="page-head">
        <h1 className="page-title">
          <Icon name="settings" size={26} />
          {t("Настройки", "Settings")}
        </h1>
      </header>

      <Panel
        title={t("Мои персонажи", "My characters")}
        icon="users"
        actions={
          <Button icon="plus" iconOnly size="sm" variant="soft" onClick={onNew}>
            {t("Новый герой", "New hero")}
          </Button>
        }
      >
        {characters.length === 0 ? (
          <EmptyState
            icon="users"
            title={t("Пока ни одного героя", "No heroes yet")}
            action={
              <Button icon="plus" variant="primary" onClick={onNew}>
                {t("Создать героя", "Create a hero")}
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
                <CharacterAvatar name={item.name} url={item.avatarUrl} />
                <div className="character-row-text">
                  <button
                    type="button"
                    className="character-row-name"
                    onClick={() => onSelect(item.id)}
                  >
                    {item.name}
                  </button>
                  <span className="character-row-meta">
                    {[item.ancestry, item.className, t(`${item.level} ур.`, `Level ${item.level}`)]
                      .filter(Boolean)
                      .join(" · ")}
                    {item.updatedAt &&
                      ` · ${t("изменён", "updated")} ${dateFormat.format(new Date(item.updatedAt))}`}
                  </span>
                </div>
                <div className="character-row-actions">
                  <Button
                    size="sm"
                    variant={item.id === currentId ? "soft" : "ghost"}
                    icon={item.id === currentId ? "check" : "sheet"}
                    iconOnly
                    aria-label={t(`Открыть лист: ${item.name}`, `Open sheet: ${item.name}`)}
                    aria-pressed={item.id === currentId}
                    onClick={() => onSelect(item.id)}
                  >
                    {item.id === currentId ? t("Открыт", "Open") : t("Открыть", "Open")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="copy"
                    iconOnly
                    title={t("Дублировать", "Duplicate")}
                    aria-label={t(`Дублировать ${item.name}`, `Duplicate ${item.name}`)}
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
                    title={t("Экспорт JSON", "Export JSON")}
                    aria-label={t(`Экспортировать ${item.name}`, `Export ${item.name}`)}
                    onClick={() => void onExport(item.id)}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="trash"
                    iconOnly
                    title={t("Удалить", "Delete")}
                    aria-label={t(`Удалить ${item.name}`, `Delete ${item.name}`)}
                    disabled={busyId === item.id}
                    onClick={() => setDeleteTarget(item)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {account && (
        <Panel title={t("Аккаунт", "Account")} icon="users">
          <div className="settings-account">
            <span className="muted">{account.email}</span>
            <Button
              icon="logout"
              iconOnly
              variant="ghost"
              disabled={account.signingOut}
              onClick={account.signOut}
            >
              {t("Выйти", "Sign out")}
            </Button>
          </div>
        </Panel>
      )}

      <Panel title={t("Данные", "Data")} icon="cloud">
        <div className="data-actions">
          <strong>{t("Резервная копия", "Backup")}</strong>
          <div className="hstack wrap">
            <Button icon="download" iconOnly aria-label={t("Скачать JSON текущего героя", "Download this hero as JSON")} onClick={() => void onExport(character.id)}>
              {t("Экспорт текущего", "Export current hero")}
            </Button>
            <Button icon="upload" iconOnly aria-label={t("Импортировать героя из JSON", "Import a hero from JSON")} onClick={() => fileRef.current?.click()}>
              {t("Импорт JSON", "Import JSON")}
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

      <section className="settings-theme-disclosure">
        <h3>
          <Icon name="palette" size={17} />
          <span>{t("Внешний вид", "Appearance")}</span>
          <span className="settings-theme-current">{t(activeTheme, englishThemeNames[activeTheme] || activeTheme)}</span>

        </h3>
        <div className="settings-theme-content">
          <p className="settings-theme-description">
            {t("Выберите цветовую схему. Все варианты подобраны с учётом контрастности текста.", "Choose a color scheme. Each theme is designed for legible text.")}
          </p>
          <div className="theme-grid">
            {themes.map((theme) => {
              const active = activeTheme === theme.name;
              return (
                <button
                  key={theme.name}
                  type="button"
                  className={`theme-card ${active ? "is-active" : ""}`.trim()}
                  onClick={() => onThemeChoice({ name: theme.name })}
                  aria-pressed={active}
                >
                  <span
                    className="theme-card-preview"
                    style={{ background: theme.colors.background }}
                  >
                    <span className="theme-card-panel" style={{ background: theme.colors.lighter_background }} />
                    <span className="theme-dots">
                      {["accent", "red", "green", "blue", "magenta"].map((key) => (
                        <i key={key} style={{ background: theme.colors[key] }} />
                      ))}
                    </span>
                  </span>
                  <span className="theme-card-name">{t(theme.name, englishThemeNames[theme.name] || theme.name)}</span>
                  <span className="theme-card-meta">{theme.mode === "light" ? t("светлая", "light") : t("тёмная", "dark")}</span>
                  {active && <Icon name="check" size={15} className="theme-card-check" />}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <Panel title={t("О листе", "About the sheet")} icon="book">
        <div className="about-grid">
          <div>
            <span className="eyebrow">{t("Правила", "Rules")}</span>
            <p>
              {t("Переведённые правила Draw Steel из репозитория", "Russian Draw Steel rules from")}{" "}
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
            <span className="eyebrow">{t("Лист", "Sheet")}</span>
            <p>
              {t("Вдохновлён официальным листом MCDM и проектом Forge Steel. Независимый фан-проект, не связанный с MCDM Productions, LLC.", "Inspired by the official MCDM character sheet and Forge Steel. An independent fan project unaffiliated with MCDM Productions, LLC.")}
            </p>
          </div>
          <div>
            <span className="eyebrow">{t("Иллюстрации", "Artwork")}</span>
            <p>
              {t("Официальная основа: © MCDM Productions, LLC, из", "Original artwork © MCDM Productions, LLC, from")}{" "}
              <a
                href="https://www.mcdmproductions.com/press"
                target="_blank"
                rel="noreferrer"
              >
                {t("пресс-материалов MCDM", "the MCDM press kit")}
              </a>{" "}
              {t("и", "and")}{" "}
              <a
                href="https://shop.mcdmproductions.com/products/draw-steel-heroes-pdf"
                target="_blank"
                rel="noreferrer"
              >
                {t("превью книги", "the book preview")}
              </a>
              {t(". Иллюстрации адаптированы с AI. Дополнительные арты созданы для листа с AI. Источник каждой иллюстрации указан в Кодексе.", ". Artwork was adapted using AI. Additional artwork was created for the sheet using AI. The Codex credits each illustration.")}
            </p>
            <section className="art-credits">
              <h3>{t("Источники иллюстраций", "Artwork credits")} ({ART_ASSETS.length})</h3>
              <ul>
                {ART_ASSETS.map((art) => (
                  <li key={`${art.kind}:${art.name}`}>
                    {art.kind === "class" ? readerLabel(art.name, locale) : titles?.[art.articleIds[0]] || art.name} —{" "}
                    {art.sourceUrl ? (
                      <a href={art.sourceUrl} target="_blank" rel="noreferrer">
                        {artworkCredit(art, locale)}
                      </a>
                    ) : (
                      artworkCredit(art, locale)
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <div>
            <span className="eyebrow">{t("Версия", "Version")}</span>
            <p className="mono">
              1.0.0 · Draw Steel™ &amp; © 2025 MCDM Productions LLC
            </p>
          </div>
        </div>
      </Panel>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("Удалить персонажа?", "Delete character?")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              {t("Отмена", "Cancel")}
            </Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => void confirmDelete()}
            >
              {t("Удалить навсегда", "Delete permanently")}
            </Button>
          </>
        }
      >
        <p>
          <strong>{deleteTarget?.name}</strong> {t("будет удалён с сервера. Сначала можно сделать экспорт JSON — отменить удаление нельзя.", "will be deleted from the server. You can export a backup first. Deletion is permanent.")}
        </p>
        {deleteTarget && (
          <Button
            variant="soft"
            icon="download"
            onClick={async () => {
              await onExport(deleteTarget.id);
              notify(t("Резервная копия сохранена", "Backup saved"), "success");
            }}
          >
            {t("Сначала экспортировать", "Export first")}
          </Button>
        )}
      </Modal>
    </div>
  );
}
