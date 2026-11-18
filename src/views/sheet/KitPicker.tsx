import { useState } from "react";
import { Button, Chip, EmptyState, Modal } from "../../components/ui";
import { SearchInput } from "../../components/ui/SearchInput";
import { useScrollFade } from "../../components/useScrollFade";
import { ReferenceList } from "../../components/rules/ReferenceList";
import { RuleArticleReader } from "../../components/rules/RuleArticleReader";
import { catalogSectionEntries } from "../../data/reference-catalog";
import { kitByName, type Kit } from "../../data/kits";
import { searchText } from "../../lib/codex";
import { characterKitSlot } from "../../lib/equipment";
import type { Character } from "../../types";
import { KitBonuses } from "../../components/KitBonuses";
import "./KitPicker.css";

export function KitPicker({
  open,
  character,
  secondary = false,
  title = "Комплекты",
  onClose,
  onSelect,
}: {
  open: boolean;
  character: Character;
  secondary?: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (kit: Kit) => void;
}) {
  const currentKit = kitByName(secondary ? character.secondaryKit ?? "" : character.kit);
  const { kits, otherKit, issue } = characterKitSlot(character, secondary);
  const [query, setQuery] = useState("");
  const [previewId, setPreviewId] = useState(currentKit?.id ?? "");
  const listFade = useScrollFade();
  const entries = catalogSectionEntries("kits").filter((entry) => kits.some((kit) => kit.name === entry.name));
  const needle = searchText(query.trim());
  const filtered = entries.filter((entry) => !needle || searchText(entry.search).includes(needle));
  const preview = filtered.find((entry) => entry.id === previewId) ?? filtered.find((entry) => entry.name === currentKit?.name) ?? filtered[0];
  const selected = kits.find((kit) => kit.name === preview?.name);

  const unavailable = Boolean(issue(selected));

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={title}
      footer={
        <>
          <span className="grow" />
          <Button variant="primary" disabled={!selected || unavailable} onClick={() => selected && !unavailable && onSelect(selected)}>
            {unavailable ? "Уже выбран в паре" : "Выбрать комплект"}
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
              metaFor={(entry) => entry.name === otherKit?.name ? <Chip>Уже выбран в паре</Chip> : entry.name === currentKit?.name ? <Chip tone="accent">Текущий</Chip> : null}
            />
          </nav>
          <section className="kit-picker-preview" aria-label={`Описание: ${preview.name}`}>
            {otherKit && selected && !unavailable && <div className="kit-picker-pair">
              <KitBonuses title={`Бонусы в паре с «${otherKit.name}»`} level={character.level} loadout={{
                kit: secondary ? otherKit.name : selected.name,
                secondaryKit: secondary ? selected.name : otherKit.name,
                automation: character.automation,
              }} />
            </div>}
            {preview.articleId && <RuleArticleReader key={preview.id} articleId={preview.articleId} entityName={preview.entityName} />}
          </section>
        </div>
      )}
    </Modal>
  );
}
