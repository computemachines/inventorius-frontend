import * as React from "react";
import { useState, useEffect, useMemo, useContext } from "react";
import { ApiContext } from "../api-client/api-client";
import { SchemaField } from "../hooks/useSchemaForm";
import { SchemaFieldList, labelClasses } from "./SchemaFields";
import FormSection from "./FormSection";

/**
 * Schema Admin - Low-level editor for mixin schemas
 *
 * Design system colors:
 * - #04151f deep black (headers)
 * - #082441 dark navy (mixin headers, badges)
 * - #0c3764 medium blue (hover/focus)
 * - #c0771f amber (accents, intersections)
 * - #cdd2d6 light gray (borders)
 * - #26532b dark green (primary actions)
 * - #6d635d muted text
 */

// Shared Tailwind classes for admin editors (slightly smaller than form fields)
const adminInputClasses = "py-2 px-3 text-sm border border-[#cdd2d6] rounded bg-white text-[#04151f] focus:outline-none focus:border-[#0c3764] focus:ring-2 focus:ring-[#0c3764]/15";
const selectClasses = `${adminInputClasses} cursor-pointer appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2304151f' d='M6 8L1 3h10z'/%3E%3C/svg%3E")] bg-no-repeat bg-[right_0.5rem_center] pr-8`;
const btnPrimary = "py-2 px-4 text-sm font-semibold bg-[#26532b] text-white rounded hover:bg-[#1e4423] transition-colors";
const btnSecondary = "py-2 px-4 text-sm font-medium bg-white text-[#04151f] border border-[#cdd2d6] rounded hover:bg-[#f0f0f0] transition-colors";
// Buttons for dark backgrounds - deeper colors reduce chromatic aberration/halation
const btnSaveLight = "py-1.5 px-3 text-xs font-semibold bg-emerald-700 text-white rounded hover:bg-emerald-600 transition-colors";
const btnDeleteLight = "py-1.5 px-3 text-xs font-semibold bg-red-800 text-white rounded hover:bg-red-700 transition-colors";

// Types that mirror the API exactly (SchemaField is imported from useSchemaForm)

interface TriggerCondition {
  field: string;
  op: "eq" | "neq" | "in" | "lt" | "gt" | "lte" | "gte" | "set" | "and";
  value: unknown;
}

interface ChildMixin {
  mixin: string;
  trigger: TriggerCondition;
}

interface Mixin {
  name: string;
  fields: SchemaField[];
  children: ChildMixin[];
}

interface IntersectionRule {
  when: string[];
  adds: SchemaField[];
}

interface Schema {
  root_mixins: string[];
  mixins: Record<string, Mixin>;
  intersections: IntersectionRule[];
}

interface ValidationError {
  path: string;
  message: string;
}

// Validation functions
function validateField(field: SchemaField, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const path = `field[${index}]`;

  if (!field.name.trim()) {
    errors.push({ path, message: "Field name is required" });
  }
  if (field.type === "enum" && (!field.options || field.options.length === 0)) {
    errors.push({ path, message: "Enum field requires at least one option" });
  }
  if (field.type === "unit" && !field.unit?.trim()) {
    errors.push({ path, message: "Unit field requires a unit symbol" });
  }
  return errors;
}

function validateMixin(mixin: Mixin, allMixinNames: string[]): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!mixin.name.trim()) {
    errors.push({ path: "name", message: "Mixin name is required" });
  }

  // Check for duplicate field names
  const fieldNames = new Set<string>();
  mixin.fields.forEach((f, i) => {
    errors.push(...validateField(f, i));
    if (fieldNames.has(f.name)) {
      errors.push({ path: `field[${i}]`, message: `Duplicate field name: ${f.name}` });
    }
    fieldNames.add(f.name);
  });

  // Check child references
  mixin.children.forEach((child, i) => {
    if (!child.mixin) {
      errors.push({ path: `child[${i}]`, message: "Child mixin reference required" });
    } else if (!allMixinNames.includes(child.mixin)) {
      errors.push({ path: `child[${i}]`, message: `Unknown mixin: ${child.mixin}` });
    }
    if (!child.trigger.field.trim()) {
      errors.push({ path: `child[${i}].trigger`, message: "Trigger field required" });
    }
  });

  return errors;
}

