import { useState } from "react";
import {
  Button,
  Chip,
  EmptyState,
  Modal,
  TextInput,
} from "../../components/ui";
import {
  KIT_COMPENDIUM,
  kitBonusLabel,
  kitByName,
  type Kit,
} from "../../data/kits";
import "./KitPicker.css";
import { Artwork, ArtworkFigure } from "../../components/Artwork";
import { artFor } from "../../lib/art";

export function KitPicker({
  open,
  current,
  onClose,
  onSelect,
}: {
  open: boolean;
  current: string;
  onClose: () => void;
  onSelect: (kit: Kit) => void;
}) {
  const currentKit = kitByName(current);
  const [query, setQuery] = useState("");
  const [previewId, setPreviewId] = useState(currentKit?.id ?? "");

  const needle = query.trim().toLowerCase();
  const filtered = KIT_COMPENDIUM.filter((kit) =>
    needle
      ? `${kit.name} ${kit.summary} ${kit.equipment}`
          .toLowerCase()
          .includes(needle)
      : true,
  );
  const preview = filtered.find((kit) => kit.id === previewId) ?? filtered[0];

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Комплекты"
      footer={
        <>
          <span className="grow" />
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            disabled={!preview}
            onClick={() => preview && onSelect(preview)}
          >
            Выбрать комплект
          </Button>
        </>
      }
    >
      <div className="kit-picker-search">
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск комплекта…"
          aria-label="Поиск комплекта"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="search"
          title="Комплект не найден"
          text="Попробуйте другой запрос."
        />
      ) : (
        <div className="kit-picker-body">
          <div className="kit-picker-list">
            {filtered.map((kit) => (
              <button
                key={kit.id}
                type="button"
                className={`kit-option ${artFor("kit", kit.name) ? "with-art" : ""} ${preview?.id === kit.id ? "is-active" : ""}`.trim()}
                onClick={() => setPreviewId(kit.id)}
              >
                <Artwork kind="kit" name={kit.name} />
                <span className="kit-option-name">{kit.name}</span>
                <span className="kit-option-equipment">{kit.equipment}</span>
                {kit.id === currentKit?.id && (
                  <span className="kit-option-current">текущий</span>
                )}
              </button>
            ))}
          </div>

          <aside className="kit-picker-preview">
            {preview ? (
              <>
                <ArtworkFigure
                  art={artFor("kit", preview.name)}
                  className="kit-preview-art"
                />
                <h3>{preview.name}</h3>
                <p className="kit-preview-summary">{preview.summary}</p>

                <div className="kit-preview-block">
                  <span className="eyebrow">Снаряжение</span>
                  <p>{preview.equipment}</p>
                </div>

                {preview.bonuses.length > 0 && (
                  <div className="kit-preview-block">
                    <span className="eyebrow">Бонусы комплекта</span>
                    <div className="kit-bonuses">
                      {preview.bonuses.map((bonus) => (
                        <Chip
                          key={`${bonus.label}-${bonus.value}`}
                          tone="accent"
                        >
                          {kitBonusLabel(bonus.label)} {bonus.value}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}

                {preview.signatureAbility && (
                  <div className="kit-preview-block">
                    <span className="eyebrow">Знаковая способность</span>
                    <p className="kit-signature">{preview.signatureAbility}</p>
                  </div>
                )}
              </>
            ) : (
              <EmptyState icon="sword" title="Выберите комплект" />
            )}
          </aside>
        </div>
      )}
    </Modal>
  );
}
