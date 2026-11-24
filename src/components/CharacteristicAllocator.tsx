import { useLocale } from "../i18n/locale";
import {
  CHARACTERISTIC_KEYS,
  type Character,
  type CharacteristicKey,
} from "../types";
import { classPreset } from "../data/classes";
import {
  allocateCharacteristicArray,
  assignCharacteristicValue,
  characteristicArrays,
  isValidCharacteristicAllocation,
} from "../lib/characteristic-allocation";
import { CHARACTERISTICS } from "../lib/rules";
import "./CharacteristicAllocator.css";

export interface CharacteristicAllocatorProps {
  className: string;
  value: Character["characteristics"];
  onChange: (value: Character["characteristics"]) => void;
}

const LABELS = Object.fromEntries(CHARACTERISTICS.map(({ key, label }) => [key, label])) as Record<CharacteristicKey, string>;

function formatValue(value: number): string {
  return value > 0 ? `+${value}` : String(value).replace("-", "−");
}

function fixedKeysFor(className: string): CharacteristicKey[] {
  const starting = classPreset(className)?.starting ?? {};
  return CHARACTERISTIC_KEYS.filter((key) => key in starting);
}

function selectedArrayId(className: string, value: Character["characteristics"]): string | undefined {
  if (!isValidCharacteristicAllocation(className, value)) return undefined;
  const fixedKeys = new Set(fixedKeysFor(className));
  const freeKeys = CHARACTERISTIC_KEYS.filter((key) => !fixedKeys.has(key));
  const sorted = freeKeys.map((key) => value[key]).sort((a, b) => b - a);
  return characteristicArrays(className).find((array) =>
    array.values.every((entry, index) => entry === sorted[index]),
  )?.id;
}

export function CharacteristicAllocator({
  className,
  value,
  onChange,
}: CharacteristicAllocatorProps) {
  const { locale, t } = useLocale();
  const englishLabels: Record<CharacteristicKey, string> = { might: "Might", agility: "Agility", reason: "Reason", intuition: "Intuition", presence: "Presence" };
  const name = (key: CharacteristicKey) => locale === "en" ? englishLabels[key] : LABELS[key];
  const arrays = characteristicArrays(className);
  const valid = isValidCharacteristicAllocation(className, value);
  const activeArrayId = valid ? selectedArrayId(className, value) : undefined;
  const fixedKeys = fixedKeysFor(className);
  const freeKeys = CHARACTERISTIC_KEYS.filter((key) => !fixedKeys.includes(key));
  const availableValues = valid
    ? [...new Set(freeKeys.map((key) => value[key]))].sort((a, b) => b - a)
    : [];

  if (!arrays.length) {
    return <p className="characteristic-allocator__message">{t("Сначала выберите класс, чтобы увидеть распределение характеристик.", "Choose a class first to see characteristic arrays.")}</p>;
  }

  return (
    <section className="characteristic-allocator" aria-labelledby="characteristic-allocator-title">
      <h3 id="characteristic-allocator-title">{t("Распределение характеристик", "Characteristic allocation")}</h3>
      <p className="characteristic-allocator__instructions">
        {t("При назначении занятого бонуса характеристики меняются значениями.", "Assigning a bonus already in use swaps the characteristic values.")}
      </p>

      <div className="characteristic-allocator__arrays" role="group" aria-label={t("Готовые наборы значений", "Available arrays")}>
        {arrays.map((array) => (
          <button
            className="characteristic-allocator__array"
            type="button"
            key={array.id}
            aria-pressed={activeArrayId === array.id}
            aria-label={locale === "en" ? `Array ${array.label}` : `Набор ${array.label}: ${array.description}`}
            onClick={() => onChange(allocateCharacteristicArray(className, array.id, value))}
          >
            <span className="characteristic-allocator__array-values" aria-hidden="true">
              {array.values.map((entry, index) => <span key={`${entry}-${index}`}>{formatValue(entry)}</span>)}
            </span>
            <span className="characteristic-allocator__array-description">{locale === "ru" ? array.description : `Array ${array.label}`}</span>
          </button>
        ))}
      </div>

      {!valid ? (
        <p className="characteristic-allocator__feedback" role="alert">
          {t("Сохранённые значения не соответствуют правилам этого класса. Выберите набор выше, чтобы исправить распределение.", "The saved values do not match this class. Choose an array above to fix the allocation.")}
        </p>
      ) : null}

      <div className="characteristic-allocator__stats" aria-label={t("Характеристики героя", "Hero characteristics")}>
        {CHARACTERISTIC_KEYS.map((key) => {
          const locked = fixedKeys.includes(key);
          return (
            <article className={`characteristic-allocator__stat${locked ? " is-locked" : ""}`} key={key}>
              <h4>{name(key)}</h4>
              {locked ? (
                <div className="characteristic-allocator__locked-value">
                  <span>{formatValue(value[key])}</span>
                  <span className="characteristic-allocator__lock-label">{t("Задано классом", "Fixed by class")}</span>
                </div>
              ) : (
                <div className="characteristic-allocator__chips" role="group" aria-label={locale === "en" ? `Value for ${name(key)}` : `Значение для характеристики «${name(key)}»`}>
                  {availableValues.map((candidate) => {
                    const holder = freeKeys.find((other) => other !== key && value[other] === candidate);
                    const accessibleName = candidate === value[key]
                      ? locale === "en" ? `${name(key)}: ${formatValue(candidate)}, current value` : `${name(key)}: ${formatValue(candidate)}, текущее значение`
                      : locale === "en" ? `${name(key)}: choose ${formatValue(candidate)}; swap with ${holder ? name(holder) : "another free characteristic"}` : `${name(key)}: выбрать ${formatValue(candidate)}; поменять местами с ${holder ? name(holder) : "другой свободной характеристикой"}`;
                    return (
                      <button
                        className="characteristic-allocator__chip"
                        type="button"
                        key={candidate}
                        aria-label={accessibleName}
                        aria-pressed={value[key] === candidate}
                        disabled={candidate !== value[key] && !valid}
                        onClick={() => onChange(assignCharacteristicValue(className, value, key, candidate))}
                      >
                        {formatValue(candidate)}
                      </button>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
