import * as React from "react";
import { useContext, useState, useCallback, useEffect } from "react";
import { useFrontload } from "react-frontload";
import { useLocation } from "react-router-dom";
import { parse } from "query-string";

import { ApiContext, FrontloadContext } from "../api-client/api-client";
import { ToastContext } from "./Toast";
import { useSchemaForm } from "../hooks/useSchemaForm";
import ItemLabel from "./ItemLabel";
import PrintButton from "./PrintButton";
import FormSection from "./FormSection";
import { CodesSection, CodeEntry, createEmptyCode } from "./CodesSection";
import { SchemaFieldList, labelClasses, inputClasses } from "./SchemaFields";

/**
 * Batch creation form using the unified trigger schema system.
 * Uses modular components: FormSection, CodesSection, SchemaFieldList.
 */
export function NewBatchForm() {
  const location = useLocation();
  const queryParentSkuId = (parse(location.search).parent as string) || "";

  const { data, frontloadMeta, setData } = useFrontload(
    "new-batch-schema",
    async ({ api }: FrontloadContext) => ({
      nextBatch: await api.getNextBatch(),
      parentSku: queryParentSkuId ? await api.getSku(queryParentSkuId) : null,
    })
  );

  const api = useContext(ApiContext);
  const { setToastContent } = useContext(ToastContext);

  // Schema form hook handles all field state
  const schema = useSchemaForm("batch", ["SourceSelector"]);

  // Form state (non-schema fields)
  const [batchId, setBatchId] = useState("");
  const [parentSkuId, setParentSkuId] = useState(queryParentSkuId);
  const [parentSkuName, setParentSkuName] = useState("");
  const [batchName, setBatchName] = useState("");
  const [codes, setCodes] = useState<CodeEntry[]>([createEmptyCode()]);

  const batchIdPlaceholder = frontloadMeta.pending
    ? "Loading..."
    : frontloadMeta.error
    ? "Error"
    : data?.nextBatch.state || "BAT000001";

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

  const resetForm = useCallback(async () => {
    setBatchId("");
    setBatchName("");
    schema.reset();
    setCodes([createEmptyCode()]);

    if (!queryParentSkuId) {
      setParentSkuId("");
      setParentSkuName("");
    }

    try {
      const nextBatch = await api.getNextBatch();
      setData((prev) => ({ ...prev, nextBatch }));
    } catch (e) {
      // Ignore - using mock data
    }
  }, [api, setData, schema, queryParentSkuId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const props = schema.getSubmitValues();

    // Store active mixins for reference
    if (schema.activeMixins.length > 1) {
      (props as Record<string, unknown>)._mixins = schema.activeMixins.filter(
        (m) => m !== "SourceSelector"
      );
    }

    const ownedCodes = codes
      .filter((c) => c.value.trim() && c.isOwned)
      .map((c) => c.value.trim());
    const associatedCodes = codes
      .filter((c) => c.value.trim() && !c.isOwned)
      .map((c) => c.value.trim());

    const resp = await api.createBatch({
      id: batchId || batchIdPlaceholder,
      sku_id: parentSkuId || undefined,
      name: batchName || undefined,
      owned_codes: ownedCodes.length > 0 ? ownedCodes : undefined,
      associated_codes: associatedCodes.length > 0 ? associatedCodes : undefined,
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
      await resetForm();
    } else {
      setToastContent({
        content: <p>{resp.title}</p>,
        mode: "failure",
      });
    }
  };

  // Separate trigger field from other fields
  const sourceField = schema.availableFields.find((f) => f.name === "source");
  const otherFields = schema.availableFields.filter((f) => f.name !== "source");

  if (frontloadMeta.pending) return <div className="p-4">Loading...</div>;
  if (frontloadMeta.error) throw Error("API Error");

  return (
    <form className="max-w-[40rem] mx-auto" onSubmit={handleSubmit}>
      <h2 className="text-2xl font-bold text-[#04151f] mb-6 pb-3 border-b-2 border-[#cdd2d6]">
        New Batch
      </h2>

      {schema.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {schema.error}
        </div>
      )}

      {/* Batch ID */}
      <label htmlFor="batch-id" className={labelClasses} style={{ marginTop: 0 }}>
        Batch ID
      </label>
      <div className="flex items-center gap-2">
        <input
          id="batch-id"
          type="text"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          placeholder={batchIdPlaceholder}
          className={inputClasses + " flex-1"}
        />
        <PrintButton value={batchId || batchIdPlaceholder} />
      </div>

      {/* Parent SKU */}
      <label htmlFor="parent-sku" className={labelClasses}>
        Parent SKU
      </label>
      <input
        id="parent-sku"
        type="text"
        value={parentSkuId}
        onChange={(e) => setParentSkuId(e.target.value)}
        placeholder="SKU ID (optional)"
        className={inputClasses}
      />
      {parentSkuName && (
        <p className="mt-1 text-sm text-[#6d635d]">{parentSkuName}</p>
      )}

      {/* Batch Name */}
      <label htmlFor="batch-name" className={labelClasses}>
        Name
      </label>
      <input
        id="batch-name"
        type="text"
        value={batchName}
        onChange={(e) => setBatchName(e.target.value)}
        placeholder={parentSkuName || "Optional"}
        className={inputClasses}
      />

      {/* Provenance Section */}
      <FormSection title="Provenance" accent="blue">
        {/* Source trigger field with typeahead */}
        {sourceField && (
          <SchemaFieldList
            fields={[sourceField]}
            values={schema.fieldValues}
            onChange={schema.handleFieldChange}
            entityType="batch"
            triggerFields={{ source: "source" }}
          />
        )}

        {/* Dynamic fields from selected source */}
        {otherFields.length > 0 && (
          <>
            <SchemaFieldList
              fields={otherFields}
              values={schema.fieldValues}
              onChange={schema.handleFieldChange}
              entityType="batch"
            />
            {schema.activeMixins.length > 1 && (
              <div className="mt-4 py-2 px-3 text-sm text-[#6d635d] bg-[#cdd2d6]/30 rounded inline-block">
                Source: {schema.activeMixins.filter((m) => m !== "SourceSelector").join(" → ")}
              </div>
            )}
          </>
        )}
      </FormSection>

      {/* Codes Section */}
      <CodesSection codes={codes} setCodes={setCodes} />

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

export default NewBatchForm;
