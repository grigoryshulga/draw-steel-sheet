import { useLocale } from "../../i18n/locale";
import { useState, type FormEvent } from "react";
import { Icon } from "../../components/Icons";
import {
  Button,
  Chip,
  Field,
  Modal,
  NumberInput,
  Select,
  TextInput,
} from "../../components/ui";
import {
  DAMAGE_TRAIT_TYPES,
  damageTraitText,
  withDamageTrait,
  withoutDamageTrait,
} from "../../lib/damage-traits";
import {
  damageTraitsForSheet,
  type SheetDamageTrait,
} from "../../lib/sheet-damage-traits";
import { useApp } from "../../state/AppContext";
import type { DamageTraitKind } from "../../types";
import "./DamageTraits.css";

/** Сколько чипов помещается в шапке до сводки «+N». */
const VISIBLE_TRAITS = 3;
const EN_DAMAGE: Record<string, string> = { урон: "Damage (all types)", кислота: "Acid", холод: "Cold", порча: "Corruption", огонь: "Fire", святой: "Holy", молния: "Lightning", яд: "Poison", психический: "Psychic", звук: "Sonic" };
function traitDisplay(trait: Pick<SheetDamageTrait, "kind" | "type" | "value">, english: boolean) {
  return english ? `${trait.kind === "immunity" ? "Immunity" : "Weakness"}: ${EN_DAMAGE[trait.type.toLowerCase()] || trait.type} ${trait.value}` : damageTraitText(trait);
}

/**
 * Иммунитеты и уязвимости в шапке «Здоровья»: компактные чипы и кнопка
 * добавления. Автоматические иммунитеты приходят из особенностей, ручные
 * записи хранятся в персонаже. Оба вида — напоминания, расчёт урона не меняют.
 */
