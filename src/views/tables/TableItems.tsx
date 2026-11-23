import { useEffect, useState } from "react";
import { CardDetailModal } from "../../components/CardDetailModal";
import { TableLibrary } from "./TableLibrary";
import { Button, Card, Select } from "../../components/ui";
import {
  ItemEffectsEditor,
  ItemEffectsSummary,
} from "../../components/ItemEffectsEditor";
import { MarkdownPreview } from "../../components/MarkdownPreview";
import { MarkdownEditor } from "../../components/MarkdownEditor";
import { ItemAbilitiesEditor } from "../../components/ItemAbilitiesEditor";
import { CATALOG } from "../../data/library";
import { loadCharacter } from "../../lib/api";
import type { Character, InventoryItem } from "../../types";
import type { DirectorTemplate, TableSnapshot } from "../../lib/tables/types";
import type { SendTableCommand } from "./TableMembers";

const CATEGORY_NAMES: Record<InventoryItem["category"], string> = {
  gear: "Снаряжение",
  consumable: "Расходник",
  treasure: "Сокровище",
  trinket: "Безделушка",
  title: "Титул",
};
const emptyItem = (): InventoryItem => ({
  id: crypto.randomUUID(),
  name: "",
  category: "gear",
  qty: 1,
  notes: "",
  equipped: false,
});
function inventoryFrom(value: unknown): InventoryItem[] {
  if (Array.isArray(value)) return value as InventoryItem[];
  if (
    value &&
    typeof value === "object" &&
    "inventory" in value &&
    Array.isArray(value.inventory)
  )
    return value.inventory as InventoryItem[];
  return [];
}

function TradeItemPicker({ label, placeholder, inventory, quantities, onChange }: {
  label: string;
  placeholder: string;
  inventory: InventoryItem[];
  quantities: Record<string, number>;
  onChange: (quantities: Record<string, number>) => void;
}) {
  const choices = inventory.filter(item => item.qty > 0 && !Object.hasOwn(quantities, item.id));
  const selected = inventory.filter(item => item.qty > 0 && Object.hasOwn(quantities, item.id));
  return <div className="table-trade-picker">
    <label>
      {label}
      <Select value="" disabled={!choices.length || selected.length >= 100} onChange={event => {
        const id = event.currentTarget.value;
        if (id) onChange({ ...quantities, [id]: 1 });
      }}>
        <option value="">{selected.length ? "Добавить предмет" : placeholder}</option>
        {choices.map(item => <option key={item.id} value={item.id}>{item.name} · {item.qty} шт.</option>)}
      </Select>
    </label>
    {selected.length > 0 && <ul className="table-trade-picks">
      {selected.map(item => <li key={item.id} className="table-trade-pick">
        <span>{item.name}</span>
        <input className="input" type="number" min={1} max={item.qty} step={1} required
          value={quantities[item.id] || ""} aria-label={`Количество: ${item.name}`}
          onChange={event => onChange({ ...quantities, [item.id]: event.currentTarget.valueAsNumber || 0 })} />
        <Button size="sm" icon="close" iconOnly variant="ghost" onClick={() => {
          const remaining = { ...quantities };
          delete remaining[item.id];
          onChange(remaining);
        }}>{`Убрать из предложения: ${item.name}`}</Button>
      </li>)}
    </ul>}
  </div>;
}

const tradeSelection = (inventory: InventoryItem[], quantities: Record<string, number>) =>
  inventory.filter(item => item.qty > 0 && quantities[item.id] > 0)
    .map(item => ({ itemId: item.id, qty: quantities[item.id] }));

