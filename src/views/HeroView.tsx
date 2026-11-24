import { useLocale } from "../i18n/locale";
import { BUILDER_DATA } from "../lib/character-builder";
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
import { SKILL_GROUPS, SKILL_GROUP_TONES, SKILL_ORIGINALS } from "../data/skills";
import { PerksPanel } from "./hero/PerksPanel";
import { ClassFeaturesPanel } from "./hero/ClassFeaturesPanel";
import { useApp } from "../state/AppContext";
import "./HeroView.css";

export function HeroView({ embedded = false }: { embedded?: boolean }) {
  const { locale, t } = useLocale();
  const nameFor = (value: string, entries: { name: string; originalName?: string }[]) => locale === "en" ? entries.find((item) => item.name === value)?.originalName || value : value;
  const groupNames: Record<string, string> = { crafting: "Crafting", exploration: "Exploration", interpersonal: "Interpersonal", intrigue: "Intrigue", lore: "Lore" };
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
            {t("Герой", "Hero")}
          </h1>
          <div className="page-actions">
            <Button icon="sheet" onClick={() => goTo("sheet")}>
              {t("К листу", "Back to sheet")}
            </Button>
          </div>
        </header>
      )}

      <Panel title={t("Личность", "Identity")} icon="hero" dense>
        <div className="hero-identity">
          <Field label={t("Имя", "Name")} className="hero-identity-name">
            <TextInput
              value={character.name}
              placeholder={t("Имя героя", "Hero name")}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Field>
          <Field label={t("Происхождение", "Ancestry")}>
            <Select
              value={character.ancestry}
              onChange={(e) => patch({ ancestry: e.target.value })}
            >
              <option value="">—</option>
              {ANCESTRIES.map((ancestry) => (
                <option key={ancestry} value={ancestry}>
                  {nameFor(ancestry, BUILDER_DATA.ancestries)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("Карьера", "Career")}>
            <Select
              value={character.career}
              onChange={(e) => patch({ career: e.target.value })}
            >
              <option value="">—</option>
              {CAREERS.map((career) => (
                <option key={career} value={career}>
                  {nameFor(career, BUILDER_DATA.careers)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="hero-identity-build">
            <dl>
              <div><dt>{t("Класс", "Class")}</dt><dd>{nameFor(character.className, BUILDER_DATA.classes) || t("Не выбран", "Not selected")}</dd></div>
              <div><dt>{t("Подкласс", "Subclass")}</dt><dd>{nameFor(character.subclass, BUILDER_DATA.classes.flatMap((item) => item.subclasses)) || t("Не выбран", "Not selected")}</dd></div>
            </dl>
            <HelpTooltip label={t("Как сменить класс или подкласс", "Changing class or subclass")}>
              <p>{t("Для другого класса или подкласса создайте нового героя. Так способности и особенности будут соответствовать вашему выбору.", "Create a new hero to choose a different class or subclass, so abilities and features match your choice.")}</p>
            </HelpTooltip>
          </div>
          <Field label={t("Уровень", "Level")} className="hero-identity-level">
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
        title={t("Навыки", "Skills")}
        icon="check"
        actions={
          <Button
            size="sm"
            variant="ghost"
            icon="close"
            disabled={skills.length === 0}
            onClick={() => patch({ skills: [] })}
          >
            {t("Снять все навыки", "Clear all skills")}
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
                    <h3>{locale === "en" ? groupNames[group.key] : group.label}</h3>
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
                        {locale === "en" ? SKILL_ORIGINALS[skill]?.originalName || skill : skill}
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
  const { t } = useLocale();
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
        <h3>{t("Языки", "Languages")}</h3>
      </header>
      {languages.length > 0 && (
        <div className="hero-language-list">
          {languages.map((language) => (
            <Chip
              key={language}
              active
              tone="blue"
              title={t(`Убрать язык: ${language}`, `Remove language: ${language}`)}
              onClick={() => update((current) => ({
                ...current,
                languages: current.languages.filter((item) => item !== language),
              }))}
            >
              <span className="sr-only">{t("Убрать язык: ", "Remove language: ")}</span>
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
          <TextInput value={draft} placeholder={t("Новый язык", "New language")} aria-label={t("Новый язык", "New language")} autoFocus
            enterKeyHint="done" onChange={(event) => setDraft(event.target.value)} />
          <Button type="submit" size="sm" variant="ghost" icon="check" iconOnly disabled={!draft.trim()}>{t("Сохранить язык", "Save language")}</Button>
        </form>
      ) : (
        <div ref={(node) => { addButton.current = node?.querySelector("button") ?? null; }} className="hero-lang-add">
          <Button type="button" size="sm" variant="ghost" icon="plus" iconOnly onClick={() => setAdding(true)}>{t("Добавить язык", "Add language")}</Button>
        </div>
      )}
    </section>
  );
}
