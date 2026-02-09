// src/components/composites/SchemaFields.tsx
// Fully human reviewed: NO
// Progress: NONE
//
// Conversation:
// > (no discussion yet)


import * as React from "react";
import { useContext, useState, useEffect, useCallback } from "react";
import { ApiContext } from "../../api-client/api-client";
import { AttributeBundle } from "../../api-client/data-models";
import { SchemaField } from "../../hooks/useSchemaForm";
import { AsyncTypeaheadField } from "./Typeahead";

// Shared Tailwind classes (design system)
export const labelClasses =
  "block text-[0.85rem] font-semibold text-[#04151f] uppercase tracking-wide mb-1.5";
export const inputClasses =
  "block w-full py-2.5 px-3 border border-[#cdd2d6] rounded-md bg-white text-[#04151f] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0c3764] focus:ring-[3px] focus:ring-[#0c3764]/15 placeholder:text-gray-400";
const selectClasses = `${inputClasses} cursor-pointer appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2304151f' d='M6 8L1 3h10z'/%3E%3C/svg%3E")] bg-no-repeat bg-[right_0.75em_center] pr-10`;

/**
 * Format a field name for display (snake_case -> Title Case)
 */
export function formatLabel(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// Field Renderer Types & Registry
// ============================================================================

interface FieldRendererProps {
  field: SchemaField;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
  inputId: string;
}

type FieldRenderer = React.FC<FieldRendererProps>;

const TextRenderer: FieldRenderer = ({ value, onChange, inputId }) => (
  <input
    id={inputId}
    type="text"
    value={(value as string) ?? ""}
    onChange={(e) => onChange(e.target.value)}
    className={inputClasses}
    autoComplete="off"
  />
);

const NumberRenderer: FieldRenderer = ({ value, onChange, inputId }) => (
  <input
    id={inputId}
    type="number"
    value={(value as string) ?? ""}
    onChange={(e) => onChange(e.target.value)}
    className={inputClasses}
  />
);

const BoolRenderer: FieldRenderer = ({ field, value, onChange, inputId }) => (
  <div className="flex items-center gap-3">
    <input
      type="checkbox"
      id={inputId}
      checked={value === true}
      onChange={(e) => onChange(e.target.checked)}
      className="w-5 h-5 rounded border-[#cdd2d6] text-[#0c3764] focus:ring-[#0c3764]"
    />
    <label htmlFor={inputId} className="text-[#04151f] font-medium">
      {formatLabel(field.name)}
    </label>
  </div>
);

const EnumRenderer: FieldRenderer = ({ field, value, onChange, inputId }) => (
  <select
    id={inputId}
    value={(value as string) ?? ""}
    onChange={(e) => onChange(e.target.value)}
    className={selectClasses}
  >
    <option value="">Select {formatLabel(field.name).toLowerCase()}...</option>
    {field.options?.map((opt) => (
      <option key={opt} value={opt}>
        {opt}
      </option>
    ))}
  </select>
);

const UnitRenderer: FieldRenderer = ({ field, value, onChange, inputId }) => (
  <div className="flex items-stretch">
    <input
      id={inputId}
      type="text"
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClasses} flex-1 rounded-r-none border-r-0`}
      placeholder="e.g., 100"
    />
    <span className="flex items-center px-3 bg-[#e5e4de] text-[#6d635d] text-sm font-medium border border-[#cdd2d6] border-l-0 rounded-r-md whitespace-nowrap">
      {field.unit}
    </span>
  </div>
);

interface FileMetadata {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  is_image: boolean;
  thumbnail_url?: string;
}

const FileRenderer: FieldRenderer = ({ field, value, onChange, inputId }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<FileMetadata | null>(null);

  // Fetch metadata when value (file_id) changes
  useEffect(() => {
    if (value && typeof value === "string") {
      fetch(`/api/files/${value}`, { method: "HEAD" })
        .then((r) => {
          if (r.ok) {
            // File exists, create preview info from the value
            // We don't have full metadata, but we can at least show the ID
            setPreview({
              id: value as string,
              filename: "Uploaded file",
              content_type: "",
              size: 0,
              is_image: true, // Assume image for thumbnail attempt
              thumbnail_url: `/api/files/${value}/thumb`,
            });
          }
        })
        .catch(() => {
          // File doesn't exist or error
          setPreview(null);
        });
    } else {
      setPreview(null);
    }
  }, [value]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/files", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(
            errData["invalid-params"]?.[0]?.reason || "Upload failed"
          );
        }

        const data = await response.json();
        const fileState = data.state as FileMetadata;

        onChange(fileState.id);
        setPreview(fileState);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const handleRemove = useCallback(() => {
    onChange("");
    setPreview(null);
    setError(null);
  }, [onChange]);

  // Accept attribute from field.options (MIME types)
  const accept = field.options?.join(",") || "image/*,application/pdf";

  return (
    <div className="space-y-2">
      {/* Preview */}
      {preview && (
        <div className="flex items-center gap-3 p-2 bg-[#f5f4f0] rounded border border-[#cdd2d6]">
          {preview.is_image && preview.thumbnail_url && (
            <img
              src={preview.thumbnail_url}
              alt="Preview"
              className="w-16 h-16 object-cover rounded"
              onError={(e) => {
                // Hide broken image
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[#04151f] truncate">
              {preview.filename}
            </div>
            {preview.size > 0 && (
              <div className="text-xs text-[#6d635d]">
                {(preview.size / 1024).toFixed(1)} KB
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="text-[#9e2a2a] hover:text-[#7a1f1f] text-sm font-medium"
          >
            Remove
          </button>
        </div>
      )}

      {/* Upload input */}
      {!preview && (
        <div className="relative">
          <input
            id={inputId}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            disabled={uploading}
            className="block w-full text-sm text-[#04151f] file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-[#0c3764] file:text-white hover:file:bg-[#082441] disabled:opacity-50"
          />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <span className="text-sm text-[#6d635d]">Uploading...</span>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && <div className="text-sm text-[#9e2a2a]">{error}</div>}
    </div>
  );
};

/** Registry mapping field types to their renderers */
const fieldRenderers: Record<string, FieldRenderer> = {
  text: TextRenderer,
  number: NumberRenderer,
  bool: BoolRenderer,
  enum: EnumRenderer,
  unit: UnitRenderer,
  file: FileRenderer,
};

/** Get renderer for a field type, defaulting to text */
function getRenderer(type: string): FieldRenderer {
  return fieldRenderers[type] || fieldRenderers.text;
}

// ============================================================================
// Typeahead Field Renderer
// ============================================================================

type EntityType = "sku" | "batch";

interface TypeaheadRendererProps {
  field: SchemaField;
  value: string;
  onChange: (value: string) => void;
  inputId: string;
  entityType: EntityType;
  triggerApiField: string;
}

function TypeaheadRenderer({
  field,
  value,
  onChange,
  inputId,
  entityType,
  triggerApiField,
}: TypeaheadRendererProps) {
  const api = useContext(ApiContext);

  return (
    <AsyncTypeaheadField<AttributeBundle>
      id={inputId}
      value={value ?? ""}
      onChange={onChange}
      onSelect={(bundle) => onChange(bundle.name)}
      onSearch={async (query) => {
        const result = await api.searchBundles(entityType, triggerApiField, query, {
          entityType,
          activeBundleIds: [],
        });
        return result.bundles;
      }}
      getItemText={(b) => b.name}
      getItemKey={(b) => b.id}
      renderItem={(bundle) => (
        <>
          {bundle.name}
          <span className="opacity-50 ml-2 text-sm">
            {bundle.fields.length} field{bundle.fields.length !== 1 ? "s" : ""}
          </span>
        </>
      )}
      placeholder={`Search ${formatLabel(field.name).toLowerCase()}...`}
      clearable
      allowCreate
      onCreate={onChange}
    />
  );
}

// ============================================================================
// Single Field Component
// ============================================================================

interface SchemaFieldInputProps {
  field: SchemaField;
  value: string | boolean;
  onChange: (name: string, value: string | boolean) => void;
  /** For typeahead fields: entity type (e.g., "sku", "batch") */
  entityType?: EntityType;
  /** For typeahead fields: API field name for search */
  triggerApiField?: string;
  /** Whether this field uses typeahead */
  isTypeahead?: boolean;
}

/**
 * Renders a single schema field using the appropriate input type.
 */
export function SchemaFieldInput({
  field,
  value,
  onChange,
  entityType,
  triggerApiField,
  isTypeahead = false,
}: SchemaFieldInputProps) {
  const inputId = `field-${field.name}`;
  const Renderer = getRenderer(field.type);

  // Bool renders its own label inline
  if (field.type === "bool") {
    return (
      <div className="py-2">
        <Renderer
          field={field}
          value={value}
          onChange={(v) => onChange(field.name, v)}
          inputId={inputId}
        />
      </div>
    );
  }

  // Typeahead fields
  if (isTypeahead && entityType && triggerApiField) {
    return (
      <div className="py-2">
        <label htmlFor={inputId} className={labelClasses}>
          {formatLabel(field.name)}
          {field.required && <span className="text-[#c0771f] ml-0.5 font-bold">*</span>}
        </label>
        <TypeaheadRenderer
          field={field}
          value={(value as string) ?? ""}
          onChange={(v) => onChange(field.name, v)}
          inputId={inputId}
          entityType={entityType}
          triggerApiField={triggerApiField}
        />
      </div>
    );
  }

  // Standard fields
  return (
    <div className="py-2">
      <label htmlFor={inputId} className={labelClasses}>
        {formatLabel(field.name)}
        {field.required && <span className="text-[#c0771f] ml-0.5 font-bold">*</span>}
      </label>
      <Renderer
        field={field}
        value={value}
        onChange={(v) => onChange(field.name, v)}
        inputId={inputId}
      />
    </div>
  );
}

// ============================================================================
// Field List Component
// ============================================================================

interface SchemaFieldListProps {
  /** Fields to render */
  fields: SchemaField[];
  /** Current field values */
  values: Record<string, string | boolean>;
  /** Called when a field changes */
  onChange: (name: string, value: string | boolean) => void;
  /** Entity type for typeahead searches (e.g., "sku", "batch") */
  entityType?: EntityType;
  /** Map of field names to their API trigger field names */
  triggerFields?: Record<string, string>;
  /** Fields to exclude from rendering */
  excludeFields?: string[];
}

/**
 * Renders a list of schema fields.
 */
export function SchemaFieldList({
  fields,
  values,
  onChange,
  entityType,
  triggerFields = {},
  excludeFields = [],
}: SchemaFieldListProps) {
  const filteredFields = fields.filter((f) => !excludeFields.includes(f.name));

  if (filteredFields.length === 0) {
    return null;
  }

  return (
    <>
      {filteredFields.map((field) => {
        const triggerApiField = triggerFields[field.name];
        return (
          <SchemaFieldInput
            key={field.name}
            field={field}
            value={values[field.name] ?? ""}
            onChange={onChange}
            entityType={entityType}
            triggerApiField={triggerApiField}
            isTypeahead={!!triggerApiField}
          />
        );
      })}
    </>
  );
}

// Export EntityType for consumers
export type { EntityType };
