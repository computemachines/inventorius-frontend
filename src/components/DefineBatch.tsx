import * as React from "react";
import { useContext, useState, useRef, useEffect, useCallback } from "react";
import { useFrontload } from "react-frontload";
import { useLocation } from "react-router-dom";
import { parse } from "query-string";

import { ApiContext, FrontloadContext } from "../api-client/api-client";
import { CodeUsageRef, AttributeBundle } from "../api-client/data-models";
import { ToastContext } from "./Toast";
import ItemLabel from "./ItemLabel";
import PrintButton from "./PrintButton";
import {
  TriggerField,
  DynamicFieldSection,
  labelClasses,
  inputClasses,
} from "./DynamicFieldSection";
import { useDynamicFields, TriggerState } from "../hooks/useDynamicFields";

/**
 * Code entry with lookup status
 */
interface CodeEntry {
  id: string;
  value: string;
  isOwned: boolean;
  usedBy: CodeUsageRef[];
  isLoading: boolean;
}

/**
 * Define Batch page - uses unified trigger field model.
 *
 * UX CHANGE: Added "Source" trigger field that works like "Item Type" in SKU form.
 * When you select a source (DigiKey, Amazon, etc.), source-specific fields appear.
 *
 * Design system colors:
 * - #04151f deep black (headers)
 * - #082441 dark navy (dropdowns)
 * - #0c3764 medium blue (hover/focus)
 * - #c0771f amber (accents)
 * - #cdd2d6 light gray (borders)
 * - #26532b dark green (primary actions)
 */
