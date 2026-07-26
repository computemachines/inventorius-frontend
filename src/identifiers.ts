/** Normalize human shorthand to the fixed-width ID stored by Inventorius. */
export function normalizeInventoriusId(value: string): string {
  const cleaned = value.trim().toUpperCase();
  const match = cleaned.match(/^(BIN|SKU|BAT|PRC)(\d{1,6})$/);

  if (!match) {
    return cleaned;
  }

  return `${match[1]}${match[2].padStart(6, "0")}`;
}