function validateIntersection(rule: IntersectionRule, index: number, allMixinNames: string[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const path = `intersection[${index}]`;

  if (rule.when.length < 2) {
    errors.push({ path, message: "Intersection requires at least 2 mixins" });
  }
  rule.when.forEach((m, i) => {
    if (!allMixinNames.includes(m)) {
      errors.push({ path: `${path}.when[${i}]`, message: `Unknown mixin: ${m}` });
    }
  });
  rule.adds.forEach((f, i) => {
    errors.push(...validateField(f, i).map(e => ({ ...e, path: `${path}.${e.path}` })));
  });

  return errors;
}

// Sub-editors
function FieldEditor({
  field,
  onChange,
  onDelete,
}: {
  field: SchemaField;
  onChange: (f: SchemaField) => void;
  onDelete: () => void;
}) {
  const handleTypeChange = (newType: string) => {
    const updates: Partial<SchemaField> = { type: newType };
    // Initialize type-specific properties when switching types
    if (newType === "enum" && !field.options) {
      updates.options = [];
    }
    if (newType === "unit" && !field.unit) {
      updates.unit = "";
    }
    onChange({ ...field, ...updates });
  };

  return (
    <div className="flex gap-2 items-center py-2 px-3 bg-white rounded border border-[#cdd2d6] mb-1">
      <input
        type="text"
        value={field.name}
        onChange={(e) => onChange({ ...field, name: e.target.value })}
        placeholder="field_name"
        className={`${adminInputClasses} w-44 py-1.5 text-sm font-mono`}
      />
      <select
        value={field.type}
        onChange={(e) => handleTypeChange(e.target.value)}
        className={`${selectClasses} w-24 py-1.5 text-xs`}
      >
        <option value="text">text</option>
        <option value="number">number</option>
        <option value="enum">enum</option>
        <option value="bool">bool</option>
        <option value="unit">unit</option>
        <option value="file">file</option>
      </select>
      {field.type === "enum" && (
        <input
          type="text"
          value={field.options?.join(", ") || ""}
          onChange={(e) =>
            onChange({ ...field, options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
          }
          placeholder="opt1, opt2, opt3"
          className={`${adminInputClasses} flex-1 min-w-0 py-1.5 text-xs`}
        />
      )}
      {field.type === "unit" && (
        <input
          type="text"
          value={field.unit || ""}
          onChange={(e) => onChange({ ...field, unit: e.target.value })}
          placeholder="unit"
          className={`${adminInputClasses} w-20 py-1.5 text-xs font-mono`}
        />
      )}
      {(field.type !== "enum" && field.type !== "unit") && <div className="flex-1" />}
      <button
        onClick={onDelete}
        className="w-6 h-6 flex items-center justify-center text-[#6d635d] hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
        title="Remove field"
      >
        ×
      </button>
    </div>
  );
}

function TriggerEditor({
  trigger,
  onChange,
}: {
  trigger: TriggerCondition;
  onChange: (t: TriggerCondition) => void;
}) {
  const valueIsArray = trigger.op === "in";

  return (
    <span className="inline-flex gap-2 items-center">
      <input
        type="text"
        value={trigger.field}
        onChange={(e) => onChange({ ...trigger, field: e.target.value })}
        placeholder="field"
        className={`${adminInputClasses} w-28 py-1.5 text-sm font-mono`}
      />
      <select
        value={trigger.op}
        onChange={(e) => {
          const newOp = e.target.value as TriggerCondition["op"];
          let newValue = trigger.value;
          if (newOp === "in" && !Array.isArray(trigger.value)) {
            newValue = trigger.value ? [trigger.value] : [];
          } else if (newOp !== "in" && Array.isArray(trigger.value)) {
            newValue = (trigger.value as string[])[0] || "";
          }
          onChange({ ...trigger, op: newOp, value: newValue });
        }}
        className={`${selectClasses} w-20 py-1.5 text-sm`}
      >
        <option value="eq">eq</option>
        <option value="neq">neq</option>
        <option value="in">in</option>
        <option value="lt">lt</option>
        <option value="gt">gt</option>
        <option value="lte">lte</option>
        <option value="gte">gte</option>
        <option value="set">set</option>
      </select>
      {trigger.op === "set" ? (
        <select
          value={String(trigger.value)}
          onChange={(e) => onChange({ ...trigger, value: e.target.value === "true" })}
          className={`${selectClasses} w-20 py-1.5 text-sm`}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : valueIsArray ? (
        <input
          type="text"
          value={Array.isArray(trigger.value) ? (trigger.value as string[]).join(", ") : ""}
          onChange={(e) =>
            onChange({ ...trigger, value: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
          }
          placeholder="val1, val2"
          className={`${adminInputClasses} w-36 py-1.5 text-sm`}
        />
      ) : (
        <input
          type="text"
          value={(trigger.value as string) ?? ""}
          onChange={(e) => onChange({ ...trigger, value: e.target.value })}
          placeholder="value"
          className={`${adminInputClasses} w-28 py-1.5 text-sm`}
        />
      )}
    </span>
  );
}

function ChildMixinEditor({
  child,
  onChange,
  onDelete,
  availableMixins,
}: {
  child: ChildMixin;
  onChange: (c: ChildMixin) => void;
  onDelete: () => void;
  availableMixins: string[];
}) {
  return (
    <div className="flex gap-3 items-center py-2 px-3 bg-white rounded border border-[#cdd2d6] mb-1">
      <span className="text-[#082441] font-bold">→</span>
      <select
        value={child.mixin}
        onChange={(e) => onChange({ ...child, mixin: e.target.value })}
        className={`${selectClasses} min-w-[160px] py-1.5 text-sm`}
      >
        <option value="">Select mixin...</option>
        {availableMixins.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <span className="text-[#6d635d] text-sm font-medium">when</span>
      <TriggerEditor
        trigger={child.trigger}
        onChange={(t) => onChange({ ...child, trigger: t })}
      />
      <button
        onClick={onDelete}
        className="w-6 h-6 flex items-center justify-center text-[#6d635d] hover:text-red-600 hover:bg-red-50 rounded transition-colors ml-auto flex-shrink-0"
        title="Remove trigger"
      >
        ×
      </button>
    </div>
  );
}

function MixinEditor({
  mixin,
  onChange,
  onDelete,
  onSave,
  availableMixins,
  isNew,
  validationErrors,
}: {
  mixin: Mixin;
  onChange: (m: Mixin) => void;
  onDelete: () => void;
  onSave: () => void;
  availableMixins: string[];
  isNew?: boolean;
  validationErrors: ValidationError[];
}) {
  const [expanded, setExpanded] = useState(isNew);
  const hasErrors = validationErrors.length > 0;

  const addField = () => {
    onChange({
      ...mixin,
      fields: [...mixin.fields, { name: "", type: "text" }],
    });
  };

  const addChild = () => {
    onChange({
      ...mixin,
      children: [
        ...mixin.children,
        { mixin: "", trigger: { field: "", op: "eq", value: "" } },
      ],
    });
  };

  return (
    <div className={`rounded-lg overflow-hidden border ${hasErrors ? 'border-red-400' : 'border-[#cdd2d6]'} mb-3`}>
      <div
        className="py-3 px-4 bg-[#082441] text-white cursor-pointer flex justify-between items-center"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-3">
          <span className="text-white/50 text-xs">{expanded ? "▼" : "▶"}</span>
          <strong className="font-semibold text-base">{mixin.name || "(new mixin)"}</strong>
          <span className="text-white/50 text-sm">
            {mixin.fields.length} fields, {mixin.children.length} children
          </span>
          {hasErrors && <span className="text-red-300 text-sm ml-1">⚠</span>}
        </span>
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={onSave} className={btnSaveLight}>Save</button>
          <button onClick={onDelete} className={btnDeleteLight}>Delete</button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 bg-[#f8f9fa]">
          {/* Name */}
          <div className="mb-4">
            <label className={labelClasses}>Name</label>
            <input
              type="text"
              value={mixin.name}
              onChange={(e) => onChange({ ...mixin, name: e.target.value })}
              className={`${adminInputClasses} w-48 font-semibold`}
            />
          </div>

          {/* Fields */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <label className={`${labelClasses} mb-0`}>Fields</label>
              <button onClick={addField} className={`${btnSecondary} py-0.5 px-2 text-xs`}>+ Add</button>
            </div>
            <div className="flex flex-col gap-1">
              {mixin.fields.map((field, i) => (
                <FieldEditor
                  key={i}
                  field={field}
                  onChange={(f) => {
                    const newFields = [...mixin.fields];
                    newFields[i] = f;
                    onChange({ ...mixin, fields: newFields });
                  }}
                  onDelete={() => onChange({ ...mixin, fields: mixin.fields.filter((_, j) => j !== i) })}
                />
              ))}
              {mixin.fields.length === 0 && (
                <div className="text-sm text-[#6d635d] italic py-2">(no fields)</div>
              )}
            </div>
          </div>

          {/* Children */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className={`${labelClasses} mb-0`}>Children (triggers)</label>
              <button onClick={addChild} className={`${btnSecondary} py-0.5 px-2 text-xs`}>+ Add</button>
            </div>
            <div className="flex flex-col gap-1">
              {mixin.children.map((child, i) => (
                <ChildMixinEditor
                  key={i}
                  child={child}
                  availableMixins={availableMixins}
                  onChange={(c) => {
                    const newChildren = [...mixin.children];
                    newChildren[i] = c;
                    onChange({ ...mixin, children: newChildren });
                  }}
                  onDelete={() => onChange({ ...mixin, children: mixin.children.filter((_, j) => j !== i) })}
                />
              ))}
              {mixin.children.length === 0 && (
                <div className="text-sm text-[#6d635d] italic py-2">(no children)</div>
              )}
            </div>
          </div>

          {/* Validation Errors */}
          {hasErrors && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <strong>Validation issues:</strong>
              <ul className="mt-1 list-disc list-inside">
                {validationErrors.map((e, i) => (
                  <li key={i}>{e.path}: {e.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IntersectionEditor({
  rule,
  onChange,
  onDelete,
  availableMixins,
}: {
  rule: IntersectionRule;
  onChange: (r: IntersectionRule) => void;
  onDelete: () => void;
  availableMixins: string[];
}) {
  return (
    <div className="p-4 bg-[#fffaf0] border border-[#c0771f]/40 rounded-lg mb-3">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          {/* When clause */}
          <div className="mb-4">
            <label className={labelClasses}>When these mixins are active</label>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {rule.when.map((m, i) => (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <span className="text-[#c0771f] font-bold text-lg">+</span>
                  )}
                  <div className="inline-flex items-center bg-white rounded border border-[#cdd2d6]">
                    <select
                      value={m}
                      onChange={(e) => {
                        const newWhen = [...rule.when];
                        newWhen[i] = e.target.value;
                        onChange({ ...rule, when: newWhen });
                      }}
                      className="py-1.5 px-2 text-sm border-0 bg-transparent focus:outline-none focus:ring-0 cursor-pointer"
                    >
                      <option value="">Select...</option>
                      {availableMixins.map((mx) => (
                        <option key={mx} value={mx}>{mx}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => onChange({ ...rule, when: rule.when.filter((_, j) => j !== i) })}
                      className="px-2 py-1.5 text-[#6d635d] hover:text-red-600 hover:bg-red-50 border-l border-[#cdd2d6]"
                    >
                      ×
                    </button>
                  </div>
                </React.Fragment>
              ))}
              <button
                onClick={() => onChange({ ...rule, when: [...rule.when, ""] })}
                className="py-1.5 px-3 text-sm text-[#c0771f] border border-[#c0771f]/40 rounded hover:bg-[#c0771f]/10"
              >
                + Add Mixin
              </button>
            </div>
          </div>

          {/* Adds clause */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <label className={`${labelClasses} mb-0`}>Add these fields</label>
              <button
                onClick={() => onChange({ ...rule, adds: [...rule.adds, { name: "", type: "text" }] })}
                className="py-1 px-2 text-xs text-[#c0771f] border border-[#c0771f]/40 rounded hover:bg-[#c0771f]/10"
              >
                + Add Field
              </button>
            </div>
            <div className="flex flex-col">
              {rule.adds.map((field, i) => (
                <FieldEditor
                  key={i}
                  field={field}
                  onChange={(f) => {
                    const newAdds = [...rule.adds];
                    newAdds[i] = f;
                    onChange({ ...rule, adds: newAdds });
                  }}
                  onDelete={() => onChange({ ...rule, adds: rule.adds.filter((_, j) => j !== i) })}
                />
              ))}
              {rule.adds.length === 0 && (
                <div className="text-sm text-[#6d635d] italic py-2">(no fields)</div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onDelete}
          className="w-8 h-8 flex items-center justify-center text-[#6d635d] hover:text-red-600 hover:bg-red-50 rounded text-xl flex-shrink-0"
          title="Remove intersection"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// Test Panel Component - Form Preview (uses SchemaFieldList for consistent rendering)
function TestPanel({
  schemaName,
  schema,
}: {
  schemaName: string;
  schema: Schema;
}) {
  const api = useContext(ApiContext);
  const [activeMixins, setActiveMixins] = useState<string[]>(schema.root_mixins.slice(0, 1));
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});
  const [result, setResult] = useState<{ active_mixins: string[]; available_fields: SchemaField[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    try {
      const resp = await api.evaluateSchema(schemaName, activeMixins, fieldValues);
      setResult(resp as { active_mixins: string[]; available_fields: SchemaField[] });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // Auto-run on changes
  useEffect(() => {
    if (activeMixins.length > 0) {
      runTest();
    }
  }, [activeMixins, fieldValues, schemaName]);

  const handleFieldChange = (name: string, value: string | boolean) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleReset = () => {
    setFieldValues({});
    setActiveMixins(schema.root_mixins.slice(0, 1));
    setResult(null);
  };

  // Separate trigger field from other fields
  const triggerField = result?.available_fields.find(
    (f) => f.name === "item_type" || f.name === "source"
  );
  const otherFields = result?.available_fields.filter(
    (f) => f.name !== "item_type" && f.name !== "source"
  ) || [];

  // Determine title for dynamic fields section
  const triggerValue = triggerField ? fieldValues[triggerField.name] : null;
  const dynamicSectionTitle = triggerValue
    ? `${triggerValue} Attributes`
    : "Dynamic Fields";

  return (
    <div className="bg-white border border-[#cdd2d6] rounded-lg shadow-sm">
      {/* Form Header */}
      <div className="px-6 py-4 border-b-2 border-[#cdd2d6]">
        <h3 className="text-xl font-bold text-[#04151f]">
          Form Preview: {schemaName === "sku" ? "New SKU" : "New Batch"}
        </h3>
        <p className="text-sm text-[#6d635d] mt-1">
          Test how the form renders with different field values
        </p>
      </div>

      <div className="p-6">
        {/* Root Mixin Selector */}
        <div className="mb-4">
          <label className={labelClasses}>Starting Schema</label>
          <select
            value={activeMixins[0] || ""}
            onChange={(e) => {
              setActiveMixins([e.target.value]);
              setFieldValues({});
              setResult(null);
            }}
            className={`${selectClasses} w-64`}
          >
            {schema.root_mixins.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Trigger Field (Item Type / Source) - rendered without typeahead in preview */}
        {triggerField && (
          <SchemaFieldList
            fields={[triggerField]}
            values={fieldValues}
            onChange={handleFieldChange}
          />
        )}

        {/* Dynamic Fields Section */}
        {otherFields.length > 0 && (
          <FormSection title={dynamicSectionTitle} accent="amber">
            <SchemaFieldList
              fields={otherFields}
              values={fieldValues}
              onChange={handleFieldChange}
            />

            {/* Active mixins indicator */}
            {result && result.active_mixins.length > 1 && (
              <div className="mt-4 py-2 px-3 text-sm text-[#6d635d] bg-[#cdd2d6]/30 rounded inline-block">
                Active: {result.active_mixins.slice(1).join(" → ")}
              </div>
            )}
          </FormSection>
        )}

        {/* Form Actions */}
        <div className="flex gap-3 mt-8 pt-6 border-t border-[#cdd2d6]">
          <button
            type="button"
            disabled
            className="flex-1 py-3 px-6 text-base font-semibold bg-[#26532b]/50 text-white rounded-md cursor-not-allowed"
          >
            Create {schemaName === "sku" ? "SKU" : "Batch"} (Preview)
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="py-3 px-5 text-base font-medium bg-transparent text-[#6d635d] border border-[#cdd2d6] rounded-md hover:bg-[#cdd2d6] hover:text-[#04151f] transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>

        {loading && (
          <div className="fixed bottom-4 right-4 bg-[#082441] text-white px-4 py-2 rounded-lg shadow-lg">
            Evaluating...
          </div>
        )}
      </div>
    </div>
  );
}

// Main Component
export default function SchemaAdmin() {
  const api = useContext(ApiContext);
  const [schemaName, setSchemaName] = useState("sku");
  const [schema, setSchema] = useState<Schema | null>(null);
  const [availableSchemas, setAvailableSchemas] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [newMixin, setNewMixin] = useState<Mixin | null>(null);
  const [showTest, setShowTest] = useState(false);

  // Load available schemas
  useEffect(() => {
    api.listSchemas().then(setAvailableSchemas);
  }, [api]);

  // Load selected schema
  useEffect(() => {
    if (schemaName) {
      api.getSchema(schemaName)
        .then((data) => {
          setSchema(data as Schema);
          setStatus("");
        })
        .catch((err) => setStatus(`Error loading: ${(err as Error).message}`));
    }
  }, [schemaName, api]);

  const availableMixins = useMemo(() => schema ? Object.keys(schema.mixins) : [], [schema]);

  const reloadSchema = async () => {
    const data = await api.getSchema(schemaName);
    setSchema(data as Schema);
  };

  const saveMixin = async (mixinName: string, mixin: Mixin) => {
    // Validate first
    const errors = validateMixin(mixin, availableMixins);
    if (errors.length > 0) {
      setStatus(`Validation failed: ${errors[0].message}`);
      return;
    }

    try {
      await api.saveMixin(schemaName, mixinName, mixin);
      setStatus(`Saved: ${mixinName}`);
      await reloadSchema();
      setNewMixin(null);
      setTimeout(() => setStatus(""), 2000);
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  };

  const deleteMixin = async (mixinName: string) => {
    if (!confirm(`Delete mixin "${mixinName}"?`)) return;
    try {
      await api.deleteMixin(schemaName, mixinName);
      setStatus(`Deleted: ${mixinName}`);
      await reloadSchema();
      setTimeout(() => setStatus(""), 2000);
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  };

  const saveFullSchema = async () => {
    if (!schema) return;

    // Validate intersections
    const errors: ValidationError[] = [];
    schema.intersections.forEach((rule, i) => {
      errors.push(...validateIntersection(rule, i, availableMixins));
    });
    if (errors.length > 0) {
      setStatus(`Validation failed: ${errors[0].message}`);
      return;
    }

    try {
      await api.saveSchema(schemaName, schema);
      setStatus("Schema saved");
      setTimeout(() => setStatus(""), 2000);
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  };

  return (
    <div className="max-w-[960px] mx-auto py-6 px-4">
      <h2 className="text-2xl font-bold text-[#04151f] mb-6 pb-3 border-b-2 border-[#cdd2d6]">
        Schema Admin
      </h2>

      {/* Schema selector and status */}
      <div className="flex items-center gap-4 mb-6">
        <div>
          <label className={labelClasses}>Schema</label>
          <select
            value={schemaName}
            onChange={(e) => setSchemaName(e.target.value)}
            className={`${selectClasses} w-40`}
          >
            {availableSchemas.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowTest(!showTest)}
          className={`${showTest ? btnPrimary : btnSecondary} mt-5`}
        >
          {showTest ? "Hide Test" : "Test Schema"}
        </button>
        {status && (
          <span className={`mt-5 text-sm ${status.startsWith("Error") || status.startsWith("Validation") ? "text-red-600" : "text-[#26532b]"}`}>
            {status}
          </span>
        )}
      </div>

      {/* Test Panel */}
      {showTest && schema && (
        <div className="mb-6">
          <TestPanel schemaName={schemaName} schema={schema} />
        </div>
      )}

      {schema && (
        <>
          {/* Root Mixins */}
          <div className="mb-6 p-4 bg-[#f8f9fa] rounded-lg border border-[#cdd2d6]">
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-sm font-bold text-[#04151f] mr-2">Root Mixins:</span>
              {schema.root_mixins.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#082441] text-white rounded text-sm"
                >
                  {r}
                  <button
                    onClick={async () => {
                      await api.removeRootMixin(schemaName, r);
                      await reloadSchema();
                    }}
                    className="hover:text-red-300 ml-1 text-white/60"
                  >
                    ×
                  </button>
                </span>
              ))}
              <select
                onChange={async (e) => {
                  if (e.target.value) {
                    await api.addRootMixin(schemaName, e.target.value);
                    await reloadSchema();
                    e.target.value = "";
                  }
                }}
                defaultValue=""
                className={`${selectClasses} w-36 py-1.5 text-sm`}
              >
                <option value="">+ Add Root</option>
                {availableMixins
                  .filter((m) => !schema.root_mixins.includes(m))
                  .map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
              </select>
            </div>
          </div>

          {/* Mixins */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-base font-bold text-[#04151f] flex items-center gap-2">
                <span className="w-1.5 h-5 bg-[#082441] rounded-sm"></span>
                Mixins
              </h3>
              <button
                onClick={() => setNewMixin({ name: "", fields: [], children: [] })}
                className={btnSecondary}
              >
                + New Mixin
              </button>
            </div>

            {newMixin && (
              <MixinEditor
                mixin={newMixin}
                onChange={setNewMixin}
                onDelete={() => setNewMixin(null)}
                onSave={() => saveMixin(newMixin.name, newMixin)}
                availableMixins={availableMixins}
                validationErrors={validateMixin(newMixin, availableMixins)}
                isNew
              />
            )}

            {Object.entries(schema.mixins).map(([name, mixin]) => (
              <MixinEditor
                key={name}
                mixin={mixin}
                onChange={(m) => setSchema({ ...schema, mixins: { ...schema.mixins, [name]: m } })}
                onDelete={() => deleteMixin(name)}
                onSave={() => saveMixin(name, schema.mixins[name])}
                availableMixins={availableMixins}
                validationErrors={validateMixin(mixin, availableMixins)}
              />
            ))}
          </div>

          {/* Intersections */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-base font-bold text-[#04151f] flex items-center gap-2">
                <span className="w-1.5 h-5 bg-[#c0771f] rounded-sm"></span>
                Intersections
              </h3>
              <button
                onClick={() => setSchema({ ...schema, intersections: [...schema.intersections, { when: [], adds: [] }] })}
                className={btnSecondary}
              >
                + New Intersection
              </button>
              <button onClick={saveFullSchema} className={btnPrimary}>
                Save Intersections
              </button>
            </div>

            {schema.intersections.map((rule, i) => (
              <IntersectionEditor
                key={i}
                rule={rule}
                availableMixins={availableMixins}
                onChange={(r) => {
                  const newIntersections = [...schema.intersections];
                  newIntersections[i] = r;
                  setSchema({ ...schema, intersections: newIntersections });
                }}
                onDelete={() => setSchema({ ...schema, intersections: schema.intersections.filter((_, j) => j !== i) })}
              />
            ))}
            {schema.intersections.length === 0 && (
              <div className="text-sm text-[#6d635d] italic">No intersection rules</div>
            )}
          </div>

          {/* Raw JSON */}
          <details className="mt-6">
            <summary className="cursor-pointer text-sm text-[#6d635d] hover:text-[#04151f]">
              View Raw JSON
            </summary>
            <pre className="mt-2 p-4 bg-[#082441] text-[#e5e4de] rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(schema, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}
