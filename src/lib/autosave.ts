export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

/** One active document, one writer. A failed write never acknowledges a revision. */
export function createAutosave<T>({
  save,
  onStatus,
  onSaved,
  onEdit,
  delay = 650,
}: {
  save: (document: T) => Promise<T>;
  onStatus: (status: SaveStatus, error?: string) => void;
  onSaved?: (document: T, submitted: T) => void;
  /** Synchronous durable staging, before any debounce or remote write. */
  onEdit?: (document: T) => void;
  delay?: number;
}) {
  let current: T | null = null;
  let acknowledged: T | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | null = null;

  function cancelTimer() {
    clearTimeout(timer);
    timer = undefined;
  }

  function hasChanges() {
    return current !== acknowledged;
  }

  function isDirty() {
    // Even a local revert is unsafe to leave while an older write is in flight.
    // That write can still replace the server document before the revert saves.
    return hasChanges() || inFlight !== null;
  }

  function flush(): Promise<void> {
    cancelTimer();
    if (inFlight) return inFlight;
    if (!hasChanges()) return Promise.resolve();
    inFlight = (async () => {
      while (current !== null && hasChanges()) {
        const document = current;
        onStatus("saving");
        try {
          const saved = await save(document);
          acknowledged = document;
          onSaved?.(saved, document);
        } catch (error) {
          cancelTimer();
          onStatus(
            "error",
            error instanceof Error ? error.message : "Ошибка сохранения",
          );
          throw error;
        }
      }
      onStatus("saved");
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  return {
    isDirty,
    flush,
    /** Call only after flush; switching an unsaved document is a programming error. */
    load(document: T | null, options?: { pending?: boolean }) {
      if (isDirty() || inFlight)
        throw new Error("Сначала сохраните текущего героя");
      cancelTimer();
      current = document;
      acknowledged = options?.pending ? null : document;
      onStatus(document === null ? "idle" : options?.pending ? "pending" : "saved");
    },
    edit(document: T) {
      if (document === current) return;
      onEdit?.(document);
      current = document;
      cancelTimer();
      if (!hasChanges() && !inFlight) {
        onStatus("saved");
        return;
      }
      onStatus("pending");
      timer = setTimeout(() => {
        void flush().catch(() => undefined);
      }, delay);
    },
    /** Explicit conflict resolution; durable recovery remains owned by storage. */
    resolve(document: T | null) {
      if (inFlight) throw new Error("Дождитесь завершения сохранения");
      cancelTimer();
      current = acknowledged = document;
      onStatus(document === null ? "idle" : "saved");
    },
    settled: () => inFlight ?? Promise.resolve(),
    // Do not start a competing request during unload. The caller guards navigation.
    dispose: cancelTimer,
  };
}
