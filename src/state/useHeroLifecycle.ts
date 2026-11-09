import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Character, CharacterSummary } from "../types";
import { createAutosave, type SaveStatus } from "../lib/autosave";
import { getCharacterRepository } from "../lib/api";
import { useStorageScope } from "./StorageScope";
import { parseCharacterImport } from "../lib/character-import";
import { normalizeCharacter } from "../lib/defaults";
import { makeId } from "../data/templates";
import { recalculateCharacter } from "../lib/character-calculations";
import { downloadJson, safeFilename } from "../lib/utils";

type Notify = (message: string, tone?: "info" | "success" | "error") => void;

export class PendingHeroEditsError extends Error {
  constructor(readonly pendingCount: number, readonly localError: string) {
    super("Есть несинхронизированные правки. Можно остаться или выйти, сохранив правки для этого аккаунта на устройстве.");
    this.name = "PendingHeroEditsError";
  }
}

export interface UseHeroLifecycleOptions {
  notify: Notify;
  navigate: (tab: string) => void;
  /** Сбрасывает сессию бросков и историю игровых действий при смене героя. */
  onActivate: () => void;
  beforeSignOut: { current: () => Promise<void> };
}

function toSummary(character: Character): CharacterSummary {
  return {
    id: character.id,
    name: character.name,
    className: character.className,
    ancestry: character.ancestry,
    level: character.level,
    updatedAt: character.updatedAt,
    ...(character.avatar?.url ? { avatarUrl: character.avatar.url } : {}),
  };
}

