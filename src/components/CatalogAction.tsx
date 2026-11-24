import { useLocale } from "../i18n/locale";
import { Icon } from "./Icons";
import "./CatalogAction.css";
import { useContext, useState } from "react";
import { AppContext } from "../state/AppContext";
import type { CatalogEntry } from "../data/library";
import { addCatalogEntry, ownsCatalogEntry } from "../lib/catalog-character";
import { CHARACTERISTICS } from "../lib/rule-display";
import { makeId } from "../data/templates";
import { Button, Field, Select, TextInput } from "./ui";

export function CatalogAction({ entry }: { entry: CatalogEntry }) {
  const { t, locale } = useLocale();
  const app = useContext(AppContext);
  const originalGoal = entry.kind === "project" && entry.originalDescription?.match(/^\*\*Project Goal:\*\* (.+)$/m)?.[1];
  const choices = CHARACTERISTICS.filter((c) =>
    entry.projectCharacteristic.includes(c.label),
  );
  const [characteristic, setCharacteristic] = useState(
    choices.length === 1 ? choices[0].key : "",
  );
  const [goal, setGoal] = useState(
    /^\d+$/.test(entry.projectGoal) ? entry.projectGoal : "",
  );
  if (!app)
    return (
      <p className="muted">
        <a href="#/sheet">{t("Создайте или выберите героя", "Create or select a hero")}</a>{t(", чтобы добавлять записи из каталога.", " to add catalog entries.")}
      </p>
    );
  const owned = ownsCatalogEntry(app.character, entry);
  return (
    <div className="catalog-action">
      <p className="muted small">
        {t("Герой", "Hero")}: <strong>{app.character.name || t("Без имени", "Unnamed")}</strong>
        {owned ? t(" · Уже добавлено", " · Already added") : ""}
      </p>
      {entry.kind === "project" && (
        <div className="catalog-project-options">
          <Field label={t("Характеристика", "Characteristic")}>
            <Select
              aria-label={t("Характеристика нового проекта", "New project characteristic")}
              value={characteristic}
              onChange={(e) => setCharacteristic(e.target.value)}
            >
              <option value="">{t("Выбрать позже", "Choose later")}</option>
              {(choices.length ? choices : CHARACTERISTICS).map((c) => (
                <option key={c.key} value={c.key}>
                  {locale === "en" ? ({ might: "Might", agility: "Agility", reason: "Reason", intuition: "Intuition", presence: "Presence" } as const)[c.key] : c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("Цель в очках", "Goal in points")}>
            <TextInput
              type="number"
              min="0"
              step="1"
              aria-label={t("Цель нового проекта", "New project goal")}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={t("Уточнить позже", "Decide later")}
            />
          </Field>
        </div>
      )}
      {entry.kind === "project" && !entry.projectGoal.match(/^\d+$/) && (
        <p className="muted small">
          {entry.projectGoal
            ? t(`Цель по правилам: ${entry.projectGoal}.`, originalGoal ? `Project goal: ${originalGoal}` : "See the project description for the goal.")
            : t("Цель зависит от выбранного результата — уточните её по описанию.", "The goal depends on the chosen outcome; see the project description.")}
        </p>
      )}
      <div className="catalog-action-buttons">
        <Button
          variant="primary"
          icon="plus"
          disabled={
            (owned && entry.kind === "title") ||
            (goal !== "" && (!/^\d+$/.test(goal) || Number(goal) < 1))
          }
          onClick={() => {
            app.update((character) =>
              addCatalogEntry(character, entry, makeId(), {
                characteristic,
                goal,
              }),
            );
            app.notify(
              `${entry.kind === "project" ? t("Проект начат", "Project started") : t("Добавлено", "Added")}: ${locale === "en" ? entry.originalName || entry.name : entry.name}`,
              "success",
            );
          }}
        >
          {owned && entry.kind === "title"
            ? t("Уже у героя", "Already owned")
            : entry.kind === "project"
              ? owned
                ? t("Начать ещё один", "Start another")
                : t("Начать проект", "Start project")
              : entry.kind === "title"
                ? t("Добавить титул", "Add title")
                : owned
                  ? t("Добавить ещё один", "Add another")
                  : t("Добавить в инвентарь", "Add to inventory")}
        </Button>
        {owned && (
          <a href={entry.kind === "project" ? "#/sheet" : "#/inventory"}>
            {entry.kind === "project" ? t("К проектам в листе", "Open projects") : t("В инвентарь", "Open inventory")} <Icon name="arrow-right" size={16} />
          </a>
        )}
      </div>
    </div>
  );
}
