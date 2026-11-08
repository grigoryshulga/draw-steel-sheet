import { useState } from "react";
import type { CharacterPersistenceState } from "../lib/persistence/offline-repository";
import { useAccount } from "../state/StorageScope";
import { Button, Modal } from "./ui";

export function PersistenceStatus({
  state,
  retry,
  resolve,
  download,
  allowSignOut,
}: {
  state: CharacterPersistenceState;
  retry: () => Promise<void>;
  resolve: (
    id: string,
    choice: "keep-local" | "use-server",
  ) => Promise<unknown>;
  download: (id: string, version: "local" | "server") => void;
  allowSignOut: () => void;
}) {
  const account = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }
  const history = state.recoveries.filter(
    (record) => record.state === "resolved" && record.conflict,
  );
  const needsAttention =
    Boolean(state.localError) ||
    ["offline", "conflict", "error"].includes(state.status);
  return (
    <>
      {(needsAttention || history.length > 0) && (
        <section
          className="save-error-banner persistence-status"
          aria-label="Сохранение героев"
        >
          <div>
            {state.localError ? (
              <p role="alert">
                <strong>Правки пока только в открытой вкладке.</strong>{" "}
                {state.localError} Скачайте копию перед закрытием.
              </p>
            ) : state.pendingCount > 0 ? (
              <p role="status">
                На устройстве сохранены правки: {state.pendingCount}.{" "}
                {state.conflicts.length
                  ? "Нужно выбрать версию героя."
                  : "Синхронизируем при восстановлении связи."}
              </p>
            ) : (
              state.status === "offline" && (
                <p role="status">
                  Нет связи. Открыт сохранённый на этом устройстве лист.
                </p>
              )
            )}
            {error && <p role="alert">{error}</p>}
            {state.conflicts.map((record) => (
              <div key={record.id}>
                <h3>Две версии: {record.document.name}</h3>
                <p>
                  На устройстве:{" "}
                  {new Date(record.editedAt).toLocaleString("ru")}. На сервере:{" "}
                  {record.conflict?.server
                    ? new Date(record.conflict.server.updatedAt).toLocaleString(
                        "ru",
                      )
                    : "герой удалён"}
                  . Выбор заменит текущий лист; обе копии останутся доступны
                  ниже.
                </p>
                <div className="hstack wrap">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run(() => resolve(record.id, "keep-local"))
                    }
                  >
                    Сохранить мою версию
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run(() => resolve(record.id, "use-server"))
                    }
                  >
                    Взять серверную версию
                  </Button>
                </div>
              </div>
            ))}
            {state.recoveries.length > 0 && (
              <section>
                <h3>Скачать сохранённые копии</h3>
                {state.recoveries
                  .filter(
                    (record) => record.state === "pending" || record.conflict,
                  )
                  .map((record) => (
                    <div className="hstack wrap" key={record.id}>
                      <span>
                        {record.document.name} ·{" "}
                        {new Date(record.editedAt).toLocaleString("ru")}
                      </span>
                      <Button onClick={() => download(record.id, "local")}>
                        Моя копия
                      </Button>
                      {record.conflict?.server && (
                        <Button onClick={() => download(record.id, "server")}>
                          Серверная копия
                        </Button>
                      )}
                    </div>
                  ))}
              </section>
            )}
          </div>
          {(state.pendingCount > 0 || state.localError) && (
            <Button icon="refresh" iconOnly disabled={busy} onClick={() => void run(retry)}>
              Повторить сохранение
            </Button>
          )}
        </section>
      )}
      <Modal
        open={Boolean(account?.pendingSignOut)}
        onClose={() => account?.cancelSignOut?.()}
        title="Остались несинхронизированные правки"
        footer={
          <>
            <Button onClick={() => account?.cancelSignOut?.()}>Остаться</Button>
            <Button
              disabled={Boolean(account?.pendingSignOut?.localError)}
              onClick={() => {
                allowSignOut();
                account?.signOut();
              }}
            >
              Выйти, сохранив правки на устройстве
            </Button>
          </>
        }
      >
        <p>
          Правки привязаны к этому аккаунту. Они будут отправлены после
          следующего входа с этого устройства. Очистка данных браузера удалит
          локальные копии.
        </p>
        {account?.pendingSignOut?.localError && (
          <p role="alert">
            Хранилище устройства недоступно. Сначала скачайте копии героев или
            повторите сохранение.
          </p>
        )}
        {state.recoveries
          .filter((record) => record.state === "pending")
          .map((record) => (
            <Button
              key={record.id}
              onClick={() => download(record.id, "local")}
            >
              Скачать: {record.document.name}
            </Button>
          ))}
      </Modal>
    </>
  );
}
