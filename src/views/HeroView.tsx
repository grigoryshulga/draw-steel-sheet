import { useLayoutEffect, useRef, useState } from "react";
import { Icon } from "../components/Icons";
import {
  Button,
  Chip,
  Field,
  NumberInput,
  Panel,
  Select,
  TextInput,
} from "../components/ui";
import { ANCESTRIES, CAREERS } from "../data/classes";
import { HelpTooltip } from "../components/HelpTooltip";
import { SKILL_GROUPS, SKILL_GROUP_TONES } from "../data/skills";
import { PerksPanel } from "./hero/PerksPanel";
import { ClassFeaturesPanel } from "./hero/ClassFeaturesPanel";
import { useApp } from "../state/AppContext";
import "./HeroView.css";

export function HeroView({ embedded = false }: { embedded?: boolean }) {
  const { character, update, patch, goTo } = useApp();
  const skills = character.skills;

  const toggleSkill = (skill: string) => {
    update((c) => ({
      ...c,
      skills: c.skills.includes(skill)
        ? c.skills.filter((s) => s !== skill)
        : [...c.skills, skill],
    }));
  };

  return (
    <div className={`hero-view${embedded ? " is-embedded" : ""}`}>
      {!embedded && (
        <header className="page-head">
          <h1 className="page-title">
            <Icon name="hero" size={26} />
            Герой
          </h1>
          <div className="page-actions">
            <Button icon="sheet" onClick={() => goTo("sheet")}>
              К листу
            </Button>
          </div>
        </header>
      )}

      <Panel title="Личность" icon="hero" dense>
        <div className="hero-identity">
          <Field label="Имя" className="hero-identity-name">
            <TextInput
              value={character.name}
              placeholder="Имя героя"
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Field>
          <Field label="Происхождение">
            <Select
              value={character.ancestry}
              onChange={(e) => patch({ ancestry: e.target.value })}
            >
              <option value="">—</option>
              {ANCESTRIES.map((ancestry) => (
                <option key={ancestry} value={ancestry}>
                  {ancestry}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={<span className="hstack">Класс <HelpTooltip label="Почему нельзя сменить класс"><p>Для другого класса создайте нового героя. Смена класса в готовом листе не пересобирает его способности и особенности.</p></HelpTooltip></span>}>
            <span className="hero-locked-choice">
            <Icon name="lock" size={14} />
            <TextInput
              value={character.className}
              readOnly aria-label="Класс" placeholder="Не выбран"
            />
            </span>
          </Field>
          <Field label="Карьера">
            <Select
              value={character.career}
              onChange={(e) => patch({ career: e.target.value })}
            >
              <option value="">—</option>
              {CAREERS.map((career) => (
                <option key={career} value={career}>
                  {career}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={<span className="hstack">Подкласс <HelpTooltip label="Почему нельзя сменить подкласс"><p>Для другого подкласса создайте нового героя. Так сохранятся согласованные способности и особенности.</p></HelpTooltip></span>}>
            <span className="hero-locked-choice">
            <Icon name="lock" size={14} />
            <TextInput
              value={character.subclass}
              readOnly aria-label="Подкласс" placeholder="Не выбран"
            />
            </span>
          </Field>
          <Field label="Уровень" className="hero-identity-level">
            <NumberInput
              value={character.level}
              min={1}
              max={10}
              onChange={(level) => patch({ level })}
            />
          </Field>
        </div>
      </Panel>

      <Panel
        title="Навыки"
        icon="check"
        actions={
          <Button
            size="sm"
            variant="ghost"
            icon="close"
            disabled={skills.length === 0}
            onClick={() => patch({ skills: [] })}
          >
            Снять все навыки
          </Button>
        }
      >
        <div className="hero-skills-layout">
          <div className="hero-skill-groups">
            {SKILL_GROUPS.map((group) => {
              const selected = group.skills.filter((skill) =>
                skills.includes(skill),
              ).length;
              return (
                <section
                  key={group.key}
                  className="hero-skill-group"
                  data-tone={SKILL_GROUP_TONES[group.key]}
                >
                  <header className="hero-skill-head">
                    <h3>{group.label}</h3>
                    <Chip
                      active={selected > 0}
                      tone={selected > 0 ? "accent" : "default"}
                    >
                      {selected}/{group.skills.length}
                    </Chip>
                  </header>
                  <div className="hero-skill-grid">
                    {group.skills.map((skill) => (
                      <Chip
                        key={skill}
                        tone={SKILL_GROUP_TONES[group.key]}
                        active={skills.includes(skill)}
                        onClick={() => toggleSkill(skill)}
                      >
                        {skill}
                      </Chip>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <HeroLanguages />
        </div>
      </Panel>

      <PerksPanel />
      {!embedded && <ClassFeaturesPanel />}
    </div>
  );
}

function HeroLanguages() {
  const { character, update } = useApp();
  const languages = character.languages;
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const closeEditor = () => {
    restoreFocus.current = true;
    setDraft("");
    setAdding(false);
  };
  useLayoutEffect(() => {
    if (!adding && restoreFocus.current) {
      restoreFocus.current = false;
      addButton.current?.focus();
    }
  }, [adding]);

  return (
    <section className="hero-language-column">
      <header className="hero-skill-head">
        <h3>Языки</h3>
      </header>
      {languages.length > 0 && (
        <div className="hero-language-list">
          {languages.map((language) => (
            <Chip
              key={language}
              active
              tone="blue"
              title={`Убрать язык: ${language}`}
              onClick={() => update((current) => ({
                ...current,
                languages: current.languages.filter((item) => item !== language),
              }))}
            >
              <span className="sr-only">Убрать язык: </span>
              {language}
              <Icon name="close" size={11} aria-hidden="true" />
            </Chip>
          ))}
        </div>
      )}
      {adding ? (
        <form
          className="hero-lang-editor"
          onSubmit={(event) => {
            event.preventDefault();
            const language = draft.trim();
            if (!language) return;
            update((current) => current.languages.includes(language)
              ? current
              : { ...current, languages: [...current.languages, language] });
            closeEditor();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            closeEditor();
          }}
          onBlur={(event) => {
            if (!draft.trim() && !event.currentTarget.contains(event.relatedTarget)) setAdding(false);
          }}
        >
          <TextInput value={draft} placeholder="Новый язык" aria-label="Новый язык" autoFocus
            enterKeyHint="done" onChange={(event) => setDraft(event.target.value)} />
          <Button type="submit" size="sm" variant="ghost" icon="check" iconOnly disabled={!draft.trim()}>Сохранить язык</Button>
        </form>
      ) : (
        <div ref={(node) => { addButton.current = node?.querySelector("button") ?? null; }} className="hero-lang-add">
          <Button type="button" size="sm" variant="ghost" icon="plus" iconOnly onClick={() => setAdding(true)}>Добавить язык</Button>
        </div>
      )}
    </section>
  );
}
