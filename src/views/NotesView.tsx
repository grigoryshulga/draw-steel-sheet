import { Panel, TextArea } from "../components/ui";
import { Icon } from "../components/Icons";
import { NOTE_SECTIONS } from "../data/notes";
import { ProjectsPanel } from "./sheet/ProjectsPanel";
import { useApp } from "../state/AppContext";
import type { NoteSectionKey } from "../types";
import "./NotesView.css";

/** Отдельная страница заметок героя по разделам. */
export function NotesView() {
  const { character, update } = useApp();

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
          Заметки
        </h1>
      </header>

      <div className="notes-grid">
        {NOTE_SECTIONS.map((section) => {
          const isMisc = section.key === "misc";
          return (
            <Panel
              key={section.key}
              title={section.label}
              dense
              className={`note-section-card${isMisc ? " note-section-wide" : ""}`}
            >
              <TextArea
                className="note-section-textarea"
                rows={isMisc ? 6 : 9}
                value={character.notes[section.key]}
                placeholder={section.placeholder}
                aria-label={`Заметки: ${section.label}`}
                onChange={(event) => setNote(section.key, event.target.value)}
              />
            </Panel>
          );
        })}
      </div>

      <ProjectsPanel />
    </div>
  );
}
