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

/**
 * Иммунитеты и уязвимости в шапке «Здоровья»: компактные чипы и кнопка
 * добавления. Автоматические иммунитеты приходят из особенностей, ручные
 * записи хранятся в персонаже. Оба вида — напоминания, расчёт урона не меняют.
 */
export function DamageTraits() {
  const { character } = useApp();
  const [open, setOpen] = useState(false);
  const traits = damageTraitsForSheet(character);
  const visible = traits.slice(0, VISIBLE_TRAITS);
  const hidden = traits.length - visible.length;

  return (
    <div className="damage-traits" role="group" aria-label="Иммунитеты и уязвимости">
      {visible.map((trait) => (
        <button
          key={trait.id}
          type="button"
          className={`damage-trait is-${trait.kind}`}
          title={`${damageTraitText(trait)} — ${trait.source}`}
          aria-label={`${damageTraitText(trait)}. Источник: ${trait.source}`}
          onClick={() => setOpen(true)}
        >
          <Icon
            name={trait.kind === "immunity" ? "shield" : "warning"}
            size={12}
          />
          <span className="damage-trait-type">{trait.type}</span>
          <span className="damage-trait-value">{trait.value}</span>
        </button>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          className="damage-trait-more"
          title={`Ещё ${hidden}. Показать все`}
          aria-label={`Показать все иммунитеты и уязвимости: ещё ${hidden}`}
          onClick={() => setOpen(true)}
        >
          +{hidden}
        </button>
      )}
      <button
        type="button"
        className="damage-trait-add"
        title="Добавить иммунитет или уязвимость"
        aria-label="Добавить иммунитет или уязвимость"
        onClick={() => setOpen(true)}
      >
        <Icon name="plus" size={16} />
      </button>
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
  return (
    <li className="damage-trait-row">
      <span className={`damage-trait-row-icon is-${trait.kind}`}>
        <Icon
          name={trait.kind === "immunity" ? "shield" : "warning"}
          size={13}
        />
      </span>
      <div className="damage-trait-row-body">
        <p className="damage-trait-row-title">{damageTraitText(trait)}</p>
        <p className="damage-trait-row-source">{trait.source}</p>
      </div>
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          icon="trash"
          iconOnly
          aria-label={`Удалить: ${damageTraitText(trait)}`}
          title="Удалить запись"
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
  const { character, update } = useApp();
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
      title="Иммунитеты и уязвимости"
      className="damage-traits-dialog"
    >
      <p className="damage-traits-hint small muted">
        Записи показываются как напоминание и не меняют расчёт урона.
      </p>

      <form className="damage-trait-form" onSubmit={add}>
        <h3 className="eyebrow">Новая запись</h3>
        <div className="damage-trait-kinds" role="group" aria-label="Вид записи">
          <Chip
            active={kind === "immunity"}
            tone="green"
            onClick={() => setKind("immunity")}
          >
            Иммунитет
          </Chip>
          <Chip
            active={kind === "weakness"}
            tone="red"
            onClick={() => setKind("weakness")}
          >
            Уязвимость
          </Chip>
        </div>
        <div className="damage-trait-form-row">
          <Field label="Тип">
            <Select
              value={type}
              autoFocus
              aria-label="Тип урона"
              onChange={(event) => setType(event.currentTarget.value)}
            >
              {DAMAGE_TRAIT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Значение">
            <NumberInput
              value={value}
              min={1}
              max={999}
              showButtons={false}
              label="Значение иммунитета или уязвимости"
              className="damage-trait-value-input"
              onChange={setValue}
            />
          </Field>
        </div>
        <Field label="Источник или заметка">
          <TextInput
            value={note}
            maxLength={140}
            placeholder="Например, сценарий или временный эффект"
            aria-label="Источник или заметка"
            onChange={(event) => setNote(event.currentTarget.value)}
          />
        </Field>
        <div className="damage-trait-form-actions">
          <Button iconOnly type="submit" variant="primary" icon="plus" disabled={!canAdd}>
            Добавить
          </Button>
        </div>
      </form>

      {automatic.length > 0 && (
        <section className="damage-traits-section">
          <h3 className="eyebrow">Из особенностей</h3>
          <ul className="damage-traits-list">
            {automatic.map((trait) => (
              <TraitRow key={trait.id} trait={trait} />
            ))}
          </ul>
        </section>
      )}

      <section className="damage-traits-section">
        <h3 className="eyebrow">Добавлено вручную</h3>
        {manual.length > 0 ? (
          <ul className="damage-traits-list">
            {manual.map((trait) => (
              <TraitRow key={trait.id} trait={trait} onRemove={remove} />
            ))}
          </ul>
        ) : (
          <p className="damage-traits-empty small muted">
            Пока ничего не добавлено.
          </p>
        )}
      </section>
    </Modal>
  );
}