function sortSummaries(list: CharacterSummary[]): CharacterSummary[] {
  return [...list].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/**
 * Загружает список и активного героя, сериализует переходы между героями
 * и отвечает за сохранение и жизненный цикл документов.
 */
export function useHeroLifecycle({
  notify,
  navigate,
  onActivate,
  beforeSignOut,
}: UseHeroLifecycleOptions) {
  const scope = useStorageScope();
  const repository = useMemo(() => getCharacterRepository(scope), [scope]);
  const { listCharacters, loadCharacter, saveCharacter, deleteCharacter: deleteCharacterRequest } = repository;
  const [persistence, setPersistence] = useState(() => repository.getState());
  const allowPendingSignOut = useRef(false);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [character, setCharacter] = useState<Character | null>(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [changingCharacter, setChangingCharacter] = useState(false);

  const characterRef = useRef<Character | null>(null);
  const characterAction = useRef(false);
  const autosave = useMemo(
    () =>
      createAutosave<Character>({
        save: saveCharacter,
        onEdit: repository.stageCharacter,
        onStatus: (status, error = "") => {
          setSaveStatus(status);
          setSaveError(error);
        },
        onSaved: (saved, submitted) => {
          if (characterRef.current === submitted) {
            const acknowledged = { ...submitted, updatedAt: saved.updatedAt };
            characterRef.current = acknowledged;
            setCharacter(acknowledged);
          }
          setCharacters((previous) =>
            sortSummaries(
              previous.map((item) =>
                item.id === saved.id ? toSummary(saved) : item,
              ),
            ),
          );
        },
      }),
    [repository, saveCharacter],
  );

  useEffect(() => repository.subscribe(setPersistence), [repository]);

  const update = useCallback(
    (recipe: (current: Character) => Character) => {
      const previous = characterRef.current;
      if (!previous || characterAction.current) return;
      allowPendingSignOut.current = false;
      const next = {
        ...recalculateCharacter(previous, recipe(previous)),
        updatedAt: new Date().toISOString(),
      };
      characterRef.current = next;
      autosave.edit(next);
      setCharacter(next);
    },
    [autosave],
  );

  const patch = useCallback(
    (partial: Partial<Character>) =>
      update((current) => ({ ...current, ...partial })),
    [update],
  );

  useEffect(() => {
    beforeSignOut.current = async () => {
      if (characterAction.current)
        throw new Error("Дождитесь завершения операции с героем");
      if (allowPendingSignOut.current) {
        allowPendingSignOut.current = false;
        autosave.dispose();
        await autosave.settled().catch(() => undefined);
        return;
      }
      try {
        await autosave.flush();
        await repository.syncPending();
      } catch (error) {
        const state = repository.getState();
        if (state.pendingCount || autosave.isDirty()) {
          throw new PendingHeroEditsError(state.pendingCount, state.localError);
        }
        throw error;
      }
    };
    return () => {
      beforeSignOut.current = async () => undefined;
    };
  }, [autosave, beforeSignOut, repository]);

  /* ---------- Первичная загрузка ---------- */

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const list = await listCharacters();
        if (disposed) return;
        setCharacters(sortSummaries(list));
        if (list.length > 0) {
          const doc = normalizeCharacter(await loadCharacter(list[0].id));
          if (disposed) return;
          characterRef.current = doc;
          autosave.load(doc, { pending: repository.isPending(doc.id) });
          setCharacter(doc);
        }
        // A restarted app retries its durable queue. A failed request leaves it
        // pending, with both versions available if the server has moved on.
        void autosave.flush().then(() => {
          if (!disposed) return repository.syncPending();
        }).catch(() => undefined);
      } catch (error) {
        if (!disposed) {
          setBootError(
            error instanceof Error ? error.message : "Сервис недоступен",
          );
        }
      } finally {
        if (!disposed) setBooting(false);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [autosave, repository, listCharacters, loadCharacter]);

  /* ---------- Автосохранение ---------- */

  useEffect(() => {
    const guardUnload = (event: BeforeUnloadEvent) => {
      if (!autosave.isDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const flush = () => {
      void autosave.flush().then(() => repository.syncPending()).catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", guardUnload);
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", guardUnload);
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      autosave.dispose();
    };
  }, [autosave, repository]);

  /* ---------- Действия с персонажами ---------- */

  const activateCharacter = (doc: Character | null) => {
    autosave.load(doc, { pending: doc !== null && repository.isPending(doc.id) });
    characterRef.current = doc;
    setCharacter(doc);
    onActivate();
  };

  const changeCharacter = async (action: () => Promise<void>) => {
    if (characterAction.current)
      throw new Error("Дождитесь завершения операции с героем");
    characterAction.current = true;
    setChangingCharacter(true);
    try {
      // Includes the debounce window and all edits queued during an earlier write.
      await autosave.flush();
      await action();
    } finally {
      characterAction.current = false;
      setChangingCharacter(false);
    }
  };

  const handleSelectCharacter = async (id: string, options: { openSheet?: boolean } = {}) => {
    if (characterRef.current?.id === id) {
      if (options.openSheet) navigate("sheet");
      return;
    }
    try {
      await changeCharacter(async () => {
        activateCharacter(normalizeCharacter(await loadCharacter(id)));
      });
      if (options.openSheet) navigate("sheet");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Не удалось загрузить героя",
        "error",
      );
    }
  };

  /** Use after an item transaction: install an acknowledged document while
   * editing is guarded, rather than feeding a remote snapshot through update(). */
  const refreshCharacter = async () => {
    await changeCharacter(async () => {
      const id = characterRef.current?.id;
      if (!id) return;
      const doc = normalizeCharacter(await loadCharacter(id));
      autosave.load(doc, { pending: repository.isPending(id) });
      characterRef.current = doc;
      setCharacter(doc);
      setCharacters(previous => sortSummaries(previous.map(item => item.id === id ? toSummary(doc) : item)));
    });
  };

  const handleCreate = async (draft: Character) => {
    await changeCharacter(async () => {
      const doc = await saveCharacter(draft);
      setCharacters((prev) => sortSummaries([toSummary(doc), ...prev]));
      activateCharacter(doc);
      navigate("sheet");
      notify(`Герой «${doc.name}» создан`, "success");
    });
  };

  const handleDuplicate = async (id: string) => {
    try {
      await changeCharacter(async () => {
        const source =
          characterRef.current?.id === id
            ? characterRef.current
            : normalizeCharacter(await loadCharacter(id));
        const now = new Date().toISOString();
        const copy: Character = {
          ...source,
          id: makeId(),
          name: `${source.name} — копия`,
          // Файл портрета принадлежит исходному герою; копия начинает без него.
          avatar: undefined,
          createdAt: now,
          updatedAt: now,
        };
        const saved = await saveCharacter(copy);
        setCharacters((prev) => sortSummaries([toSummary(saved), ...prev]));
        activateCharacter(saved);
        notify("Создана копия героя", "success");
      });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Не удалось скопировать",
        "error",
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await changeCharacter(async () => {
        const remaining = characters.filter((item) => item.id !== id);
        const deletingCurrent = characterRef.current?.id === id;
        // Load the replacement first: a failed read must leave the current hero intact.
        const replacement =
          deletingCurrent && remaining.length
            ? normalizeCharacter(await loadCharacter(remaining[0].id))
            : null;
        await deleteCharacterRequest(id);
        setCharacters(remaining);
        if (deletingCurrent) {
          activateCharacter(replacement);
          if (!replacement) navigate("sheet");
        }
        notify("Персонаж удалён", "success");
      });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Не удалось удалить",
        "error",
      );
      throw error;
    }
  };

  const handleExport = async (id: string) => {
    try {
      const doc =
        characterRef.current?.id === id
          ? characterRef.current
          : await loadCharacter(id);
      downloadJson(`${safeFilename(doc.name)}.draw-steel.json`, doc);
      notify("JSON сохранён", "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Не удалось экспортировать",
        "error",
      );
    }
  };

  const handleImport = async (file: File) => {
    try {
      await changeCharacter(async () => {
        const doc = await parseCharacterImport(file);
        const saved = await saveCharacter(doc);
        setCharacters((prev) => sortSummaries([toSummary(saved), ...prev]));
        activateCharacter(saved);
        navigate("sheet");
        notify(`Импортирован герой «${saved.name}»`, "success");
      });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Не удалось импортировать",
        "error",
      );
    }
  };

  const isTransitioning = useCallback(
    () => characterAction.current,
    [],
  );

  const retryPersistence = async () => {
    repository.retryLocalPersistence();
    await autosave.flush();
    await repository.syncPending();
  };
  const resolveConflict = async (recoveryId: string, choice: "keep-local" | "use-server") => {
    if (characterAction.current) throw new Error("Дождитесь завершения операции с героем");
    characterAction.current = true;
    setChangingCharacter(true);
    try {
      autosave.dispose();
      await autosave.settled().catch(() => undefined);
      const recovery = repository.getState().recoveries.find(item => item.id === recoveryId);
      const doc = await repository.resolveConflict(recoveryId, choice);
      if (characterRef.current?.id === recovery?.document.id) {
        const normalized = doc ? normalizeCharacter(doc) : null;
        autosave.resolve(normalized);
        characterRef.current = normalized;
        setCharacter(normalized);
      }
      setCharacters(sortSummaries(await listCharacters()));
      return doc;
    } finally {
      characterAction.current = false;
      setChangingCharacter(false);
    }
  };
  const downloadRecovery = (recoveryId: string, version: "local" | "server") => {
    const recovery = repository.getState().recoveries.find(item => item.id === recoveryId);
    const doc = version === "server" ? recovery?.conflict?.server : recovery?.document;
    if (!doc) throw new Error("Эта версия героя отсутствует");
    downloadJson(`${safeFilename(doc.name)}.${version}.draw-steel.json`, doc);
  };

  return {
    characters,
    character,
    characterRef,
    booting,
    bootError,
    saveStatus,
    saveError,
    changingCharacter,
    autosave,
    update,
    patch,
    isTransitioning,
    handleSelectCharacter,
    refreshCharacter,
    handleCreate,
    handleDuplicate,
    handleDelete,
    handleExport,
    handleImport,
    persistence,
    retryPersistence,
    resolveConflict,
    downloadRecovery,
    /** UI calls this only after an explicit "leave with local edits" choice,
     * then invokes the existing account signOut control again. */
    allowSignOutWithPending: () => { allowPendingSignOut.current = true; },
  };
}
