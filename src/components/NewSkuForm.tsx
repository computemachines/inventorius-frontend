import * as React from "react";
import { useContext, useState, useCallback } from "react";
import { useFrontload } from "react-frontload";

import { ApiContext, FrontloadContext } from "../api-client/api-client";
import { CodeUsageRef, AttributeBundle } from "../api-client/data-models";
import { ToastContext } from "./Toast";
import { useSchemaForm, SchemaField } from "../hooks/useSchemaForm";
import ItemLabel from "./ItemLabel";
import PrintButton from "./PrintButton";
import { AsyncTypeaheadField } from "./Typeahead";

// Shared Tailwind classes (design system)
const labelClasses =
  "block text-[0.85rem] font-semibold text-[#04151f] uppercase tracking-wide mt-5 mb-1.5";
const inputClasses =
  "block w-full py-2.5 px-3 border border-[#cdd2d6] rounded-md bg-white text-[#04151f] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0c3764] focus:ring-[3px] focus:ring-[#0c3764]/15 placeholder:text-gray-400";

interface CodeEntry {
  id: string;
  value: string;
  isOwned: boolean;
  usedBy: CodeUsageRef[];
  isLoading: boolean;
}

/**
 * Format a field name for display (snake_case -> Title Case)
 */
function formatLabel(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * SKU creation form using the unified trigger schema system.
 *
 * Design system colors:
 * - #04151f deep black (headers)
 * - #082441 dark navy (dropdowns)
 * - #0c3764 medium blue (hover/focus)
 * - #c0771f amber (accents, intersection fields)
 * - #cdd2d6 light gray (borders)
 * - #26532b dark green (primary actions)
 */
export function NewSkuForm() {
  const { data, frontloadMeta, setData } = useFrontload(
    "new-sku-schema",
    async ({ api }: FrontloadContext) => ({
      nextSku: await api.getNextSku(),
    })
  );

  const api = useContext(ApiContext);
  const { setToastContent } = useContext(ToastContext);

  // Use the new schema form hook
  const schema = useSchemaForm("sku", ["ItemTypeSelector"]);

  // Form state (non-schema fields)
  const [skuId, setSkuId] = useState("");

  // Code labels state
  const [codes, setCodes] = useState<CodeEntry[]>([
    { id: crypto.randomUUID(), value: "", isOwned: true, usedBy: [], isLoading: false }
  ]);

  const skuIdPlaceholder = frontloadMeta.pending
    ? "Loading..."
    : frontloadMeta.error
    ? "Error"
    : data?.nextSku.state || "SKU000001";

  // Code Labels Handlers
  const autoClassifyCode = (code: string): boolean => {
    return code.length % 2 === 1;
  };

  const handleCodeChange = useCallback(
    async (id: string, newValue: string) => {
      const trimmedValue = newValue.trim();

      setCodes((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                value: newValue,
                isOwned: trimmedValue ? autoClassifyCode(trimmedValue) : c.isOwned,
                isLoading: trimmedValue.length > 0,
              }
            : c
        )
      );

      if (trimmedValue) {
        const result = await api.getCodeUsage(trimmedValue);
        setCodes((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, usedBy: result.usedBy, isLoading: false }
              : c
          )
        );
      } else {
        setCodes((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, usedBy: [], isLoading: false } : c
          )
        );
      }
    },
    [api]
  );

  const toggleCodeOwnership = useCallback((id: string) => {
    setCodes((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isOwned: !c.isOwned } : c))
    );
  }, []);

  const removeCode = useCallback((id: string) => {
    setCodes((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (filtered.length === 0) {
        return [{ id: crypto.randomUUID(), value: "", isOwned: true, usedBy: [], isLoading: false }];
      }
      return filtered;
    });
  }, []);

  const handleCodeBlur = useCallback((id: string, index: number) => {
    setCodes((prev) => {
      const code = prev.find((c) => c.id === id);
      const isLastRow = index === prev.length - 1;
      if (code && !code.value.trim() && !isLastRow) {
        return prev.filter((c) => c.id !== id);
      }
      return prev;
    });
  }, []);

  const handleCodeFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  }, []);

  const handleCodeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, id: string, index: number) => {
      if (e.key === "Tab" && !e.shiftKey) {
        const currentCode = codes.find((c) => c.id === id);
        const isLastRow = index === codes.length - 1;

        if (currentCode?.value.trim() && isLastRow) {
          e.preventDefault();
          const newId = crypto.randomUUID();
          setCodes((prev) => [
            ...prev,
            { id: newId, value: "", isOwned: true, usedBy: [], isLoading: false },
          ]);
          setTimeout(() => {
            const newInput = document.querySelector(
              `input[data-code-id="${newId}"]`
            ) as HTMLInputElement;
            newInput?.focus();
          }, 0);
        }
      }
    },
    [codes]
  );

  const handlePlusClick = useCallback((id: string) => {
    const currentCode = codes.find((c) => c.id === id);

    if (currentCode?.value.trim()) {
      const newId = crypto.randomUUID();
      setCodes((prev) => [
        ...prev,
        { id: newId, value: "", isOwned: true, usedBy: [], isLoading: false },
      ]);
      setTimeout(() => {
        const newInput = document.querySelector(
          `input[data-code-id="${newId}"]`
        ) as HTMLInputElement;
        newInput?.focus();
      }, 0);
    } else {
      const input = document.querySelector(
        `input[data-code-id="${id}"]`
      ) as HTMLInputElement;
      input?.focus();
    }
  }, [codes]);

  const resetForm = useCallback(async () => {
    setSkuId("");
    schema.reset();
    setCodes([
      { id: crypto.randomUUID(), value: "", isOwned: true, usedBy: [], isLoading: false }
    ]);

    try {
      const nextSku = await api.getNextSku();
      setData(() => ({ nextSku }));
    } catch (e) {
      // Ignore - using mock data
    }
  }, [api, setData, schema]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const props = schema.getSubmitValues();

    // Store active mixins for reference
    if (schema.activeMixins.length > 1) {
      (props as Record<string, unknown>)._mixins = schema.activeMixins.filter(
        (m) => m !== "ItemTypeSelector"
      );
    }

    const ownedCodes = codes
      .filter((c) => c.value.trim() && c.isOwned)
      .map((c) => c.value.trim());
    const associatedCodes = codes
      .filter((c) => c.value.trim() && !c.isOwned)
      .map((c) => c.value.trim());

    const resp = await api.createSku({
      id: skuId || skuIdPlaceholder,
      name: (props.item_type as string) || "",
      props: Object.keys(props).length > 0 ? props : undefined,
      owned_codes: ownedCodes.length > 0 ? ownedCodes : undefined,
      associated_codes: associatedCodes.length > 0 ? associatedCodes : undefined,
    });

    if (resp.kind === "status") {
      setToastContent({
        content: (
          <p>
            Success,{" "}
            <ItemLabel url={resp.Id} onClick={() => setToastContent({})} />{" "}
            created.
          </p>
        ),
        mode: "success",
      });
      await resetForm();
    } else {
      setToastContent({
        content: <p>{resp.title}</p>,
        mode: "failure",
      });
    }
  };

  // Render a schema field
  const renderField = (field: SchemaField) => {
    const value = schema.fieldValues[field.name] ?? "";
    const inputId = `field-${field.name}`;

    // Determine if this is a "special" field that triggers mixins
    const isTypeaheadField = field.name === "item_type" || field.name === "source";

    // Boolean checkbox
    if (field.type === "bool") {
      return (
        <div key={field.name} className="flex items-center gap-3 mt-4">
          <input
            type="checkbox"
            id={inputId}
            checked={value === true}
            onChange={(e) => schema.handleFieldChange(field.name, e.target.checked)}
            className="w-5 h-5 rounded border-[#cdd2d6] text-[#0c3764] focus:ring-[#0c3764]"
          />
          <label htmlFor={inputId} className="text-[#04151f] font-medium">
            {formatLabel(field.name)}
          </label>
        </div>
      );
    }

    // Enum dropdown
    if (field.type === "enum" && field.options) {
      return (
        <div key={field.name} className="py-2">
          <label htmlFor={inputId} className={labelClasses} style={{ marginTop: 0 }}>
            {formatLabel(field.name)}
            {field.required && <span className="text-[#c0771f] ml-0.5 font-bold">*</span>}
          </label>
          <select
            id={inputId}
            value={value as string}
            onChange={(e) => schema.handleFieldChange(field.name, e.target.value)}
            className={`${inputClasses} cursor-pointer appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2304151f' d='M6 8L1 3h10z'/%3E%3C/svg%3E")] bg-no-repeat bg-[right_0.75em_center] pr-10`}
          >
            <option value="">Select {formatLabel(field.name).toLowerCase()}...</option>
            {field.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );
    }

    // Unit field
    if (field.type === "unit" && field.unit) {
      return (
        <div key={field.name} className="py-2">
          <label htmlFor={inputId} className={labelClasses} style={{ marginTop: 0 }}>
            {formatLabel(field.name)}
            {field.required && <span className="text-[#c0771f] ml-0.5 font-bold">*</span>}
          </label>
          <div className="flex items-stretch">
            <input
              id={inputId}
              type="text"
              value={value as string}
              onChange={(e) => schema.handleFieldChange(field.name, e.target.value)}
              className={`${inputClasses} flex-1 rounded-r-none border-r-0`}
              placeholder="e.g., 10k"
            />
            <span className="flex items-center px-3 bg-[#e5e4de] text-[#6d635d] text-sm font-medium border border-[#cdd2d6] border-l-0 rounded-r-md whitespace-nowrap">
              {field.unit}
            </span>
          </div>
        </div>
      );
    }

    // Number field
    if (field.type === "number") {
      return (
        <div key={field.name} className="py-2">
          <label htmlFor={inputId} className={labelClasses} style={{ marginTop: 0 }}>
            {formatLabel(field.name)}
            {field.required && <span className="text-[#c0771f] ml-0.5 font-bold">*</span>}
          </label>
          <input
            id={inputId}
            type="number"
            value={value as string}
            onChange={(e) => schema.handleFieldChange(field.name, e.target.value)}
            className={inputClasses}
          />
        </div>
      );
    }

    // Item type field with typeahead
    if (isTypeaheadField) {
      return (
        <div key={field.name} className="py-2">
          <label htmlFor={inputId} className={labelClasses} style={{ marginTop: 0 }}>
            {formatLabel(field.name)}
            {field.required && <span className="text-[#c0771f] ml-0.5 font-bold">*</span>}
          </label>
          <AsyncTypeaheadField<AttributeBundle>
            id={inputId}
            value={(value as string) || ""}
            onChange={(v) => schema.handleFieldChange(field.name, v)}
            onSelect={(bundle) => schema.handleFieldChange(field.name, bundle.name)}
            onSearch={async (query) => {
              const result = await api.searchBundles("sku", "itemType", query, {
                entityType: "sku",
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
            placeholder="Resistor, Capacitor, Battery..."
            clearable
            allowCreate
            onCreate={(inputValue) => schema.handleFieldChange(field.name, inputValue)}
          />
        </div>
      );
    }

    // Text field (default)
    return (
      <div key={field.name} className="py-2">
        <label htmlFor={inputId} className={labelClasses} style={{ marginTop: 0 }}>
          {formatLabel(field.name)}
          {field.required && <span className="text-[#c0771f] ml-0.5 font-bold">*</span>}
        </label>
        <input
          id={inputId}
          type="text"
          value={value as string}
          onChange={(e) => schema.handleFieldChange(field.name, e.target.value)}
          className={inputClasses}
          autoComplete="off"
        />
      </div>
    );
  };

  // Separate fields into groups for visual organization
  const itemTypeField = schema.availableFields.find((f) => f.name === "item_type");
  const otherFields = schema.availableFields.filter((f) => f.name !== "item_type");

  return (
    <form className="max-w-[40rem] mx-auto" onSubmit={handleSubmit}>
      <h2 className="text-2xl font-bold text-[#04151f] mb-6 pb-3 border-b-2 border-[#cdd2d6]">
        New SKU
      </h2>

      {schema.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {schema.error}
        </div>
      )}

      {/* SKU ID */}
      <label htmlFor="sku-id" className={labelClasses} style={{ marginTop: 0 }}>
        SKU ID
      </label>
      <div className="flex items-center gap-2">
        <input
          id="sku-id"
          type="text"
          value={skuId}
          onChange={(e) => setSkuId(e.target.value)}
          placeholder={skuIdPlaceholder}
          className={inputClasses + " flex-1"}
        />
        <PrintButton value={skuId || skuIdPlaceholder} />
      </div>

      {/* Item Type (trigger field) */}
      {itemTypeField && renderField(itemTypeField)}

      {/* Dynamic Fields */}
      {otherFields.length > 0 && (
        <div className="mt-7 pt-5 border-t-2 border-[#cdd2d6]">
          <h3 className="text-base font-bold text-[#04151f] mb-3 flex items-center gap-2">
            <span className="block w-1 h-5 bg-[#c0771f] rounded-sm"></span>
            {schema.fieldValues.item_type || "Item"} Attributes
          </h3>
          {otherFields.map(renderField)}
          {schema.activeMixins.length > 1 && (
            <div className="mt-4 py-2 px-3 text-sm text-[#6d635d] bg-[#cdd2d6]/30 rounded inline-block">
              Active: {schema.activeMixins.filter((m) => m !== "ItemTypeSelector").join(" → ")}
            </div>
          )}
        </div>
      )}

      {/* Codes Section */}
      <div className="mt-7 pt-5 border-t-2 border-[#cdd2d6]">
        <h3 className="text-base font-bold text-[#04151f] mb-3 flex items-center gap-2">
          <span className="block w-1 h-5 bg-[#c0771f] rounded-sm"></span>
          Codes
        </h3>
        <div className="flex flex-col gap-2">
          {codes.map((code, index) => {
            const isLastRow = index === codes.length - 1;
            return (
              <div key={code.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative flex items-stretch">
                    <input
                      type="text"
                      value={code.value}
                      onChange={(e) => handleCodeChange(code.id, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(e, code.id, index)}
                      onFocus={handleCodeFocus}
                      onBlur={() => handleCodeBlur(code.id, index)}
                      placeholder="Scan or type code..."
                      className={`${inputClasses} flex-1 ${code.value ? 'pr-20' : ''}`}
                      data-code-id={code.id}
                    />
                    {code.value && (
                      <button
                        type="button"
                        tabIndex={-1}
                        className={`absolute right-1 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                          code.isOwned
                            ? 'bg-[#26532b] text-white hover:bg-[#1e4423]'
                            : 'bg-[#cdd2d6] text-[#6d635d] hover:bg-[#b8bfc5]'
                        }`}
                        onClick={() => toggleCodeOwnership(code.id)}
                        title={code.isOwned ? "Owned (uniquely identifies)" : "Associated (shared)"}
                      >
                        {code.isOwned ? "Owned" : "Assoc"}
                      </button>
                    )}
                  </div>
                  {isLastRow ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      className="py-2.5 px-3.5 text-base font-semibold border border-[#cdd2d6] rounded-md bg-transparent text-gray-400 hover:bg-[#e8f4e8] hover:border-[#26532b] hover:text-[#26532b] transition-colors"
                      onClick={() => handlePlusClick(code.id)}
                      title="Add code"
                    >
                      +
                    </button>
                  ) : (
                    <button
                      type="button"
                      tabIndex={-1}
                      className="py-2.5 px-3.5 text-base font-semibold border border-[#cdd2d6] rounded-md bg-transparent text-gray-400 hover:bg-red-100 hover:border-red-400 hover:text-red-600 transition-colors"
                      onClick={() => removeCode(code.id)}
                      title="Remove code"
                    >
                      ×
                    </button>
                  )}
                </div>
                {/* Show shared SKUs for associated codes */}
                {!code.isOwned && code.usedBy.length > 0 && !code.isLoading && (
                  <div className="flex items-center gap-2 text-xs flex-wrap pl-1">
                    <span className="text-[#6d635d]">Shared with:</span>
                    {code.usedBy.slice(0, 3).map((ref) => (
                      <a
                        key={ref.id}
                        href={`/${ref.type}/${ref.id}`}
                        className="px-2 py-0.5 bg-[#082441] text-[#ecebe4] rounded text-xs hover:bg-[#0c3764] transition-colors"
                        onClick={(e) => e.preventDefault()}
                      >
                        {ref.name || ref.id}
                      </a>
                    ))}
                    {code.usedBy.length > 3 && (
                      <span className="text-gray-400 italic">
                        +{code.usedBy.length - 3} more
                      </span>
                    )}
                  </div>
                )}
                {code.isLoading && (
                  <span className="text-sm text-gray-400 pl-1">...</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-8 pt-6 border-t border-[#cdd2d6]">
        <button
          type="submit"
          className="flex-1 py-3 px-6 text-base font-semibold bg-[#26532b] text-white rounded-md hover:bg-[#1e4423] active:scale-[0.98] transition-all cursor-pointer"
        >
          Create SKU
        </button>
        <button
          type="button"
          onClick={resetForm}
          className="py-3 px-5 text-base font-medium bg-transparent text-[#6d635d] border border-[#cdd2d6] rounded-md hover:bg-[#cdd2d6] hover:text-[#04151f] transition-colors cursor-pointer"
        >
          Reset
        </button>
      </div>

      {schema.loading && (
        <div className="fixed bottom-4 right-4 bg-[#082441] text-white px-4 py-2 rounded-lg shadow-lg">
          Loading...
        </div>
      )}
    </form>
  );
}

export default NewSkuForm;
