import type { SchemaField, SchemaValue } from "../../hooks/useSchemaForm";

export type SchemaInputValue = string | boolean | { unit: string; value: string };

export type RawProperties = Record<string, unknown>;

export function valuesForSchemaEvaluation(properties: RawProperties): RawProperties {
  return Object.fromEntries(
    Object.entries(properties).map(([name, value]) => [
      name,
      isUnitValue(value) ? value.value : value,
    ]),
  );
}

export function valueForSchemaInput(
  field: SchemaField,
  storedValue: SchemaValue,
): SchemaInputValue {
  if (field.type === "bool") return storedValue === true;
  if (field.type === "unit" && !field.unit?.trim()) {
    return isUnitValue(storedValue)
      ? { unit: storedValue.unit, value: String(storedValue.value) }
      : { unit: "", value: storedValue == null ? "" : String(storedValue) };
  }
  if (field.type === "unit" && isUnitValue(storedValue)) {
    return String(storedValue.value);
  }
  if (storedValue === undefined || storedValue === null) return "";
  return String(storedValue);
}

export function valueFromSchemaInput(
  _field: SchemaField,
  inputValue: SchemaInputValue,
): unknown {
  // Keep the user's lexical input while editing. This preserves intermediate
  // decimal and negative forms such as "1." and "-" in controlled inputs.
  return inputValue;
}

export function encodeChangedSchemaValues(
  values: RawProperties,
  fields: Iterable<SchemaField>,
  changedNames: Iterable<string>,
): { values: RawProperties; invalidNames: string[] } {
  const definitions = new Map(Array.from(fields, (field) => [field.name, field]));
  const encoded: RawProperties = {};
  const invalidNames: string[] = [];
  for (const name of changedNames) {
    const value = values[name];
    const field = definitions.get(name);
    if (!field || value === "" || value === undefined || field.type === "bool") {
      encoded[name] = value;
      continue;
    }
    if (field.type === "number" || field.type === "unit") {
      const rawNumber = isUnitValue(value) ? value.value : value;
      const unit = field.unit?.trim() || (isUnitValue(value) ? value.unit.trim() : "");
      if (field.type === "unit" && rawNumber === "" && !unit) {
        encoded[name] = "";
        continue;
      }
      const number = typeof rawNumber === "number" ? rawNumber : Number(rawNumber);
      if (field.type === "unit" && (!unit || rawNumber === "")) {
        invalidNames.push(name);
        continue;
      }
      if (!Number.isFinite(number)) {
        invalidNames.push(name);
        continue;
      }
      encoded[name] = field.type === "unit"
        ? { unit, value: number }
        : number;
      continue;
    }
    encoded[name] = value;
  }
  return { values: encoded, invalidNames };
}

export function persistedMixins(
  activeMixins: string[],
  schemaRoots: string[],
  implicitRoots: string[],
): string[] {
  const transientRoots = new Set([...schemaRoots, ...implicitRoots]);
  return activeMixins.filter((mixin) => !transientRoots.has(mixin));
}

export function overlaySchemaProperties(
  original: RawProperties,
  changedValues: RawProperties,
  changedNames: Iterable<string>,
  mixins: string[],
): RawProperties {
  const result = { ...original };
  for (const name of changedNames) {
    const value = changedValues[name];
    if (value === "" || value === undefined) delete result[name];
    else result[name] = value;
  }
  if (mixins.length > 0 || Object.prototype.hasOwnProperty.call(original, "_mixins")) {
    result._mixins = mixins;
  }
  else delete result._mixins;
  return result;
}

function isUnitValue(value: unknown): value is { unit: string; value: number | string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { unit?: unknown }).unit === "string" &&
    ["number", "string"].includes(typeof (value as { value?: unknown }).value)
  );
}
