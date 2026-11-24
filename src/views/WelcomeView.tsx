import { useLocale } from "../i18n/locale";
import { useRef, type ChangeEvent } from "react";
import { Button } from "../components/ui";
import { Icon } from "../components/Icons";
import { DrawSteelLogo } from "../components/DrawSteelLogo";
import { SiteLogo } from "../components/SiteLogo";
import "./WelcomeView.css";

export interface WelcomeViewProps {
  onCreate: () => void;
  onImport: (file: File) => Promise<void>;
  onOpenCodex: () => void;
  busy?: boolean;
}

const welcomeSteps = (t: (ru: string, en: string) => string) => [
  {
    icon: "plus" as const,
    title: t("Создайте героя", "Create your hero"),
    description: t("Соберите героя по шагам или начните с пустого листа.", "Build a hero step by step or start with a blank sheet."),
  },
  {
    icon: "sheet" as const,
    title: t("Играйте с листом", "Play from your sheet"),
    description: t("Отмечайте ресурсы, способности, снаряжение и записи журнала.", "Track resources, abilities, equipment, and journal entries."),
  },
  {
    icon: "book" as const,
    title: t("Держите правила под рукой", "Keep the rules handy"),
    description: t("Открывайте Кодекс, когда понадобится уточнить правило.", "Look up a rule in the Codex during play."),
  },
];

export function WelcomeView({
  onCreate,
  onImport,
  onOpenCodex,
  busy = false,
}: WelcomeViewProps) {
  const { t } = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) void onImport(file);
    // Allow choosing the same file again after an import error.
    event.currentTarget.value = "";
  };

  return (
    <section className="welcome-view" aria-labelledby="welcome-title">
      <div className="welcome-frame">
        <div className="welcome-hero">
          <SiteLogo variant="wordmark" className="site-logo--welcome" />
          <p className="welcome-kicker">{t("ВАШЕ ПРИКЛЮЧЕНИЕ В DRAW STEEL", "YOUR DRAW STEEL ADVENTURE")}</p>
          <h1 id="welcome-title">{t("Время создать героя", "Time to create a hero")}</h1>
          <p className="welcome-lead">
            {t("Соберите лист для игры, вернитесь к нему в любой момент и держите нужные правила рядом.", "Build your character sheet, return to it between sessions, and keep the rules you need close at hand.")}
          </p>

          <div className="welcome-actions">
            <Button
              variant="primary"
              size="lg"
              icon="plus"
              disabled={busy}
              onClick={onCreate}
            >
              {t("Создать героя", "Create a hero")}
            </Button>
            <Button
              size="lg"
              icon="upload"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {t("Импортировать JSON", "Import JSON")}
            </Button>
            <input
              ref={fileInputRef}
              className="welcome-file-input"
              type="file"
              accept=".json,application/json"
              aria-label={t("Выберите файл героя в формате JSON", "Choose a character JSON file")}
              disabled={busy}
              onChange={handleFile}
            />
          </div>
          <p className="welcome-save-note">
            <Icon name="cloud" size={15} />
            {t("Изменения сохраняются автоматически. Статус сохранения виден рядом с именем героя.", "Changes are saved automatically. Check the save status beside your hero’s name.")}
          </p>
        </div>

        <div className="welcome-lower">
          <section
            className="welcome-steps"
            aria-labelledby="welcome-steps-title"
          >
            <h2 id="welcome-steps-title">
              {t("Всё нужное для игры — в одном месте", "Everything you need to play")}
            </h2>
            <ol>
              {welcomeSteps(t).map((step, index) => (
                <li key={step.icon}>
                  <span className="welcome-step-icon" aria-hidden="true">
                    <Icon name={step.icon} size={17} />
                  </span>
                  <span className="welcome-step-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <aside className="welcome-codex">
            <span className="welcome-codex-icon" aria-hidden="true">
              <Icon name="book" size={19} />
            </span>
            <div>
              <h2>{t("Правила всегда рядом", "Rules at the table")}</h2>
              <p>{t("Ищите термины и разделы в Кодексе, не покидая лист.", "Look up terms and rulebook sections in the Codex.")}</p>
              <Button
                variant="ghost"
                size="sm"
                icon="chevron-right"
                disabled={busy}
                onClick={onOpenCodex}
              >
                {t("Открыть Кодекс", "Open the Codex")}
              </Button>
            </div>
          </aside>
        </div>
        <aside className="welcome-brand-credit" aria-label={t("О совместимости", "Compatibility")}>
          <DrawSteelLogo className="draw-steel-logo--credit" />
          <p>
            {t("Неофициальный инструмент для листов персонажей Draw Steel. Не связан с MCDM Productions и не одобрен компанией.", "An unofficial character sheet for Draw Steel. Unaffiliated with and unendorsed by MCDM Productions.")}
          </p>
        </aside>
      </div>
    </section>
  );
}
