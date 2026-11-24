import { useLocale } from "../i18n/locale";
import { lazy, Suspense, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { addCatalogEntry } from "../lib/catalog-character";
import { inventoryItemName } from "../lib/inventory-display";
import { kitDisplayName, kitDisplayBonus, kitDisplayEquipment, kitDisplaySignature, kitDisplayStorm, kitDisplayValue } from "../lib/kit-display";
import { ItemAbilitiesEditor } from "../components/ItemAbilitiesEditor";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { RuleArticleReader } from "../components/rules/RuleArticleReader";
import { catalogSectionEntries } from "../data/reference-catalog";
import { ItemEffectsEditor, ItemEffectsSummary } from "../components/ItemEffectsEditor";
import { normalizeItemEffects } from "../lib/item-effects";
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
  kitByName,
  type Kit,
} from "../data/kits";
import { featureEquipmentRequirements } from "../lib/feature-equipment-requirements";
import { changeKit, characterKitSlot, kitSignatureAbility } from "../lib/equipment";
import { KitBonuses } from "../components/KitBonuses";
import { AbilityCardContent } from "../components/AbilityCard";
import { CalculationToggle } from "../components/rules/CalculationInline";
import { CardDetailModal } from "../components/CardDetailModal";
import { FeatureEquipmentFields } from "../components/FeatureEquipmentFields";
import { KitPicker } from "./sheet/KitPicker";
import { useApp } from "../state/AppContext";
import type { Ability, InventoryItem, ItemCategory, ItemEffect } from "../types";
import "./InventoryView.css";

const InventoryCatalogPicker = lazy(() => import("./InventoryCatalogPicker").then(module => ({ default: module.InventoryCatalogPicker })));

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
  effects: ItemEffect[];
  abilityIds: string[];
}

