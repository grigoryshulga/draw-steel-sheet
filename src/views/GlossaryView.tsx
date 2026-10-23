import { useEffect, useState } from "react";
import { GLOSSARY, glossaryLink, matchesLibraryQuery } from "../data/library";
import { useLibraryLocation } from "../lib/library-location";
import { LibraryHeader } from "../components/LibraryHeader";
import { RuleText } from "../components/RuleText";
import { Button, TextInput } from "../components/ui";
import "./CodexView.css";
import "./LibraryView.css";

export function GlossaryView() {
  const [, , id] = useLibraryLocation();
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState("");
  const letters = [...new Set(GLOSSARY.map((entry) => entry.letter))];
  const selected = GLOSSARY.find((entry) => entry.id === id);
  const results = GLOSSARY.filter(
    (entry) =>
      (!letter || entry.letter === letter) &&
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
      <LibraryHeader
        current="glossary"
        description={`Терминов: ${GLOSSARY.length}. Короткие определения на русском, поиск также по английским названиям.`}
      />
      <div className="glossary-tools">
        <TextInput
          type="search"
          aria-label="Поиск по глоссарию"
          placeholder="Например: замедление, slowed, эшелон…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLetter("");
          }}
        />
        <nav className="glossary-alphabet" aria-label="Алфавит">
          <button aria-pressed={!letter} onClick={() => setLetter("")}>
            Все
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
      <p className="muted small catalog-count">Найдено: {results.length}</p>
      {id && !selected && (
        <p className="muted">
          Термин по этой ссылке не найден. Воспользуйтесь поиском.
        </p>
      )}
      {results.length === 0 && (
        <div className="library-empty">
          <h2>Термин не найден</h2>
          <p>Попробуйте русское или английское название.</p>
          <Button
            onClick={() => {
              setQuery("");
              setLetter("");
            }}
          >
            Показать все
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
                <a href={glossaryLink(entry.id)}>{entry.name}</a>
              </h2>
              {entry.english && (
                <span className="glossary-english">{entry.english}</span>
              )}
            </header>
            <RuleText text={entry.markdown} />
          </article>
        ))}
      </div>
    </div>
  );
}
