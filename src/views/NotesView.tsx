import { useLocale } from "../i18n/locale";
import { useRef, useState } from "react";
import { Button, Panel } from "../components/ui";
import { MarkdownEditor } from "../components/MarkdownEditor";
import { Icon } from "../components/Icons";
import { NOTE_SECTIONS } from "../data/notes";
import { HeroProfileText } from "./hero/HeroProfileBlock";
import { ProjectsPanel } from "./sheet/ProjectsPanel";
import { useApp } from "../state/AppContext";
import type { NoteSectionKey } from "../types";
import "./NotesView.css";

/** Отдельная страница заметок героя по разделам. */
export function NotesView() {
  const { locale, t } = useLocale();
  const { character, update } = useApp();
  const [expanded, setExpanded] = useState<NoteSectionKey | null>(null);
  const [activeSection, setActiveSection] = useState<NoteSectionKey>("story");
  const [toolbarContainer, setToolbarContainer] = useState<HTMLDivElement | null>(null);
  const grid = useRef<HTMLDivElement>(null);

  const toggleExpanded = (key: NoteSectionKey) => {
    setActiveSection(key);
    setExpanded(current => current === key ? null : key);
    requestAnimationFrame(() => {
      const card = grid.current?.querySelector<HTMLElement>(`.note-section-${key}`);
      card?.scrollIntoView({ block: "start", behavior: "smooth" });
      card?.querySelector<HTMLButtonElement>(".note-expand-button")?.focus({ preventScroll: true });
    });
  };

  const setNote = (key: NoteSectionKey, text: string) => {
    update((current) => ({
      ...current,
      notes: { ...current.notes, [key]: text },
    }));
  };

  return (
    <div className="notes-view">
      <header className="page-head">
        <h1 className="page-title">
          <Icon name="book" size={24} />
          {t("Журнал", "Journal")}
        </h1>
        <p className="muted small">{t("Личные заметки и проекты", "Personal notes and projects")}</p>
      </header>

      <ProjectsPanel />

      <div className="notes-editor">
        <div ref={setToolbarContainer} className="notes-toolbar" />
        <div ref={grid} className={`notes-grid${expanded ? " is-expanded" : ""}`}>
          {NOTE_SECTIONS.map((section) => {
            const english: Record<NoteSectionKey, [string, string]> = {
              story: ["Story", "What is happening in the story, and what does your hero want?"],
              contacts: ["Contacts", "Who helps, who cannot be trusted, and who expects something?"],
              debts: ["Debts", "What has your hero promised, to whom, and what happens if they fail?"],
              secrets: ["Secrets", "What is your hero hiding, and what have they discovered?"],
              misc: ["Other notes", "Anything else worth remembering…"],
            };
            const label = locale === "en" ? english[section.key][0] : section.label;
            const isMisc = section.key === "misc";
            const isExpanded = expanded === section.key;
            return (
              <Panel
                key={section.key}
                title={label}
                dense
                className={`note-section-card note-section-${section.key}${isMisc ? " note-section-wide" : ""}${isExpanded ? " is-expanded" : ""}`}
                actions={<Button className="note-expand-button" size="sm" variant="ghost" icon={isExpanded ? "collapse" : "expand"} iconOnly
                  aria-expanded={isExpanded} aria-controls={`note-editor-${section.key}`}
                  aria-label={`${isExpanded ? t("Вернуть к разделам", "Return to sections") : t("Развернуть на весь контейнер", "Expand to full container")}: ${label}`}
                  title={isExpanded ? t("Вернуть к разделам журнала", "Return to journal sections") : t("Развернуть на весь контейнер", "Expand to full container")}
                  onClick={() => toggleExpanded(section.key)} />}
              >
                <div id={`note-editor-${section.key}`} className="note-section-editor">
                  <MarkdownEditor
                    value={character.notes[section.key]}
                    placeholder={locale === "en" ? english[section.key][1] : section.placeholder}
                    aria-label={`${t("Журнал", "Journal")}: ${label}`}
                    toolbarContainer={activeSection === section.key ? toolbarContainer : null}
                    onFocus={() => setActiveSection(section.key)}
                    onChange={(text) => setNote(section.key, text)}
                  />
                </div>
              </Panel>
            );
          })}
        </div>
      </div>

      <HeroBackground />
    </div>
  );
}

function HeroBackground() {
  const { t } = useLocale();
  const { character, update } = useApp();

  const patchCulture = (key: keyof typeof character.culture, value: string) => {
    update((current) => ({ ...current, culture: { ...current.culture, [key]: value } }));
  };

  const patchCareerInfo = (key: keyof typeof character.careerInfo, value: string) => {
    update((current) => ({ ...current, careerInfo: { ...current.careerInfo, [key]: value } }));
  };

  return (
    <Panel title={t("Предыстория", "Background")} icon="hero" dense bodyClassName="notes-background">
      <section className="notes-background-section">
        <h3>{t("Культура", "Culture")}</h3>
        <div className="notes-culture">
          <HeroProfileText title={t("Среда", "Environment")} value={character.culture.environment}
            placeholder={t("Напр.: город", "E.g. city")} onChange={(value) => patchCulture("environment", value)} />
          <HeroProfileText title={t("Организация", "Organization")} value={character.culture.organization}
            placeholder={t("Напр.: гильдия", "E.g. guild")} onChange={(value) => patchCulture("organization", value)} />
          <HeroProfileText title={t("Воспитание", "Upbringing")} value={character.culture.upbringing}
            placeholder={t("Напр.: море", "E.g. sea")} onChange={(value) => patchCulture("upbringing", value)} />
        </div>
      </section>
      <section className="notes-background-section">
        <h3>{t("Карьера", "Career")}</h3>
        <div className="notes-career">
          <HeroProfileText title={t("Преимущества", "Benefits")} value={character.careerInfo.benefits}
            placeholder={t("Что даёт карьера", "Career benefits")} onChange={(value) => patchCareerInfo("benefits", value)} multiline />
          <HeroProfileText title={t("Детали", "Details")} value={character.careerInfo.details}
            placeholder={t("Как герой жил до приключений", "Your hero’s life before adventuring")} onChange={(value) => patchCareerInfo("details", value)} multiline />
          <HeroProfileText title={t("Побуждающий инцидент", "Inciting incident")} value={character.careerInfo.incitingIncident}
            placeholder={t("Почему герой отправился в путь", "Why your hero set out")} onChange={(value) => patchCareerInfo("incitingIncident", value)} multiline />
        </div>
      </section>
    </Panel>
  );
}