export function TableItems({
  table,
  templates,
  busy,
  command,
  saveTemplate,
  refreshHero,
  commandError = "",
}: {
  table: TableSnapshot;
  templates: DirectorTemplate[];
  busy: boolean;
  command: SendTableCommand;
  saveTemplate: (template: DirectorTemplate) => Promise<void>;
  refreshHero: () => Promise<void>;
  commandError?: string;
}) {
  const director = table.actorId === table.ownerId;
  const [tab, setTab] = useState<"offers" | "templates">("offers");
  const showingOffers = !director || tab === "offers";
  const acceptedIds = new Set(table.offers.flatMap(offer =>
    offer.status === "accepted" && offer.fromUserId === table.actorId && offer.templateId
      ? [offer.templateId]
      : [],
  ));
  const [composing, setComposing] = useState(false);
  const [tradingHeroId, setTradingHeroId] = useState<string | null>(null);
  const [tradeDetails, setTradeDetails] = useState<TableSnapshot["trades"][number] | null>(null);
  const [details, setDetails] = useState<InventoryItem | null>(null);
  const [item, setItem] = useState(emptyItem);
  const [templateId, setTemplateId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [loadedHero, setOwn] = useState<Character | null>(null);
  const [target, setTarget] = useState<{ userId: string; heroId: string } | null>(null);
  const [offered, setOffered] = useState<Record<string, number>>({});
  const [requested, setRequested] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const me = table.members.find((m) => m.userId === table.actorId);
  const own = loadedHero?.id === me?.hero?.id ? loadedHero : null;
  const trading = tradingHeroId !== null && tradingHeroId === own?.id;
  const recipients = table.members.filter(member => member.role === "player" && member.userId !== table.actorId && member.hero);
  const targetMember = recipients.find(member => member.userId === target?.userId && member.hero?.id === target.heroId);
  const targetItems = inventoryFrom(targetMember?.hero?.sections.inventory);
  const offeredItems = tradeSelection(own?.inventory ?? [], offered);
  const requestedItems = tradeSelection(targetItems, requested);
  const templateEffectsChanged =
    Boolean(templateId) &&
    JSON.stringify(item.effects ?? []) !==
      JSON.stringify(
        templates.find((t) => t.id === templateId)?.item?.effects ?? [],
      );
  useEffect(() => {
    let active = true;
    if (me?.hero)
      void loadCharacter(me.hero.id)
        .then((c) => {
          if (active) setOwn(c);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [me?.hero?.id, table.revision]);
  async function send(type: string, payload: Record<string, unknown>) {
    setError("");
    const result = await command(type, payload);
    if (result) await refreshHero().catch((e) => setError(e.message));
    return result;
  }
  return (
    <section className="table-stack table-items-panel">
      <div className="table-section-heading">
        <h2>Предметы и обмен</h2>
        <div className="table-actions">
          {director && <Button icon="plus" variant="primary" disabled={busy || table.archived} onClick={() => { setTemplateId(""); setItem(emptyItem()); setComposing(true); }}>{table.members.some((m) => m.hero) ? "Предложить предмет" : "Создать предмет"}</Button>}
          {!director && own && <Button icon="plus" disabled={busy || table.archived} onClick={() => {
            setTarget(null);
            setOffered({});
            setRequested({});
            setTradingHeroId(own.id);
          }}>Подарить или обменять</Button>}
        </div>
      </div>
      {director && <div className="table-filter-bar" role="group" aria-label="Разделы предметов">
        <button type="button" aria-pressed={showingOffers} onClick={() => setTab("offers")}>Предложения</button>
        <button type="button" aria-pressed={!showingOffers} onClick={() => setTab("templates")}>Заготовки</button>
      </div>}
      {error && !composing && !trading && <p role="alert">{error}</p>}
      {table.archived && (
        <p className="table-notice">
          Предложения и обмен приостановлены до восстановления стола.
        </p>
      )}
      {director && (
        <CardDetailModal open={composing} onClose={() => setComposing(false)} title={table.members.some((m) => m.hero) ? "Предложить предмет" : "Создать предмет"} className="table-dialog table-item-composer" wide>
          <section className="table-stack">
            {(error || commandError) && <p role="alert">{error || commandError}</p>}
            <fieldset disabled={busy || table.archived}>
              <label>
                Получатель
                <select
                  className="select"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                >
                  <option value="">Выберите героя</option>
                  {table.members
                    .filter((m) => m.hero)
                    .map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.hero!.name} · {m.name}
                      </option>
                    ))}
                </select>
              </label>
              {!table.members.some((m) => m.hero) && (
                <p className="muted">
                  Для предложения нужен участник с активным героем. Пока можно
                  сохранить заготовку.
                </p>
              )}
              <section className="table-disclosure">
                <h3>Взять из каталога</h3>
                <label>
                  Поиск сокровища
                  <input
                    className="input"
                    type="search"
                    value={catalogQuery}
                    onChange={(e) => setCatalogQuery(e.target.value)}
                  />
                </label>
                {catalogQuery.trim() &&
                  CATALOG.filter(
                    (entry) =>
                      entry.kind === "treasure" &&
                      `${entry.name} ${entry.originalName ?? ""}`
                        .toLocaleLowerCase("ru")
                        .includes(catalogQuery.trim().toLocaleLowerCase("ru")),
                  )
                    .slice(0, 20)
                    .map((entry) => (
                      <Button
                        key={entry.id}
                        onClick={() => {
                          setTemplateId("");
                          setItem({
                            ...emptyItem(),
                            name: entry.name,
                            catalogId: entry.id,
                            category: entry.category === "Расходуемые" ? "consumable" : entry.category === "Безделушки" ? "trinket" : "treasure",
                            notes: entry.markdown,
                          });
                          setCatalogQuery("");
                        }}
                      >
                        {entry.name}
                      </Button>
                    ))}
              </section>
              <div className="table-form-grid table-item-fields">
                <label>
                  Название
                  <input
                    className="input"
                    maxLength={200}
                    value={item.name}
                    onChange={(e) => setItem({ ...item, name: e.target.value })}
                  />
                </label>
                <label>
                  Категория
                  <select
                    className="select"
                    value={item.category}
                    onChange={(e) =>
                      setItem({
                        ...item,
                        category: e.target.value as InventoryItem["category"],
                      })
                    }
                  >
                    {Object.entries(CATEGORY_NAMES).map(([value, name]) => (
                      <option key={value} value={value}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Количество
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={9999}
                    value={item.qty}
                    onChange={(e) =>
                      setItem({
                        ...item,
                        qty: Math.max(1, Math.floor(Number(e.target.value))),
                      })
                    }
                  />
                </label>
              </div>
              <div className="field">
                <span className="field-label">Описание</span>
                <MarkdownEditor
                  disabled={busy || table.archived}
                  aria-label="Описание предмета"
                  value={item.notes}
                  onChange={(notes) => setItem({ ...item, notes })}
                />
              </div>
              <ItemAbilitiesEditor value={item.abilityIds} onChange={(abilityIds) => setItem({ ...item, abilityIds })} disabled={busy} />
              <section className="table-disclosure">
                <h3>
                  Бонусы при экипировке{" "}
                  <span className="table-badge">
                    {item.effects?.length ?? 0}
                  </span>
                </h3>
                <ItemEffectsEditor
                  effects={item.effects ?? []}
                  onChange={(effects) => setItem({ ...item, effects })}
                  disabled={busy}
                />
                <p className="muted">
                  Бонусы действуют после экипировки при включённом авторасчёте
                  листа.
                </p>
              </section>
              {templateEffectsChanged && (
                <p role="status">
                  Бонусы заготовки изменены. Сохраните её перед отправкой
                  предложения; ожидающие предложения получат новую версию
                  эффектов.
                </p>
              )}
              <div className="table-actions">
                <Button
                  icon="bookmark"
                  disabled={!item.name.trim()}
                  onClick={async () => {
                    const id = templateId || crypto.randomUUID();
                    try {
                      await saveTemplate({
                        id,
                        name: item.name,
                        kind: "item",
                        item,
                        version:
                          templates.find((t) => t.id === templateId)?.version ??
                          0,
                      });
                      setTemplateId(id);
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Не удалось сохранить заготовку",
                      );
                    }
                  }}
                >
                  Сохранить заготовку
                </Button>
                <Button
                  variant="primary"
                  disabled={
                    !recipient || !item.name.trim() || templateEffectsChanged
                  }
                  onClick={async () => {
                    const member = table.members.find(
                      (m) => m.userId === recipient,
                    );
                    if (member?.hero && await command("offer-item", {
                        heroId: member.hero.id,
                        toUserId: recipient,
                        item,
                        ...(templateId ? { templateId } : {}),
                      })) {
                      setTab("offers");
                      setComposing(false);
                    }
                  }}
                >
                  Предложить
                </Button>
              </div>
            </fieldset>
          </section>
        </CardDetailModal>
      )}
      {showingOffers && table.offers.length === 0 && table.trades.length === 0 && (
        <p className="table-empty">
          {director
            ? "Предложите предмет герою. Он появится в инвентаре после согласия игрока."
            : "Здесь появятся предложения предметов и обмена."}
        </p>
      )}
      {showingOffers && table.offers.length > 0 && <div className="table-card-grid">
        {[...table.offers]
          .sort(
            (a, b) =>
              Number(b.status === "pending") - Number(a.status === "pending"),
          )
          .map((offer) => (
            <Card key={offer.id} className={`table-offer-card is-${offer.status}`} >
              <h3>
                {offer.item.name} × {offer.item.qty}
              </h3>
              <p className="muted table-offer-recipient">
                {table.members.find((m) => m.userId === offer.toUserId)?.hero
                  ?.name ??
                  table.members.find((m) => m.userId === offer.toUserId)
                    ?.name ??
                  "Игрок"}
              </p>
              <span
                className={`table-badge ${offer.status === "pending" ? "is-active" : ""}`}
              >
                {
                  {
                    pending: "Ожидает ответа",
                    accepted: "Принят",
                    declined: "Отклонён",
                    revoked: "Отозван",
                  }[offer.status]
                }
              </span>
              <div className="table-actions"><Button icon="eye" iconOnly size="sm" variant="ghost" onClick={() => setDetails(offer.item)}>Описание предмета</Button>
              {offer.status === "pending" && (
                <>
                  {offer.toUserId === table.actorId && (
                    <>
                      <Button
                        disabled={busy || table.archived}
                        variant="primary"
                        onClick={() =>
                          void send("answer-offer", {
                            offerId: offer.id,
                            accept: true,
                            version: offer.version,
                          })
                        }
                      >
                        Принять
                      </Button>
                      <Button
                        disabled={busy || table.archived}
                        onClick={() =>
                          void send("answer-offer", {
                            offerId: offer.id,
                            accept: false,
                            version: offer.version,
                          })
                        }
                      >
                        Отклонить
                      </Button>
                    </>
                  )}
                  {director && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || table.archived}
                      onClick={() =>
                        void command("revoke-offer", { offerId: offer.id })
                      }
                    >
                      Отозвать
                    </Button>
                  )}
                </>
              )}
              </div>
            </Card>
          ))}
      </div>}
      {!director && own && (
        <CardDetailModal open={trading} onClose={() => setTradingHeroId(null)} title="Подарить или обменять" className="table-dialog" wide>
          {(error || commandError) && <p role="alert">{error || commandError}</p>}
          <form className="table-stack" onSubmit={async event => {
            event.preventDefault();
            if (busy || table.archived || !targetMember?.hero || (!offeredItems.length && !requestedItems.length)) return;
            if (await command("create-trade", {
              toUserId: targetMember.userId,
              fromHeroId: own.id,
              toHeroId: targetMember.hero.id,
              offered: offeredItems,
              requested: requestedItems,
            })) {
              setOffered({});
              setRequested({});
              setTradingHeroId(null);
            }
          }}>
            <fieldset disabled={busy || table.archived}>
              <label>
                Получатель
                <Select value={targetMember?.userId ?? ""} required onChange={event => {
                  const member = recipients.find(candidate => candidate.userId === event.currentTarget.value);
                  setTarget(member?.hero ? { userId: member.userId, heroId: member.hero.id } : null);
                  setRequested({});
                }}>
                  <option value="">Выберите персонажа</option>
                  {recipients.map(member => <option key={member.userId} value={member.userId}>
                    {member.hero?.name} · {member.name}
                  </option>)}
                </Select>
              </label>
              <div className="table-form-grid">
                <TradeItemPicker label="Передаю" placeholder="Выберите предмет"
                  inventory={own.inventory} quantities={offered} onChange={setOffered} />
                <TradeItemPicker label="Прошу взамен"
                  placeholder={targetMember?.hero?.sections.inventory === undefined && targetMember ? "Инвентарь закрыт" : "Без ответного предмета"}
                  inventory={targetItems} quantities={requested} onChange={setRequested} />
              </div>
              <p className="muted small">Предметы перейдут после подтверждения обоими игроками.</p>
              <Button type="submit" variant="primary"
                disabled={!targetMember?.hero || (!offeredItems.length && !requestedItems.length)}>
                {requestedItems.length ? "Предложить обмен" : "Предложить подарок"}
              </Button>
            </fieldset>
          </form>
        </CardDetailModal>
      )}
      {showingOffers && table.trades.map((trade) => (
        <Card key={trade.id} className={`table-trade-card is-${trade.status}`}>
          <h3>
            Обмен между{" "}
            {table.members.find((m) => m.userId === trade.fromUserId)?.name ??
              "игроками"}{" "}
            и{" "}
            {table.members.find((m) => m.userId === trade.toUserId)?.name ??
              "игроком"}
          </h3>
          <p>
            Передаётся:{" "}
            {trade.offered
              .map(
                (row) =>
                  `${row.item?.name ?? own?.inventory.find((i) => i.id === row.itemId)?.name ?? inventoryFrom(table.members.find((m) => m.userId === trade.fromUserId)?.hero?.sections.inventory).find((i) => i.id === row.itemId)?.name ?? "Предмет"} × ${row.qty}`,
              )
              .join(", ") || "ничего"}
          </p>
          <p>
            Взамен:{" "}
            {trade.requested
              .map(
                (row) =>
                  `${row.item?.name ?? own?.inventory.find((i) => i.id === row.itemId)?.name ?? inventoryFrom(table.members.find((m) => m.userId === trade.toUserId)?.hero?.sections.inventory).find((i) => i.id === row.itemId)?.name ?? "Предмет"} × ${row.qty}`,
              )
              .join(", ") || "подарок"}
          </p>
          <div className="table-actions"><Button icon="eye" iconOnly size="sm" variant="ghost" onClick={() => setTradeDetails(trade)}>Состав и эффекты предметов</Button></div>
          <p>
            {
              {
                pending: "Ожидает подтверждений",
                accepted: "Обмен завершён",
                cancelled: "Отменён",
              }[trade.status]
            }{" "}
            · Подтверждений: {trade.confirmations.length} / 2
          </p>
          {trade.status === "pending" &&
            [trade.fromUserId, trade.toUserId].includes(table.actorId) && (
              <div className="table-actions">
                <Button
                  disabled={busy || table.archived}
                  onClick={() =>
                    void command("cancel-trade", { tradeId: trade.id })
                  }
                >
                  Отменить
                </Button>
                <Button
                  variant="primary"
                  disabled={
                    busy ||
                    table.archived ||
                    trade.confirmations.includes(table.actorId)
                  }
                  onClick={() =>
                    void send("confirm-trade", { tradeId: trade.id })
                  }
                >
                  Подтвердить условия
                </Button>
              </div>
            )}
        </Card>
      ))}
      {director && !showingOffers && <TableLibrary kind="item" templates={templates} acceptedIds={acceptedIds} disabled={busy || table.archived} onAdd={(template) => {
        if (!template.item) return;
        setTemplateId(template.id);
        setItem({ ...structuredClone(template.item), id: crypto.randomUUID(), equipped: false });
        setComposing(true);
      }} />}
      <CardDetailModal open={!!tradeDetails} onClose={() => setTradeDetails(null)} title="Состав и эффекты предметов" className="table-dialog" wide>
        {tradeDetails && [...tradeDetails.offered, ...tradeDetails.requested].map((row, index) => row.item && <section key={`${row.itemId}-${index}`} className="table-disclosure"><h3>{row.item.name} × {row.qty}</h3><MarkdownPreview text={row.item.notes} /><ItemEffectsSummary effects={row.item.effects ?? []} /></section>)}
      </CardDetailModal>
      <CardDetailModal open={!!details} onClose={() => setDetails(null)} title={details?.name ?? "Предмет"} className="table-dialog" wide>
        {details && <><MarkdownPreview text={details.notes} /><ItemEffectsSummary effects={details.effects ?? []} /></>}
      </CardDetailModal>
    </section>
  );
}
