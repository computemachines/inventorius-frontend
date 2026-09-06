import { useState, useEffect, useCallback, useRef } from "react";

export interface SchemaField {
  name: string;
  type: string;
  options?: string[];
  unit?: string;
  required?: boolean;
  multiline?: boolean;
}

export type SchemaValue = unknown;
export type SchemaValues = Record<string, SchemaValue>;

interface EvaluateResponse {
  active_mixins: string[];
  root_mixins?: string[];
  implicit_root_mixins?: string[];
  available_fields: SchemaField[];
}

export interface SchemaFormOptions {
  activeMixins?: string[];
  initialValues?: SchemaValues;
  resourceId?: string;
  useSchemaRoots?: boolean;
  preserveUnavailableValues?: boolean;
}

/** Keep property values in their API representation while evaluating a form. */
export function useSchemaForm(
  schemaName: string,
  optionsOrRoots: SchemaFormOptions | string[] = {},
) {
  const options: SchemaFormOptions = Array.isArray(optionsOrRoots)
    ? { activeMixins: optionsOrRoots }
    : optionsOrRoots;
  const initialMixinsRef = useRef(options.activeMixins ?? []);
  const initialValuesRef = useRef(options.initialValues ?? {});
  const [activeMixins, setActiveMixins] = useState<string[]>(initialMixinsRef.current);
  const [implicitRootMixins, setImplicitRootMixins] = useState<string[]>([]);
  const [schemaRootMixins, setSchemaRootMixins] = useState<string[]>([]);
  const [fieldValues, setFieldValues] = useState<SchemaValues>(initialValuesRef.current);
  const [availableFields, setAvailableFields] = useState<SchemaField[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restorationCache = useRef<SchemaValues>({});
  const requestGeneration = useRef(0);
  const requestAbort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const resourceId = options.resourceId;
  const useSchemaRoots = options.useSchemaRoots ?? false;
  const preserveUnavailableValues = options.preserveUnavailableValues ?? false;

  const evaluate = useCallback(async () => {
    const generation = ++requestGeneration.current;
    requestAbort.current?.abort();
    const abort = new AbortController();
    requestAbort.current = abort;
    setError(null);
    const loadingTimer = setTimeout(() => {
      if (mounted.current && !abort.signal.aborted) setLoading(true);
    }, 200);
    try {
      const response = await fetch(`/api/schema/${schemaName}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({
          active_mixins: initialMixinsRef.current,
          field_values: fieldValues,
          use_schema_roots: useSchemaRoots,
          ...(resourceId ? { resource_id: resourceId } : {}),
        }),
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = (await response.json()) as EvaluateResponse;
      if (!mounted.current || generation !== requestGeneration.current) return;
      setActiveMixins((previous) => sameJson(previous, data.active_mixins) ? previous : data.active_mixins);
      setImplicitRootMixins((previous) => {
        const next = data.implicit_root_mixins ?? [];
        return sameJson(previous, next) ? previous : next;
      });
      setSchemaRootMixins((previous) => {
        const next = data.root_mixins ?? [];
        return sameJson(previous, next) ? previous : next;
      });
      setAvailableFields((previous) => sameJson(previous, data.available_fields) ? previous : data.available_fields);
    } catch (e) {
      if (
        mounted.current &&
        !abort.signal.aborted &&
        generation === requestGeneration.current
      ) {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    } finally {
      clearTimeout(loadingTimer);
      if (mounted.current && generation === requestGeneration.current) setLoading(false);
    }
  }, [fieldValues, resourceId, schemaName, useSchemaRoots]);

  const isFirstEval = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestGeneration.current += 1;
      requestAbort.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (error) return;
    if (isFirstEval.current) {
      isFirstEval.current = false;
      void evaluate();
    } else {
      const timer = setTimeout(evaluate, 100);
      return () => clearTimeout(timer);
    }
  }, [fieldValues, schemaName, resourceId, evaluate, error]);

  useEffect(() => {
    if (preserveUnavailableValues) return;
    const activeNames = new Set(availableFields.map((field) => field.name));
    setFieldValues((previous) => {
      const cleaned: SchemaValues = {};
      let changed = false;
      for (const [name, value] of Object.entries(previous)) {
        if (activeNames.has(name)) cleaned[name] = value;
        else {
          changed = true;
          if (value !== undefined && value !== "") restorationCache.current[name] = value;
        }
      }
      for (const field of availableFields) {
        if (!(field.name in cleaned)) {
          if (field.name in restorationCache.current) {
            changed = true;
            cleaned[field.name] = restorationCache.current[field.name];
          } else if (field.type === "bool") {
            changed = true;
            cleaned[field.name] = true;
          }
        }
      }
      return changed ? cleaned : previous;
    });
  }, [availableFields, preserveUnavailableValues]);

  const handleFieldChange = useCallback((fieldName: string, value: SchemaValue) => {
    setFieldValues((previous) => ({ ...previous, [fieldName]: value }));
  }, []);

  const reset = useCallback(() => {
    setFieldValues(initialValuesRef.current);
    restorationCache.current = {};
    setError(null);
  }, []);

  const retry = useCallback(() => {
    setError(null);
    isFirstEval.current = true;
    setFieldValues((previous) => ({ ...previous }));
  }, []);

  const getSubmitValues = useCallback((): SchemaValues => Object.fromEntries(
    Object.entries(fieldValues).filter(([, value]) => value !== undefined && value !== ""),
  ), [fieldValues]);

  return {
    activeMixins,
    implicitRootMixins,
    schemaRootMixins,
    fieldValues,
    availableFields,
    loading,
    error,
    handleFieldChange,
    reset,
    retry,
    getSubmitValues,
  };
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
