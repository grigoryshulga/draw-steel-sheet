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

const STEPS = [
  {
    icon: "plus" as const,
    title: "Создайте героя",
    description: "Соберите героя по шагам или начните с пустого листа.",
  },
  {
    icon: "sheet" as const,
    title: "Играйте с листом",
    description: "Отмечайте ресурсы, способности, снаряжение и записи журнала.",
  },
  {
    icon: "book" as const,
    title: "Держите правила под рукой",
    description: "Открывайте Кодекс, когда понадобится уточнить правило.",
  },
];

export function WelcomeView({
  onCreate,
  onImport,
  onOpenCodex,
  busy = false,
}: WelcomeViewProps) {
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
          <p className="welcome-kicker">ВАШЕ ПРИКЛЮЧЕНИЕ В DRAW STEEL</p>
          <h1 id="welcome-title">Время создать героя</h1>
          <p className="welcome-lead">
            Соберите лист для игры, вернитесь к нему в любой момент и держите
            нужные правила рядом.
          </p>

          <div className="welcome-actions">
            <Button
              variant="primary"
              size="lg"
              icon="plus"
              disabled={busy}
              onClick={onCreate}
            >
              Создать героя
            </Button>
            <Button
              size="lg"
              icon="upload"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              Импортировать JSON
            </Button>
            <input
              ref={fileInputRef}
              className="welcome-file-input"
              type="file"
              accept=".json,application/json"
              aria-label="Выберите файл героя в формате JSON"
              disabled={busy}
              onChange={handleFile}
            />
          </div>
          <p className="welcome-save-note">
            <Icon name="cloud" size={15} />
            Изменения сохраняются автоматически. Статус сохранения виден рядом с
            именем героя.
          </p>
        </div>

        <div className="welcome-lower">
          <section
            className="welcome-steps"
            aria-labelledby="welcome-steps-title"
          >
            <h2 id="welcome-steps-title">
              Всё нужное для игры — в одном месте
            </h2>
            <ol>
              {STEPS.map((step, index) => (
                <li key={step.title}>
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
              <h2>Правила всегда рядом</h2>
              <p>Ищите термины и разделы в Кодексе, не покидая лист.</p>
              <Button
                variant="ghost"
                size="sm"
                icon="chevron-right"
                disabled={busy}
                onClick={onOpenCodex}
              >
                Открыть Кодекс
              </Button>
            </div>
          </aside>
        </div>
        <aside className="welcome-brand-credit" aria-label="О совместимости">
          <DrawSteelLogo className="draw-steel-logo--credit" />
          <p>
            Неофициальный инструмент для листов персонажей Draw Steel. Не
            связан с MCDM Productions и не одобрен компанией.
          </p>
        </aside>
      </div>
    </section>
  );
}
