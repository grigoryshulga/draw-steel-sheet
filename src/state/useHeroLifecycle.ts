import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Character, CharacterSummary } from "../types";
import { createAutosave, type SaveStatus } from "../lib/autosave";
import {
  deleteCharacter as deleteCharacterRequest,
  listCharacters,
  loadCharacter,
  saveCharacter,
} from "../lib/api";
import { parseCharacterImport } from "../lib/character-import";
import { normalizeCharacter } from "../lib/defaults";
import { makeId } from "../data/templates";
import { recalculateCharacter } from "../lib/character-calculations";
import { downloadJson, safeFilename } from "../lib/utils";

type Notify = (message: string, tone?: "info" | "success" | "error") => void;

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
        onStatus: (status, error = "") => {
          setSaveStatus(status);
          setSaveError(error);
        },
        onSaved: (saved) =>
          setCharacters((previous) =>
            sortSummaries(
              previous.map((item) =>
                item.id === saved.id ? toSummary(saved) : item,
              ),
            ),
          ),
      }),
    [],
  );

  const update = useCallback(
    (recipe: (current: Character) => Character) => {
      const previous = characterRef.current;
      if (!previous || characterAction.current) return;
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
      await autosave.flush();
    };
    return () => {
      beforeSignOut.current = async () => undefined;
    };
  }, [autosave, beforeSignOut]);

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
          autosave.load(doc);
          setCharacter(doc);
        }
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
  }, [autosave]);

  /* ---------- Автосохранение ---------- */

  useEffect(() => {
    const guardUnload = (event: BeforeUnloadEvent) => {
      if (!autosave.isDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const flush = () => {
      void autosave.flush().catch(() => undefined);
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
  }, [autosave]);

  /* ---------- Действия с персонажами ---------- */

  const activateCharacter = (doc: Character | null) => {
    autosave.load(doc);
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

  const handleSelectCharacter = async (id: string) => {
    if (characterRef.current?.id === id) return;
    try {
      await changeCharacter(async () => {
        activateCharacter(normalizeCharacter(await loadCharacter(id)));
      });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Не удалось загрузить героя",
        "error",
      );
    }
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
    handleCreate,
    handleDuplicate,
    handleDelete,
    handleExport,
    handleImport,
  };
}