export function DefineBatch() {
  const location = useLocation();
  const queryParentSkuId = (parse(location.search).parent as string) || "";

  const { data, frontloadMeta, setData } = useFrontload(
    "define-batch-component",
    async ({ api }: FrontloadContext) => ({
      nextBatch: await api.getNextBatch(),
      parentSku: queryParentSkuId ? await api.getSku(queryParentSkuId) : null,
    })
  );

  const api = useContext(ApiContext);
  const { setToastContent } = useContext(ToastContext);

  // Dynamic fields hook (for Source trigger)
  const dynamicFields = useDynamicFields("batch");

  // Initialize the Source trigger field on mount
  useEffect(() => {
    const triggerDefs = api.getTriggerFields("batch");
    for (const def of triggerDefs) {
      dynamicFields.initTrigger(def);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Fixed form state
  const [batchId, setBatchId] = useState("");
  const [parentSkuId, setParentSkuId] = useState(queryParentSkuId);
  const [parentSkuName, setParentSkuName] = useState("");
  const [batchName, setBatchName] = useState("");
  const [codes, setCodes] = useState<CodeEntry[]>([
    { id: crypto.randomUUID(), value: "", isOwned: true, usedBy: [], isLoading: false }
  ]);

  // Refs
  const batchIdRef = useRef<HTMLInputElement>(null);
  const debounceRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Set parent SKU name from query param data
  useEffect(() => {
    if (data?.parentSku?.kind === "sku") {
      setParentSkuName(data.parentSku.state.name || "");
    }
  }, [data?.parentSku]);

  // Look up parent SKU when ID changes
  useEffect(() => {
    if (parentSkuId && parentSkuId !== queryParentSkuId) {
      api.getSku(parentSkuId).then((result) => {
        if (result.kind === "sku") {
          setParentSkuName(result.state.name || "");
        } else {
          setParentSkuName("");
        }
      });
    } else if (!parentSkuId) {
      setParentSkuName("");
    }
  }, [parentSkuId, queryParentSkuId, api]);

  const batchIdPlaceholder = frontloadMeta.pending
    ? "Loading..."
    : frontloadMeta.error
    ? "Error"
    : data?.nextBatch.state || "BAT000001";

  // Code handlers
  const lookupCode = useCallback(async (codeId: string, value: string) => {
    if (!value.trim()) {
      setCodes(prev => prev.map(c =>
        c.id === codeId ? { ...c, usedBy: [], isLoading: false } : c
      ));
      return;
    }

    setCodes(prev => prev.map(c =>
      c.id === codeId ? { ...c, isLoading: true } : c
    ));

    const result = await api.getCodeUsage(value.trim());

    setCodes(prev => prev.map(c =>
      c.id === codeId ? { ...c, usedBy: result.usedBy, isLoading: false } : c
    ));
  }, [api]);

  const handleCodeChange = (codeId: string, newValue: string) => {
    setCodes(prev => prev.map(c =>
      c.id === codeId ? { ...c, value: newValue } : c
    ));

    const existing = debounceRefs.current.get(codeId);
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(() => {
      lookupCode(codeId, newValue);
      debounceRefs.current.delete(codeId);
    }, 300);
    debounceRefs.current.set(codeId, timeout);
  };

  const toggleCodeOwnership = (codeId: string) => {
    setCodes(prev => prev.map(c =>
      c.id === codeId ? { ...c, isOwned: !c.isOwned } : c
    ));
  };

  const addCodeRow = () => {
    setCodes(prev => [
      ...prev,
      { id: crypto.randomUUID(), value: "", isOwned: true, usedBy: [], isLoading: false }
    ]);
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('input[data-code-input]');
      inputs[inputs.length - 1]?.focus();
    }, 0);
  };

  const handleCodeKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Tab" && !e.shiftKey && index === codes.length - 1) {
      const lastCode = codes[index];
      if (lastCode.value.trim()) {
        e.preventDefault();
        addCodeRow();
      }
    }
  };

  const handleReset = () => {
    setBatchId("");
    setBatchName("");
    setCodes([{ id: crypto.randomUUID(), value: "", isOwned: true, usedBy: [], isLoading: false }]);
    dynamicFields.reset();
    // Re-initialize triggers after reset
    const triggerDefs = api.getTriggerFields("batch");
    for (const def of triggerDefs) {
      dynamicFields.initTrigger(def);
    }
    if (!queryParentSkuId) {
      setParentSkuId("");
      setParentSkuName("");
    }
    batchIdRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const ownedCodes: string[] = [];
    const associatedCodes: string[] = [];

    for (const code of codes) {
      if (!code.value.trim()) continue;
      if (code.isOwned) {
        ownedCodes.push(code.value.trim());
      } else {
        associatedCodes.push(code.value.trim());
      }
    }

    // Get dynamic field values as props
    const props = dynamicFields.getFieldValues();

    // Add source to props if selected
    const sourceState = dynamicFields.triggers.source;
    if (sourceState?.selectedBundle) {
      props.source = sourceState.selectedBundle.name;
    }

    const resp = await api.createBatch({
      id: batchId || batchIdPlaceholder,
      sku_id: parentSkuId || undefined,
      name: batchName || undefined,
      owned_codes: ownedCodes,
      associated_codes: associatedCodes,
      props: Object.keys(props).length > 0 ? props : undefined,
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
      handleReset();
      const nextBatch = await api.getNextBatch();
      setData(prev => ({ ...prev, nextBatch }));
    } else {
      setToastContent({
        content: <p>{resp.title}</p>,
        mode: "failure",
      });
    }
  };

  if (frontloadMeta.pending) return <div className="p-4">Loading...</div>;
  if (frontloadMeta.error) throw Error("API Error");

  // Get source trigger state
  const sourceTrigger = dynamicFields.triggers.source;

  return (
    <div className="max-w-[40rem] mx-auto">
      {/* Title */}
      <h2 className="text-2xl font-bold text-[#04151f] mb-6 pb-3 border-b-2 border-[#cdd2d6]">
        New Batch
      </h2>

      <form onSubmit={handleSubmit}>
        {/* Batch ID */}
        <label htmlFor="batch_id" className={labelClasses} style={{ marginTop: 0 }}>
          Batch ID
        </label>
        <div className="flex items-center gap-2">
          <input
            ref={batchIdRef}
            type="text"
            id="batch_id"
            className={inputClasses + " flex-1"}
            placeholder={batchIdPlaceholder}
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
          />
          <PrintButton value={batchId || batchIdPlaceholder} />
        </div>

        {/* Parent SKU */}
        <label htmlFor="parent_sku" className={labelClasses}>
          Parent SKU
        </label>
        <input
          type="text"
          id="parent_sku"
          className={inputClasses}
          placeholder="SKU ID (optional)"
          value={parentSkuId}
          onChange={(e) => setParentSkuId(e.target.value)}
        />
        {parentSkuName && (
          <p className="mt-1 text-sm text-[#6d635d]">{parentSkuName}</p>
        )}

        {/* Batch Name */}
        <label htmlFor="batch_name" className={labelClasses}>
          Name
        </label>
        <input
          type="text"
          id="batch_name"
          className={inputClasses}
          placeholder={parentSkuName || "Optional"}
          value={batchName}
          onChange={(e) => setBatchName(e.target.value)}
        />

        {/* Source Section - NEW: Uses unified trigger field model */}
        {sourceTrigger && (
          <div className="mt-7 pt-5 border-t-2 border-[#cdd2d6]">
            <h3 className="text-base font-bold text-[#04151f] mb-3 flex items-center gap-2">
              <span className="block w-1 h-5 bg-[#0c3764] rounded-sm"></span>
              Provenance
            </h3>

            {/* Source trigger field (typeahead) */}
            <TriggerField
              triggerState={sourceTrigger}
              onInputChange={(value) => dynamicFields.handleTriggerInput("source", value)}
              onSelect={(bundle) => dynamicFields.selectBundle("source", bundle)}
              onClear={() => dynamicFields.clearTrigger("source")}
              onBlur={() => dynamicFields.hideSuggestions("source")}
            />

            {/* Dynamic fields from selected source bundle */}
            {dynamicFields.fieldStates.length > 0 && (
              <div className="mt-2">
                <DynamicFieldSection
                  fieldStates={dynamicFields.fieldStates}
                  onChange={dynamicFields.handleFieldChange}
                  showSourceGroups={false}
                />
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
            {codes.map((code, index) => (
              <div key={code.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative flex items-stretch">
                    <input
                      data-code-input
                      type="text"
                      className={`${inputClasses} flex-1 ${code.value ? 'pr-20' : ''} !mt-0`}
                      placeholder="Scan or type code..."
                      value={code.value}
                      onChange={(e) => handleCodeChange(code.id, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(e, index)}
                    />
                    {code.value && (
                      <button
                        type="button"
                        onClick={() => toggleCodeOwnership(code.id)}
                        className={`absolute right-1 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                          code.isOwned
                            ? 'bg-[#26532b] text-white hover:bg-[#1e4423]'
                            : 'bg-[#cdd2d6] text-[#6d635d] hover:bg-[#b8bfc5]'
                        }`}
                      >
                        {code.isOwned ? 'Owned' : 'Assoc'}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={addCodeRow}
                    className="py-2.5 px-3.5 text-base font-semibold border border-[#cdd2d6] rounded-md bg-transparent text-gray-400 hover:bg-[#e8f4e8] hover:border-[#26532b] hover:text-[#26532b] transition-colors"
                  >
                    +
                  </button>
                </div>
                {/* Shared info */}
                {!code.isLoading && code.value && code.usedBy.length > 0 && (
                  <div className="flex items-center gap-2 text-xs flex-wrap pl-1">
                    <span className="text-[#6d635d]">Shared with:</span>
                    {code.usedBy.slice(0, 3).map((ref) => (
                      <span
                        key={ref.id}
                        className="px-2 py-0.5 bg-[#082441] text-[#ecebe4] rounded text-xs"
                      >
                        {ref.name || ref.id}
                      </span>
                    ))}
                    {code.usedBy.length > 3 && (
                      <span className="text-gray-400 italic">+{code.usedBy.length - 3} more</span>
                    )}
                  </div>
                )}
                {code.isLoading && (
                  <span className="text-sm text-gray-400 pl-1">Loading...</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-8 pt-6 border-t border-[#cdd2d6]">
          <button
            type="submit"
            className="flex-1 py-3 px-6 text-base font-semibold bg-[#26532b] text-white rounded-md hover:bg-[#1e4423] active:scale-[0.98] transition-all cursor-pointer"
          >
            Create Batch
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="py-3 px-5 text-base font-medium bg-transparent text-[#6d635d] border border-[#cdd2d6] rounded-md hover:bg-[#cdd2d6] hover:text-[#04151f] transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}

export default DefineBatch;
