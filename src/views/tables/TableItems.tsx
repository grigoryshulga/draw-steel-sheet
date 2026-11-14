import { useEffect, useState } from "react";
import { CardDetailModal } from "../../components/CardDetailModal";
import { TableLibrary } from "./TableLibrary";
import { Button, Card } from "../../components/ui";
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
  const [composing, setComposing] = useState(false);
  const [trading, setTrading] = useState(false);
  const [tradeDetails, setTradeDetails] = useState<TableSnapshot["trades"][number] | null>(null);
  const [details, setDetails] = useState<InventoryItem | null>(null);
  const [item, setItem] = useState(emptyItem);
  const [templateId, setTemplateId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [own, setOwn] = useState<Character | null>(null);
  const [target, setTarget] = useState("");
  const [offered, setOffered] = useState<Record<string, number>>({});
  const [requested, setRequested] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const me = table.members.find((m) => m.userId === table.actorId);
  const targetMember = table.members.find((m) => m.userId === target);
  const targetItems = inventoryFrom(targetMember?.hero?.sections.inventory);
  const templateEffectsChanged =
    Boolean(templateId) &&
    JSON.stringify(item.effects ?? []) !==
      JSON.stringify(
        templates.find((t) => t.id === templateId)?.item?.effects ?? [],
      );
  useEffect(() => {
    let active = true;
    setOwn(null);
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
  const selection = (values: Record<string, number>) =>
    Object.entries(values)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => ({ itemId, qty }));
  return (
    <section className="table-stack">
      <div className="table-section-heading">
        <h2>Предметы и обмен</h2>
        <div className="table-actions">
          {director && <Button icon="plus" variant="primary" disabled={busy || table.archived} onClick={() => { setTemplateId(""); setItem(emptyItem()); setComposing(true); }}>{table.members.some((m) => m.hero) ? "Предложить предмет" : "Создать предмет"}</Button>}
          {!director && own && <Button icon="plus" disabled={busy || table.archived} onClick={() => setTrading(true)}>Подарить или обменять</Button>}
        </div>
      </div>
      <div className={`table-items-layout${director ? " has-library" : ""}`}>
      <div className="table-stack">
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
                      })) setComposing(false);
                  }}
                >
                  Предложить
                </Button>
              </div>
            </fieldset>
          </section>
        </CardDetailModal>
      )}
      {table.offers.length === 0 && table.trades.length === 0 && (
        <p className="table-empty">
          {director
            ? "Предложите предмет герою. Он появится в инвентаре после согласия игрока."
            : "Здесь появятся предложения предметов и обмена."}
        </p>
      )}
      <div className="table-card-grid">
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
              <p className="muted">
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
      </div>
      {!director && own && (
        <CardDetailModal open={trading} onClose={() => setTrading(false)} title="Подарить или обменять" className="table-dialog" wide>
          {(error || commandError) && <p role="alert">{error || commandError}</p>}
          <p>
            Если выбранный предмет изменится, подтверждения сбросятся. Оба
            игрока подтверждают условия. Предметы переходят одновременно;
            полученное не экипируется.
          </p>
          <fieldset disabled={busy || table.archived}>
            <label>
              С кем
              <select
                className="select"
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value);
                  setRequested({});
                  setTrading(false);
                }}
              >
                <option value="">Выберите игрока</option>
                {table.members
                  .filter((m) => m.hero && m.userId !== table.actorId)
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.hero!.name} · {m.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="table-form-grid">
              <div>
                <h4>Передаю</h4>
                {own.inventory.map((i) => (
                  <label key={i.id}>
                    {i.name} · есть {i.qty}
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={i.qty}
                      value={offered[i.id] ?? 0}
                      onChange={(e) =>
                        setOffered({
                          ...offered,
                          [i.id]: Math.max(
                            0,
                            Math.min(i.qty, Math.floor(Number(e.target.value))),
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <div>
                <h4>Прошу взамен</h4>
                {targetItems.length === 0 && (
                  <p className="muted">
                    Можно отправить подарок без ответного предмета. Для выбора
                    ответного предмета игрок открывает свой инвентарь.
                  </p>
                )}
                {targetItems.map((i) => (
                  <label key={i.id}>
                    {i.name} · есть {i.qty}
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={i.qty}
                      value={requested[i.id] ?? 0}
                      onChange={(e) =>
                        setRequested({
                          ...requested,
                          [i.id]: Math.max(
                            0,
                            Math.min(i.qty, Math.floor(Number(e.target.value))),
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
            <Button
              disabled={
                !targetMember?.hero ||
                (selection(offered).length === 0 &&
                  selection(requested).length === 0)
              }
              onClick={async () => {
                if (
                  await command("create-trade", {
                    toUserId: target,
                    fromHeroId: own.id,
                    toHeroId: targetMember!.hero!.id,
                    offered: selection(offered),
                    requested: selection(requested),
                  })
                ) {
                  setOffered({});
                  setRequested({});
                  setTrading(false);
                }
              }}
            >
              Предложить условия
            </Button>
          </fieldset>
        </CardDetailModal>
      )}
      {table.trades.map((trade) => (
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
      </div>
      {director && <TableLibrary kind="item" templates={templates} disabled={busy || table.archived} onAdd={(template) => {
        if (!template.item) return;
        setTemplateId(template.id);
        setItem({ ...structuredClone(template.item), id: crypto.randomUUID(), equipped: false });
        setComposing(true);
      }} />}
      </div>
      <CardDetailModal open={!!tradeDetails} onClose={() => setTradeDetails(null)} title="Состав и эффекты предметов" className="table-dialog" wide>
        {tradeDetails && [...tradeDetails.offered, ...tradeDetails.requested].map((row, index) => row.item && <section key={`${row.itemId}-${index}`} className="table-disclosure"><h3>{row.item.name} × {row.qty}</h3><MarkdownPreview text={row.item.notes} /><ItemEffectsSummary effects={row.item.effects ?? []} /></section>)}
      </CardDetailModal>
      <CardDetailModal open={!!details} onClose={() => setDetails(null)} title={details?.name ?? "Предмет"} className="table-dialog" wide>
        {details && <><MarkdownPreview text={details.notes} /><ItemEffectsSummary effects={details.effects ?? []} /></>}
      </CardDetailModal>
    </section>
  );
}
