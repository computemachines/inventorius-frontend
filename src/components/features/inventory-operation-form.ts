import { useRef } from "react";

export const labelClasses =
  "block text-[0.85rem] font-semibold text-[#04151f] uppercase tracking-wide mb-1.5";

export const inputClasses =
  "w-full rounded-md border border-[#cdd2d6] bg-white px-3 py-3 text-base text-[#04151f] focus:border-[#26532b] focus:outline-none focus:ring-2 focus:ring-[#26532b]/20";

export const submitClasses =
  "w-full rounded-md bg-[#26532b] px-6 py-3 text-base font-semibold text-white hover:bg-[#1e4423] disabled:cursor-wait disabled:opacity-60";

export function isBinId(value: string): boolean {
  return /^BIN\d{6}$/.test(value);
}

export function isBatchId(value: string): boolean {
  return /^BAT\d{6}$/.test(value);
}

export function isSkuId(value: string): boolean {
  return /^SKU\d{6}$/.test(value);
}

export function createIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

/**
 * Keep one key for a canonical command until the server confirms it. Retrying
 * after a timeout is therefore safe, while changing any command field creates
 * a distinct operation on the next submission.
 */
export function useCommandIdempotency() {
  const pending = useRef<{ payload: string; key: string } | null>(null);

  return {
    keyFor(payload: unknown): string {
      const serialized = JSON.stringify(payload);
      if (pending.current?.payload !== serialized) {
        pending.current = { payload: serialized, key: createIdempotencyKey() };
      }
      return pending.current.key;
    },
    clear() {
      pending.current = null;
    },
  };
}
