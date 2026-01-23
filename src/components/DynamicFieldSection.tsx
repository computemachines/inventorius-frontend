import * as React from "react";
import { useRef, useEffect } from "react";
import { SchemaField, AttributeBundle, TriggerFieldDef } from "../api-client/data-models";
import { FieldState, TriggerState } from "../hooks/useDynamicFields";

// Shared Tailwind classes (design system)
const labelClasses =
  "block text-[0.85rem] font-semibold text-[#04151f] uppercase tracking-wide mt-5 mb-1.5";
const inputClasses =
  "block w-full py-2.5 px-3 border border-[#cdd2d6] rounded-md bg-white text-[#04151f] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0c3764] focus:ring-[3px] focus:ring-[#0c3764]/15 placeholder:text-gray-400";

interface TriggerFieldProps {
  triggerState: TriggerState;
  onInputChange: (value: string) => void;
  onSelect: (bundle: AttributeBundle) => void;
  onClear: () => void;
  onBlur: () => void;
}

/**
 * A trigger field with typeahead dropdown.
 * Used for Item Type (SKU) and Source (Batch).
 */
export function TriggerField({
  triggerState,
  onInputChange,
  onSelect,
  onClear,
  onBlur,
}: TriggerFieldProps) {
  const { def, inputValue, selectedBundle, suggestions, showSuggestions } = triggerState;
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onBlur();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onBlur]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onBlur();
    } else if (e.key === "Enter" && suggestions.length > 0) {
      e.preventDefault();
      onSelect(suggestions[0]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className={labelClasses} style={{ marginTop: 0 }}>
        {def.label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue && onInputChange(inputValue)}
          placeholder={def.placeholder}
          className={inputClasses}
        />
        {selectedBundle && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            title="Clear selection"
          >
            ×
          </button>
        )}
      </div>

      {/* Typeahead dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-[#082441] rounded-md shadow-lg border border-[#0c3764] max-h-60 overflow-auto">
          {suggestions.map((bundle, index) => (
            <button
              key={bundle.id}
              type="button"
              onClick={() => onSelect(bundle)}
              className={`w-full text-left px-3 py-2 text-[#ecebe4] hover:bg-[#0c3764] transition-colors ${
                index === 0 ? "bg-[#0c3764]/50" : ""
              }`}
            >
              {bundle.name}
            </button>
          ))}
        </div>
      )}

      {/* Show "create new" option when no matches */}
      {showSuggestions && inputValue.trim().length >= 2 && suggestions.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-[#082441] rounded-md shadow-lg border border-[#0c3764]">
          <div className="px-3 py-2 text-[#ecebe4] text-sm italic">
            No matches. Press Tab to create "{inputValue.trim()}"
          </div>
        </div>
      )}
    </div>
  );
}

interface DynamicFieldProps {
  fieldState: FieldState;
  onChange: (fieldName: string, value: string) => void;
}

/**
 * Renders a single dynamic field based on its type.
 */
export function DynamicField({ fieldState, onChange }: DynamicFieldProps) {
  const { field, value } = fieldState;

  const renderInput = () => {
    switch (field.type) {
      case "enum":
        return (
          <select
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
            className={inputClasses}
          >
            <option value="">Select...</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case "unit":
        return (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(field.name, e.target.value)}
              className={`${inputClasses} flex-1`}
              placeholder={field.required ? "Required" : "Optional"}
            />
            {field.unit && (
              <span className="text-[#6d635d] text-sm min-w-[3rem]">
                {field.unit}
              </span>
            )}
          </div>
        );

      case "number":
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
            className={inputClasses}
            placeholder={field.required ? "Required" : "Optional"}
          />
        );

      default: // text
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
            className={inputClasses}
            placeholder={field.required ? "Required" : "Optional"}
          />
        );
    }
  };

  return (
    <div>
      <label className={labelClasses}>{field.label}</label>
      {renderInput()}
    </div>
  );
}

interface DynamicFieldSectionProps {
  fieldStates: FieldState[];
  onChange: (fieldName: string, value: string) => void;
  /** Optional: group fields by source bundle visually */
  showSourceGroups?: boolean;
}

/**
 * Renders all dynamic fields, optionally grouped by source bundle.
 */
export function DynamicFieldSection({
  fieldStates,
  onChange,
  showSourceGroups = false,
}: DynamicFieldSectionProps) {
  if (fieldStates.length === 0) {
    return null;
  }

  if (!showSourceGroups) {
    return (
      <div className="space-y-1">
        {fieldStates.map((fs) => (
          <DynamicField
            key={`${fs.sourceBundle}-${fs.field.name}`}
            fieldState={fs}
            onChange={onChange}
          />
        ))}
      </div>
    );
  }

  // Group by source bundle
  const groups: Record<string, FieldState[]> = {};
  for (const fs of fieldStates) {
    const key = fs.sourceBundle;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(fs);
  }

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([source, fields]) => {
        const isIntersection = source.startsWith("intersection:");
        const isPackage = source.startsWith("package:");

        return (
          <div
            key={source}
            className={
              isIntersection
                ? "pl-3 border-l-2 border-[#c0771f]"
                : isPackage
                ? "pl-3 border-l-2 border-[#0c3764]"
                : ""
            }
          >
            {fields.map((fs) => (
              <DynamicField
                key={`${fs.sourceBundle}-${fs.field.name}`}
                fieldState={fs}
                onChange={onChange}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Export classes for reuse
export { labelClasses, inputClasses };
