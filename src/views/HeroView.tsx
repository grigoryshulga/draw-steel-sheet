import { useState, type KeyboardEvent } from "react";
import { Icon } from "../components/Icons";
import {
  Button,
  Chip,
  Field,
  NumberInput,
  Panel,
  Select,
  TextArea,
  TextInput,
} from "../components/ui";
import { ANCESTRIES, CAREERS, CLASS_PRESETS } from "../data/classes";
import { SKILL_GROUPS, SKILL_GROUP_TONES } from "../data/skills";
import { PerksPanel } from "./hero/PerksPanel";
import { ClassFeaturesPanel } from "./hero/ClassFeaturesPanel";
import { useApp } from "../state/AppContext";
import "./HeroView.css";

export function HeroView({ embedded = false }: { embedded?: boolean }) {
  const { character, update, patch, goTo } = useApp();
  const [languageDraft, setLanguageDraft] = useState("");

  const skills = character.skills;

  const toggleSkill = (skill: string) => {
    update((c) => ({
      ...c,
      skills: c.skills.includes(skill)
        ? c.skills.filter((s) => s !== skill)
        : [...c.skills, skill],
    }));
  };

  const addLanguage = () => {
    const value = languageDraft.trim();
    if (!value) return;
    if (!character.languages.includes(value)) {
      update((c) => ({ ...c, languages: [...c.languages, value] }));
    }
    setLanguageDraft("");
  };

  const onLanguageEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addLanguage();
    }
  };

  const patchCulture = (key: keyof typeof character.culture, value: string) => {
    patch({ culture: { ...character.culture, [key]: value } });
  };

  const patchCareerInfo = (
    key: keyof typeof character.careerInfo,
    value: string,
  ) => {
    patch({ careerInfo: { ...character.careerInfo, [key]: value } });
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
          <Field label="Класс">
            <Select
              value={character.className}
              onChange={(e) => patch({ className: e.target.value })}
            >
              <option value="">—</option>
              {CLASS_PRESETS.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.name}
                </option>
              ))}
            </Select>
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
          <Field label="Подкласс">
            <TextInput
              value={character.subclass}
              placeholder="Напр.: Церемониями́ст"
              onChange={(e) => patch({ subclass: e.target.value })}
            />
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
            Снять все
          </Button>
        }
      >
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
      </Panel>

      <PerksPanel />
      {!embedded && <ClassFeaturesPanel />}

      <div className="hero-cols">
        <Panel title="Языки" icon="book" dense>
          <div className="hero-langs">
            {character.languages.map((language) => (
              <Chip
                key={language}
                active
                tone="blue"
                title={`Убрать: ${language}`}
                onClick={() =>
                  update((c) => ({
                    ...c,
                    languages: c.languages.filter((item) => item !== language),
                  }))
                }
              >
                {language}
                <Icon name="close" size={11} />
              </Chip>
            ))}
          </div>
          <TextInput
            className="hero-lang-input"
            value={languageDraft}
            placeholder="Добавить язык и нажать Enter…"
            aria-label="Новый язык"
            onChange={(e) => setLanguageDraft(e.target.value)}
            onKeyDown={onLanguageEnter}
          />
        </Panel>

        <Panel title="Культура" icon="users" dense>
          <div className="hero-culture">
            <Field label="Среда">
              <TextInput
                value={character.culture.environment}
                placeholder="Напр.: город"
                onChange={(e) => patchCulture("environment", e.target.value)}
              />
            </Field>
            <Field label="Организация">
              <TextInput
                value={character.culture.organization}
                placeholder="Напр.: гильдия"
                onChange={(e) => patchCulture("organization", e.target.value)}
              />
            </Field>
            <Field label="Воспитание">
              <TextInput
                value={character.culture.upbringing}
                placeholder="Напр.: море"
                onChange={(e) => patchCulture("upbringing", e.target.value)}
              />
            </Field>
          </div>
        </Panel>
      </div>

      <div className="hero-cols">
        <Panel title="Карьера" icon="sheet" dense>
          <div className="hero-stack">
            <Field label="Преимущества">
              <TextArea
                rows={3}
                value={character.careerInfo.benefits}
                placeholder="Что даёт карьера"
                onChange={(e) => patchCareerInfo("benefits", e.target.value)}
              />
            </Field>
            <Field label="Детали">
              <TextArea
                rows={3}
                value={character.careerInfo.details}
                placeholder="Как герой жил до приключений"
                onChange={(e) => patchCareerInfo("details", e.target.value)}
              />
            </Field>
            <Field label="Побуждающий инцидент">
              <TextArea
                rows={2}
                value={character.careerInfo.incitingIncident}
                placeholder="Почему герой отправился в путь"
                onChange={(e) =>
                  patchCareerInfo("incitingIncident", e.target.value)
                }
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Особенности" icon="spark" dense>
          <div className="hero-stack">
            <Field label="Особенности происхождения">
              <TextArea
                rows={4}
                value={character.ancestryTraits}
                placeholder="Полное описание черт происхождения"
                onChange={(e) => patch({ ancestryTraits: e.target.value })}
              />
            </Field>
            <Field label="Заметки об особенностях класса">
              <TextArea
                rows={4}
                value={character.classFeatures}
                placeholder="Полное описание умений класса"
                onChange={(e) => patch({ classFeatures: e.target.value })}
              />
              <span className="muted small">
                Заметки редактируются вручную и не обновляются при выборе особенностей выше.
              </span>
            </Field>
          </div>
        </Panel>
      </div>
    </div>
  );
}
