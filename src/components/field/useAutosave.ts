// Saving that only says saved when the server has said so.
//
// A change goes into a pending buffer and stays there until the request that
// carried it comes back successful. A failed request keeps the change, shows
// the failure, and can be retried. Nothing is ever cleared optimistically.
//
// This is the online half of the save layer. The offline store comes later and
// will sit underneath this same contract.
import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface AutosaveOptions<T> {
  /** Sends the patch. Resolve true only when the server has acknowledged it. */
  save: (patch: Record<string, T>) => Promise<boolean>;
  /** Quiet time after the last change before a save runs. */
  delay?: number;
}

export interface Autosave<T> {
  status: SaveStatus;
  savedAt: Date | null;
  /** True while a change is entered and not yet acknowledged. */
  hasPending: boolean;
  /** Buffer a change and schedule a save. */
  queue: (key: string, value: T) => void;
  /** Save everything pending now. Resolves true when nothing is outstanding. */
  flush: () => Promise<boolean>;
  /** Retry after a failure. */
  retry: () => Promise<boolean>;
}

export function useAutosave<T = unknown>({ save, delay = 900 }: AutosaveOptions<T>): Autosave<T> {
  const pending = useRef<Record<string, T>>({});
  const timer = useRef<number | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const statusRef = useRef<SaveStatus>("idle");
  const saveRef = useRef(save);
  saveRef.current = save;

  const [status, setStatusState] = useState<SaveStatus>("idle");
  const setStatus = (next: SaveStatus) => { statusRef.current = next; setStatusState(next); };
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [hasPending, setHasPending] = useState(false);

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const flush = useCallback(async (): Promise<boolean> => {
    clearTimer();
    // A save already on its way is waited for rather than skipped, so a flush
    // before moving on or sending never returns while work is outstanding.
    if (inflight.current) {
      await inflight.current;
      if (Object.keys(pending.current).length === 0) return statusRef.current !== "error";
    }
    const patch = { ...pending.current };
    const keys = Object.keys(patch);
    if (keys.length === 0) {
      setHasPending(false);
      return true;
    }

    setStatus("saving");
    let ok = false;
    let settle: () => void = () => {};
    inflight.current = new Promise<void>((resolve) => { settle = resolve; });
    try {
      ok = await saveRef.current(patch);
    } catch {
      ok = false;
    }
    inflight.current = null;
    settle();

    if (!ok) {
      // The change stays exactly where it was. Nothing is lost and the last
      // successful timestamp is not reused to imply this one worked.
      setHasPending(Object.keys(pending.current).length > 0);
      setStatus("error");
      return false;
    }

    // Clear only what this request actually carried and what has not been
    // changed again since it left.
    for (const key of keys) {
      if (Object.is(pending.current[key], patch[key])) delete pending.current[key];
    }
    const outstanding = Object.keys(pending.current).length > 0;
    setSavedAt(new Date());
    setHasPending(outstanding);
    setStatus(outstanding ? "pending" : "saved");
    if (outstanding) {
      timer.current = window.setTimeout(() => { void flush(); }, delay);
      return false;
    }
    return true;
  }, [delay]);

  const queue = useCallback((key: string, value: T) => {
    pending.current[key] = value;
    setHasPending(true);
    setStatus("pending");
    clearTimer();
    timer.current = window.setTimeout(() => { void flush(); }, delay);
  }, [delay, flush]);

  useEffect(() => clearTimer, []);

  return { status, savedAt, hasPending, queue, flush, retry: flush };
}

export default useAutosave;
