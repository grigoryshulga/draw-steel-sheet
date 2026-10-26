import { useMemo, useState, type KeyboardEvent } from "react";
import { Icon, type IconName } from "../components/Icons";
import {
  Button,
  Chip,
  EmptyState,
  Field,
  Modal,
  NumberInput,
  Panel,
  Select,
  Stepper,
  TextArea,
  TextInput,
  Toggle,
} from "../components/ui";
import { makeId } from "../data/templates";
import { KIT_COMPENDIUM, kitBonusLabel, kitByName } from "../data/kits";
import { classFeatureGroups } from "../data/class-feature-rules";
import { changeKit } from "../lib/equipment";
import { FeatureEquipmentFields } from "../components/FeatureEquipmentFields";
import { KitPicker } from "./sheet/KitPicker";
import { useApp } from "../state/AppContext";
import type { InventoryItem, ItemCategory } from "../types";
import "./InventoryView.css";
import "../components/LibraryNav.css";
import { Artwork } from "../components/Artwork";

const CATEGORY_META: { key: ItemCategory; label: string; icon: IconName }[] = [
  { key: "gear", label: "Снаряжение", icon: "sword" },
  { key: "consumable", label: "Расходники", icon: "heart" },
  { key: "treasure", label: "Сокровища", icon: "spark" },
  { key: "trinket", label: "Безделушки", icon: "copy" },
  { key: "title", label: "Титулы", icon: "users" },
];

const CATEGORY_LABEL: Record<ItemCategory, string> = Object.fromEntries(
  CATEGORY_META.map((meta) => [meta.key, meta.label]),
) as Record<ItemCategory, string>;

interface ItemDraft {
  name: string;
  category: ItemCategory;
  qty: number;
  notes: string;
}

interface PresetItem {
  name: string;
  category: ItemCategory;
  notes?: string;
}

const PRESETS: PresetItem[] = [
  {
    name: "Зелье лечения",
    category: "consumable",
    notes: "Восстанавливает выносливость",
  },
  { name: "Факел", category: "gear" },
  { name: "Верёвка, 15 м", category: "gear" },
  {
    name: "Сокровище",
    category: "treasure",
    notes: "Стоимость уточни у мастера",
  },
];

type DeleteReason = "manual" | "empty" | "used";

interface PendingDelete {
  item: InventoryItem;
  reason: DeleteReason;
}

const DELETE_MESSAGES: Record<DeleteReason, string> = {
  manual: "Удалить предмет из инвентаря?",
  empty: "Количество стало нулевым. Удалить предмет?",
  used: "Предмет израсходован. Удалить его?",
};

