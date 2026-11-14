import { useState } from "react";
import { Button, Chip, EmptyState, Modal } from "../../components/ui";
import { SearchInput } from "../../components/ui/SearchInput";
import { useScrollFade } from "../../components/useScrollFade";
import { ReferenceList } from "../../components/rules/ReferenceList";
import { RuleArticleReader } from "../../components/rules/RuleArticleReader";
import { catalogSectionEntries } from "../../data/reference-catalog";
import { availableKits, kitByName, type Kit } from "../../data/kits";
import { searchText } from "../../lib/codex";
import { selectedGroupValue } from "../../lib/feature-conditions";
import type { Character } from "../../types";
import "./KitPicker.css";

export function KitPicker({
  open,
  character,
  onClose,
  onSelect,
}: {
  open: boolean;
  character: Character;
  onClose: () => void;
  onSelect: (kit: Kit) => void;
}) {
  const currentKit = kitByName(character.kit);
  const [query, setQuery] = useState("");
  const [previewId, setPreviewId] = useState(currentKit?.id ?? "");
  const listFade = useScrollFade();
  const kits = availableKits(character.className, selectedGroupValue(character, "fury.aspect") ?? character.subclass);
  const entries = catalogSectionEntries("kits").filter((entry) => kits.some((kit) => kit.name === entry.name));
  const needle = searchText(query.trim());
  const filtered = entries.filter((entry) => !needle || searchText(entry.search).includes(needle));
  const preview = filtered.find((entry) => entry.id === previewId) ?? filtered.find((entry) => entry.name === currentKit?.name) ?? filtered[0];
  const selected = kits.find((kit) => kit.name === preview?.name);

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Комплекты"
      footer={
        <>
          <span className="grow" />
          <Button variant="primary" disabled={!selected} onClick={() => selected && onSelect(selected)}>
            Выбрать комплект
          </Button>
        </>
      }
    >
      <div className="kit-picker-search">
        <SearchInput value={query} onValueChange={setQuery} placeholder="Поиск комплекта…" aria-label="Поиск комплекта" />
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon="search" title={kits.length ? "Комплект не найден" : "Комплекты недоступны"}
          text={kits.length ? "Попробуйте другой запрос." : "Этот класс не использует комплекты."} />
      ) : (
        <div className="kit-picker-body">
          <nav ref={listFade.ref} className={`kit-picker-list scroll-fade${listFade.more ? " has-more" : ""}`} tabIndex={0} aria-label="Доступные комплекты">
            <ReferenceList
              entries={filtered}
              label="Комплекты"
              selectedId={preview?.id}
              onSelect={(entry) => setPreviewId(entry.id)}
              metaFor={(entry) => entry.name === currentKit?.name ? <Chip tone="accent">Текущий</Chip> : null}
            />
          </nav>
          <section className="kit-picker-preview" aria-label={`Описание: ${preview.name}`}>
            {preview.articleId && <RuleArticleReader key={preview.id} articleId={preview.articleId} entityName={preview.entityName} />}
          </section>
        </div>
      )}
    </Modal>
  );
}
