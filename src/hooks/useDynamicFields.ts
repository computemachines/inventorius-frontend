import { useState, useCallback, useContext } from "react";
import { ApiContext } from "../api-client/api-client";
import {
  SchemaField,
  AttributeBundle,
  TriggerFieldDef,
  BundleContext,
} from "../api-client/data-models";

/**
 * State for a single field value
 */
export interface FieldState {
  field: SchemaField;
  value: string;
  /** Which bundle contributed this field */
  sourceBundle: string;
}

/**
 * State for a trigger field (typeahead with bundle selection)
 */
export interface TriggerState {
  def: TriggerFieldDef;
  /** Current input value (for typeahead) */
  inputValue: string;
  /** Selected bundle (if any) */
  selectedBundle: AttributeBundle | null;
  /** Suggestions from typeahead search */
  suggestions: AttributeBundle[];
  /** Whether suggestions dropdown is visible */
  showSuggestions: boolean;
}

/**
 * Hook for managing dynamic fields in forms.
 * Provides unified handling of trigger fields and their contributed fields.
 */
export function useDynamicFields(entityType: "sku" | "batch") {
  const api = useContext(ApiContext);

  // Trigger field states (itemType, source, etc.)
  const [triggers, setTriggers] = useState<Record<string, TriggerState>>({});

  // All dynamic fields from active bundles
  const [fieldStates, setFieldStates] = useState<FieldState[]>([]);

  // Currently active bundles
  const [activeBundles, setActiveBundles] = useState<AttributeBundle[]>([]);

  /**
   * Initialize a trigger field
   */
  const initTrigger = useCallback((def: TriggerFieldDef) => {
    setTriggers((prev) => ({
      ...prev,
      [def.name]: {
        def,
        inputValue: "",
        selectedBundle: null,
        suggestions: [],
        showSuggestions: false,
      },
    }));
  }, []);

  /**
   * Get the current bundle context for intersection computation
   */
  const getBundleContext = useCallback((): BundleContext => ({
    entityType,
    activeBundleIds: activeBundles.map((b) => b.id),
  }), [entityType, activeBundles]);

  /**
   * Handle typeahead input change for a trigger field
   */
  const handleTriggerInput = useCallback(
    async (fieldName: string, value: string) => {
      setTriggers((prev) => ({
        ...prev,
        [fieldName]: {
          ...prev[fieldName],
          inputValue: value,
          showSuggestions: true,
        },
      }));

      if (value.trim().length < 1) {
        setTriggers((prev) => ({
          ...prev,
          [fieldName]: {
            ...prev[fieldName],
            suggestions: [],
          },
        }));
        return;
      }

      const context = getBundleContext();
      const result = await api.searchBundles(entityType, fieldName, value, context);

      setTriggers((prev) => ({
        ...prev,
        [fieldName]: {
          ...prev[fieldName],
          suggestions: result.bundles,
        },
      }));
    },
    [api, entityType, getBundleContext]
  );

  /**
   * Select a bundle from typeahead suggestions
   */
  const selectBundle = useCallback(
    (fieldName: string, bundle: AttributeBundle) => {
      // Update trigger state
      setTriggers((prev) => ({
        ...prev,
        [fieldName]: {
          ...prev[fieldName],
          inputValue: bundle.name,
          selectedBundle: bundle,
          showSuggestions: false,
          suggestions: [],
        },
      }));

      // Add bundle to active bundles (replacing any existing for this trigger)
      setActiveBundles((prev) => {
        // Remove any bundle that was selected for this trigger field
        const existing = triggers[fieldName]?.selectedBundle;
        const filtered = existing
          ? prev.filter((b) => b.id !== existing.id)
          : prev;
        return [...filtered, bundle];
      });

      // Add bundle's fields to fieldStates
      const newFields: FieldState[] = bundle.fields.map((field) => ({
        field,
        value: field.default?.toString() || "",
        sourceBundle: bundle.id,
      }));

      setFieldStates((prev) => {
        // Remove fields from any previously selected bundle for this trigger
        const existing = triggers[fieldName]?.selectedBundle;
        const filtered = existing
          ? prev.filter((fs) => fs.sourceBundle !== existing.id)
          : prev;
        return [...filtered, ...newFields];
      });

      // Check for intersection fields with other active bundles
      const context = getBundleContext();
      // Add bundle to context for intersection computation
      const contextWithNew = {
        ...context,
        activeBundleIds: [...context.activeBundleIds, bundle.id],
      };

      // Compute intersections (synchronous since we have the data)
      // This is a simplified version - in production would be async
      api.searchBundles(entityType, fieldName, bundle.name, context).then((result) => {
        if (result.intersectionFields.length > 0) {
          const intersectionFieldStates: FieldState[] = result.intersectionFields.map(
            (field) => ({
              field,
              value: field.default?.toString() || "",
              sourceBundle: `intersection:${bundle.id}`,
            })
          );
          setFieldStates((prev) => [...prev, ...intersectionFieldStates]);
        }
      });
    },
    [api, entityType, getBundleContext, triggers]
  );

  /**
   * Clear a trigger field selection
   */
  const clearTrigger = useCallback((fieldName: string) => {
    const existing = triggers[fieldName]?.selectedBundle;

    setTriggers((prev) => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        inputValue: "",
        selectedBundle: null,
        suggestions: [],
        showSuggestions: false,
      },
    }));

    if (existing) {
      // Remove bundle from active bundles
      setActiveBundles((prev) => prev.filter((b) => b.id !== existing.id));

      // Remove fields contributed by this bundle (and its intersections)
      setFieldStates((prev) =>
        prev.filter(
          (fs) =>
            fs.sourceBundle !== existing.id &&
            !fs.sourceBundle.startsWith(`intersection:${existing.id}`)
        )
      );
    }
  }, [triggers]);

  /**
   * Handle value change for a regular (non-trigger) field
   */
  const handleFieldChange = useCallback(
    async (fieldName: string, value: string) => {
      setFieldStates((prev) =>
        prev.map((fs) =>
          fs.field.name === fieldName ? { ...fs, value } : fs
        )
      );

      // Check if this field is a trigger for secondary bundles (e.g., "package")
      const fieldState = fieldStates.find((fs) => fs.field.name === fieldName);
      if (!fieldState) return;

      // For SKU, package field triggers package bundles
      if (entityType === "sku" && fieldName === "package" && value) {
        const context = getBundleContext();
        const result = await api.getBundleByValue(entityType, fieldName, value, context);

        if (result.bundles.length > 0) {
          const packageBundle = result.bundles[0];

          // Remove any existing package bundle fields
          setFieldStates((prev) =>
            prev.filter(
              (fs) =>
                !fs.sourceBundle.startsWith("package:") &&
                !fs.sourceBundle.startsWith("intersection:")
            )
          );

          // Add new package bundle fields
          const newFields: FieldState[] = packageBundle.fields.map((field) => ({
            field,
            value: field.default?.toString() || "",
            sourceBundle: `package:${packageBundle.id}`,
          }));

          // Add intersection fields
          const intersectionFields: FieldState[] = result.intersectionFields.map(
            (field) => ({
              field,
              value: field.default?.toString() || "",
              sourceBundle: `intersection:${packageBundle.id}`,
            })
          );

          setFieldStates((prev) => [...prev, ...newFields, ...intersectionFields]);
        }
      }
    },
    [api, entityType, fieldStates, getBundleContext]
  );

  /**
   * Hide suggestions dropdown
   */
  const hideSuggestions = useCallback((fieldName: string) => {
    setTriggers((prev) => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        showSuggestions: false,
      },
    }));
  }, []);

  /**
   * Reset all dynamic fields
   */
  const reset = useCallback(() => {
    setTriggers({});
    setFieldStates([]);
    setActiveBundles([]);
  }, []);

  /**
   * Get all field values as a props object for submission
   */
  const getFieldValues = useCallback((): Record<string, string> => {
    const values: Record<string, string> = {};
    for (const fs of fieldStates) {
      if (fs.value) {
        values[fs.field.name] = fs.value;
      }
    }
    return values;
  }, [fieldStates]);

  return {
    // State
    triggers,
    fieldStates,
    activeBundles,

    // Actions
    initTrigger,
    handleTriggerInput,
    selectBundle,
    clearTrigger,
    handleFieldChange,
    hideSuggestions,
    reset,

    // Helpers
    getFieldValues,
    getBundleContext,
  };
}
