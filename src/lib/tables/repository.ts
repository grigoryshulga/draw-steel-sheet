import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import type {
  BoardRepository,
  HeroTableCombat,
  SharedBoardView,
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
): TableRepository & BoardRepository {
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
  function subscribe(id: string, signal: string, onChange: () => void, onStatus?: (connected: boolean) => void) {
    const channel = client
      .channel(`${signal}:${id}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: signal,
          ...(id ? { filter: `id=eq.${id}` } : {}),
        },
        onChange,
      )
      .subscribe((status) => {
        onStatus?.(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") onChange();
      });
    // Repair missed notifications and recheck revoked membership.
    const timer = setInterval(onChange, 2500);
    if (typeof window !== "undefined") window.addEventListener("online", onChange);
    return () => {
      clearInterval(timer);
      void client.removeChannel(channel);
      if (typeof window !== "undefined") window.removeEventListener("online", onChange);
    };
  }
  const images = client.storage.from("table-images");
  return {
    list: () => rpc<TableSummary[]>("table_list"),
    read: (id) => rpc<TableSnapshot>("table_read", { p_table_id: id }),
    readHeroCombat: (heroId) => rpc<HeroTableCombat | null>("table_hero_combat", { p_hero_id: heroId }),
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
      return subscribe(id, "table_signals", onChange, onStatus);
    },
    readBoardView: id => rpc<SharedBoardView>("table_board_view", { p_table_id: id }),
    writeBoardView: (id, command) => rpc<SharedBoardView>("table_board_view_write", { p_table_id: id, p_command: command }),
    subscribeBoardView: (id, onChange) => subscribe(id, "table_board_signals", onChange),
    async uploadBoardImage(id, assetId, image) {
      const path = `${id}/${assetId}`;
      const { error } = await images.upload(path, image, { contentType: "image/webp", cacheControl: "60" });
      if (error && !(await images.exists(path)).data) throw failure(error.message);
      void rpc<string[]>("table_board_expired_images", { p_table_id: id })
        .then(expired => { if (expired.length) return images.remove(expired); })
        .catch(() => {});
    },
    async boardImageUrl(id, assetId) {
      const { error, data } = await images.createSignedUrl(`${id}/${assetId}`, 60);
      if (error) throw failure(error.message);
      return data.signedUrl;
    },
  };
}

export function createHttpTableRepository(
  fetcher: typeof fetch = fetch,
): TableRepository & BoardRepository {
  const tablePath = (id: string) => `/api/tables/${encodeURIComponent(id)}`;
  const imagePath = (id: string, assetId: string) => `${tablePath(id)}/board-images/${encodeURIComponent(assetId)}`;
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
    readHeroCombat: (heroId) =>
      request<HeroTableCombat | null>(`/api/table-hero-combat/${encodeURIComponent(heroId)}`),
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
    readBoardView: id => request<SharedBoardView>(`${tablePath(id)}/board-view`),
    writeBoardView: (id, command) => request<SharedBoardView>(`${tablePath(id)}/board-view`, "PUT", command),
    subscribeBoardView(_id, onChange) {
      const timer = setInterval(onChange, 750);
      return () => clearInterval(timer);
    },
    async uploadBoardImage(id, assetId, image) {
      const response = await fetcher(imagePath(id, assetId), {
        method: "PUT", body: image, signal: AbortSignal.timeout(20000),
        headers: { "Content-Type": "image/webp" },
      });
      if (!response.ok) {
        const problem = await response.json().catch(() => null);
        throw failure(problem?.error ?? "Не удалось загрузить изображение", String(response.status));
      }
    },
    boardImageUrl: (id, assetId) => Promise.resolve(imagePath(id, assetId)),
  };
}

export const tableRepository = supabase
  ? createSupabaseTableRepository(supabase)
  : createHttpTableRepository();
