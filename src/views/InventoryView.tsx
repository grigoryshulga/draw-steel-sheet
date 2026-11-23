import { lazy, Suspense, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { addCatalogEntry } from "../lib/catalog-character";
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
  kitBonusLabel,
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
  const [rulesOpen, setRulesOpen] = useState(false);
  const entry = catalogSectionEntries("kits").find((item) => item.name === kit.name);
  return (
    <>
      {!!kit.variants?.length && <p className="inv-kit-hint">Выберите конкретный комплект: {kit.variants.map((variant) => variant.name).join(", ")}. Бонусы зависят от этого выбора.</p>}
      {kit.animalForm && <p>Форма животного: {kit.animalForm}</p>}
      {kit.storm && <p>Первозданный шторм: {kit.storm} · {kit.damageType}</p>}
      <p className="inv-kit-equipment">{kit.equipment}</p>
      {showBonuses && <div className="inv-kit-bonuses">
        {kit.bonuses.map((bonus) => (
          <Chip key={`${bonus.label}-${bonus.value}`} tone="accent">
            {kitBonusLabel(bonus.label)} {bonus.value}
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
            aria-label={`Открыть знаковую способность: ${kit.signatureAbility}`}
            onClick={onOpenSignature}
          >
            {kit.signatureAbility}
          </Button>
        )}
        {entry && <Button size="sm" variant="ghost" icon="book" iconOnly aria-label={`Правила комплекта «${kit.name}»`}
          title={`Правила комплекта «${kit.name}»`} onClick={() => setRulesOpen(true)} />}
        {children}
      </div>
      {rulesOpen && entry?.articleId && <CardDetailModal open onClose={() => setRulesOpen(false)} title={kit.name} wide>
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

      {item.notes && <div className="inv-card-notes"><MarkdownPreview text={item.notes} /></div>}
      {!!item.abilityIds?.length && <p className="small muted">Способностей от предмета: {item.abilityIds.length}</p>}
      <ItemEffectsSummary effects={item.effects ?? []} />

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
          {(item.category === "gear" || !!item.abilityIds?.length || (item.category === "treasure" && normalizeItemEffects(item.effects).length > 0)) && (
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
    { secondary: false, name: character.kit, kit: selectedKit, label: isTactician ? "Первый комплект" : "Комплект" },
    ...(isTactician ? [{ secondary: true, name: character.secondaryKit ?? "", kit: secondaryKit, label: "Второй комплект" }] : []),
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
      notify("Предмет обновлён", "success");
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
        title="Инвентарь"
        icon="inventory"
        dense
        actions={
          <>
            <a className="inv-catalog-link" href="#/catalog/treasure">
              Каталог наград ↗
            </a>
            <Button size="sm" variant="soft" icon="plus" onClick={() => setCatalogOpen(true)}>Добавить предмет</Button>
          </>
        }
      >
        <p>Бонусы надетых предметов применяются при включённом автоматическом расчёте.</p>
        {character.inventory.length === 0 ? (
          <EmptyState
            icon="inventory"
            title="Сумка пуста"
            text="Добавьте снаряжение, расходники или награды из каталога."
            action={
              <Button variant="primary" icon="plus" onClick={() => setCatalogOpen(true)}>
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

      <section className="inv-configuration">
        <h3>Комплект и настройки снаряжения{character.kit ? ` · ${character.kit}` : ""}</h3>
      <Panel
        title={isTactician ? "Полевой арсенал" : "Комплект"}
        icon="sword"
        bodyClassName={`inv-loadout${isTactician ? " is-paired" : ""}`}
        actions={isTactician && !character.automation?.enabled ? <Chip>Авторасчёт выключен</Chip> : undefined}
      >
        <div className="inv-kit-grid">
          {kitSlots.map((slot) => {
            const kit = slot.kit;
            const manualControl = (
              <Button variant="ghost" size="sm" icon="edit" aria-label={`Свой комплект: ${slot.label.toLowerCase()}`}
                onClick={() => setManualKit({ name: slot.name, secondary: slot.secondary })}>Свой комплект</Button>
            );
            return (
            <article className="inv-kit-column" key={slot.label}>
              <header className="inv-kit-slot-head">
                <div className="inv-kit-feature-name">
                  <span className="eyebrow">{slot.label}</span>
                  <h3>{kit?.name || slot.name.trim() || "Не выбран"}</h3>
                </div>
                <Button
                  size="sm"
                  variant="soft"
                  icon="book"
                  aria-label={`${slot.name ? "Сменить" : "Выбрать"}: ${slot.label.toLowerCase()}`}
                  onClick={() => setKitPickerTarget(slot.secondary ? "secondary" : "primary")}
                >
                  {slot.name ? "Сменить" : "Выбрать"}
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

      </section>

      <Modal
        open={dialogOpen}
        wide
        onClose={closeDialog}
        title={editing ? "Изменить предмет" : "Новый предмет"}
        footer={
          <>
            {editing && (
              <Button
                variant="danger"
                icon="trash"
                iconOnly
                aria-label={`Удалить предмет: ${editing.name || "без названия"}`}
                title="Удалить предмет"
                onClick={() => askDelete(editing)}
              />
            )}
            <span className="grow" />
            <Button variant="ghost" icon="close" iconOnly aria-label="Закрыть редактор предмета" title="Закрыть" onClick={closeDialog} />
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
              rows={10}
              placeholder="Свойства, стоимость или напоминание"
              aria-label="Заметка о предмете"
              onChange={(e) =>
                setDraft((current) => ({ ...current, notes: e.target.value }))
              }
            />
          </Field>
        </div>

        <Field label="Бонусы предмета">
          <ItemEffectsEditor effects={draft.effects} onChange={(effects) => setDraft((current) => ({ ...current, effects }))} />
        </Field>
        <ItemAbilitiesEditor value={draft.abilityIds} onChange={(abilityIds) => setDraft(current => ({ ...current, abilityIds }))} />

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
            <Button variant="ghost" icon="close" iconOnly aria-label="Отменить удаление предмета" title="Оставить предмет" onClick={() => setPendingDelete(null)} />
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

      {catalogOpen && <Suspense fallback={null}><InventoryCatalogPicker onClose={() => setCatalogOpen(false)} onCreate={() => { setCatalogOpen(false); openCreate(); }} onAdd={(entry) => {
        update(current => addCatalogEntry(current, entry, makeId()));
        notify(`Добавлено: ${entry.name}`, "success");
      }} /></Suspense>}

      {kitPickerTarget && (
        <KitPicker
          open
          character={character}
          secondary={kitPickerTarget === "secondary"}
          title={isTactician ? kitPickerTarget === "secondary" ? "Второй комплект" : "Первый комплект" : "Комплекты"}
          onClose={() => setKitPickerTarget(null)}
          onSelect={(kit) => {
            if (applyKit(kit.name, kitPickerTarget === "secondary")) {
              setKitPickerTarget(null);
              notify(`Комплект «${kit.name}» выбран`, "success");
            }
          }}
        />
      )}
      {manualKit && <CardDetailModal open title="Свой комплект" onClose={() => setManualKit(null)} footer={<>
        <Button variant="ghost" onClick={() => setManualKit(null)}>Отмена</Button>
        <Button variant="primary" onClick={() => { if (applyKit(manualKit.name, manualKit.secondary)) setManualKit(null); }}>Сохранить</Button>
      </>}>
        <Field label="Название комплекта"><TextInput value={manualKit.name} aria-label="Название своего комплекта"
          onChange={(event) => setManualKit({ ...manualKit, name: event.target.value })} /></Field>
      </CardDetailModal>}
      <CardDetailModal
        open={kitAbility !== null}
        onClose={() => setKitAbility(null)}
        title={kitAbility?.name ?? "Знаковая способность"}
        source={kitAbility?.source}
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
