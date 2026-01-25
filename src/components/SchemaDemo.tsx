import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";

// Shared Tailwind classes (from DynamicFieldSection)
const labelClasses =
  "block text-[0.85rem] font-semibold text-[#04151f] uppercase tracking-wide mt-4 mb-1.5";
const inputClasses =
  "block w-full py-2.5 px-3 border border-[#cdd2d6] rounded-md bg-white text-[#04151f] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0c3764] focus:ring-[3px] focus:ring-[#0c3764]/15";

interface SchemaField {
  name: string;
  type: string;
  options?: string[];
  unit?: string;
  required?: boolean;
}

interface EvaluateResponse {
  active_mixins: string[];
  available_fields: SchemaField[];
}

/**
 * Demo page for the unified trigger schema system.
 * Shows a 5-digit number entry form that demonstrates arbitrary depth triggering.
 */
export default function SchemaDemo() {
  const [activeMixins, setActiveMixins] = useState<string[]>(["Digit1"]);
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});
  const [availableFields, setAvailableFields] = useState<SchemaField[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restoration cache - NOT React state, changes don't trigger re-renders
  // Stores last-known values for fields that have been removed
  const restorationCache = useRef<Record<string, string | boolean>>({});

  // Computed: the number being entered (fieldValues is always clean/canonical)
  const computedNumber = React.useMemo(() => {
    const digits: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const d = fieldValues[`digit${i}`];
      if (typeof d === "string" && d !== "") {
        digits.push(d);
      }
    }
    return digits.length > 0 ? digits.join("") : "—";
  }, [fieldValues]);

  // Evaluate the schema whenever field values change
  const evaluate = useCallback(async () => {
    setError(null);
    // Only show loading indicator if request takes > 200ms
    const loadingTimer = setTimeout(() => setLoading(true), 200);
    try {
      const resp = await fetch("/api/schema/decimal/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active_mixins: ["Digit1"], // Always start from Digit1
          field_values: fieldValues,
        }),
      });

      if (!resp.ok) {
        throw new Error(`API error: ${resp.status}`);
      }

      const data: EvaluateResponse = await resp.json();

      // Only update state if values actually changed (prevent infinite loops)
      setActiveMixins((prev) => {
        const newVal = data.active_mixins;
        return JSON.stringify(prev) === JSON.stringify(newVal) ? prev : newVal;
      });
      setAvailableFields((prev) => {
        const newVal = data.available_fields;
        return JSON.stringify(prev) === JSON.stringify(newVal) ? prev : newVal;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      clearTimeout(loadingTimer);
      setLoading(false);
    }
  }, [fieldValues]);

  // Initial load
  useEffect(() => {
    evaluate();
  }, []);

  // Re-evaluate when field values change
  useEffect(() => {
    const timer = setTimeout(evaluate, 100);
    return () => clearTimeout(timer);
  }, [fieldValues, evaluate]);

  // Sync fieldValues with availableFields:
  // 1. Archive removed field values to restoration cache
  // 2. Clean fieldValues to only include available fields
  // 3. Initialize new fields (check cache first, then use defaults)
  useEffect(() => {
    const activeNames = new Set(availableFields.map((f) => f.name));

    setFieldValues((prev) => {
      const cleaned: Record<string, string | boolean> = {};
      let changed = false;

      // Keep values for fields that are still active
      // Archive values for fields that are being removed
      for (const [k, v] of Object.entries(prev)) {
        if (activeNames.has(k)) {
          cleaned[k] = v;
        } else {
          // Field is being removed
          changed = true;
          if (v !== undefined && v !== "") {
            // Archive non-empty values before removing
            restorationCache.current[k] = v;
          }
        }
      }

      // Initialize new fields
      for (const field of availableFields) {
        if (!(field.name in cleaned)) {
          changed = true;
          // Check restoration cache first
          if (field.name in restorationCache.current) {
            cleaned[field.name] = restorationCache.current[field.name];
          } else if (field.type === "bool") {
            // Default bool fields to true (user unchecks to trigger next level)
            cleaned[field.name] = true;
          }
          // Other field types start undefined/empty
        }
      }

      // Only return new object if something actually changed
      return changed ? cleaned : prev;
    });
  }, [availableFields]);

  const handleFieldChange = (name: string, value: string | boolean) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  };

  // Render a single field
  const renderField = (field: SchemaField) => {
    const value = fieldValues[field.name] ?? "";

    if (field.type === "bool") {
      return (
        <div key={field.name} className="flex items-center gap-3 mt-4">
          <input
            type="checkbox"
            id={field.name}
            checked={value === true}
            onChange={(e) => handleFieldChange(field.name, e.target.checked)}
            className="w-5 h-5 rounded border-[#cdd2d6] text-[#0c3764] focus:ring-[#0c3764]"
          />
          <label htmlFor={field.name} className="text-[#04151f] font-medium">
            {formatFieldName(field.name)}
          </label>
        </div>
      );
    }

    if (field.type === "enum") {
      return (
        <div key={field.name}>
          <label className={labelClasses}>{formatFieldName(field.name)}</label>
          <select
            value={value as string}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={inputClasses}
          >
            <option value="">Select...</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    }

    // Default: text input
    return (
      <div key={field.name}>
        <label className={labelClasses}>{formatFieldName(field.name)}</label>
        <input
          type="text"
          value={value as string}
          onChange={(e) => handleFieldChange(field.name, e.target.value)}
          className={inputClasses}
          placeholder={field.unit ? `Value in ${field.unit}` : "Enter value"}
        />
        {field.unit && (
          <span className="text-[#6d635d] text-sm ml-2">{field.unit}</span>
        )}
      </div>
    );
  };

  // Format field names for display
  const formatFieldName = (name: string): string => {
    return name
      .replace(/([a-z])(\d)/g, "$1 $2")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Group fields by digit level
  const groupedFields = React.useMemo(() => {
    const groups: Record<string, SchemaField[]> = {};
    for (const field of availableFields) {
      const match = field.name.match(/^(digit|final)(\d)/);
      if (match) {
        const level = `Digit ${match[2]}`;
        if (!groups[level]) groups[level] = [];
        groups[level].push(field);
      } else {
        // Intersection fields
        if (!groups["Special"]) groups["Special"] = [];
        groups["Special"].push(field);
      }
    }
    return groups;
  }, [availableFields]);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#04151f] mb-2">
        Dynamic Schema Demo
      </h1>
      <p className="text-[#6d635d] mb-6">
        Enter a number one digit at a time. Each digit triggers the next level
        until you check "Final". This demonstrates the unified trigger model
        with arbitrary depth.
      </p>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Current number display */}
      <div className="bg-[#082441] rounded-lg p-6 mb-6">
        <div className="text-[#cdd2d6] text-sm uppercase tracking-wide mb-2">
          Current Number
        </div>
        <div className="text-5xl font-mono text-[#ecebe4] tracking-wider">
          {computedNumber}
        </div>
        <div className="text-[#6d635d] text-sm mt-2">
          {activeMixins.length} digit level{activeMixins.length !== 1 ? "s" : ""}{" "}
          active
        </div>
      </div>

      {/* Active mixins visualization */}
      <div className="mb-6">
        <div className="text-sm font-semibold text-[#04151f] uppercase tracking-wide mb-2">
          Active Mixins (Trigger Chain)
        </div>
        <div className="flex gap-2 flex-wrap">
          {activeMixins.map((mixin, i) => (
            <React.Fragment key={mixin}>
              <span className="bg-[#0c3764] text-white px-3 py-1 rounded-full text-sm">
                {mixin}
              </span>
              {i < activeMixins.length - 1 && (
                <span className="text-[#cdd2d6] self-center">→</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Form fields grouped by level */}
      <div className="space-y-6">
        {Object.entries(groupedFields).map(([group, fields]) => (
          <div
            key={group}
            className={`p-4 rounded-lg ${
              group === "Special"
                ? "bg-[#c0771f]/10 border-l-4 border-[#c0771f]"
                : "bg-[#f8f9fa] border-l-4 border-[#0c3764]"
            }`}
          >
            <div className="text-sm font-bold text-[#04151f] uppercase tracking-wide mb-2">
              {group}
              {group === "Special" && (
                <span className="ml-2 text-xs font-normal normal-case text-[#6d635d]">
                  (Intersection rules)
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {fields.map(renderField)}
            </div>
          </div>
        ))}
      </div>

      {/* Debug info */}
      <details className="mt-8">
        <summary className="cursor-pointer text-[#6d635d] text-sm">
          Debug Info
        </summary>
        <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto">
          {JSON.stringify({
            activeMixins,
            fieldValues,
            restorationCache: restorationCache.current,
            availableFields,
          }, null, 2)}
        </pre>
      </details>

      {loading && (
        <div className="fixed bottom-4 right-4 bg-[#082441] text-white px-4 py-2 rounded-lg shadow-lg">
          Evaluating...
        </div>
      )}
    </div>
  );
}
