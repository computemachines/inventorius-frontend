import { useCallback, useEffect, useRef, useState } from "react";

import { createIdempotencyKey } from "./inventory-operation-form";

const STORAGE_KEY = "inventorius:new-bin:pending-command";
const STORAGE_VERSION = 1;

export interface NewBinPayload {
  id?: string;
}

export interface PendingNewBinCommand {
  version: typeof STORAGE_VERSION;
  key: string;
  payload: NewBinPayload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPendingNewBinCommand(value: unknown): value is PendingNewBinCommand {
  if (!isRecord(value) || value.version !== STORAGE_VERSION) return false;
  if (
    typeof value.key !== "string" ||
    value.key.length === 0 ||
    value.key.length > 200 ||
    /[\u0000-\u001f\u007f]/.test(value.key)
  ) {
    return false;
  }
  if (!isRecord(value.payload)) return false;

  const payloadKeys = Object.keys(value.payload);
  if (payloadKeys.some((key) => key !== "id")) return false;
  if (!("id" in value.payload)) return true;

  return (
    typeof value.payload.id === "string" &&
    /^BIN\d{1,6}$/i.test(value.payload.id)
  );
}

function readPendingCommand(): PendingNewBinCommand | null {
  const serialized = window.sessionStorage.getItem(STORAGE_KEY);
  if (serialized === null) return null;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (isPendingNewBinCommand(parsed)) return parsed;
  } catch {
    // Invalid or obsolete session data must never become an API command.
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
  return null;
}

/**
 * Preserve an unconfirmed New Bin command within this browser tab.
 *
 * The record is written before the request begins. A reload or route change can
 * therefore recover the same payload with the same idempotency key instead of
 * accidentally allocating a second bin.
 */
export function usePendingNewBinCommand() {
  const pendingRef = useRef<PendingNewBinCommand | null>(null);
  const [pending, setPending] = useState<PendingNewBinCommand | null>(null);
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);

  useEffect(() => {
    try {
      const restored = readPendingCommand();
      pendingRef.current = restored;
      setPending(restored);
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    } finally {
      setReady(true);
    }
  }, []);

  const getOrCreate = useCallback(
    (payload: NewBinPayload): PendingNewBinCommand | null => {
      if (pendingRef.current) return pendingRef.current;

      const next: PendingNewBinCommand = {
        version: STORAGE_VERSION,
        key: createIdempotencyKey(),
        payload,
      };

      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        setStorageAvailable(false);
        return null;
      }

      pendingRef.current = next;
      setPending(next);
      return next;
    },
    [],
  );

  const clear = useCallback(() => {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // A command already held in memory can still be cleared for this mount.
      // If browser storage later becomes readable again, API idempotency makes
      // the stale record recover the same bin rather than allocate another.
    }
    pendingRef.current = null;
    setPending(null);
  }, []);

  return { pending, ready, storageAvailable, getOrCreate, clear };
}
