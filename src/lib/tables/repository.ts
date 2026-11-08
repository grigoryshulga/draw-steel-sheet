import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import type {
  DirectorTemplate,
  TableCommand,
  TableRepository,
  TableSnapshot,
  TableSummary,
} from "./types";

export class TableError extends Error {
  constructor(
    message: string,
    public readonly code = "table-error",
  ) {
    super(message);
    this.name = "TableError";
  }
}
function failure(message: string, code?: string): TableError {
  if (/fetch|network|timeout|abort/i.test(message))
    return new TableError(
      "Сервер не ответил. Проверьте соединение и повторите действие.",
      "network",
    );
  if (/revision|conflict|верси|конфликт/i.test(message))
    return new TableError(
      "Стол изменился на другом устройстве. Данные обновлены; повторите действие.",
      "conflict",
    );
  if (
    /function .* does not exist|schema cache|could not find the function/i.test(
      message,
    )
  )
    return new TableError(
      "Функции столов ещё не установлены на сервере. Администратору нужно применить миграцию столов.",
      "unavailable",
    );
  return new TableError(message, code);
}

export function createSupabaseTableRepository(
  client: SupabaseClient,
): TableRepository {
  async function rpc<T>(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<T> {
    const { data, error } = await client
      .rpc(name, args)
      .abortSignal(AbortSignal.timeout(12000));
    if (error) throw failure(error.message, error.code);
    return data as T;
  }
  return {
    list: () => rpc<TableSummary[]>("table_list"),
    read: (id) => rpc<TableSnapshot>("table_read", { p_table_id: id }),
    command: (id, command) =>
      rpc<TableSnapshot | null>("table_command", {
        p_table_id: id,
        p_command: command,
      }),
    templates: () => rpc<DirectorTemplate[]>("table_templates"),
    saveTemplate: (template) =>
      rpc<DirectorTemplate>("table_template_save", { p_template: template }),
    deleteTemplate: async (id) => {
      await rpc("table_template_delete", { p_id: id });
    },
    subscribe(id, onChange, onStatus) {
      const channel = client
        .channel(`table:${id}:${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "table_signals",
            ...(id ? { filter: `id=eq.${id}` } : {}),
          },
          onChange,
        )
        .subscribe((status) => {
          onStatus?.(status === "SUBSCRIBED");
          if (status === "SUBSCRIBED") onChange();
        });
      // Repair missed notifications and recheck revoked membership, also when Realtime is disabled.
      const timer = setInterval(onChange, 2500);
      const reconnect = () => onChange();
      if (typeof window !== "undefined")
        window.addEventListener("online", reconnect);
      return () => {
        clearInterval(timer);
        void client.removeChannel(channel);
        if (typeof window !== "undefined")
          window.removeEventListener("online", reconnect);
      };
    },
  };
}

export function createHttpTableRepository(
  fetcher: typeof fetch = fetch,
): TableRepository {
  async function request<T>(
    url: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    const response = await fetcher(url, {
      method,
      signal: AbortSignal.timeout(12000),
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok)
      throw failure(
        data?.error ?? `Ошибка сервера (${response.status})`,
        String(response.status),
      );
    return data as T;
  }
  return {
    list: async () =>
      (await request<{ tables: TableSummary[] }>("/api/tables")).tables,
    read: (id) =>
      request<TableSnapshot>(`/api/tables/${encodeURIComponent(id)}`),
    command: (id: string | null, command: TableCommand) =>
      request<TableSnapshot | null>("/api/table-command", "POST", {
        tableId: id,
        command,
      }),
    templates: async () =>
      (await request<{ templates: DirectorTemplate[] }>("/api/table-templates"))
        .templates,
    saveTemplate: (template) =>
      request<DirectorTemplate>("/api/table-templates", "PUT", template),
    deleteTemplate: async (id) => {
      await request(`/api/table-templates/${encodeURIComponent(id)}`, "DELETE");
    },
    subscribe(_id, onChange) {
      const timer = setInterval(onChange, 750);
      return () => clearInterval(timer);
    },
  };
}

export const tableRepository = supabase
  ? createSupabaseTableRepository(supabase)
  : createHttpTableRepository();
