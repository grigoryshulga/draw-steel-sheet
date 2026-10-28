import { Button, Chip, Panel } from "../../components/ui";
import { Icon } from "../../components/Icons";
import { SKILL_GROUPS, SKILL_GROUP_TONES } from "../../data/skills";
import { useApp } from "../../state/AppContext";
import "./SkillsPanel.css";

/** Навыки героя рядом с характеристиками. */
export function SkillsPanel() {
  const { character, goTo } = useApp();
  const selected = new Set(character.skills);
  const groups = SKILL_GROUPS.map((group) => ({
    ...group,
    items: group.skills.filter((skill) => selected.has(skill)),
  })).filter((group) => group.items.length > 0);
  const known = new Set(SKILL_GROUPS.flatMap((group) => group.skills));
  const extras = character.skills.filter((skill) => !known.has(skill));
  return (
    <Panel
      title="Навыки"
      icon="check"
      className="skills-panel"
      actions={
        <Button size="sm" variant="ghost" icon="edit" onClick={() => goTo("development")}>
          Изменить
        </Button>
      }
    >
      {character.skills.length === 0 ? (
        <div className="skills-empty">
          <Icon name="check" size={20} />
          <Button size="sm" variant="soft" onClick={() => goTo("development")}>
            Выбрать навыки
          </Button>
        </div>
      ) : (
        <div className="sheet-skills">
          {groups.map((group) => (
            <section className="sheet-skill-group" key={group.key}>
              <span className="eyebrow">{group.label}</span>
              <div className="sheet-skill-chips">
                {group.items.map((skill) => (
                  <Chip key={skill} tone={SKILL_GROUP_TONES[group.key]}>
                    {skill}
                  </Chip>
                ))}
              </div>
            </section>
          ))}
          {extras.length > 0 && (
            <section className="sheet-skill-group">
              <span className="eyebrow">Другие</span>
              <div className="sheet-skill-chips">
                {extras.map((skill) => (
                  <Chip key={skill}>{skill}</Chip>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Panel>
  );
}
