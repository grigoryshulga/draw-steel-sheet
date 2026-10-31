import { afterEach, describe, expect, it, vi } from "vitest";
import { createAutosave } from "../src/lib/autosave";

afterEach(() => vi.useRealTimers());

describe("autosave", () => {
  it("marks changes pending immediately and coalesces typing", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async (doc: string) => doc);
    const onStatus = vi.fn();
    const autosave = createAutosave({ save, onStatus });
    autosave.load("original");
    autosave.edit("first");
    autosave.edit("latest");
    expect(onStatus).toHaveBeenLastCalledWith("pending");
    expect(autosave.isDirty()).toBe(true);
    await vi.advanceTimersByTimeAsync(650);
    expect(save).toHaveBeenCalledExactlyOnceWith("latest");
    expect(autosave.isDirty()).toBe(false);
  });

  it("flushes a pending edit before switching and cancels its timer", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async (doc: string) => doc);
    const autosave = createAutosave({ save, onStatus: vi.fn() });
    autosave.load("hero A");
    autosave.edit("edited A");
    expect(() => autosave.load("hero B")).toThrow();
    await autosave.flush();
    autosave.load("hero B");
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledExactlyOnceWith("edited A");
  });

  it("serializes writes and flush waits for edits made during a request", async () => {
    const first = Promise.withResolvers<string>();
    const save = vi
      .fn<(doc: string) => Promise<string>>()
      .mockReturnValueOnce(first.promise)
      .mockImplementation(async (doc) => doc);
    const autosave = createAutosave({ save, onStatus: vi.fn() });
    autosave.load("initial");
    autosave.edit("revision 1");
    const pending = autosave.flush();
    autosave.edit("revision 2");
    expect(autosave.flush()).toBe(pending);
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve("revision 1");
    await pending;
    expect(save.mock.calls).toEqual([["revision 1"], ["revision 2"]]);
    expect(autosave.isDirty()).toBe(false);
  });

  it("keeps a failed revision dirty, blocks replacement and supports retry", async () => {
    const save = vi
      .fn<(doc: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockImplementation(async (doc) => doc);
    const onStatus = vi.fn();
    const autosave = createAutosave({ save, onStatus });
    autosave.load("original");
    autosave.edit("precious edit");
    await expect(autosave.flush()).rejects.toThrow("Offline");
    expect(onStatus).toHaveBeenLastCalledWith("error", "Offline");
    expect(autosave.isDirty()).toBe(true);
    expect(() => autosave.load("other")).toThrow();
    await autosave.flush();
    expect(autosave.isDirty()).toBe(false);
    expect(save.mock.calls).toEqual([["precious edit"], ["precious edit"]]);
  });

  it("does not send a late debounce write after a hero was deleted", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async (doc: string) => doc);
    const autosave = createAutosave({ save, onStatus: vi.fn() });
    autosave.load("hero");
    autosave.edit("changed");
    await autosave.flush();
    autosave.load(null);
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(1);
    expect(autosave.isDirty()).toBe(false);
  });
});

describe("autosave reverts", () => {
  it("keeps navigation guarded when reverting during an older write", async () => {
    const first = Promise.withResolvers<string>();
    const save = vi.fn<(document: string) => Promise<string>>()
      .mockReturnValueOnce(first.promise)
      .mockImplementation(async (document) => document);
    const autosave = createAutosave({ save, onStatus: vi.fn() });
    autosave.load("original");
    autosave.edit("changed");
    const pending = autosave.flush();
    autosave.edit("original");
    expect(autosave.isDirty()).toBe(true);
    first.resolve("changed");
    await pending;
    expect(save.mock.calls).toEqual([["changed"], ["original"]]);
    expect(autosave.isDirty()).toBe(false);
  });

  it("cancels a pending edit when reverted before saving", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async (document: string) => document);
    const onStatus = vi.fn();
    const autosave = createAutosave({ save, onStatus });
    autosave.load("original");
    autosave.edit("changed");
    autosave.edit("original");
    expect(onStatus).toHaveBeenLastCalledWith("saved");
    expect(autosave.isDirty()).toBe(false);
    await vi.runAllTimersAsync();
    expect(save).not.toHaveBeenCalled();
  });
});
