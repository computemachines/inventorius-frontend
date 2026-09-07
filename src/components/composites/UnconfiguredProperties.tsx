import * as React from "react";
import { useEffect, useState } from "react";
import type { SchemaField } from "../../hooks/useSchemaForm";
import { SchemaFieldList, inputClasses } from "./SchemaFields";
import { encodeChangedSchemaValues, RawProperties } from "./schema-property-values";
import { itemReferenceId } from "./item-references";

export function storedPropertyField(name: string, value: unknown): SchemaField {
  const type = typeof value === "number" ? "number"
    : typeof value === "boolean" ? "bool"
    : isMeasurement(value) ? "unit"
    : typeof value === "string" ? "text" : "json";
  return { name, type, ...(type === "text" ? { multiline: true } : {}) };
}

function isMeasurement(value: unknown): value is { value: number; unit: string } {
  return value !== null && typeof value === "object" &&
    typeof (value as any).value === "number" && typeof (value as any).unit === "string" &&
    Object.keys(value).every(key => key === "value" || key === "unit");
}

/** Only offer transfers that preserve the complete stored value, including units. */
export function acceptsStoredProperty(field: SchemaField, value: unknown): boolean {
  switch (field.type) {
    case "unit": return isMeasurement(value) && Number.isFinite(value.value) &&
      (!field.unit?.trim() || field.unit.trim() === value.unit);
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "bool": return typeof value === "boolean";
    case "text": return typeof value === "string";
    case "enum": return typeof value === "string" && !!field.options?.includes(value);
    case "item-reference": return typeof value === "string" && itemReferenceId(value) === value;
    case "item-reference-list": return Array.isArray(value) && value.every(v => typeof v === "string" && itemReferenceId(v) === v);
    default: return false;
  }
}

function PropertyRow({ name, value, fields, values, onChange, onMove, onPendingEdit }: {
  name: string; value: unknown; fields: SchemaField[]; values: RawProperties;
  onPendingEdit: (name: string, pending: boolean) => void;
  onChange: (name: string, value: unknown) => void;
  onMove: (from: string, to: string, value: unknown, replace: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    onPendingEdit(name, editing);
    return () => onPendingEdit(name, false);
  }, [name, editing, onPendingEdit]);
  const [draft, setDraft] = useState<unknown>(value);
  const [error, setError] = useState("");
  const [destination, setDestination] = useState("");
  const field = storedPropertyField(name, value);
  const candidates = fields.filter(f => acceptsStoredProperty(f, value));
  const target = candidates.find(f => f.name === destination);
  const occupied = target && values[target.name] !== undefined && values[target.name] !== "";
  const display = isMeasurement(value) ? `${value.value} ${value.unit}`
    : typeof value === "string" ? value : JSON.stringify(value);
  const button = "px-3 py-2 rounded border border-[#cdd2d6] text-sm bg-white";
  return (
    <fieldset className="min-w-0 rounded border border-[#cdd2d6] p-3" aria-label={name}>
      <legend className="font-semibold break-words px-1">{name}</legend>
      {editing ? <>
        {field.type === "json" ? <label className="block">Stored value (JSON)
          <textarea className={inputClasses} value={String(draft)} onChange={e => setDraft(e.target.value)} />
        </label> : <SchemaFieldList fields={[field]} values={{ [name]: draft }} onChange={(_, v) => setDraft(v)} />}
        {error && <p role="alert">{error}</p>}
        <div className="flex flex-wrap gap-2 mt-2">
          <button type="button" className={button} onClick={() => {
            let next: unknown;
            if (field.type === "json") {
              try { next = JSON.parse(String(draft)); }
              catch { setError("Enter valid JSON, or cancel this edit."); return; }
            } else {
              const encoded = encodeChangedSchemaValues({ [name]: draft }, [field], [name]);
              if (encoded.invalidNames.length) { setError("Enter a complete value and unit where needed."); return; }
              next = encoded.values[name];
            }
            onChange(name, next); setEditing(false); setError("");
          }}>Apply edit</button>
          <button type="button" className={button} onClick={() => { setEditing(false); setError(""); }}>Cancel edit</button>
        </div>
        <p className="text-sm mt-2">Apply this edit before saving the record.</p>
      </> : <>
        <p className="whitespace-pre-wrap break-words mb-3">{display}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} onClick={() => {
            setDraft(field.type === "json" ? JSON.stringify(value, null, 2) : value); setEditing(true);
          }}>Edit</button>
          <button type="button" className={button} onClick={() => onChange(name, undefined)}>Remove</button>
        </div>
        {candidates.length > 0 && <div className="mt-3">
          <label className="block">Move to field
            <select className={inputClasses} value={destination} onChange={e => setDestination(e.target.value)}>
              <option value="">Choose a compatible field…</option>
              {candidates.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
            </select>
          </label>
          {target && (occupied ? <div className="mt-2">
            <p>This field already has a value: {JSON.stringify(values[target.name])}. Choose which value to keep.</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <button type="button" className={button} onClick={() => onMove(name, target.name, value, true)}>Replace destination value</button>
              <button type="button" className={button} onClick={() => onMove(name, target.name, value, false)}>Keep destination value</button>
            </div>
          </div> : <button type="button" className={`${button} mt-2`} onClick={() => onMove(name, target.name, value, true)}>Move value</button>)}
        </div>}
      </>}
    </fieldset>
  );
}

export function UnconfiguredProperties({ entries, fields, values, onChange, onMove, onPendingEdit }: {
  entries: [string, unknown][]; fields: SchemaField[]; values: RawProperties;
  onPendingEdit: (name: string, pending: boolean) => void;
  onChange: (name: string, value: unknown) => void;
  onMove: (from: string, to: string, value: unknown, replace: boolean) => void;
}) {
  if (!entries.length) return null;
  return <section aria-label="Properties outside the current schema" className="mt-6 space-y-3">
    <h3 className="font-semibold">Properties outside the current schema</h3>
    <p className="text-sm">These saved properties aren’t in the currently active schema. They’re preserved unless you change or remove them. Changes take effect when you save the record.</p>
    {entries.map(([name, value]) => <PropertyRow key={name} {...{ name, value, fields, values, onChange, onMove, onPendingEdit }} />)}
  </section>;
}
