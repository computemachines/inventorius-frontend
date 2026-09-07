import { normalizeInventoriusId } from "../../identifiers";

export function itemReferenceId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = normalizeInventoriusId(value);
  return /^(SKU|BAT)\d{6}$/.test(id) ? id : null;
}

/** Render only canonical stored references, including legacy JSON display values. */
export function displayedItemReferences(value: string): string[] | null {
  if (itemReferenceId(value) === value) return [value];
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      Array.isArray(parsed) &&
      parsed.length &&
      parsed.every((id) => typeof id === "string" && itemReferenceId(id) === id)
    )
      return parsed;
  } catch {
    /* Ordinary text remains ordinary text. */
  }
  return null;
}
