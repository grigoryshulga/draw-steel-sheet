import { useCallback, useEffect, useRef, useState } from "react";
import { BOARD_VIEW, clampBoardView, SHARED_BOARD_VIEW } from "../lib/tables/board";
import { tableRepository } from "../lib/tables/repository";
import type { BoardView, SharedBoardView } from "../lib/tables/types";

const UPDATE_INTERVAL = 250;

export function useBoardView(tableId: string, canLead: boolean, sharedEnabled = true) {
  const [view, setView] = useState<BoardView>(BOARD_VIEW);
  const [shared, setShared] = useState<SharedBoardView>(SHARED_BOARD_VIEW);
  const [error, setError] = useState("");
  const [readError, setReadError] = useState("");
  const [ready, setReady] = useState(false);
  const [changing, setChanging] = useState(false);
  const position = useRef(view);
  const latest = useRef(shared);
  const owned = useRef<string | null>(null);
  const sequence = useRef(0);
  const pending = useRef(false);
  const sending = useRef(false);
  const readPending = useRef(false);
  const reading = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const mounted = useRef(false);
  const retryMove = useRef<() => void>(() => {});

  const display = useCallback((next: BoardView) => {
    position.current = next;
    setView(next);
  }, []);

  const accept = useCallback((next: SharedBoardView) => {
    if (!mounted.current || next.revision <= latest.current.revision) return;
    const previous = latest.current;
    latest.current = next;
    setShared(next);
    if (next.control && next.control === owned.current) return;
    owned.current = null;
    pending.current = false;
    if (next.control || previous.control) display(clampBoardView(next));
  }, [display]);

  const refresh = useCallback(async () => {
    readPending.current = true;
    if (reading.current) return;
    reading.current = true;
    try {
      while (readPending.current && mounted.current) {
        readPending.current = false;
        const next = await tableRepository.readBoardView(tableId);
        if (!mounted.current) return;
        accept(next);
        setReadError("");
        setReady(true);
        if (pending.current && timer.current === undefined) retryMove.current();
      }
    } catch (problem) {
      if (mounted.current) setReadError(problem instanceof Error ? problem.message : "Не удалось получить общий обзор");
    } finally {
      reading.current = false;
    }
  }, [accept, tableId]);

  useEffect(() => {
    if (!sharedEnabled) return;
    mounted.current = true;
    void refresh();
    const unsubscribe = tableRepository.subscribeBoardView(tableId, () => void refresh());
    return () => {
      mounted.current = false;
      unsubscribe();
      window.clearTimeout(timer.current);
      timer.current = undefined;
    };
  }, [refresh, sharedEnabled, tableId]);

  const sendMove = useCallback(async function send() {
    const control = owned.current;
    if (!pending.current || sending.current || !control || !mounted.current) return;
    sending.current = true;
    pending.current = false;
    try {
      accept(await tableRepository.writeBoardView(tableId, {
        type: "move", control, sequence: ++sequence.current,
        view: position.current,
      }));
      if (mounted.current) setError("");
    } catch (problem) {
      if (mounted.current) {
        setError(problem instanceof Error ? problem.message : "Не удалось передать положение полотна");
        // Keep the latest position available for retry after the next gesture.
        if (owned.current === control) pending.current = true;
      }
      return;
    } finally {
      sending.current = false;
    }
    if (pending.current && timer.current === undefined) {
      timer.current = window.setTimeout(() => {
        timer.current = undefined;
        void send();
      }, UPDATE_INTERVAL);
    }
  }, [accept, tableId]);
  retryMove.current = () => { void sendMove(); };

  const move = (next: BoardView, immediately = false) => {
    if (latest.current.control && latest.current.control !== owned.current) return;
    display(clampBoardView(next));
    if (!canLead || !owned.current) return;
    pending.current = true;
    if (immediately) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
      void sendMove();
    } else if (timer.current === undefined) {
      timer.current = window.setTimeout(() => {
        timer.current = undefined;
        void sendMove();
      }, UPDATE_INTERVAL);
    }
  };

  const lead = async (start: boolean) => {
    if (!ready || !canLead || changing) return;
    const control = start ? crypto.randomUUID() : latest.current.control;
    if (!control) return;
    setChanging(true);
    setError("");
    try {
      if (start) {
        owned.current = control;
        sequence.current = 0;
      } else {
        pending.current = false;
        window.clearTimeout(timer.current);
        timer.current = undefined;
      }
      const next = await tableRepository.writeBoardView(tableId, start
        ? { type: "start", control, expectedRevision: latest.current.revision, view: position.current }
        : { type: "stop", control, view: position.current });
      accept(next);
      if (start && latest.current.control !== control) {
        owned.current = null;
        setError("Обзор изменился. Нажмите «Вести обзор» ещё раз.");
      }
    } catch (problem) {
      if (mounted.current) {
        setError(problem instanceof Error ? problem.message : "Не удалось изменить режим обзора");
        void refresh();
      }
    } finally {
      if (mounted.current) setChanging(false);
    }
  };
  const following = !!shared.control && (!canLead || shared.control !== owned.current);
  return { view, position, move, lead, following, shared, ready, changing, error: error || readError };
}
