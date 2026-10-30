import { useMemo, useState, type KeyboardEvent } from "react";
import { Icon } from "../components/Icons";
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
} from "../components/ui";
import { makeId } from "../data/templates";
import {
  KIT_COMPENDIUM,
  kitBonusLabel,
  kitByName,
  type Kit,
} from "../data/kits";
import { featureEquipmentRequirements } from "../lib/feature-equipment-requirements";
import { changeKit } from "../lib/equipment";
import { FeatureEquipmentFields } from "../components/FeatureEquipmentFields";
import { KitPicker } from "./sheet/KitPicker";
import { useApp } from "../state/AppContext";
import type { InventoryItem, ItemCategory } from "../types";
import "./InventoryView.css";
import { Artwork } from "../components/Artwork";

const CATEGORY_META: { key: ItemCategory; label: string }[] = [
  { key: "gear", label: "Снаряжение" },
  { key: "consumable", label: "Расходники" },
  { key: "treasure", label: "Сокровища" },
  { key: "trinket", label: "Безделушки" },
  { key: "title", label: "Титулы" },
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

const EMPTY_DRAFT: ItemDraft = {
  name: "",
  category: "consumable",
  qty: 1,
  notes: "",
};

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

function catalogHref(item: InventoryItem) {
  const kind = item.category === "title" ? "title" : "treasure";
  return `#/catalog/${kind}/${encodeURIComponent(item.catalogId ?? "")}`;
}

function KitFeature({ kit, eyebrow }: { kit: Kit; eyebrow: string }) {
  return (
    <article className="inv-kit-feature">
      <Artwork kind="kit" name={kit.name} className="inv-kit-feature-art" />
      <div className="inv-kit-feature-body">
        <header className="inv-kit-feature-head">
          <div className="inv-kit-feature-name">
            <span className="eyebrow">{eyebrow}</span>
            <h3>{kit.name}</h3>
          </div>
          <div className="inv-kit-bonuses">
            {kit.bonuses.map((bonus) => (
              <Chip key={`${bonus.label}-${bonus.value}`} tone="accent">
                {kitBonusLabel(bonus.label)} {bonus.value}
              </Chip>
            ))}
          </div>
        </header>
        <p className="inv-kit-summary">{kit.summary}</p>
        <div className="inv-kit-facts">
          <div>
            <span className="eyebrow">Снаряжение</span>
            <p>{kit.equipment}</p>
          </div>
          {kit.signatureAbility && (
            <div>
              <span className="eyebrow">Знаковая способность</span>
              <p>{kit.signatureAbility}</p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ItemCard({
  item,
  onEdit,
  onQty,
  onEquip,
  onUse,
}: {
  item: InventoryItem;
  onEdit: () => void;
  onQty: (qty: number) => void;
  onEquip: () => void;
  onUse: () => void;
}) {
  return (
    <article className={`inv-card${item.equipped ? " is-equipped" : ""}`}>
      <header className="inv-card-head">
        <h4>{item.name || "Без названия"}</h4>
        <Button
          size="sm"
          variant="ghost"
          icon="edit"
          iconOnly
          aria-label={`Изменить: ${item.name || "предмет"}`}
          title="Изменить предмет"
          onClick={onEdit}
        />
      </header>

      {item.notes && <p className="inv-card-notes">{item.notes}</p>}

      <footer className="inv-card-foot">
        <Stepper
          value={item.qty}
          min={0}
          label={`Количество: ${item.name}`}
          onChange={onQty}
        />
        <div className="inv-card-actions">
          {item.catalogId && (
            <a className="inv-card-rules" href={catalogHref(item)}>
              Правила ↗
            </a>
          )}
          {item.category === "gear" && (
            <Chip
              tone={item.equipped ? "green" : "default"}
              active={item.equipped}
              title={item.equipped ? "Снять предмет" : "Отметить как надетое"}
              onClick={onEquip}
            >
              {item.equipped ? "Надето" : "Надеть"}
            </Chip>
          )}
          {item.category === "consumable" && (
            <Button
              size="sm"
              variant="soft"
              icon="heart"
              disabled={item.qty <= 0}
              onClick={onUse}
            >
              Использовать
            </Button>
          )}
        </div>
      </footer>
    </article>
  );
}

export function InventoryView() {
  const { character, update, patch, notify } = useApp();

  const [draft, setDraft] = useState<ItemDraft>(EMPTY_DRAFT);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [kitPickerOpen, setKitPickerOpen] = useState(false);
  const selectedKit = kitByName(character.kit);
  const secondaryKit = kitByName(character.secondaryKit ?? "");
  const isTactician = character.className === "Тактик";
  const hasConditionalEquipmentOption = Boolean(
    featureEquipmentRequirements(
      character.className,
      character.automation?.classFeatureSelections,
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

  const openCreate = () => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setDialogOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    setDraft({
      name: item.name,
      category: item.category,
      qty: item.qty,
      notes: item.notes,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const saveItem = () => {
    const name = draft.name.trim();
    if (!name) return;
    const qty = Math.max(1, Math.floor(draft.qty) || 1);
    const notes = draft.notes.trim();

    if (editing) {
      patchItem(editing.id, {
        name,
        category: draft.category,
        qty,
        notes,
        equipped: draft.category === "gear" ? editing.equipped : false,
      });
      notify("Предмет обновлён", "success");
    } else {
      const item: InventoryItem = {
        id: makeId(),
        name,
        category: draft.category,
        qty,
        notes,
        equipped: false,
      };
      update((c) => ({ ...c, inventory: [...c.inventory, item] }));
      notify("Предмет добавлен", "success");
    }
    closeDialog();
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
    closeDialog();
    notify("Предмет удалён", "info");
  };

  const askDelete = (item: InventoryItem) => {
    closeDialog();
    setPendingDelete({ item, reason: "manual" });
  };

  const applyPreset = (preset: PresetItem) => {
    setDraft({
      name: preset.name,
      category: preset.category,
      qty: 1,
      notes: preset.notes ?? "",
    });
  };

  const onNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveItem();
    }
  };

  return (
    <div className="inv-view">
      <Panel
        title="Комплект"
        icon="sword"
        actions={
          <Button
            size="sm"
            variant="soft"
            icon="book"
            onClick={() => setKitPickerOpen(true)}
          >
            {selectedKit ? "Сменить" : "Выбрать"}
          </Button>
        }
      >
        <div className={`inv-kit-grid${isTactician ? " is-paired" : ""}`}>
          <div className="inv-kit-column">
            <Field label="Название комплекта">
              <TextInput
                value={character.kit}
                placeholder="Напр.: Клинок и щит"
                aria-label="Комплект"
                onChange={(e) => patch({ kit: e.target.value })}
              />
            </Field>

            {selectedKit ? (
              <KitFeature kit={selectedKit} eyebrow="Текущий комплект" />
            ) : character.kit.trim() ? (
              <div className="inv-kit-custom">
                <span className="eyebrow">Свой комплект</span>
                <h3>{character.kit}</h3>
                <p>
                  Этого комплекта нет в справочнике. Снаряжение и бонусы можно
                  записать в «Эффектах снаряжения».
                </p>
              </div>
            ) : (
              <p className="inv-kit-hint">
                Комплект задаёт снаряжение и бонусы героя. Выберите готовый
                комплект из справочника или впишите свой.
              </p>
            )}
          </div>

          {isTactician && (
            <div className="inv-kit-column">
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

              {secondaryKit ? (
                <KitFeature kit={secondaryKit} eyebrow="Второй комплект" />
              ) : character.secondaryKit?.trim() ? (
                <div className="inv-kit-custom">
                  <span className="eyebrow">Второй комплект</span>
                  <h3>{character.secondaryKit}</h3>
                  <p>
                    Этого комплекта нет в справочнике. Выберите другой комплект
                    или оставьте только основной.
                  </p>
                </div>
              ) : (
                <p className="inv-kit-hint">
                  Второй комплект даёт Тактику запасной набор снаряжения и
                  профилей урона. Выберите его из справочника.
                </p>
              )}

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
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Снаряжение" icon="sword">
        <div className="inv-equipment">
          {hasConditionalEquipmentOption && (
            <FeatureEquipmentFields
              value={character.automation?.equipment}
              hasKit={Boolean(
                character.kit.trim() || character.secondaryKit?.trim(),
              )}
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

          <div className="inv-equipment-fields">
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
            <Field label="Эффекты снаряжения" className="inv-effects-field">
              <TextArea
                className="inv-effects"
                value={character.equipmentEffects}
                rows={5}
                placeholder="Напр.: +5 выносливости, скорость 6, урон +2, дистанция +1, отход 2"
                onChange={(e) => patch({ equipmentEffects: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </Panel>

      <Panel
        title="Инвентарь"
        icon="inventory"
        dense
        actions={
          <>
            <a className="inv-catalog-link" href="#/catalog/treasure">
              Каталог наград ↗
            </a>
            <Button size="sm" variant="soft" icon="plus" onClick={openCreate}>
              Добавить
            </Button>
          </>
        }
      >
        {character.inventory.length === 0 ? (
          <EmptyState
            icon="inventory"
            title="Сумка пуста"
            text="Добавьте снаряжение, расходники или награды из каталога."
            action={
              <Button variant="primary" icon="plus" onClick={openCreate}>
                Добавить предмет
              </Button>
            }
          />
        ) : (
          <div className="inv-groups">
            {grouped.map((group) => {
              if (group.items.length === 0) return null;
              return (
                <section
                  key={group.key}
                  className="inv-group"
                  data-category={group.key}
                  aria-label={group.label}
                >
                  <header className="inv-group-head">
                    <h3>{group.label}</h3>
                    <span className="inv-group-count numeric">
                      {group.items.length}
                    </span>
                    <span className="inv-group-rule" />
                    {group.key === "treasure" && treasureCount > 3 && (
                      <Chip
                        tone="yellow"
                        title="Правила советуют нести не больше трёх сокровищ"
                      >
                        <Icon name="warning" size={13} /> безопасно нести три
                      </Chip>
                    )}
                  </header>
                  <div className="inv-card-grid">
                    {group.items.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onEdit={() => openEdit(item)}
                        onQty={(qty) => changeQty(item, qty)}
                        onEquip={() =>
                          patchItem(item.id, { equipped: !item.equipped })
                        }
                        onUse={() => useConsumable(item)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </Panel>

      <Modal
        open={dialogOpen}
        onClose={closeDialog}
        title={editing ? "Изменить предмет" : "Новый предмет"}
        footer={
          <>
            {editing && (
              <Button
                variant="danger"
                icon="trash"
                onClick={() => askDelete(editing)}
              >
                Удалить
              </Button>
            )}
            <span className="grow" />
            <Button variant="ghost" onClick={closeDialog}>
              Отмена
            </Button>
            <Button
              variant="primary"
              icon={editing ? "check" : "plus"}
              disabled={!draft.name.trim()}
              onClick={saveItem}
            >
              {editing ? "Сохранить" : "Добавить"}
            </Button>
          </>
        }
      >
        <div className="inv-item-form">
          <Field label="Название" className="inv-field-wide">
            <TextInput
              autoFocus
              value={draft.name}
              placeholder="Напр.: Верёвка, 15 м"
              aria-label="Название предмета"
              onChange={(e) =>
                setDraft((current) => ({ ...current, name: e.target.value }))
              }
              onKeyDown={onNameKeyDown}
            />
          </Field>
          <Field label="Категория">
            <Select
              value={draft.category}
              aria-label="Категория предмета"
              onChange={(e) =>
                setDraft((current) => ({
                  ...current,
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
          </Field>
          <Field label="Количество">
            <NumberInput
              value={draft.qty}
              min={1}
              label="Количество"
              onChange={(qty) =>
                setDraft((current) => ({ ...current, qty }))
              }
            />
          </Field>
          <Field label="Заметка" className="inv-field-wide">
            <TextArea
              value={draft.notes}
              rows={3}
              placeholder="Свойства, стоимость или напоминание"
              aria-label="Заметка о предмете"
              onChange={(e) =>
                setDraft((current) => ({ ...current, notes: e.target.value }))
              }
            />
          </Field>
        </div>

        {editing?.catalogId && (
          <a className="inv-item-rules" href={catalogHref(editing)}>
            Открыть описание в каталоге ↗
          </a>
        )}

        {!editing && (
          <div className="inv-presets">
            <span className="eyebrow">Заготовки</span>
            <div className="inv-preset-list">
              {PRESETS.map((preset) => (
                <Chip key={preset.name} onClick={() => applyPreset(preset)}>
                  {preset.name}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </Modal>

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
