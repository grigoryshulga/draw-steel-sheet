import { useLocale } from "../../i18n/locale";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Button, Modal } from "../../components/ui";
import { useStorageScope } from "../../state/StorageScope";
import { supabaseEnabled } from "../../lib/supabase";
import { tableRepository } from "../../lib/tables/repository";
import type { ItemOffer } from "../../lib/tables/types";
import "./Tables.css";

const RuleText = lazy(() =>
  import("../../components/RuleText").then((module) => ({
    default: module.RuleText,
  })),
);

interface PendingAnswer {
  tableId: string;
  offerId: string;
  version: number;
  accept: boolean;
  operationId: string;
}
interface Incoming {
  tableId: string;
  tableName: string;
  heroName: string;
  offer: ItemOffer;
}
const effectNames: Record<string, string> = {
  stamina: "Выносливость",
  recoveries: "Восстановления",
  speed: "Скорость",
  stability: "Устойчивость",
  disengage: "Отход",
  save: "Спасброски",
  rolledDamage: "Урон с броском",
  freeStrikeDamage: "Свободный удар",
};

/** Offers are account scoped. Offline decisions remain requests until the server acknowledges. */
export function TableOfferInbox({
  beforeAnswer,
  afterAnswer,
}: {
  beforeAnswer: () => Promise<void>;
  afterAnswer: () => Promise<void>;
}) {
  const { t: tr } = useLocale();
  const scope = useStorageScope();
  const key = `draw-steel:table-offer-answers:v1:${scope}`;
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(0);
  const [postponed, setPostponed] = useState<Set<string>>(new Set());
  const offerKey = (entry: Incoming) =>
    `${scope}:${entry.tableId}:${entry.offer.id}:${entry.offer.version}`;
  const callbacks = useRef({ beforeAnswer, afterAnswer });
  callbacks.current = { beforeAnswer, afterAnswer };
  const polling = useRef(false);
  const pending = useRef<PendingAnswer[]>([]);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    setIncoming([]);
    setPostponed(new Set());
    if (!supabaseEnabled || scope === "local") return;
    let alive = true;
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
      pending.current = Array.isArray(parsed)
        ? parsed.filter(
            (v) =>
              v &&
              typeof v.tableId === "string" &&
              typeof v.offerId === "string" &&
              typeof v.accept === "boolean" &&
              Number.isInteger(v.version) &&
              typeof v.operationId === "string",
          )
        : [];
    } catch {
      pending.current = [];
    }
    setWaiting(pending.current.length);
    const persist = () => {
      localStorage.setItem(key, JSON.stringify(pending.current));
      setWaiting(pending.current.length);
    };
    const refresh = async () => {
      if (polling.current || !navigator.onLine) return;
      polling.current = true;
      try {
        const summaries = await tableRepository.list();
        pending.current = pending.current.filter((p) =>
          summaries.some((t) => t.id === p.tableId),
        );
        if (alive) persist();
        const reads = await Promise.allSettled(
          summaries.map((t) => tableRepository.read(t.id)),
        );
        if (!alive) return;
        const next: Incoming[] = [];
        for (const read of reads) {
          if (read.status !== "fulfilled" || !read.value) continue;
          const table = read.value;
          const answers = pending.current.filter((p) => p.tableId === table.id);
          for (const answer of answers) {
            const offer = table.offers.find((o) => o.id === answer.offerId);
            if (
              !offer ||
              offer.status !== "pending" ||
              offer.version !== answer.version
            ) {
              pending.current = pending.current.filter(
                (p) => p.operationId !== answer.operationId,
              );
              persist();
              if (offer?.status === "pending")
                setError(
                  tr("Эффекты предмета изменились. Ознакомьтесь с новой версией и выберите заново.", "The item effects changed. Review the new version and choose again."),
                );
              continue;
            }
            if (table.archived) continue;
            try {
              await callbacks.current.beforeAnswer();
              await tableRepository.command(table.id, {
                type: "answer-offer",
                operationId: answer.operationId,
                expectedRevision: table.revision,
                payload: {
                  offerId: answer.offerId,
                  version: answer.version,
                  accept: answer.accept,
                },
              });
              pending.current = pending.current.filter(
                (p) => p.operationId !== answer.operationId,
              );
              persist();
              await callbacks.current.afterAnswer();
              // One transaction per snapshot; the next poll uses a fresh revision.
              break;
            } catch {
              /* Keep the durable decision until a successful read/ack. */
            }
          }
          if (!table.archived)
            for (const offer of table.offers) {
              if (
                offer.status === "pending" &&
                offer.toUserId === table.actorId &&
                !pending.current.some((p) => p.offerId === offer.id) &&
                !answers.some(
                  (p) => p.offerId === offer.id && p.version === offer.version,
                )
              )
                next.push({
                  tableId: table.id,
                  tableName: table.name,
                  heroName:
                    table.members.find(
                      (member) => member.hero?.id === offer.heroId,
                    )?.hero?.name ?? tr("Герой", "Hero"),
                  offer,
                });
            }
        }
        if (alive) setIncoming(next);
      } catch {
        /* Last seen offers remain available for a durable offline answer. */
      } finally {
        polling.current = false;
      }
    };
    refreshRef.current = refresh;
    void refresh();
    const unsubscribe = tableRepository.subscribe("", () => void refresh());
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [key, scope]);

  const current = incoming.find((entry) => !postponed.has(offerKey(entry)));
  const postpone = () =>
    setPostponed((old) => new Set([...old, ...incoming.map(offerKey)]));
  async function answer(accept: boolean) {
    if (!current || busy) return;
    setBusy(true);
    setError("");
    try {
      const decision: PendingAnswer = {
        tableId: current.tableId,
        offerId: current.offer.id,
        version: current.offer.version,
        accept,
        operationId: crypto.randomUUID(),
      };
      const next = [
        ...pending.current.filter((p) => p.offerId !== decision.offerId),
        decision,
      ];
      localStorage.setItem(key, JSON.stringify(next));
      pending.current = next;
      setWaiting(next.length);
      setIncoming((old) =>
        old.filter((entry) => offerKey(entry) !== offerKey(current)),
      );
      await refreshRef.current();
    } catch {
      setError(
        tr("Не удалось сохранить ответ на устройстве. Освободите место и повторите.", "Could not save your response on this device. Free some space and try again."),
      );
    } finally {
      setBusy(false);
    }
  }
  if (!supabaseEnabled) return null;
  return (
    <>
      {incoming.length > 0 && !current && (
        <div className="table-notice table-inbox-notice" role="status">
          <span>{tr("Предложения предметов", "Item offers")}: {incoming.length}</span>
          <Button iconOnly icon="eye"
            size="sm"
            onClick={() =>
              setPostponed((old) => {
                const next = new Set(old);
                next.delete(offerKey(incoming[0]));
                return next;
              })
            }
          >
            {tr("Посмотреть", "View")}
          </Button>
        </div>
      )}
      {waiting > 0 && (
        <div className="table-notice" role="status">
          {tr("Ответы на предложения ожидают подтверждения сервера", "Offer responses await server confirmation")}: {waiting}.
          {tr("Предметы пока не получены.", "Items have not been received yet.")}
        </div>
      )}
      <Modal
        open={!!current}
        onClose={postpone}
        title={tr("Вам предложен предмет", "You have an item offer")}
        footer={
          <>
            <Button variant="ghost" onClick={postpone}>
              {tr("Позже", "Later")}
            </Button>
            <Button disabled={busy} onClick={() => void answer(false)}>
              {tr("Отклонить", "Decline")}
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => void answer(true)}
            >
              {tr("Принять", "Accept")}
            </Button>
          </>
        }
      >
        {current && (
          <>
            <p className="muted">
              {current.heroName} · {tr("Стол", "Table")} «{current.tableName}»
            </p>
            <h3>
              {current.offer.item.name} × {current.offer.item.qty}
            </h3>
            <Suspense
              fallback={
                <p className="table-prose">{current.offer.item.notes}</p>
              }
            >
              <RuleText text={current.offer.item.notes} />
            </Suspense>
            {current.offer.item.effects?.map((effect, i) => (
              <p key={i}>
                {tr(effectNames[effect.field], ({ stamina: "Stamina", recoveries: "Recoveries", speed: "Speed", stability: "Stability", disengage: "Disengage", save: "Saving throws", rolledDamage: "Rolled damage", freeStrikeDamage: "Free strike damage" } as Record<string, string>)[effect.field] ?? effectNames[effect.field])}: {effect.value > 0 ? "+" : ""}
                {effect.value}
              </p>
            ))}
            <p>
              {tr("Предмет попадёт в инвентарь указанного героя после подтверждения сервера и не будет экипирован автоматически.", "The item will enter this hero’s inventory after server confirmation and will not be equipped automatically.")}
            </p>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </Modal>
    </>
  );
}
