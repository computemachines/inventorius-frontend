import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSchemaForm } from "../../hooks/useSchemaForm";
import { SchemaFieldList } from "./SchemaFields";
import {
  overlaySchemaProperties,
  persistedMixins,
  RawProperties,
  encodeChangedSchemaValues,
  valuesForSchemaEvaluation,
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
  const fieldDefinitions = useRef(new Map());
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
    initialValues: valuesForSchemaEvaluation(properties),
    preserveUnavailableValues: true,
    resourceId,
    useSchemaRoots: true,
  });

  useEffect(() => {
    if (!hasChanges) return;
    for (const field of schema.availableFields) {
      fieldDefinitions.current.set(field.name, field);
    }
    const encoded = encodeChangedSchemaValues(
      schema.fieldValues,
      fieldDefinitions.current.values(),
      changedNames.current,
    );
    const valid = encoded.invalidNames.length === 0;
    setInvalidNames((previous) =>
      JSON.stringify(previous) === JSON.stringify(encoded.invalidNames)
        ? previous
        : encoded.invalidNames,
    );
    onValidityChange?.(valid);
    if (!valid) return;
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

  if (schema.availableFields.length === 0 && schema.loading) {
    return <span className="text-[#6d635d] italic">Loading properties…</span>;
  }

  if (schema.availableFields.length === 0) {
    return <span className="text-[#6d635d] italic">No configured fields</span>;
  }

  return (
    <>
      <SchemaFieldList
        fields={schema.availableFields}
        values={schema.fieldValues}
        onChange={(name, value) => {
          changedNames.current.add(name);
          setHasChanges(true);
          onDirty();
          schema.handleFieldChange(name, value);
        }}
        entityType={schemaName}
        triggerFields={schemaName === "sku" ? { item_type: "item_type" } : { source: "source" }}
      />
      {invalidNames.length > 0 && (
        <p className="text-[#9e2a2a]" role="alert">
          Enter a complete number for {invalidNames.join(", ")}.
        </p>
      )}
    </>
  );
}
