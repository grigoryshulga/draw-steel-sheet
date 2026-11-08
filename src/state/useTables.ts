import { useCallback, useEffect, useRef, useState } from "react";
import { tableRepository, TableError } from "../lib/tables/repository";
import type {
  TableCommand,
  TableSnapshot,
  TableSummary,
} from "../lib/tables/types";

export function useTables() {
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [table, setTable] = useState<TableSnapshot | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [lastRead, setLastRead] = useState("");
  const tableRef = useRef<TableSnapshot | null>(null);
  const selectedRef = useRef(selected);
  const readEpoch = useRef(0);
  const working = useRef(false);
  const uncertain = useRef<{
    id: string | null;
    key: string;
    request: TableCommand;
  } | null>(null);
  const [needsRetry, setNeedsRetry] = useState(false);
  selectedRef.current = selected;
  tableRef.current = table;

  const refreshList = useCallback(async () => {
    const list = await tableRepository.list();
    setTables(list);
    return list;
  }, []);
  useEffect(() => {
    let alive = true;
    void refreshList()
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [refreshList]);

  const refresh = useCallback(async (id: string) => {
    const epoch = ++readEpoch.current;
    try {
      const next = await tableRepository.read(id);
      if (selectedRef.current !== id || epoch !== readEpoch.current) return;
      if (!next) throw new TableError("Стол недоступен", "access");
      setTable(next);
      setStale(false);
      setLastRead(new Date().toISOString());
    } catch (e) {
      if (selectedRef.current !== id || epoch !== readEpoch.current) return;
      setStale(true);
      if (!tableRef.current)
        setError(e instanceof Error ? e.message : "Не удалось загрузить стол");
      if (
        e instanceof TableError &&
        /access|42501|403|404|not.?found|forbidden/i.test(
          `${e.code} ${e.message}`,
        )
      ) {
        setTable(null);
        setError("Доступ к столу прекращён.");
      }
    }
  }, []);

  useEffect(() => {
    setTable(null);
    setError("");
    setLastRead("");
    if (!selected) return;
    void refresh(selected);
    return tableRepository.subscribe(selected, () => void refresh(selected));
  }, [selected, refresh]);

  const command = useCallback(
    async (
      type: string,
      payload: Record<string, unknown> = {},
      tableId: string | null = selectedRef.current,
    ) => {
      if (working.current) return null;
      const key = JSON.stringify([tableId, type, payload]);
      if (uncertain.current && uncertain.current.key !== key) {
        setError(
          "Ответ на предыдущее действие ещё не получен. Сначала повторите его подтверждение.",
        );
        return null;
      }
      working.current = true;
      setBusy(true);
      setError("");
      ++readEpoch.current;
      const request: TableCommand = uncertain.current?.request ?? {
        type,
        payload,
        operationId: crypto.randomUUID(),
        ...(tableId && tableRef.current?.id === tableId
          ? { expectedRevision: tableRef.current.revision }
          : {}),
      };
      try {
        const result = await tableRepository.command(tableId, request);
        uncertain.current = null;
        setNeedsRetry(false);
        ++readEpoch.current;
        if (result) {
          setSelected(result.id);
          setTable(result);
          setStale(false);
          setLastRead(new Date().toISOString());
        } else if (tableId === selectedRef.current) {
          setSelected(null);
          setTable(null);
        }
        await refreshList().catch((e) => setError(e.message));
        return result;
      } catch (e) {
        if (!(e instanceof TableError) || /^5|network|timeout/i.test(e.code)) {
          uncertain.current = { id: tableId, key, request };
          setNeedsRetry(true);
        } else {
          uncertain.current = null;
          setNeedsRetry(false);
        }
        setError(
          e instanceof Error ? e.message : "Не удалось выполнить действие",
        );
        if (tableId) await refresh(tableId);
        return null;
      } finally {
        working.current = false;
        setBusy(false);
      }
    },
    [refresh, refreshList],
  );

  const retryCommand = () => {
    const pending = uncertain.current;
    return pending
      ? command(pending.request.type, pending.request.payload, pending.id)
      : Promise.resolve(null);
  };
  return {
    tables,
    table,
    selected,
    select: setSelected,
    busy,
    loading,
    error,
    setError,
    stale,
    lastRead,
    command,
    refreshList,
    needsRetry,
    retryCommand,
  };
}
