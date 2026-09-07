import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSchemaForm } from "../../hooks/useSchemaForm";
import { UnconfiguredProperties, storedPropertyField } from "./UnconfiguredProperties";
import type { SchemaField } from "../../hooks/useSchemaForm";
import { SchemaFieldList } from "./SchemaFields";
import {
  overlaySchemaProperties,
  persistedMixins,
  RawProperties,
  encodeChangedSchemaValues,
  schemaInputError,
} from "./schema-property-values";

interface SchemaPropertiesEditorProps {
  schemaName: "sku" | "batch";
  resourceId: string;
  properties: RawProperties;
  onChange: (properties: RawProperties) => void;
  onDirty: () => void;
  onValidityChange?: (valid: boolean) => void;
}

/** Schema-owned editor that preserves all opaque and unavailable properties. */
export function SchemaPropertiesEditor({
  schemaName,
  resourceId,
  properties,
  onChange,
  onDirty,
  onValidityChange,
}: SchemaPropertiesEditorProps) {
  const originalProperties = useRef(properties);
  const changedNames = useRef(new Set<string>());
  const fieldDefinitions = useRef(new Map<string, SchemaField>());
  const [pendingEdits, setPendingEdits] = useState<Set<string>>(new Set());
  const onPendingEdit = useCallback((name: string, pending: boolean) => {
    setPendingEdits(previous => {
      const next = new Set(previous);
      if (pending) next.add(name); else next.delete(name);
      return next;
    });
  }, []);
  const [hasChanges, setHasChanges] = useState(false);
  const [invalidNames, setInvalidNames] = useState<string[]>([]);
  const initialMixins = useMemo(
    () =>
      Array.isArray(properties._mixins)
        ? properties._mixins.filter((value): value is string => typeof value === "string")
        : [],
    [],
  );
  const schema = useSchemaForm(schemaName, {
    activeMixins: initialMixins,
    initialValues: properties,
    preserveUnavailableValues: true,
    resourceId,
    useSchemaRoots: true,
  });

  // Retain definitions for fields that become inactive while editing.
  for (const [name, value] of Object.entries(originalProperties.current)) {
    if (!fieldDefinitions.current.has(name)) fieldDefinitions.current.set(name, storedPropertyField(name, value));
  }
  for (const field of schema.availableFields) fieldDefinitions.current.set(field.name, field);

  useEffect(() => {
    const encoded = encodeChangedSchemaValues(
      schema.fieldValues,
      fieldDefinitions.current.values(),
      changedNames.current,
    );
    const valid = encoded.invalidNames.length === 0 && pendingEdits.size === 0;
    setInvalidNames((previous) =>
      JSON.stringify(previous) === JSON.stringify(encoded.invalidNames)
        ? previous
        : encoded.invalidNames,
    );
    onValidityChange?.(valid);
    if (!valid || !hasChanges) return;
    onChange(
      overlaySchemaProperties(
        originalProperties.current,
        encoded.values,
        changedNames.current,
        persistedMixins(
          schema.activeMixins,
          schema.schemaRootMixins,
          schema.implicitRootMixins,
        ),
      ),
    );
  }, [
    hasChanges,
    pendingEdits,
    onChange,
    schema.activeMixins,
    schema.fieldValues,
    schema.implicitRootMixins,
    schema.schemaRootMixins,
    schema.availableFields,
    onValidityChange,
  ]);

  if (schema.error) {
    return (
      <div className="text-[#9e2a2a]" role="alert">
        <p>Schema fields could not be loaded. Stored properties are preserved.</p>
        <button type="button" className="underline" onClick={schema.retry}>
          Retry
        </button>
      </div>
    );
  }

  if (!schema.hasEvaluated) {
    return <span className="text-[#6d635d] italic">Loading properties…</span>;
  }

  const changeProperty = (name: string, value: unknown) => {
    if (value !== undefined && !schema.availableFields.some(field => field.name === name)) {
      fieldDefinitions.current.set(name, storedPropertyField(name, value));
    }
    changedNames.current.add(name);
    setHasChanges(true);
    onDirty();
    schema.handleFieldChange(name, value);
  };
  const activeNames = new Set(schema.availableFields.map(field => field.name));
  const encoded = encodeChangedSchemaValues(schema.fieldValues, fieldDefinitions.current.values(), changedNames.current);
  const currentValues = { ...schema.fieldValues, ...encoded.values };
  const outside = Object.entries(currentValues).filter(([name, value]) =>
    name !== "_mixins" && !activeNames.has(name) && value !== undefined &&
    !(changedNames.current.has(name) && value === ""));

  return (
    <>
      <SchemaFieldList
        fields={schema.availableFields}
        values={schema.fieldValues}
        onChange={changeProperty}
        entityType={schemaName}
        triggerFields={schemaName === "sku" ? { item_type: "item_type" } : { source: "source" }}
      />
      <UnconfiguredProperties
        entries={outside}
        fields={schema.availableFields}
        values={currentValues}
        onChange={changeProperty}
        onPendingEdit={onPendingEdit}
        onMove={(from, to, value, replace) => {
          if (replace) changeProperty(to, value);
          changeProperty(from, undefined);
        }}
      />
      {pendingEdits.size > 0 && <p role="status">Apply or cancel the property edit before saving.</p>}
      {invalidNames.length > 0 && (
        <p className="text-[#9e2a2a]" role="alert">
          {schemaInputError(invalidNames, schema.availableFields)}
        </p>
      )}
    </>
  );
}
