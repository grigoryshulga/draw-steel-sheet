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
          Журнал
        </h1>
        <p className="muted small">Личные заметки и проекты</p>
      </header>

      <ProjectsPanel />

      <div className="notes-editor">
        <div ref={setToolbarContainer} className="notes-toolbar" />
        <div ref={grid} className={`notes-grid${expanded ? " is-expanded" : ""}`}>
          {NOTE_SECTIONS.map((section) => {
            const isMisc = section.key === "misc";
            const isExpanded = expanded === section.key;
            return (
              <Panel
                key={section.key}
                title={section.label}
                dense
                className={`note-section-card note-section-${section.key}${isMisc ? " note-section-wide" : ""}${isExpanded ? " is-expanded" : ""}`}
                actions={<Button className="note-expand-button" size="sm" variant="ghost" icon={isExpanded ? "collapse" : "expand"} iconOnly
                  aria-expanded={isExpanded} aria-controls={`note-editor-${section.key}`}
                  aria-label={`${isExpanded ? "Вернуть к разделам" : "Развернуть на весь контейнер"}: ${section.label}`}
                  title={isExpanded ? "Вернуть к разделам журнала" : "Развернуть на весь контейнер"}
                  onClick={() => toggleExpanded(section.key)} />}
              >
                <div id={`note-editor-${section.key}`} className="note-section-editor">
                  <MarkdownEditor
                    value={character.notes[section.key]}
                    placeholder={section.placeholder}
                    aria-label={`Журнал: ${section.label}`}
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
  const { character, update } = useApp();

  const patchCulture = (key: keyof typeof character.culture, value: string) => {
    update((current) => ({ ...current, culture: { ...current.culture, [key]: value } }));
  };

  const patchCareerInfo = (key: keyof typeof character.careerInfo, value: string) => {
    update((current) => ({ ...current, careerInfo: { ...current.careerInfo, [key]: value } }));
  };

  return (
    <Panel title="Предыстория" icon="hero" dense bodyClassName="notes-background">
      <section className="notes-background-section">
        <h3>Культура</h3>
        <div className="notes-culture">
          <HeroProfileText title="Среда" value={character.culture.environment}
            placeholder="Напр.: город" onChange={(value) => patchCulture("environment", value)} />
          <HeroProfileText title="Организация" value={character.culture.organization}
            placeholder="Напр.: гильдия" onChange={(value) => patchCulture("organization", value)} />
          <HeroProfileText title="Воспитание" value={character.culture.upbringing}
            placeholder="Напр.: море" onChange={(value) => patchCulture("upbringing", value)} />
        </div>
      </section>
      <section className="notes-background-section">
        <h3>Карьера</h3>
        <div className="notes-career">
          <HeroProfileText title="Преимущества" value={character.careerInfo.benefits}
            placeholder="Что даёт карьера" onChange={(value) => patchCareerInfo("benefits", value)} multiline />
          <HeroProfileText title="Детали" value={character.careerInfo.details}
            placeholder="Как герой жил до приключений" onChange={(value) => patchCareerInfo("details", value)} multiline />
          <HeroProfileText title="Побуждающий инцидент" value={character.careerInfo.incitingIncident}
            placeholder="Почему герой отправился в путь" onChange={(value) => patchCareerInfo("incitingIncident", value)} multiline />
        </div>
      </section>
    </Panel>
  );
}
