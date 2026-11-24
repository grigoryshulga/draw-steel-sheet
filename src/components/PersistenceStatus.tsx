import { storageMessage } from "../i18n/storage-messages";
import { useLocale } from "../i18n/locale";
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
  const { t, locale } = useLocale();
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
      setError(cause instanceof Error ? cause.message : t("Не удалось сохранить", "Couldn’t save"));
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
          aria-label={t("Сохранение героев", "Hero saves")}
        >
          <div>
            {state.localError ? (
              <p role="alert">
                <strong>{t("Правки пока только в открытой вкладке.", "Your changes are only in this tab.")}</strong>{" "}
                {storageMessage(state.localError, locale)} {t("Скачайте копию перед закрытием.", "Download a copy before closing.")}
              </p>
            ) : state.pendingCount > 0 ? (
              <p role="status">
                {t("На устройстве сохранены правки:", "Edits saved on this device:")} {state.pendingCount}.{" "}
                {state.conflicts.length
                  ? t("Нужно выбрать версию героя.", "Choose which version of the hero to use.")
                  : t("Синхронизируем при восстановлении связи.", "Changes will sync when you reconnect.")}
              </p>
            ) : (
              state.status === "offline" && (
                <p role="status">
                  {t("Нет связи. Открыт сохранённый на этом устройстве лист.", "You’re offline. This sheet was saved on this device.")}
                </p>
              )
            )}
            {error && <p role="alert">{storageMessage(error, locale)}</p>}
            {state.conflicts.map((record) => (
              <div key={record.id}>
                <h3>{t("Две версии:", "Two versions:")} {record.document.name}</h3>
                <p>
                  {t("На устройстве:", "On this device:")}{" "}
                  {new Date(record.editedAt).toLocaleString(locale)}. {t("На сервере:", "On the server:")}{" "}
                  {record.conflict?.server
                    ? new Date(record.conflict.server.updatedAt).toLocaleString(
                        locale,
                      )
                    : t("герой удалён", "hero deleted")}
                  . {t("Выбор заменит текущий лист; обе копии останутся доступны ниже.", "Your choice replaces the current sheet. Both copies remain available below.")}
                </p>
                <div className="hstack wrap">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run(() => resolve(record.id, "keep-local"))
                    }
                  >
                    {t("Сохранить мою версию", "Keep my version")}
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run(() => resolve(record.id, "use-server"))
                    }
                  >
                    {t("Взять серверную версию", "Use server version")}
                  </Button>
                </div>
              </div>
            ))}
            {state.recoveries.length > 0 && (
              <section>
                <h3>{t("Скачать сохранённые копии", "Download saved copies")}</h3>
                {state.recoveries
                  .filter(
                    (record) => record.state === "pending" || record.conflict,
                  )
                  .map((record) => (
                    <div className="hstack wrap" key={record.id}>
                      <span>
                        {record.document.name} ·{" "}
                        {new Date(record.editedAt).toLocaleString(locale)}
                      </span>
                      <Button onClick={() => download(record.id, "local")}>
                        {t("Моя копия", "My copy")}
                      </Button>
                      {record.conflict?.server && (
                        <Button onClick={() => download(record.id, "server")}>
                          {t("Серверная копия", "Server copy")}
                        </Button>
                      )}
                    </div>
                  ))}
              </section>
            )}
          </div>
          {(state.pendingCount > 0 || state.localError) && (
            <Button icon="refresh" iconOnly disabled={busy} onClick={() => void run(retry)}>
              {t("Повторить сохранение", "Retry save")}
            </Button>
          )}
        </section>
      )}
      <Modal
        open={Boolean(account?.pendingSignOut)}
        onClose={() => account?.cancelSignOut?.()}
        title={t("Остались несинхронизированные правки", "You have unsynced changes")}
        footer={
          <>
            <Button onClick={() => account?.cancelSignOut?.()}>{t("Остаться", "Stay signed in")}</Button>
            <Button
              disabled={Boolean(account?.pendingSignOut?.localError)}
              onClick={() => {
                allowSignOut();
                account?.signOut();
              }}
            >
              {t("Выйти, сохранив правки на устройстве", "Sign out and keep edits on this device")}
            </Button>
          </>
        }
      >
        <p>
          {t("Правки привязаны к этому аккаунту. Они будут отправлены после следующего входа с этого устройства. Очистка данных браузера удалит локальные копии.", "Your changes belong to this account and will sync the next time you sign in on this device. Clearing browser data deletes local copies.")}
        </p>
        {account?.pendingSignOut?.localError && (
          <p role="alert">
            {t("Хранилище устройства недоступно. Сначала скачайте копии героев или повторите сохранение.", "Device storage is unavailable. Download your heroes or retry saving first.")}
          </p>
        )}
        {state.recoveries
          .filter((record) => record.state === "pending")
          .map((record) => (
            <Button
              key={record.id}
              onClick={() => download(record.id, "local")}
            >
              {t("Скачать:", "Download:")} {record.document.name}
            </Button>
          ))}
      </Modal>
    </>
  );
}
