import { useEffect, useState } from "react";
import { GLOSSARY, glossaryLink, matchesLibraryQuery } from "../data/library";
import { useLibraryLocation } from "../lib/library-location";
import { GlossaryDefinition } from "../components/rules/GlossaryDefinition";
import { Button, TextInput } from "../components/ui";
import "./CodexView.css";
import "./LibraryView.css";
import { useLocale } from "../i18n/locale";

export function GlossaryView() {
  const { locale, t } = useLocale();
  const [, , id] = useLibraryLocation();
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState("");
  const initial = (entry: (typeof GLOSSARY)[number]) => locale === "en" && entry.english ? entry.english[0].toUpperCase() : entry.letter;
  const letters = [...new Set(GLOSSARY.map(initial))].sort((a, b) => a.localeCompare(b, locale));
  useEffect(() => setLetter(""), [locale]);
  const selected = GLOSSARY.find((entry) => entry.id === id);
  const results = GLOSSARY.filter(
    (entry) =>
      (!letter || initial(entry) === letter) &&
      matchesLibraryQuery(query, entry.name, entry.english, entry.markdown),
  );
  useEffect(() => {
    if (!id) return;
    setQuery("");
    setLetter("");
    const frame = requestAnimationFrame(() =>
      document
        .getElementById(`term-${id}`)
        ?.scrollIntoView({ block: "center" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [id]);
  return (
    <div className="library-view glossary-view">
      <div className="glossary-tools">
        <TextInput
          type="search"
          aria-label={t("Поиск по глоссарию", "Search glossary")}
          placeholder={t("Например: замедление, slowed, эшелон…", "For example: slowed, tier…")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLetter("");
          }}
        />
        <nav className="glossary-alphabet" aria-label={t("Алфавит", "Alphabet")}>
          <button aria-pressed={!letter} onClick={() => setLetter("")}>
            {t("Все", "All")}
          </button>
          {letters.map((value) => (
            <button
              key={value}
              aria-pressed={value === letter}
              onClick={() => {
                setLetter(value);
                setQuery("");
              }}
            >
              {value}
            </button>
          ))}
        </nav>
      </div>
      <p className="muted small catalog-count">{t("Найдено", "Found")}: {results.length}</p>
      {id && !selected && (
        <p className="muted">
          {t("Термин по этой ссылке не найден. Воспользуйтесь поиском.", "This term could not be found. Try a search.")}
        </p>
      )}
      {results.length === 0 && (
        <div className="library-empty">
          <h2>{t("Термин не найден", "Term not found")}</h2>
          <p>{t("Попробуйте русское или английское название.", "Try the Russian or English name.")}</p>
          <Button
            onClick={() => {
              setQuery("");
              setLetter("");
            }}
          >
            {t("Показать все", "Show all")}
          </Button>
        </div>
      )}
      <div className="glossary-entries">
        {results.map((entry) => (
          <article
            key={entry.id}
            id={`term-${entry.id}`}
            className={`glossary-entry${entry.id === id ? " is-selected" : ""}`}
          >
            <header>
              <h2>
                <a href={glossaryLink(entry.id)}>{locale === "en" && entry.english ? entry.english : entry.name}</a>
              </h2>
              {entry.english && locale === "ru" && (
                <span className="glossary-english">{entry.english}</span>
              )}
            </header>
            <GlossaryDefinition entry={entry} />
          </article>
        ))}
      </div>
    </div>
  );
}
