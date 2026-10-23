import "./CatalogAction.css";
import { useContext, useState } from "react";
import { AppContext } from "../state/AppContext";
import type { CatalogEntry } from "../data/library";
import { addCatalogEntry, ownsCatalogEntry } from "../lib/catalog-character";
import { CHARACTERISTICS } from "../lib/rules";
import { makeId } from "../data/templates";
import { Button, Field, Select, TextInput } from "./ui";

export function CatalogAction({ entry }: { entry: CatalogEntry }) {
  const app = useContext(AppContext);
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
        <a href="#/sheet">Создайте или выберите героя</a>, чтобы добавлять
        записи из каталога.
      </p>
    );
  const owned = ownsCatalogEntry(app.character, entry);
  return (
    <div className="catalog-action">
      <p className="muted small">
        Герой: <strong>{app.character.name || "Без имени"}</strong>
        {owned ? " · Уже добавлено" : ""}
      </p>
      {entry.kind === "project" && (
        <div className="catalog-project-options">
          <Field label="Характеристика">
            <Select
              aria-label="Характеристика нового проекта"
              value={characteristic}
              onChange={(e) => setCharacteristic(e.target.value)}
            >
              <option value="">Выбрать позже</option>
              {(choices.length ? choices : CHARACTERISTICS).map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Цель в очках">
            <TextInput
              type="number"
              min="0"
              step="1"
              aria-label="Цель нового проекта"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Уточнить позже"
            />
          </Field>
        </div>
      )}
      {entry.kind === "project" && !entry.projectGoal.match(/^\d+$/) && (
        <p className="muted small">
          {entry.projectGoal
            ? `Цель по правилам: ${entry.projectGoal}.`
            : "Цель зависит от выбранного результата — уточните её по описанию."}
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
              `${entry.kind === "project" ? "Проект начат" : "Добавлено"}: ${entry.name}`,
              "success",
            );
          }}
        >
          {owned && entry.kind === "title"
            ? "Уже у героя"
            : entry.kind === "project"
              ? owned
                ? "Начать ещё один"
                : "Начать проект"
              : entry.kind === "title"
                ? "Добавить титул"
                : owned
                  ? "Добавить ещё один"
                  : "Добавить в инвентарь"}
        </Button>
        {owned && (
          <a href={entry.kind === "project" ? "#/sheet" : "#/inventory"}>
            {entry.kind === "project" ? "К проектам в листе" : "В инвентарь"} →
          </a>
        )}
      </div>
    </div>
  );
}