const EMPTY_DRAFT: ItemDraft = {
  name: "",
  category: "consumable",
  qty: 1,
  notes: "",
  effects: [],
  abilityIds: [],
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

function KitFeature({ kit, showBonuses, onOpenSignature, children }: {
  kit: Kit;
  showBonuses: boolean;
  onOpenSignature: () => void;
  children: ReactNode;
}) {
  const { locale, t } = useLocale();
  const signature = kitDisplaySignature(kit, locale);
  const [animal, storm, damage] = kitDisplayStorm(kit, locale);
  const [rulesOpen, setRulesOpen] = useState(false);
  const entry = catalogSectionEntries("kits").find((item) => item.name === kit.name);
  return (
    <>
      {!!kit.variants?.length && <p className="inv-kit-hint">{t("Выберите конкретный комплект", "Choose a specific kit")}: {kit.variants.map((variant) => kitDisplayName(variant.name, locale)).join(", ")}. {t("Бонусы зависят от этого выбора.", "Bonuses depend on this choice.")}</p>}
      {kit.animalForm && <p>{t("Форма животного", "Animal form")}: {animal}</p>}
      {kit.storm && <p>{t("Первозданный шторм", "Primordial storm")}: {storm} · {damage}</p>}
      <p className="inv-kit-equipment">{kitDisplayEquipment(kit, locale)}</p>
      {showBonuses && <div className="inv-kit-bonuses">
        {kit.bonuses.map((bonus) => (
          <Chip key={`${bonus.label}-${bonus.value}`} tone="accent">
            {kitDisplayBonus(bonus.label, locale)} {kitDisplayValue(bonus.value, locale)}
          </Chip>
        ))}
      </div>}
      <div className="inv-kit-card-footer">
        {kit.signatureAbility && (
          <Button
            variant="ghost"
            size="sm"
            icon="sword"
            className="inv-kit-signature"
            aria-label={t(`Открыть знаковую способность: ${signature}`, `Open signature ability: ${signature}`)}
            onClick={onOpenSignature}
          >
            {signature}
          </Button>
        )}
        {entry && <Button size="sm" variant="ghost" icon="book" iconOnly aria-label={t(`Правила комплекта «${kit.name}»`, `Kit rules: ${kitDisplayName(kit.name, locale)}`)}
          title={t(`Правила комплекта «${kit.name}»`, `Kit rules: ${kitDisplayName(kit.name, locale)}`)} onClick={() => setRulesOpen(true)} />}
        {children}
      </div>
      {rulesOpen && entry?.articleId && <CardDetailModal open onClose={() => setRulesOpen(false)} title={kitDisplayName(kit.name, locale)} wide>
        <RuleArticleReader articleId={entry.articleId} entityName={entry.entityName} />
      </CardDetailModal>}
    </>
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
  const { locale, t } = useLocale();
  const displayName = inventoryItemName(item, locale);
  return (
    <article className={`inv-card${item.equipped ? " is-equipped" : ""}`}>
      <header className="inv-card-head">
        <h4>{displayName || t("Без названия", "Untitled")}</h4>
        <Button
          size="sm"
          variant="ghost"
          icon="edit"
          iconOnly
          aria-label={t(`Изменить: ${displayName || "предмет"}`, `Edit: ${displayName || "item"}`)}
          title={t("Изменить предмет", "Edit item")}
          onClick={onEdit}
        />
      </header>

      {item.notes && <div className="inv-card-notes"><MarkdownPreview text={item.notes} /></div>}
      {!!item.abilityIds?.length && <p className="small muted">{t("Способностей от предмета", "Item abilities")}: {item.abilityIds.length}</p>}
      <ItemEffectsSummary effects={item.effects ?? []} />

      <footer className="inv-card-foot">
        <Stepper
          value={item.qty}
          min={0}
          label={t(`Количество: ${displayName}`, `Quantity: ${displayName}`)}
          onChange={onQty}
        />
        <div className="inv-card-actions">
          {item.catalogId && (
            <a className="inv-card-rules" href={catalogHref(item)}>
              {t("Правила ↗", "Rules ↗")}
            </a>
          )}
          {(item.category === "gear" || !!item.abilityIds?.length || (item.category === "treasure" && normalizeItemEffects(item.effects).length > 0)) && (
            <Chip
              tone={item.equipped ? "green" : "default"}
              active={item.equipped}
              title={item.equipped ? t("Снять предмет", "Unequip item") : t("Отметить как надетое", "Mark as equipped")}
              onClick={onEquip}
            >
              {item.equipped ? t("Надето", "Equipped") : t("Надеть", "Equip")}
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
              {t("Использовать", "Use")}
            </Button>
          )}
        </div>
      </footer>
    </article>
  );
}

export function InventoryView() {
  const { locale, t } = useLocale();
  const categoryName = (key: ItemCategory) => locale === "en" ? ({ gear: "Equipment", consumable: "Consumables", treasure: "Treasures", trinket: "Trinkets", title: "Titles" } as const)[key] : CATEGORY_LABEL[key];
  const { character, update, patch, notify } = useApp();

  const [draft, setDraft] = useState<ItemDraft>(EMPTY_DRAFT);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [kitPickerTarget, setKitPickerTarget] = useState<"primary" | "secondary" | null>(null);
  const [manualKit, setManualKit] = useState<{ name: string; secondary: boolean } | null>(null);
  const [kitAbility, setKitAbility] = useState<Ability | null>(null);
  const [showKitCalculations, setShowKitCalculations] = useState(false);
  const selectedKit = kitByName(character.kit);
  const secondaryKit = kitByName(character.secondaryKit ?? "");
  const isTactician = character.className === "Тактик";
  const kitSlots = [
    { secondary: false, name: character.kit, kit: selectedKit, label: isTactician ? t("Первый комплект", "First kit") : t("Комплект", "Kit") },
    ...(isTactician ? [{ secondary: true, name: character.secondaryKit ?? "", kit: secondaryKit, label: t("Второй комплект", "Second kit") }] : []),
  ];
  const openKitAbility = (kit: Kit) => {
    setShowKitCalculations(false);
    setKitAbility(character.abilities.find((ability) =>
      ability.source === `Комплект: ${kit.name}` && ability.name === kit.signatureAbility,
    ) ?? kitSignatureAbility(kit) ?? null);
  };
  const applyKit = (name: string, secondary: boolean) => {
    const issue = characterKitSlot(character, secondary).issue(kitByName(name));
    if (issue) {
      notify(issue, "error");
      return false;
    }
    update((current) => changeKit(current, name, secondary));
    return true;
  };
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
      effects: normalizeItemEffects(item.effects),
      abilityIds: item.abilityIds ?? [],
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
        effects: normalizeItemEffects(draft.effects),
        abilityIds: draft.abilityIds,
        equipped: draft.category === "gear" || draft.abilityIds.length > 0 || (draft.category === "treasure" && draft.effects.length > 0) ? editing.equipped : false,
      });
      notify(t("Предмет обновлён", "Item updated"), "success");
    } else {
      const item: InventoryItem = {
        id: makeId(),
        name,
        category: draft.category,
        qty,
        notes,
        equipped: false,
        effects: normalizeItemEffects(draft.effects),
        abilityIds: draft.abilityIds,
      };
      update((c) => ({ ...c, inventory: [...c.inventory, item] }));
      notify(t("Предмет добавлен", "Item added"), "success");
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
      notify(t(`Использовано: ${item.name}`, `Used: ${inventoryItemName(item, locale)}`), "info");
    }
  };

  const removeItem = (id: string) => {
    update((c) => ({
      ...c,
      inventory: c.inventory.filter((item) => item.id !== id),
    }));
    setPendingDelete(null);
    closeDialog();
    notify(t("Предмет удалён", "Item removed"), "info");
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
      effects: [],
      abilityIds: [],
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
        title={t("Инвентарь", "Inventory")}
        icon="inventory"
        dense
        actions={
          <>
            <a className="inv-catalog-link" href="#/catalog/treasure">
              {t("Каталог наград ↗", "Rewards catalog ↗")}
            </a>
            <Button size="sm" variant="soft" icon="plus" onClick={() => setCatalogOpen(true)}>{t("Добавить предмет", "Add item")}</Button>
          </>
        }
      >
        <p>{t("Бонусы надетых предметов применяются при включённом автоматическом расчёте.", "Equipped item bonuses apply when automatic calculation is enabled.")}</p>
        {character.inventory.length === 0 ? (
          <EmptyState
            icon="inventory"
            title={t("Сумка пуста", "Your bag is empty")}
            text={t("Добавьте снаряжение, расходники или награды из каталога.", "Add equipment, consumables, or rewards from the catalog.")}
            action={
              <Button variant="primary" icon="plus" onClick={() => setCatalogOpen(true)}>
                {t("Добавить предмет", "Add item")}
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
                  aria-label={categoryName(group.key)}
                >
                  <header className="inv-group-head">
                    <h3>{categoryName(group.key)}</h3>
                    <span className="inv-group-count numeric">
                      {group.items.length}
                    </span>
                    <span className="inv-group-rule" />
                    {group.key === "treasure" && treasureCount > 3 && (
                      <Chip
                        tone="yellow"
                        title={t("Правила советуют нести не больше трёх сокровищ", "The rules recommend carrying no more than three treasures")}
                      >
                        <Icon name="warning" size={13} /> {t("безопасно нести три", "safe to carry three")}
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

      <section className="inv-configuration">
        <h3>{t("Комплект и настройки снаряжения", "Kit and equipment settings")}{character.kit ? ` · ${kitDisplayName(character.kit, locale)}` : ""}</h3>
      <Panel
        title={isTactician ? t("Полевой арсенал", "Field arsenal") : t("Комплект", "Kit")}
        icon="sword"
        bodyClassName={`inv-loadout${isTactician ? " is-paired" : ""}`}
        actions={isTactician && !character.automation?.enabled ? <Chip>{t("Авторасчёт выключен", "Automatic calculation off")}</Chip> : undefined}
      >
        <div className="inv-kit-grid">
          {kitSlots.map((slot) => {
            const kit = slot.kit;
            const manualControl = (
              <Button variant="ghost" size="sm" icon="edit" aria-label={t(`Свой комплект: ${slot.label.toLowerCase()}`, `Custom kit: ${slot.label.toLowerCase()}`)}
                onClick={() => setManualKit({ name: slot.name, secondary: slot.secondary })}>{t("Свой комплект", "Custom kit")}</Button>
            );
            return (
            <article className="inv-kit-column" key={slot.label}>
              <header className="inv-kit-slot-head">
                <div className="inv-kit-feature-name">
                  <span className="eyebrow">{slot.label}</span>
                  <h3>{kit ? kitDisplayName(kit.name, locale) : slot.name.trim() || t("Не выбран", "Not selected")}</h3>
                </div>
                <Button
                  size="sm"
                  variant="soft"
                  icon="book"
                  aria-label={`${slot.name ? t("Сменить", "Change") : t("Выбрать", "Choose")}: ${slot.label.toLowerCase()}`}
                  onClick={() => setKitPickerTarget(slot.secondary ? "secondary" : "primary")}
                >
                  {slot.name ? t("Сменить", "Change") : t("Выбрать", "Choose")}
                </Button>
              </header>
              {kit ? (
                <KitFeature kit={kit} showBonuses={!isTactician} onOpenSignature={() => openKitAbility(kit)}>
                  {manualControl}
                </KitFeature>
              ) : (
                manualControl
              )}
            </article>
            );
          })}
        </div>
        {isTactician && (
          <KitBonuses
            loadout={character}
            level={character.level}
            onChange={(preferences) => update((current) => ({
              ...current,
              automation: {
                enabled: false, adjustments: {}, ancestryTraits: [],
                ...current.automation,
                ...preferences,
              },
            }))}
          />
        )}
      </Panel>

      <Panel title={t("Снаряжение", "Equipment")} icon="sword">
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
            <Field label={t("Оружие / реализация", "Weapon / implement")}>
              <TextInput
                value={character.weapon}
                placeholder={t("Напр.: длинный меч", "E.g. longsword")}
                onChange={(e) => patch({ weapon: e.target.value })}
              />
            </Field>
            <Field label={t("Доспех / оберег", "Armor / ward")}>
              <TextInput
                value={character.armor}
                placeholder={t("Напр.: кольчуга", "E.g. chainmail")}
                onChange={(e) => patch({ armor: e.target.value })}
              />
            </Field>
            <Field label={t("Эффекты снаряжения", "Equipment effects")} className="inv-effects-field">
              <TextArea
                className="inv-effects"
                value={character.equipmentEffects}
                rows={5}
                placeholder={t("Напр.: +5 выносливости, скорость 6, урон +2, дистанция +1, отход 2", "Describe equipment effects") }
                onChange={(e) => patch({ equipmentEffects: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </Panel>

      </section>

      <Modal
        open={dialogOpen}
        wide
        onClose={closeDialog}
        title={editing ? t("Изменить предмет", "Edit item") : t("Новый предмет", "New item")}
        footer={
          <>
            {editing && (
              <Button
                variant="danger"
                icon="trash"
                iconOnly
                aria-label={t(`Удалить предмет: ${inventoryItemName(editing, locale) || "без названия"}`, `Delete item: ${inventoryItemName(editing, locale) || "untitled"}`)}
                title={t("Удалить предмет", "Delete item")}
                onClick={() => askDelete(editing)}
              />
            )}
            <span className="grow" />
            <Button variant="ghost" icon="close" iconOnly aria-label={t("Закрыть редактор предмета", "Close item editor")} title={t("Закрыть", "Close")} onClick={closeDialog} />
            <Button
              variant="primary"
              icon={editing ? "check" : "plus"}
              disabled={!draft.name.trim()}
              onClick={saveItem}
            >
              {editing ? t("Сохранить", "Save") : t("Добавить", "Add")}
            </Button>
          </>
        }
      >
        <div className="inv-item-form">
          <Field label={t("Название", "Name")} className="inv-field-wide">
            <TextInput
              autoFocus
              value={draft.name}
              placeholder={t("Напр.: Верёвка, 15 м", "E.g. rope, 15 m")}
              aria-label={t("Название предмета", "Item name")}
              onChange={(e) =>
                setDraft((current) => ({ ...current, name: e.target.value }))
              }
              onKeyDown={onNameKeyDown}
            />
          </Field>
          <Field label={t("Категория", "Category")}>
            <Select
              value={draft.category}
              aria-label={t("Категория предмета", "Item category")}
              onChange={(e) =>
                setDraft((current) => ({
                  ...current,
                  category: e.target.value as ItemCategory,
                }))
              }
            >
              {CATEGORY_META.map((meta) => (
                <option key={meta.key} value={meta.key}>
                  {categoryName(meta.key)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("Количество", "Quantity")}>
            <NumberInput
              value={draft.qty}
              min={1}
              label={t("Количество", "Quantity")}
              onChange={(qty) =>
                setDraft((current) => ({ ...current, qty }))
              }
            />
          </Field>
          <Field label={t("Заметка", "Note")} className="inv-field-wide">
            <TextArea
              value={draft.notes}
              rows={10}
              placeholder={t("Свойства, стоимость или напоминание", "Properties, value, or a reminder")}
              aria-label={t("Заметка о предмете", "Item note")}
              onChange={(e) =>
                setDraft((current) => ({ ...current, notes: e.target.value }))
              }
            />
          </Field>
        </div>

        <Field label={t("Бонусы предмета", "Item bonuses")}>
          <ItemEffectsEditor effects={draft.effects} onChange={(effects) => setDraft((current) => ({ ...current, effects }))} />
        </Field>
        <ItemAbilitiesEditor value={draft.abilityIds} onChange={(abilityIds) => setDraft(current => ({ ...current, abilityIds }))} />

        {editing?.catalogId && (
          <a className="inv-item-rules" href={catalogHref(editing)}>
            {t("Открыть описание в каталоге ↗", "Open description in catalog ↗")}
          </a>
        )}

        {!editing && (
          <div className="inv-presets">
            <span className="eyebrow">{t("Заготовки", "Templates")}</span>
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
        title={t("Удалить предмет?", "Delete item?")}
        footer={
          <>
            <Button variant="ghost" icon="close" iconOnly aria-label={t("Отменить удаление предмета", "Cancel item deletion")} title={t("Оставить предмет", "Keep item")} onClick={() => setPendingDelete(null)} />
            <Button
              variant="danger"
              icon="trash"
              onClick={() => pendingDelete && removeItem(pendingDelete.item.id)}
            >
              {t("Удалить", "Delete")}
            </Button>
          </>
        }
      >
        <p>
          «{pendingDelete ? inventoryItemName(pendingDelete.item, locale) : ""}» —{" "}
          {pendingDelete
            ? categoryName(pendingDelete.item.category).toLowerCase()
            : ""}
          , {pendingDelete?.item.qty ?? 0} {t("шт.", "items")}{" "}
          {pendingDelete && t(DELETE_MESSAGES[pendingDelete.reason], ({ manual: "Delete this item from inventory?", empty: "The quantity is zero. Delete this item?", used: "This item is used up. Delete it?" } as const)[pendingDelete.reason])}
        </p>
      </Modal>

      {catalogOpen && <Suspense fallback={null}><InventoryCatalogPicker onClose={() => setCatalogOpen(false)} onCreate={() => { setCatalogOpen(false); openCreate(); }} onAdd={(entry) => {
        update(current => addCatalogEntry(current, entry, makeId()));
        notify(t(`Добавлено: ${entry.name}`, `Added: ${entry.originalName || entry.name}`), "success");
      }} /></Suspense>}

      {kitPickerTarget && (
        <KitPicker
          open
          character={character}
          secondary={kitPickerTarget === "secondary"}
          title={isTactician ? kitPickerTarget === "secondary" ? t("Второй комплект", "Second kit") : t("Первый комплект", "First kit") : t("Комплекты", "Kits")}
          onClose={() => setKitPickerTarget(null)}
          onSelect={(kit) => {
            if (applyKit(kit.name, kitPickerTarget === "secondary")) {
              setKitPickerTarget(null);
              notify(t(`Комплект «${kit.name}» выбран`, `Selected kit “${kit.name}”`), "success");
            }
          }}
        />
      )}
      {manualKit && <CardDetailModal open title={t("Свой комплект", "Custom kit")} onClose={() => setManualKit(null)} footer={<>
        <Button variant="ghost" onClick={() => setManualKit(null)}>{t("Отмена", "Cancel")}</Button>
        <Button variant="primary" onClick={() => { if (applyKit(manualKit.name, manualKit.secondary)) setManualKit(null); }}>{t("Сохранить", "Save")}</Button>
      </>}>
        <Field label={t("Название комплекта", "Kit name")}><TextInput value={manualKit.name} aria-label={t("Название своего комплекта", "Custom kit name")}
          onChange={(event) => setManualKit({ ...manualKit, name: event.target.value })} /></Field>
      </CardDetailModal>}
      <CardDetailModal
        open={kitAbility !== null}
        onClose={() => setKitAbility(null)}
        title={kitAbility && kitByName(kitAbility.source.replace(/^Комплект: /, "")) ? kitDisplaySignature(kitByName(kitAbility.source.replace(/^Комплект: /, ""))!, locale) : kitAbility?.name ?? t("Знаковая способность", "Signature ability")}
        source={kitAbility?.source.startsWith("Комплект: ") ? t(kitAbility.source, `Kit: ${kitDisplayName(kitAbility.source.slice(10), locale)}`) : kitAbility?.source}
        footer={kitAbility ? <>
          <CalculationToggle checked={showKitCalculations} onChange={setShowKitCalculations} />
          <span className="grow" />
        </> : undefined}
      >
        {kitAbility && <AbilityCardContent ability={kitAbility} character={character} showCalculations={showKitCalculations} />}
      </CardDetailModal>
    </div>
  );
}
