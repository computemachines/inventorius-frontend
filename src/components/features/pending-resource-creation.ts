import { useCallback, useEffect, useRef, useState } from "react";

import {
  BatchCreationRequest,
  SkuCreationRequest,
} from "../../api-client/data-models";
import { createIdempotencyKey } from "./inventory-operation-form";

const STORAGE_VERSION = 1;
const SKU_STORAGE_KEY = "inventorius:new-sku:pending-command";
const BATCH_STORAGE_KEY = "inventorius:new-batch:pending-command";

export interface PendingResourceCreation<T> {
  version: typeof STORAGE_VERSION;
  key: string;
  payload: T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: string[],
): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isOptionalStringArray(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((entry) => typeof entry === "string"))
  );
}

function isJsonValue(value: unknown): boolean {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!isRecord(value)) return false;
  return Object.values(value).every(isJsonValue);
}

function isOptionalProps(value: unknown): boolean {
  return value === undefined || (isRecord(value) && isJsonValue(value));
}

function isOptionalId(value: unknown, prefix: "SKU" | "BAT"): boolean {
  return (
    value === undefined ||
    (typeof value === "string" &&
      new RegExp(`^${prefix}\\d{1,6}$`, "i").test(value))
  );
}

function isSkuCreationRequest(value: unknown): value is SkuCreationRequest {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "id",
      "name",
      "props",
      "owned_codes",
      "associated_codes",
    ])
  ) {
    return false;
  }
  return (
    isOptionalId(value.id, "SKU") &&
    typeof value.name === "string" &&
    isOptionalProps(value.props) &&
    isOptionalStringArray(value.owned_codes) &&
    isOptionalStringArray(value.associated_codes)
  );
}

function isBatchCreationRequest(value: unknown): value is BatchCreationRequest {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "id",
      "sku_id",
      "name",
      "props",
      "owned_codes",
      "associated_codes",
    ])
  ) {
    return false;
  }
  return (
    isOptionalId(value.id, "BAT") &&
    isOptionalString(value.sku_id) &&
    (value.sku_id === undefined ||
      /^SKU\d{1,6}$/i.test(value.sku_id as string)) &&
    isOptionalString(value.name) &&
    isOptionalProps(value.props) &&
    isOptionalStringArray(value.owned_codes) &&
    isOptionalStringArray(value.associated_codes)
  );
}

function isPendingResourceCreation<T>(
  value: unknown,
  isPayload: (payload: unknown) => payload is T,
): value is PendingResourceCreation<T> {
  if (!isRecord(value) || value.version !== STORAGE_VERSION) return false;
  const keyContainsControlCharacter =
    typeof value.key === "string" &&
    Array.from(value.key).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    });
  if (
    typeof value.key !== "string" ||
    value.key.length === 0 ||
    value.key.length > 200 ||
    keyContainsControlCharacter
  ) {
    return false;
  }
  return isPayload(value.payload);
}

/**
 * Preserve an unconfirmed resource-creation command within this browser tab.
 *
 * The complete payload and its idempotency key are stored before the request.
 * A retry after a lost response therefore asks the server about the same
 * command; it cannot silently allocate and print a second identity.
 */
function usePendingResourceCreation<T>(
  storageKey: string,
  isPayload: (payload: unknown) => payload is T,
) {
  const pendingRef = useRef<PendingResourceCreation<T> | null>(null);
  const [pending, setPending] = useState<PendingResourceCreation<T> | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);

  useEffect(() => {
    try {
      const serialized = window.sessionStorage.getItem(storageKey);
      let restored: PendingResourceCreation<T> | null = null;

      if (serialized !== null) {
        try {
          const parsed: unknown = JSON.parse(serialized);
          if (isPendingResourceCreation(parsed, isPayload)) {
            restored = parsed;
          } else {
            window.sessionStorage.removeItem(storageKey);
          }
        } catch {
          window.sessionStorage.removeItem(storageKey);
        }
      }

      pendingRef.current = restored;
      setPending(restored);
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    } finally {
      setReady(true);
    }
  }, [isPayload, storageKey]);

  const getOrCreate = useCallback(
    (payload: T): PendingResourceCreation<T> | null => {
      if (pendingRef.current) return pendingRef.current;

      const next: PendingResourceCreation<T> = {
        version: STORAGE_VERSION,
        key: createIdempotencyKey(),
        payload,
      };

      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        setStorageAvailable(false);
        return null;
      }

      pendingRef.current = next;
      setPending(next);
      return next;
    },
    [storageKey],
  );

  const clear = useCallback(() => {
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      // If this record becomes visible again later, API idempotency still
      // makes it refer to the original command rather than a new allocation.
    }
    pendingRef.current = null;
    setPending(null);
  }, [storageKey]);

  return { pending, ready, storageAvailable, getOrCreate, clear };
}

export function usePendingNewSkuCommand() {
  return usePendingResourceCreation(SKU_STORAGE_KEY, isSkuCreationRequest);
}

export function usePendingNewBatchCommand() {
  return usePendingResourceCreation(BATCH_STORAGE_KEY, isBatchCreationRequest);
}