export function DamageTraits() {
  const { t, locale } = useLocale();
  const { character, readOnly } = useApp();
  const [open, setOpen] = useState(false);
  const traits = damageTraitsForSheet(character);
  const visible = traits.slice(0, VISIBLE_TRAITS);
  const hidden = traits.length - visible.length;

  if (readOnly && traits.length === 0) return null;

  return (
    <div className="damage-traits" role="group" aria-label={t("Иммунитеты и уязвимости", "Immunities and weaknesses")}>
      {visible.map((trait) => (
        <button
          key={trait.id}
          type="button"
          className={`damage-trait is-${trait.kind}`}
          title={`${traitDisplay(trait, locale === "en")} — ${trait.source}`}
          aria-label={t(`${damageTraitText(trait)}. Источник: ${trait.source}`, `${traitDisplay(trait, true)}. Source: ${trait.source}`)}
          onClick={() => setOpen(true)}
        >
          <Icon
            name={trait.kind === "immunity" ? "shield" : "warning"}
            size={12}
          />
          <span className="damage-trait-type">{locale === "en" ? EN_DAMAGE[trait.type.toLowerCase()] || trait.type : trait.type}</span>
          <span className="damage-trait-value">{trait.value}</span>
        </button>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          className="damage-trait-more"
          title={t(`Ещё ${hidden}. Показать все`, `${hidden} more. Show all`)}
          aria-label={t(`Показать все иммунитеты и уязвимости: ещё ${hidden}`, `Show all immunities and weaknesses: ${hidden} more`)}
          onClick={() => setOpen(true)}
        >
          +{hidden}
        </button>
      )}
      {!readOnly && <button
        type="button"
        className="damage-trait-add"
        title={t("Добавить иммунитет или уязвимость", "Add immunity or weakness")}
        aria-label={t("Добавить иммунитет или уязвимость", "Add immunity or weakness")}
        onClick={() => setOpen(true)}
      >
        <Icon name="shield" size={14} />
        <span>{t("Иммунитеты и уязвимости", "Immunities and weaknesses")}</span>
      </button>}
      <DamageTraitsDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function TraitRow({
  trait,
  onRemove,
}: {
  trait: SheetDamageTrait;
  onRemove?: (id: string) => void;
}) {
  const { t, locale } = useLocale();
  return (
    <li className="damage-trait-row">
      <span className={`damage-trait-row-icon is-${trait.kind}`}>
        <Icon
          name={trait.kind === "immunity" ? "shield" : "warning"}
          size={13}
        />
      </span>
      <div className="damage-trait-row-body">
        <p className="damage-trait-row-title">{traitDisplay(trait, locale === "en")}</p>
        <p className="damage-trait-row-source">{trait.source}</p>
      </div>
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          icon="trash"
          iconOnly
          aria-label={t(`Удалить: ${damageTraitText(trait)}`, `Remove: ${traitDisplay(trait, true)}`)}
          title={t("Удалить запись", "Remove entry") }
          onClick={() => onRemove(trait.id)}
        />
      )}
    </li>
  );
}

function DamageTraitsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  const { character, update, readOnly } = useApp();
  const traits = damageTraitsForSheet(character);
  const automatic = traits.filter((trait) => trait.automatic);
  const manual = traits.filter((trait) => !trait.automatic);
  const [kind, setKind] = useState<DamageTraitKind>("immunity");
  const [type, setType] = useState("огонь");
  const [value, setValue] = useState(5);
  const [note, setNote] = useState("");
  const canAdd = type.trim() !== "" && Number.isInteger(value) && value >= 1;

  const remove = (id: string) =>
    update((current) => withoutDamageTrait(current, id));

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAdd) return;
    update((current) =>
      withDamageTrait(current, { kind, type, value, note }),
    );
    setNote("");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("Иммунитеты и уязвимости", "Immunities and weaknesses") }
      className="damage-traits-dialog"
    >
      <p className="damage-traits-hint small muted">
        {t("Записи показываются как напоминание и не меняют расчёт урона.", "These entries are reminders and do not change damage calculations.")}
      </p>

      {!readOnly && <form className="damage-trait-form" onSubmit={add}>
        <h3 className="eyebrow">{t("Новая запись", "New entry")}</h3>
        <div className="damage-trait-kinds" role="group" aria-label={t("Вид записи", "Entry kind") }>
          <Chip
            active={kind === "immunity"}
            tone="green"
            onClick={() => setKind("immunity")}
          >
            {t("Иммунитет", "Immunity")}
          </Chip>
          <Chip
            active={kind === "weakness"}
            tone="red"
            onClick={() => setKind("weakness")}
          >
            {t("Уязвимость", "Weakness")}
          </Chip>
        </div>
        <div className="damage-trait-form-row">
          <Field label={t("Тип", "Type") }>
            <Select
              value={type}
              autoFocus
              aria-label={t("Тип урона", "Damage type") }
              onChange={(event) => setType(event.currentTarget.value)}
            >
              {DAMAGE_TRAIT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {locale === "en" ? EN_DAMAGE[option.value] || option.label : option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("Значение", "Value") }>
            <NumberInput
              value={value}
              min={1}
              max={999}
              showButtons={false}
              label={t("Значение иммунитета или уязвимости", "Immunity or weakness value") }
              className="damage-trait-value-input"
              onChange={setValue}
            />
          </Field>
        </div>
        <Field label={t("Источник или заметка", "Source or note") }>
          <TextInput
            value={note}
            maxLength={140}
            placeholder={t("Например, сценарий или временный эффект", "For example, a scenario or temporary effect") }
            aria-label={t("Источник или заметка", "Source or note") }
            onChange={(event) => setNote(event.currentTarget.value)}
          />
        </Field>
        <div className="damage-trait-form-actions">
          <Button iconOnly type="submit" variant="primary" icon="plus" disabled={!canAdd}>
            {t("Добавить", "Add")}
          </Button>
        </div>
      </form>}

      {automatic.length > 0 && (
        <section className="damage-traits-section">
          <h3 className="eyebrow">{t("Из особенностей", "From features")}</h3>
          <ul className="damage-traits-list">
            {automatic.map((trait) => (
              <TraitRow key={trait.id} trait={trait} />
            ))}
          </ul>
        </section>
      )}

      {(!readOnly || manual.length > 0) && <section className="damage-traits-section">
        <h3 className="eyebrow">{t("Добавлено вручную", "Added manually")}</h3>
        {manual.length > 0 ? (
          <ul className="damage-traits-list">
            {manual.map((trait) => (
              <TraitRow key={trait.id} trait={trait} onRemove={readOnly ? undefined : remove} />
            ))}
          </ul>
        ) : (
          <p className="damage-traits-empty small muted">
            {t("Пока ничего не добавлено.", "Nothing added yet.")}
          </p>
        )}
      </section>}
    </Modal>
  );
}
