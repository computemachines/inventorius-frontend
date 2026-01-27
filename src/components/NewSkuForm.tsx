import * as React from "react";
import { useContext, useState, useCallback } from "react";
import { useFrontload } from "react-frontload";

import { ApiContext, FrontloadContext } from "../api-client/api-client";
import { ToastContext } from "./Toast";
import { useSchemaForm } from "../hooks/useSchemaForm";
import ItemLabel from "./ItemLabel";
import PrintButton from "./PrintButton";
import FormSection from "./FormSection";
import { CodesSection, CodeEntry, createEmptyCode } from "./CodesSection";
import { SchemaFieldList, labelClasses, inputClasses } from "./SchemaFields";

/**
 * SKU creation form using the unified trigger schema system.
 * Uses modular components: FormSection, CodesSection, SchemaFieldList.
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

  // Schema form hook handles all field state
  const schema = useSchemaForm("sku", ["ItemTypeSelector"]);

  // Form state (non-schema fields)
  const [skuId, setSkuId] = useState("");
  const [codes, setCodes] = useState<CodeEntry[]>([createEmptyCode()]);

  const skuIdPlaceholder = frontloadMeta.pending
    ? "Loading..."
    : frontloadMeta.error
    ? "Error"
    : data?.nextSku.state || "SKU000001";

  const resetForm = useCallback(async () => {
    setSkuId("");
    schema.reset();
    setCodes([createEmptyCode()]);

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

  // Separate trigger field from other fields
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

      {/* Item Type (trigger field with typeahead) */}
      {itemTypeField && (
        <SchemaFieldList
          fields={[itemTypeField]}
          values={schema.fieldValues}
          onChange={schema.handleFieldChange}
          entityType="sku"
          triggerFields={{ item_type: "item_type" }}
        />
      )}

      {/* Dynamic Fields */}
      {otherFields.length > 0 && (
        <FormSection
          title={`${schema.fieldValues.item_type || "Item"} Attributes`}
          accent="amber"
        >
          <SchemaFieldList
            fields={otherFields}
            values={schema.fieldValues}
            onChange={schema.handleFieldChange}
            entityType="sku"
          />
          {schema.activeMixins.length > 1 && (
            <div className="mt-4 py-2 px-3 text-sm text-[#6d635d] bg-[#cdd2d6]/30 rounded inline-block">
              Active: {schema.activeMixins.filter((m) => m !== "ItemTypeSelector").join(" → ")}
            </div>
          )}
        </FormSection>
      )}

      {/* Codes Section */}
      <CodesSection codes={codes} setCodes={setCodes} />

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
