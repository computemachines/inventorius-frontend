import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Field definition from the schema API
 */
export interface SchemaField {
  name: string;
  type: string; // "text" | "number" | "enum" | "bool" | "unit"
  options?: string[];
  unit?: string;
  required?: boolean;
}

/**
 * Response from the /evaluate endpoint
 */
interface EvaluateResponse {
  active_mixins: string[];
  available_fields: SchemaField[];
}

/**
 * Hook for forms that use the unified trigger schema system.
 *
 * This replaces useDynamicFields with a simpler architecture:
 * - fieldValues is the ONLY state (WYSIWYG)
 * - Server computes which fields are available
 * - restorationCache preserves values for UX when fields disappear/reappear
 */
export function useSchemaForm(schemaName: string, rootMixins: string[]) {
  const [activeMixins, setActiveMixins] = useState<string[]>(rootMixins);
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});
  const [availableFields, setAvailableFields] = useState<SchemaField[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restoration cache - NOT React state, changes don't trigger re-renders
  const restorationCache = useRef<Record<string, string | boolean>>({});

  // Evaluate the schema whenever field values change
  const evaluate = useCallback(async () => {
    setError(null);
    const loadingTimer = setTimeout(() => setLoading(true), 200);
    try {
      const resp = await fetch(`/api/schema/${schemaName}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active_mixins: rootMixins,
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
  }, [schemaName, rootMixins, fieldValues]);

  // Initial load
  useEffect(() => {
    evaluate();
  }, []);

  // Re-evaluate when field values change (debounced)
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
            // Default bool fields to true
            cleaned[field.name] = true;
          }
          // Other field types start undefined/empty
        }
      }

      // Only return new object if something actually changed
      return changed ? cleaned : prev;
    });
  }, [availableFields]);

  /**
   * Handle value change for a field
   */
  const handleFieldChange = useCallback(
    (fieldName: string, value: string | boolean) => {
      setFieldValues((prev) => ({ ...prev, [fieldName]: value }));
    },
    []
  );

  /**
   * Reset all fields to initial state
   */
  const reset = useCallback(() => {
    setFieldValues({});
    restorationCache.current = {};
  }, []);

  /**
   * Get field values for form submission (only non-empty values)
   */
  const getSubmitValues = useCallback((): Record<string, string | boolean> => {
    const values: Record<string, string | boolean> = {};
    for (const [k, v] of Object.entries(fieldValues)) {
      if (v !== undefined && v !== "") {
        values[k] = v;
      }
    }
    return values;
  }, [fieldValues]);

  return {
    // State
    activeMixins,
    fieldValues,
    availableFields,
    loading,
    error,

    // Actions
    handleFieldChange,
    reset,

    // Helpers
    getSubmitValues,
  };
}