export function InventoryView() {
  const { character, update, patch, notify } = useApp();

  const [draft, setDraft] = useState<ItemDraft>({
    name: "",
    category: "consumable",
    qty: 1,
    notes: "",
  });
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [kitPickerOpen, setKitPickerOpen] = useState(false);
  const selectedKit = kitByName(character.kit);
  const hasConditionalEquipmentOption = classFeatureGroups(character.className).some(
    (group) => group.options.some((option) =>
      option.effects.some((effect) => effect.kind === "field" && effect.when?.equipment),
    ),
  );

  const grouped = useMemo(() => {
    return CATEGORY_META.map((meta) => ({
      ...meta,
      items: character.inventory.filter((item) => item.category === meta.key),
    }));
  }, [character.inventory]);

  const treasureCount =
    grouped.find((g) => g.key === "treasure")?.items.length ?? 0;

  const patchItem = (id: string, changes: Partial<InventoryItem>) => {
    update((c) => ({
      ...c,
      inventory: c.inventory.map((item) =>
        item.id === id ? { ...item, ...changes } : item,
      ),
    }));
  };

  const addItem = (partial?: Partial<ItemDraft>) => {
    const merged = { ...draft, ...partial };
    const name = merged.name.trim();
    if (!name) return;
    const item: InventoryItem = {
      id: makeId(),
      name,
      category: merged.category,
      qty: Math.max(1, Math.floor(merged.qty) || 1),
      notes: merged.notes.trim(),
      equipped: false,
    };
    update((c) => ({ ...c, inventory: [...c.inventory, item] }));
    setDraft({ name: "", category: merged.category, qty: 1, notes: "" });
  };

  const changeQty = (item: InventoryItem, qty: number) => {
    if (qty <= 0) {
      setPendingDelete({ item, reason: "empty" });
      return;
    }
    patchItem(item.id, { qty });
  };

  const useConsumable = (item: InventoryItem) => {
    const next = item.qty - 1;
    patchItem(item.id, { qty: next });
    if (next <= 0) {
      setPendingDelete({ item: { ...item, qty: 0 }, reason: "used" });
    } else {
      notify(`Использовано: ${item.name}`, "info");
    }
  };

  const removeItem = (id: string) => {
    update((c) => ({
      ...c,
      inventory: c.inventory.filter((item) => item.id !== id),
    }));
    setPendingDelete(null);
    notify("Предмет удалён", "info");
  };

  const onDraftEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addItem();
    }
  };

  return (
    <div className="inv-view">
      <header className="page-head">
        <h1 className="page-title">
          <Icon name="inventory" size={26} />
          Инвентарь
        </h1>
      </header>

      <nav className="library-nav" aria-label="Каталоги инвентаря">
        <a href="#/catalog/treasure">Выбрать сокровище</a>
        <a href="#/catalog/title">Выбрать титул</a>
      </nav>

      <Panel title="Богатство и известность" icon="spark" dense>
        <div className="inv-wallet">
          <Field label="Богатство">
            <TextInput
              value={character.wealth}
              placeholder="Напр.: 50 золотых, жемчужина"
              onChange={(e) => patch({ wealth: e.target.value })}
            />
          </Field>
          <Field label="Известность">
            <TextInput
              value={character.renown}
              placeholder="Напр.: известен в столице"
              onChange={(e) => patch({ renown: e.target.value })}
            />
          </Field>
        </div>
      </Panel>

      <Panel title="Снаряжение" icon="sword">
        {hasConditionalEquipmentOption && (
          <FeatureEquipmentFields
            value={character.automation?.equipment}
            hasKit={Boolean(character.kit.trim() || character.secondaryKit?.trim())}
            automationEnabled={character.automation?.enabled ?? false}
            onChange={(equipment) =>
              update((current) => ({
                ...current,
                automation: {
                  ...(current.automation ?? {
                    enabled: false,
                    adjustments: {},
                    ancestryTraits: [],
                  }),
                  equipment,
                },
              }))
            }
          />
        )}
        <div className="inv-kit">
          <Field label="Комплект">
            <div className="inv-kit-row">
              <TextInput
                value={character.kit}
                placeholder="Напр.: Клинок и щит"
                aria-label="Комплект"
                onChange={(e) => patch({ kit: e.target.value })}
              />
              <Button
                size="sm"
                icon="book"
                onClick={() => setKitPickerOpen(true)}
              >
                Выбрать
              </Button>
            </div>
          </Field>
          {selectedKit && (
            <div className="inv-kit-selected">
              <Artwork
                kind="kit"
                name={selectedKit.name}
                className="inv-kit-art"
              />
              <p>{selectedKit.equipment}</p>
              <div className="inv-kit-bonuses">
                {selectedKit.bonuses.map((bonus) => (
                  <Chip key={`${bonus.label}-${bonus.value}`} tone="accent">
                    {kitBonusLabel(bonus.label)} {bonus.value}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {character.className === "Тактик" && (
            <>
              <Field label="Второй комплект · Полевой арсенал">
                <Select
                  value={character.secondaryKit ?? ""}
                  onChange={(e) =>
                    update((c) => changeKit(c, e.target.value, true))
                  }
                >
                  <option value="">Без второго комплекта</option>
                  {KIT_COMPENDIUM.filter((k) => k.name !== character.kit).map(
                    (k) => (
                      <option key={k.id}>{k.name}</option>
                    ),
                  )}
                </Select>
              </Field>
              {character.secondaryKit &&
                (["meleeDamageKit", "rangedDamageKit"] as const).map(
                  (key, i) => (
                    <Field
                      key={key}
                      label={`Профиль урона ${i === 0 ? "ближнего" : "дальнего"} боя`}
                    >
                      <Select
                        value={character.automation?.[key] || character.kit}
                        onChange={(e) =>
                          patch({
                            automation: {
                              enabled: character.automation?.enabled ?? false,
                              adjustments:
                                character.automation?.adjustments ?? {},
                              ancestryTraits:
                                character.automation?.ancestryTraits ?? [],
                              ...character.automation,
                              [key]: e.target.value,
                            },
                          })
                        }
                      >
                        {[character.kit, character.secondaryKit]
                          .filter(Boolean)
                          .map((name) => (
                            <option key={name}>{name}</option>
                          ))}
                      </Select>
                    </Field>
                  ),
                )}
            </>
          )}
          <Field label="Оружие / реализация">
            <TextInput
              value={character.weapon}
              placeholder="Напр.: длинный меч"
              onChange={(e) => patch({ weapon: e.target.value })}
            />
          </Field>
          <Field label="Доспех / оберег">
            <TextInput
              value={character.armor}
              placeholder="Напр.: кольчуга"
              onChange={(e) => patch({ armor: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Эффекты снаряжения">
          <TextArea
            className="inv-effects"
            value={character.equipmentEffects}
            rows={3}
            placeholder="Напр.: +5 выносливости, скорость 6, урон +2, дистанция +1, отход 2"
            onChange={(e) => patch({ equipmentEffects: e.target.value })}
          />
        </Field>
      </Panel>

      <Panel title="Инвентарь" icon="inventory" dense>
        {character.inventory.length === 0 ? (
          <EmptyState icon="inventory" title="Сумка пуста" />
        ) : (
          <div className="inv-groups">
            {grouped.map((group) => {
              if (group.items.length === 0) return null;
              return (
                <section key={group.key} className="inv-group">
                  <header className="inv-group-head">
                    <Icon name={group.icon} size={15} />
                    <h3>{group.label}</h3>
                    {group.key === "treasure" && treasureCount > 3 && (
                      <Chip
                        tone="yellow"
                        title="Правила советуют нести не больше трёх сокровищ"
                      >
                        <Icon name="warning" size={13} /> безопасно нести три
                      </Chip>
                    )}
                  </header>
                  <ul className="inv-list">
                    {group.items.map((item) => (
                      <li
                        key={item.id}
                        className={`inv-row ${item.equipped ? "is-equipped" : ""}`}
                      >
                        <div className="inv-name">
                          <TextInput
                            value={item.name}
                            placeholder="Название"
                            aria-label={`Название предмета: ${item.name}`}
                            onChange={(e) =>
                              patchItem(item.id, { name: e.target.value })
                            }
                          />
                          {item.category === "gear" && item.equipped && (
                            <Chip tone="green" className="inv-equipped-badge">
                              надето
                            </Chip>
                          )}
                        </div>
                        <Stepper
                          className="inv-qty"
                          value={item.qty}
                          min={0}
                          label={`Количество: ${item.name}`}
                          onChange={(qty) => changeQty(item, qty)}
                        />
                        <TextInput
                          className="inv-note"
                          value={item.notes}
                          placeholder="Заметка"
                          aria-label={`Описание предмета: ${item.name}`}
                          onChange={(e) =>
                            patchItem(item.id, { notes: e.target.value })
                          }
                        />
                        <div className="inv-row-actions">
                          {item.catalogId && (
                            <a
                              href={`#/catalog/${item.category === "title" ? "title" : "treasure"}/${encodeURIComponent(item.catalogId)}`}
                              title="Полное описание из каталога"
                            >
                              Правила ↗
                            </a>
                          )}
                          {item.category === "gear" && (
                            <Toggle
                              checked={item.equipped}
                              onChange={(equipped) =>
                                patchItem(item.id, { equipped })
                              }
                              label={`Надето: ${item.name}`}
                            />
                          )}
                          {item.category === "consumable" && (
                            <Button
                              size="sm"
                              variant="soft"
                              icon="heart"
                              disabled={item.qty <= 0}
                              onClick={() => useConsumable(item)}
                            >
                              Использовать
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="trash"
                            iconOnly
                            aria-label={`Удалить: ${item.name}`}
                            onClick={() =>
                              setPendingDelete({ item, reason: "manual" })
                            }
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        <div className="inv-add">
          <TextInput
            className="inv-add-name"
            value={draft.name}
            placeholder="Новый предмет…"
            aria-label="Название нового предмета"
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onKeyDown={onDraftEnter}
          />
          <Select
            className="inv-add-cat"
            aria-label="Категория нового предмета"
            value={draft.category}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                category: e.target.value as ItemCategory,
              }))
            }
          >
            {CATEGORY_META.map((meta) => (
              <option key={meta.key} value={meta.key}>
                {meta.label}
              </option>
            ))}
          </Select>
          <NumberInput
            className="inv-add-qty"
            label="Количество нового предмета"
            value={draft.qty}
            min={1}
            onChange={(qty) => setDraft((d) => ({ ...d, qty }))}
          />
          <TextInput
            className="inv-add-note"
            value={draft.notes}
            placeholder="Заметка (необязательно)"
            aria-label="Заметка нового предмета"
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            onKeyDown={onDraftEnter}
          />
          <Button variant="primary" icon="plus" onClick={() => addItem()}>
            Добавить
          </Button>
        </div>

        <div className="inv-presets">
          <span className="muted small">Заготовки:</span>
          {PRESETS.map((preset) => (
            <Button
              key={preset.name}
              size="sm"
              variant="ghost"
              icon="plus"
              onClick={() => {
                addItem({
                  name: preset.name,
                  category: preset.category,
                  qty: 1,
                  notes: preset.notes ?? "",
                });
                notify(`Добавлено: ${preset.name}`, "success");
              }}
            >
              {preset.name}
            </Button>
          ))}
        </div>
      </Panel>

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Удалить предмет?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Оставить
            </Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => pendingDelete && removeItem(pendingDelete.item.id)}
            >
              Удалить
            </Button>
          </>
        }
      >
        <p>
          «{pendingDelete?.item.name}» —{" "}
          {pendingDelete
            ? CATEGORY_LABEL[pendingDelete.item.category].toLowerCase()
            : ""}
          , {pendingDelete?.item.qty ?? 0} шт.{" "}
          {pendingDelete && DELETE_MESSAGES[pendingDelete.reason]}
        </p>
      </Modal>

      <KitPicker
        open={kitPickerOpen}
        current={character.kit}
        onClose={() => setKitPickerOpen(false)}
        onSelect={(kit) => {
          update((c) => changeKit(c, kit.name));
          setKitPickerOpen(false);
          notify(`Комплект «${kit.name}» выбран`, "success");
        }}
      />
    </div>
  );
}
