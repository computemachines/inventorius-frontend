import * as React from "react";
import { SchemaField } from "../hooks/useSchemaForm";

// Shared Tailwind classes (design system)
export const labelClasses =
  "block text-[0.85rem] font-semibold text-[#04151f] uppercase tracking-wide mt-5 mb-1.5";
export const inputClasses =
  "block w-full py-2.5 px-3 border border-[#cdd2d6] rounded-md bg-white text-[#04151f] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0c3764] focus:ring-[3px] focus:ring-[#0c3764]/15 placeholder:text-gray-400";

/**
 * Format a field name for display (snake_case -> Title Case)
 */
function formatLabel(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface SchemaFieldInputProps {
  field: SchemaField;
  value: string | boolean;
  onChange: (name: string, value: string | boolean) => void;
  /** Custom label override */
  label?: string;
  /** Custom placeholder */
  placeholder?: string;
  /** Whether this is a "typeahead" field (styled but functionality disabled) */
  isTypeahead?: boolean;
}

/**
 * Renders a single field based on its schema type.
 */
export function SchemaFieldInput({
  field,
  value,
  onChange,
  label,
  placeholder,
  isTypeahead = false,
}: SchemaFieldInputProps) {
  const displayLabel = label ?? formatLabel(field.name);
  const stringValue = typeof value === "boolean" ? "" : (value ?? "");

  const renderInput = () => {
    // Boolean checkbox
    if (field.type === "bool") {
      return (
        <div className="flex items-center gap-3 mt-2">
          <input
            type="checkbox"
            id={field.name}
            checked={value === true}
            onChange={(e) => onChange(field.name, e.target.checked)}
            className="w-5 h-5 rounded border-[#cdd2d6] text-[#0c3764] focus:ring-[#0c3764]"
          />
          <label htmlFor={field.name} className="text-[#04151f] font-medium">
            {displayLabel}
          </label>
        </div>
      );
    }

    // Enum dropdown
    if (field.type === "enum" && field.options) {
      return (
        <>
          <label className={labelClasses}>{displayLabel}</label>
          <select
            value={stringValue}
            onChange={(e) => onChange(field.name, e.target.value)}
            className={inputClasses}
          >
            <option value="">Select...</option>
            {field.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </>
      );
    }

    // Unit field (text input with unit suffix)
    if (field.type === "unit" && field.unit) {
      return (
        <>
          <label className={labelClasses}>{displayLabel}</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={stringValue}
              onChange={(e) => onChange(field.name, e.target.value)}
              className={`${inputClasses} flex-1`}
              placeholder={placeholder ?? (field.required ? "Required" : "Optional")}
            />
            <span className="text-[#6d635d] text-sm min-w-[3rem]">
              {field.unit}
            </span>
          </div>
        </>
      );
    }

    // Number field
    if (field.type === "number") {
      return (
        <>
          <label className={labelClasses}>{displayLabel}</label>
          <input
            type="number"
            value={stringValue}
            onChange={(e) => onChange(field.name, e.target.value)}
            className={inputClasses}
            placeholder={placeholder ?? (field.required ? "Required" : "Optional")}
          />
        </>
      );
    }

    // Text field (default) - may be styled as typeahead
    return (
      <>
        <label className={labelClasses}>{displayLabel}</label>
        <div className="relative">
          <input
            type="text"
            value={stringValue}
            onChange={(e) => onChange(field.name, e.target.value)}
            className={inputClasses}
            placeholder={placeholder ?? (field.required ? "Required" : "Optional")}
          />
          {/*
            TODO: Typeahead functionality will be added later.
            For now, the styling is in place but the dropdown is disabled.

            When enabled, this will:
            1. Call /api/schema/{name}/search?field={field}&query={value}
            2. Show dropdown with matching mixin names
            3. On select, set the field value
          */}
          {isTypeahead && stringValue && (
            <button
              type="button"
              onClick={() => onChange(field.name, "")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title="Clear"
            >
              ×
            </button>
          )}
        </div>
      </>
    );
  };

  // Bool fields render their own container
  if (field.type === "bool") {
    return renderInput();
  }

  return <div>{renderInput()}</div>;
}

interface SchemaFieldListProps {
  fields: SchemaField[];
  values: Record<string, string | boolean>;
  onChange: (name: string, value: string | boolean) => void;
  /** Fields that should be rendered as typeahead inputs */
  typeaheadFields?: string[];
  /** Custom labels for specific fields */
  labels?: Record<string, string>;
  /** Custom placeholders for specific fields */
  placeholders?: Record<string, string>;
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
  typeaheadFields = [],
  labels = {},
  placeholders = {},
  excludeFields = [],
}: SchemaFieldListProps) {
  const filteredFields = fields.filter((f) => !excludeFields.includes(f.name));

  if (filteredFields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      {filteredFields.map((field) => (
        <SchemaFieldInput
          key={field.name}
          field={field}
          value={values[field.name] ?? ""}
          onChange={onChange}
          label={labels[field.name]}
          placeholder={placeholders[field.name]}
          isTypeahead={typeaheadFields.includes(field.name)}
        />
      ))}
    </div>
  );
}

interface GroupedSchemaFieldsProps {
  fields: SchemaField[];
  values: Record<string, string | boolean>;
  activeMixins: string[];
  onChange: (name: string, value: string | boolean) => void;
  /** Fields that should be rendered as typeahead inputs */
  typeaheadFields?: string[];
  /** Custom labels for specific fields */
  labels?: Record<string, string>;
  /** Custom placeholders for specific fields */
  placeholders?: Record<string, string>;
}

/**
 * Renders schema fields grouped by active mixin.
 * Shows visual indicators for intersection fields.
 */
export function GroupedSchemaFields({
  fields,
  values,
  activeMixins,
  onChange,
  typeaheadFields = [],
  labels = {},
  placeholders = {},
}: GroupedSchemaFieldsProps) {
  // For now, just render all fields together
  // In the future, could group by mixin source
  return (
    <SchemaFieldList
      fields={fields}
      values={values}
      onChange={onChange}
      typeaheadFields={typeaheadFields}
      labels={labels}
      placeholders={placeholders}
    />
  );
}
