import type { FeatureEffect } from "../../data/class-features/types";
import { useApp } from "../../state/AppContext";
import { Button, Panel, Select } from "../../components/ui";
import {
  featureConditionMet,
  resolveFeatureAmount,
} from "../../lib/feature-modifiers";
import {
  classFeatureChoicesForSheet,
  classFeatureGroupsForSheet,
  classFeatureLegacyGroupsForSheet,
} from "../../lib/class-feature-view";
import {
  ClassFeatureMechanicsPanel,
  RoundEncounterControls,
} from "../sheet/ClassFeaturesPanel";
import "./ClassFeaturesPanel.css";

/** Stable, explicit class feature selections for automatic calculation. */
export function ClassFeaturesPanel() {
  const { character, update, goTo } = useApp();
  // Группы, уже перенесённые в механики, показывает новый раздел: старый
  // селектор для них скрыт, иначе на листе два контрола и ложный статус.
  const groups = classFeatureLegacyGroupsForSheet(character);
  const selections = character.automation?.classFeatureSelections ?? {};

  // Новый раздел показывает только записи с механикой: у классов, которые ещё
  // не разобраны, он пуст, и единственным источником остаётся старый реестр.
  // Панель с пустым телом не рисуем — только шапку с кнопками раунда.
  const hasMechanics =
    classFeatureGroupsForSheet(character).length > 0 ||
    classFeatureChoicesForSheet(character).length > 0;

  if (groups.length === 0 && !hasMechanics) return null;

  const selectOption = (groupId: string, optionId: string) => {
    update((current) => {
      const automation = current.automation ?? {
        enabled: false,
        adjustments: {},
        ancestryTraits: [],
      };
      const classFeatureSelections = {
        ...automation.classFeatureSelections,
      };
      if (optionId) classFeatureSelections[groupId] = optionId;
      else delete classFeatureSelections[groupId];
      return {
        ...current,
        automation: { ...automation, classFeatureSelections },
      };
    });
  };

  return (
    <Panel
      title="Особенности класса"
      icon="spark"
      dense
      actions={<RoundEncounterControls />}
    >
      <ClassFeatureMechanicsPanel />
      {groups.length > 0 && (
        <div className="class-feature-groups">
          {groups.map((group) => {
            const selectedId = selections[group.id] ?? "";
            const selected = group.options.find(
              (option) => option.id === selectedId,
            );
            const supported = !!selected && selected.effects.length > 0;
            const hasDistanceEffect = selected?.effects.some(
              (effect) => effect.kind === "field" && effect.field === "distance",
            );
            const equipmentEffects = selected?.effects.filter(
              (effect): effect is Extract<FeatureEffect, { kind: "field" }> =>
                effect.kind === "field" && effect.when?.equipment !== undefined,
            ) ?? [];
            const hasKit = Boolean(
              character.kit.trim() || character.secondaryKit?.trim(),
            );
            const equipmentEffectStates = equipmentEffects.map((effect) => {
              const equipment = effect.when?.equipment;
              const active = featureConditionMet(character, effect.when);
              const label = equipment?.lightArmor
                ? "+3 к Выносливости за эшелон (лёгкая броня)"
                : `+${resolveFeatureAmount(character, effect.value)} к урону способностей «Оружие» (лёгкое оружие)`;
              const missingEquipment = equipment?.lightArmor
                ? "нужно отметить лёгкую броню"
                : "нужно отметить лёгкое оружие";
              return { active, label, missingEquipment };
            });
            const activeEquipmentEffects = equipmentEffectStates.filter(
              (effect) => effect.active,
            ).length;
            const conditionalStatus = !character.automation?.enabled
              ? "Поддерживает авторасчёт"
              : hasKit
                ? "Недоступно с комплектом"
                : activeEquipmentEffects === equipmentEffectStates.length
                  ? "Все бонусы активны"
                  : activeEquipmentEffects > 0
                    ? "Часть бонусов активна"
                    : "Отметьте снаряжение";
            return (
              <section className="class-feature-group" key={group.id}>
                <label className="class-feature-label" htmlFor={`feature-${group.id}`}>
                  {group.name}
                </label>
                <Select
                  id={`feature-${group.id}`}
                  value={selected ? selected.id : ""}
                  onChange={(event) => selectOption(group.id, event.target.value)}
                >
                  <option value="">Не выбрано</option>
                  {group.options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
                {selected && (
                  <div className="class-feature-detail">
                    <div className="class-feature-status">
                      <strong>{selected.name}</strong>
                      <span className={supported ? "is-supported" : "is-manual"}>
                        {equipmentEffects.length > 0
                          ? conditionalStatus
                          : supported
                          ? character.automation?.enabled
                            ? "Автоматически"
                            : "Поддерживает авторасчёт"
                          : "По тексту правил"}
                      </span>
                    </div>
                    <p>{selected.description.replace(/\s*---\s*$/, "")}</p>
                    {equipmentEffects.length > 0 && (
                      <>
                        {equipmentEffectStates.map((effect) => (
                          <p className="class-feature-automation-note" key={effect.label}>
                            {effect.label}: {character.automation?.enabled
                              ? hasKit
                                ? "недоступно с комплектом"
                                : effect.active
                                  ? "активен"
                                  : effect.missingEquipment
                              : effect.active
                                ? "авторасчёт выключен"
                                : `авторасчёт выключен; ${effect.missingEquipment}`}
                          </p>
                        ))}
                        <p className="class-feature-automation-note">
                          Отметки описывают фактическое снаряжение. Условные бонусы недоступны с любым комплектом.
                        </p>
                        <Button size="sm" variant="ghost" onClick={() => goTo("inventory")}>
                          Отметить снаряжение
                        </Button>
                      </>
                    )}
                    {hasDistanceEffect && (
                      <p className="class-feature-automation-note">
                        Бонус применяется к числовой дальности или пределу, но не увеличивает размер области и не действует на способности «На себя».
                      </p>
                    )}
                    {!supported && selected.manualReason && (
                      <p className="class-feature-reason">{selected.manualReason}</p>
                    )}
                    {supported && !character.automation?.enabled && (
                      <p className="class-feature-automation-note">
                        Числовые бонусы этой особенности будут рассчитываться после включения авторасчёта на листе.
                      </p>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
