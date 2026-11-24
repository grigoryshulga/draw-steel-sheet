import { useLocale } from "../../i18n/locale";
import { Icon } from "../../components/Icons";
import {
  Button,
  Chip,
  Field,
  NumberInput,
  Panel,
  Select,
  TextInput,
} from "../../components/ui";
import { makeId } from "../../data/templates";
import { CHARACTERISTICS } from "../../lib/rules";
import { adjustProjectPoints, projectProgress } from "../../lib/projects";
import { useApp } from "../../state/AppContext";
import type { ProjectRow } from "../../types";
import "./ProjectsPanel.css";

/** Проекты отдыха: цель, накопленные очки и быстрый трекинг. */
export function ProjectsPanel() {
  const { t } = useLocale();
  const { character, update } = useApp();
  const projects = character.projects;

  const addProject = () => {
    const row: ProjectRow = {
      id: makeId(),
      name: "",
      assigned: character.name,
      characteristic: "",
      goal: "",
      points: "",
    };
    update((current) => ({ ...current, projects: [...current.projects, row] }));
  };

  const patchProject = (id: string, changes: Partial<ProjectRow>) => {
    update((current) => ({
      ...current,
      projects: current.projects.map((row) =>
        row.id === id ? { ...row, ...changes } : row,
      ),
    }));
  };

  const removeProject = (id: string) => {
    update((current) => ({
      ...current,
      projects: current.projects.filter((row) => row.id !== id),
    }));
  };
  return (
    <Panel
      title={t("Проекты отдыха", "Respite projects")}
      icon="book"
      className="projects-panel"
      actions={
        <>
          <a href="#/catalog/project">{t("Каталог проектов", "Project catalog")}</a>
          <Button size="sm" variant="soft" icon="plus" iconOnly aria-label={t("Добавить проект", "Add project")} title={t("Добавить проект", "Add project")} onClick={addProject} />
        </>
      }
    >
      {projects.length === 0 ? (
        <div className="project-empty">
          <span className="project-empty-icon">
            <Icon name="book" size={20} />
          </span>
          <div>
            <strong>{t("Проектов пока нет", "No projects yet")}</strong>
          </div>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((project) => {
            const progress = projectProgress(project);
            return (
              <article
                className={`project-card${progress.complete ? " is-complete" : ""}`}
                key={project.id}
              >
                <header className="project-head">
                  <TextInput
                    className="project-name"
                    value={project.name}
                    placeholder={t("Название проекта", "Project name")}
                    aria-label={t("Название проекта", "Project name")}
                    onChange={(event) =>
                      patchProject(project.id, { name: event.target.value })
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="trash"
                    iconOnly
                    aria-label={t(`Удалить проект: ${project.name || "без названия"}`, `Delete project: ${project.name || "untitled"}`)}
                    title={t("Удалить проект", "Delete project")}
                    onClick={() => removeProject(project.id)}
                  />
                </header>

                {project.catalogId && (
                  <a
                    href={`#/catalog/project/${encodeURIComponent(project.catalogId)}`}
                  >
                    {t("Требования и описание проекта", "Project requirements and description")} <Icon name="arrow-right" size={16} />
                  </a>
                )}
                <div className="project-meta">
                  <Field label={t("Исполнитель", "Assignee")}>
                    <TextInput
                      value={project.assigned}
                      placeholder={t("Герой или последователь", "Hero or follower")}
                      aria-label={t("Исполнитель проекта", "Project assignee")}
                      onChange={(event) =>
                        patchProject(project.id, {
                          assigned: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label={t("Характеристика", "Characteristic")}>
                    <Select
                      value={project.characteristic}
                      aria-label={t("Характеристика проекта", "Project characteristic")}
                      onChange={(event) =>
                        patchProject(project.id, {
                          characteristic: event.target.value,
                        })
                      }
                    >
                      <option value="">—</option>
                      {CHARACTERISTICS.map((characteristic) => (
                        <option
                          key={characteristic.key}
                          value={characteristic.key}
                        >
                          {characteristic.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("Очки", "Points")}>
                    <NumberInput
                      value={progress.points}
                      min={0}
                      label={t("Накопленные очки проекта", "Accumulated project points")}
                      onChange={(points) =>
                        patchProject(project.id, { points: String(points) })
                      }
                    />
                  </Field>
                  <Field label={t("Цель", "Goal")}>
                    <NumberInput
                      value={progress.goal}
                      min={0}
                      label={t("Цель проекта", "Project goal")}
                      onChange={(goal) =>
                        patchProject(project.id, { goal: String(goal) })
                      }
                    />
                  </Field>
                </div>

                <div className="project-progress">
                  <div className="between">
                    <span className="eyebrow">{t("Прогресс", "Progress")}</span>
                    <span className="mono project-numbers">
                      {progress.points} / {progress.goal}
                      {progress.goal > 0 && ` · ${progress.percent}%`}
                    </span>
                  </div>
                  <div
                    className="project-bar"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={Math.max(progress.goal, progress.points)}
                    aria-valuenow={progress.points}
                    aria-label={t(`Прогресс проекта: ${progress.points} из ${progress.goal}`, `Project progress: ${progress.points} of ${progress.goal}`)}
                  >
                    <span style={{ width: `${progress.percent}%` }} />
                  </div>
                  <div className="project-actions">
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() =>
                        patchProject(project.id, {
                          points: adjustProjectPoints(project.points, -1),
                        })
                      }
                    >
                      −1
                    </Button>
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() =>
                        patchProject(project.id, {
                          points: adjustProjectPoints(project.points, 1),
                        })
                      }
                    >
                      +1
                    </Button>
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() =>
                        patchProject(project.id, {
                          points: adjustProjectPoints(project.points, 5),
                        })
                      }
                    >
                      +5
                    </Button>
                    <span className="grow" />
                    {progress.complete && <Chip tone="green">{t("готов", "complete")}</Chip>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
