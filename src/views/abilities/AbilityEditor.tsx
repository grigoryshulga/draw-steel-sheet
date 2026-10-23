import { useState } from "react";
import type { Ability, AbilityKind, CharacteristicKey, ActionType } from "../../types";
import { ABILITY_KINDS, ACTION_TYPES } from "../../data/actions";
import { CHARACTERISTICS, type Tier } from "../../lib/rules";
import { useApp } from "../../state/AppContext";
import { TierRequirementSummary } from "./shared";
import { TierBadge } from "../../components/TierBadge";
import {
  Button,
  Chip,
  Field,
  Modal,
  NumberInput,
  Select,
  TextArea,
  TextInput,
} from "../../components/ui";

export interface AbilityEditorProps {
  /** Редактируемая способность или заготовка для новой. */
  initial: Ability;
  /** Новая способность (влияет только на заголовок). */
  isNew: boolean;
  onClose: () => void;
  onSave: (ability: Ability) => void;
}

export function AbilityEditor({ initial, isNew, onClose, onSave }: AbilityEditorProps) {
  const { character } = useApp();
  const [draft, setDraft] = useState<Ability>(() => ({
    ...initial,
    preferredCharacteristic:
      initial.preferredCharacteristic || initial.rollCharacteristics[0] || "",
  }));
  const [keywordsText, setKeywordsText] = useState(initial.keywords.join(", "));

  const patch = (changes: Partial<Ability>) => setDraft((prev) => ({ ...prev, ...changes }));
  const nameValid = draft.name.trim().length > 0;

  const toggleCharacteristic = (key: CharacteristicKey) => {
    const rollCharacteristics = draft.rollCharacteristics.includes(key)
      ? draft.rollCharacteristics.filter((item) => item !== key)
      : [...draft.rollCharacteristics, key];
    const preferredCharacteristic =
      draft.preferredCharacteristic !== "" &&
      rollCharacteristics.includes(draft.preferredCharacteristic)
        ? draft.preferredCharacteristic
        : (rollCharacteristics[0] ?? "");
    patch({ rollCharacteristics, preferredCharacteristic });
  };

  const patchTier = (index: number, changes: Partial<Ability["tiers"][number]>) => {
    const tiers = draft.tiers.map((tier, i) => (i === index ? { ...tier, ...changes } : tier));
    patch({ tiers: tiers as Ability["tiers"] });
  };

  const save = () => {
    if (!nameValid) return;
    onSave({
      ...draft,
      preferredCharacteristic:
        draft.preferredCharacteristic !== "" &&
        draft.rollCharacteristics.includes(draft.preferredCharacteristic)
          ? draft.preferredCharacteristic
          : (draft.rollCharacteristics[0] ?? ""),
      name: draft.name.trim(),
      keywords: keywordsText
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean),
      rollBonus: Math.trunc(draft.rollBonus) || 0,
      resourceCost: Math.max(0, Math.trunc(draft.resourceCost) || 0),
    });
  };

  const setKeywords = (text: string) => {
    setKeywordsText(text);
    patch({
      keywords: text
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      className="abil-editor-modal"
      title={isNew ? "Новая способность" : `Изменить: ${initial.name}`}
      footer={
        <div className="abil-editor-footer">
          {!nameValid && <span className="abil-editor-error">Введите название способности.</span>}
          <span className="grow" />
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" icon="check" disabled={!nameValid} onClick={save}>
            Сохранить
          </Button>
        </div>
      }
    >
      <div className="abil-editor-grid">
        <Field label="Название" className="span-2">
          <TextInput
            value={draft.name}
            onChange={(event) => patch({ name: event.target.value })}
            placeholder="Например: Пронзающий выпад"
            autoFocus
          />
        </Field>

        <Field label="Флейвор" className="span-2">
          <TextArea
            rows={2}
            value={draft.flavor}
            onChange={(event) => patch({ flavor: event.target.value })}
          />
        </Field>

        <Field label="Тип действия">
          <Select
            value={draft.actionType}
            onChange={(event) => patch({ actionType: event.target.value as ActionType })}
          >
            {ACTION_TYPES.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Вид">
          <Select
            value={draft.kind}
            onChange={(event) => patch({ kind: event.target.value as AbilityKind })}
          >
            {ABILITY_KINDS.map((kind) => (
              <option key={kind.key} value={kind.key}>
                {kind.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Ключевые слова" className="span-2">
          <TextInput
            value={keywordsText}
            onChange={(event) => setKeywords(event.target.value)}
            placeholder="Ближний, Удар, Оружие"
          />
        </Field>

        <Field label="Дистанция">
          <TextInput
            value={draft.distance}
            onChange={(event) => patch({ distance: event.target.value })}
            placeholder="Ближний 1"
          />
        </Field>

        <Field label="Цель">
          <TextInput
            value={draft.target}
            onChange={(event) => patch({ target: event.target.value })}
            placeholder="Одно существо или объект"
          />
        </Field>

        <div className="field span-2">
          <span className="field-label">Характеристики броска</span>
          <div className="abil-chips">
            {CHARACTERISTICS.map((info) => (
              <Chip
                key={info.key}
                active={draft.rollCharacteristics.includes(info.key)}
                onClick={() => toggleCharacteristic(info.key)}
                title={info.label}
              >
                {info.short}
              </Chip>
            ))}
            {draft.rollCharacteristics.length === 0 && (
              <span className="muted small">Пусто — способность без броска силы.</span>
            )}
          </div>
        </div>

        <Field label="Предпочтительная характеристика">
          <Select
            value={draft.preferredCharacteristic || ""}
            disabled={draft.rollCharacteristics.length === 0}
            onChange={(event) =>
              patch({ preferredCharacteristic: event.target.value as CharacteristicKey | "" })
            }
          >
            {draft.rollCharacteristics.length === 0 && <option value="">Нет броска</option>}
            {draft.rollCharacteristics.map((key) => {
              const info = CHARACTERISTICS.find((item) => item.key === key);
              return (
                <option key={key} value={key}>
                  {info?.label ?? key}
                </option>
              );
            })}
          </Select>
        </Field>

        <Field label="Бонус броска">
          <NumberInput
            value={draft.rollBonus}
            onChange={(value) => patch({ rollBonus: value })}
            min={-10}
            max={20}
            label="Бонус броска"
          />
        </Field>

        <Field label="Стоимость ресурса">
          <NumberInput
            value={draft.resourceCost}
            onChange={(value) => patch({ resourceCost: value })}
            min={0}
            max={10}
            label="Стоимость ресурса"
          />
        </Field>

        <Field label="Триггер" className="span-2">
          <TextInput
            value={draft.trigger}
            onChange={(event) => patch({ trigger: event.target.value })}
            placeholder="Когда враг…"
          />
        </Field>

        {draft.rollCharacteristics.length > 0 && (
          <div className="span-2">
            <TierRequirementSummary ability={draft} character={character} />
          </div>
        )}

        <div className="span-2 abil-editor-tiers">
          {draft.tiers.map((tier, index) => (
            <div className="abil-editor-tier" key={index} data-tier={index + 1}>
              <TierBadge tier={(index + 1) as Tier} size="sm" />
              <TextInput
                className="mono"
                value={tier.damage}
                onChange={(event) => patchTier(index, { damage: event.target.value })}
                placeholder="Урон: 3 + M"
              />
              <TextArea
                rows={2}
                value={tier.effect}
                onChange={(event) => patchTier(index, { effect: event.target.value })}
                placeholder="Эффект тира"
              />
            </div>
          ))}
        </div>

        <Field label="Эффект" className="span-2">
          <TextArea
            rows={3}
            value={draft.effect}
            onChange={(event) => patch({ effect: event.target.value })}
          />
        </Field>

        <Field label="Источник">
          <TextInput
            value={draft.source}
            onChange={(event) => patch({ source: event.target.value })}
            placeholder="Класс, комплект или каталог"
          />
        </Field>

        <Field label="Заметки">
          <TextInput
            value={draft.notes}
            onChange={(event) => patch({ notes: event.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}
