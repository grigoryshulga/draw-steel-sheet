import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  createHttpTableRepository,
  createSupabaseTableRepository,
} from "../src/lib/tables/repository";

describe("table transport", () => {
  it("sends the same revisioned operation unchanged through HTTP", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(null));
    const repository = createHttpTableRepository(fetcher);
    const command = {
      type: "delete",
      payload: {},
      operationId: "once",
      expectedRevision: 4,
    };
    expect(await repository.command("room", command)).toBeNull();
    expect(fetcher.mock.calls[0][0]).toBe("/api/table-command");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      tableId: "room",
      command,
    });
  });

  it("maps cloud conflicts and revoked access without acknowledging a write", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = createClient("https://tables.example.test", "test-key", {
      global: { fetch: fetcher },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const repository = createSupabaseTableRepository(client);
    fetcher.mockResolvedValueOnce(
      Response.json(
        { code: "PT409", message: "Конфликт версии стола" },
        { status: 409 },
      ),
    );
    await expect(
      repository.command("room", {
        type: "rename",
        payload: { name: "New" },
        operationId: "once",
        expectedRevision: 4,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
      p_table_id: "room",
      p_command: { operationId: "once", expectedRevision: 4 },
    });
    fetcher.mockResolvedValueOnce(
      Response.json(
        { code: "PT404", message: "Стол не найден" },
        { status: 404 },
      ),
    );
    await expect(repository.read("room")).rejects.toMatchObject({
      code: "PT404",
    });
  });

  it("subscribes to the actual signal column and removes the channel on cleanup", () => {
    const client = createClient("https://tables.example.test", "test-key", {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const channel = client.channel("test");
    const on = vi.spyOn(channel, "on");
    vi.spyOn(channel, "subscribe").mockReturnValue(channel);
    vi.spyOn(client, "channel").mockReturnValue(channel);
    const remove = vi.spyOn(client, "removeChannel").mockResolvedValue("ok");
    const unsubscribe = createSupabaseTableRepository(client).subscribe(
      "room",
      vi.fn(),
    );
    expect(on).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "table_signals",
        filter: "id=eq.room",
      },
      expect.any(Function),
    );
    unsubscribe();
    expect(remove).toHaveBeenCalledWith(channel);
  });
});
