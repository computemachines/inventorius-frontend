// src/components/features/Batch.tsx
// Fully human reviewed: NO
// Progress: NONE
//
// Conversation:
// > (no discussion yet)


import * as React from "react";
import { useContext, useEffect, useState } from "react";
import { useFrontload } from "react-frontload";
import * as Sentry from "@sentry/react";
import {
  generatePath,
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import { ApiContext, FrontloadContext } from "../../api-client/api-client";

import { ToastContext } from "../primitives/Toast";
import CodesInput, { Code } from "../composites/CodesInput";
import { FourOhFour } from "../primitives/FourOhFour";
import ItemLabel from "../primitives/ItemLabel";
import PrintButton from "../composites/PrintButton";
import ItemLocations from "../primitives/ItemLocations";
import { stringifyUrl } from "query-string";
import {
  Batch as ApiBatch,
  Problem,
  Sku,
  Unit,
  Unit1,
} from "../../api-client/data-models";
import PropertiesTable, {
  api_props_from_properties,
  Property,
  isUuidString,
} from "../composites/PropertiesTable";
import WarnModal from "../primitives/WarnModal";
import FormSection from "../primitives/FormSection";
import { labelClasses, inputClasses } from "../composites/SchemaFields";
import { SchemaPropertiesEditor } from "../composites/SchemaPropertiesEditor";
import { useAuth } from "../auth/AuthContext";
import QuantityHoldings from "./QuantityHoldings";

function BatchDetails({
  requestedId: batch_id,
  editable = false,
}: {
  requestedId: string;
  editable?: boolean;
}) {
  const navigate = useNavigate();

  const [showModal, setShowModal] = useState(false);
  const [saveState, setSaveState] = useState<"live" | "unsaved" | "saving">(
    "live"
  );
  const [unsavedParentSkuId, setUnsavedParentSkuId] = useState("");
  const [unsavedName, setUnsavedName] = useState("");
  const [unsavedCodes, setUnsavedCodes] = useState<Code[]>([]);
  const [unsavedProperties, setUnsavedProperties] = useState<Property[]>([]);
  const [unsavedRawProperties, setUnsavedRawProperties] = useState<Record<string, unknown>>({});
  const [schemaPropertiesValid, setSchemaPropertiesValid] = useState(true);
  const [loadedBatch, setLoadedBatch] = useState<ApiBatch | null>(null);

  const api = useContext(ApiContext);
  const { setToastContent } = useContext(ToastContext);
  const { hasOperation } = useAuth();

  const { data, frontloadMeta, setData } = useFrontload(
    "batch-component",
    async ({ api }: FrontloadContext) => {
      const batch = await api.getBatch(batch_id);

      let parentSku: Problem | Sku | null = null;
      if (batch.kind == "problem") {
        parentSku = batch;
      } else if (batch.state.sku_id) {
        parentSku = await api.getSku(batch.state.sku_id);
      }

      const batchBins = batch.kind == "batch" ? await batch.bins() : batch;
      return { batch, parentSku, batchBins };
    }
  );

  useEffect(() => {
    if (!editable && saveState != "live") {
      setLoadedBatch(null);
      setSaveState("live");
    }
  }, [editable]);

  // Synchronize during rendering so SSR and hydration include loaded fields.
  const synchronizeLoadedBatch = () => {
    if (
      frontloadMeta.done &&
      !frontloadMeta.error &&
      data.batch.kind != "problem" &&
      data.batch !== loadedBatch &&
      saveState == "live"
    ) {
      setLoadedBatch(data.batch);
      // reset unsaved data
      setUnsavedParentSkuId(data.batch.state.sku_id || "");
      setUnsavedName(data.batch.state.name);
      setUnsavedCodes([
        ...(data.batch.state.owned_codes || []).map((value) => ({
          value,
          kind: "owned" as const,
        })),
        ...(data.batch.state.associated_codes || []).map((value) => ({
          value,
          kind: "associated" as const,
        })),
      ]);
      setUnsavedRawProperties({ ...(data.batch.state.props || {}) });
      setSchemaPropertiesValid(true);
      setUnsavedProperties(
        Object.entries(data.batch.state.props || {}).map(([name, value]) => {
          let typed;
          if (typeof value == "undefined") {
            throw new Error("Api returned empty property: " + name);
          }
          if (typeof value == "number") {
            typed = {
              kind: "number",
              value: value,
            };
          } else if (typeof value == "string") {
            // Check if this looks like a file ID (UUID)
            if (isUuidString(value)) {
              typed = { kind: "file", value: value };
            } else {
              typed = {
                kind: "string",
                value: value,
              };
            }
          } else if (typeof value == "object" && value !== null) {
            if ("unit" in value && "value" in value) {
              const physical = new Unit1(
                value as { unit: string; value: number }
              );
              switch (physical.unit) {
                case "USD":
                  typed = { kind: "currency", value: physical.value };
                  break;

                default:
                  // Unknown unit type - stringify it
                  typed = { kind: "string", value: JSON.stringify(value) };
              }
            } else {
              // Generic object - stringify it
              typed = { kind: "string", value: JSON.stringify(value) };
            }
          } else {
            typed = { kind: "string", value: String(value) };
          }
          return new Property({ name, typed: typed });
        })
      );
    }
  };
  synchronizeLoadedBatch();

  // useEffect(() => {});

  if (frontloadMeta.pending) return <div>Loading...</div>;
  if (frontloadMeta.error) {
    Sentry.captureException(new Error("frontloadMeta.error"));
    return <div>Connection Error</div>;
  }
  if (data.batch.kind == "problem") {
    if (data.batch.type == "missing-resource") {
      Sentry.captureException(new Error("missing batch"));
      return <FourOhFour />;
    } else {
      Sentry.captureException(new Error(JSON.stringify(data)));
      return <div>{data.batch.title}</div>;
    }
  }

  let parentSkuShowItemDesc = null;
  if (editable) {
    parentSkuShowItemDesc = (
      <input
        type="text"
        id="parent_sku_id"
        name="parent_sku_id"
        className="form-single-code-input"
        value={unsavedParentSkuId}
        onChange={(e) => setUnsavedParentSkuId(e.target.value)}
      />
    );
  } else if (!data.batch.state.sku_id) {
    parentSkuShowItemDesc = (
      <div style={{ fontStyle: "italic" }}>(Anonymous)</div>
    );
  } else if (!data.parentSku || data.parentSku.kind == "problem") {
    Sentry.captureException(
      new Error(
        "parent_sku was null or problem but batch.state.sku_id was not empty"
      )
    );
    parentSkuShowItemDesc = <div>{data.batch.state.sku_id} not found</div>;
  } else if (data.parentSku.kind == "sku") {
    parentSkuShowItemDesc = (
      <ItemLabel link={true} label={data.parentSku.state.id} />
    );
  } else {
    throw Error("impossible fallthrough");
  }

  let itemLocations = null;
  if (data.batchBins.kind == "problem") {
    Sentry.captureException(new Error("Error loading batch locations"));
    itemLocations = <div>Problem loading locations</div>;
  } else {
    itemLocations = <ItemLocations itemLocations={data.batchBins} />;
  }

  return (
    <div className="max-w-[40rem] mx-auto">
      {/* Delete confirmation modal */}
      <WarnModal
        showModal={showModal}
        setShowModal={setShowModal}
        dangerousActionName="Delete"
        onContinue={async () => {
          if (1 == 1) return; // TODO: Enable delete functionality
          if (data.batch.kind == "problem") throw "impossible";
          const resp = await api.hydrate(data.batch).delete();
          if (resp.kind == "status") {
            setToastContent({ content: <p>Deleted</p>, mode: "success" });
            const updatedBatch = await api.getBatch(batch_id);
            const updatedParentSku =
              updatedBatch.kind == "batch"
                ? await api.getSku(updatedBatch.state.sku_id)
                : null;
            const updatedBatchBins =
              updatedBatch.kind == "batch" ? await updatedBatch.bins() : null;
            setData(() => ({
              batch: updatedBatch,
              parentSku: updatedParentSku,
              batchBins: updatedBatchBins,
            }));
          } else {
            setToastContent({
              content: <p>{resp.title}</p>,
              mode: "failure",
            });
          }
        }}
      />

      {/* Page Header */}
      <h2 className="text-2xl font-bold text-[#04151f] mb-6 pb-3 border-b-2 border-[#cdd2d6]">
        {editable ? "Edit Batch" : "Batch Details"}
      </h2>

      {/* Parent SKU */}
      <label htmlFor="parent-sku" className={labelClasses}>Parent SKU</label>
      {editable ? (
        <input
          id="parent-sku"
          type="text"
          className={inputClasses + " mb-6"}
          value={unsavedParentSkuId}
          onChange={(e) => {
            setSaveState("unsaved");
            setUnsavedParentSkuId(e.target.value);
          }}
          placeholder="Enter SKU ID..."
        />
      ) : (
        <div className="text-[#04151f] mb-6">{parentSkuShowItemDesc}</div>
      )}

      {/* Batch Label */}
      <label className={labelClasses}>Batch Label</label>
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xl font-mono">
          <ItemLabel link={false} label={data.batch.state.id} />
        </span>
        <PrintButton value={data.batch.state.id} />
      </div>

      {/* Name */}
      <label htmlFor="batch-name" className={labelClasses}>Name</label>
      {editable ? (
        <input
          id="batch-name"
          type="text"
          className={inputClasses + " mb-6"}
          value={unsavedName}
          onChange={(e) => {
            setSaveState("unsaved");
            setUnsavedName(e.target.value);
          }}
        />
      ) : (
        <div className="text-[#04151f] mb-6">
          {unsavedName || <span className="italic text-[#6d635d]">(No name)</span>}
        </div>
      )}

      {/* Locations */}
      <FormSection title="Locations" bgAccent="bg-dark-accent" withSeparator={true}>
        {itemLocations}
      </FormSection>

      {!editable && (
        <FormSection title="Physical quantity evidence" bgAccent="bg-accent" withSeparator={true}>
          <QuantityHoldings batchId={data.batch.state.id} />
        </FormSection>
      )}

      {/* Codes */}
      <FormSection title="Codes" bgAccent="bg-accent">
        {unsavedCodes.length == 0 && !editable ? (
          <span className="text-[#6d635d] italic">None</span>
        ) : (
          <CodesInput
            codes={unsavedCodes}
            setCodes={(codes) => {
              setSaveState("unsaved");
              setUnsavedCodes(codes);
            }}
            editable={editable}
          />
        )}
      </FormSection>

      {/* Properties */}
      <FormSection title="Additional Properties" bgAccent="bg-accent">
        {editable ? (
          <SchemaPropertiesEditor
            schemaName="batch"
            resourceId={data.batch.state.id}
            properties={unsavedRawProperties}
            onChange={setUnsavedRawProperties}
            onDirty={() => setSaveState("unsaved")}
            onValidityChange={setSchemaPropertiesValid}
          />
        ) : unsavedProperties.length == 0 ? (
          <span className="text-[#6d635d] italic">None</span>
        ) : (
          <PropertiesTable
            editable={false}
            properties={unsavedProperties}
            setProperties={(properties) => {
              setSaveState("unsaved");
              setUnsavedProperties(properties);
            }}
          />
        )}
      </FormSection>

      {/* Actions */}
      <div className="flex gap-3 mt-8 pt-6 border-t border-[#cdd2d6]">
        {editable ? (
          <>
            <button
              type="button"
              onClick={async () => {
                if (data.batch.kind == "problem") throw "impossible";
                setSaveState("saving");
                const resp = await api.hydrate(data.batch).update({
                  sku_id: unsavedParentSkuId || null,
                  id: batch_id,
                  name: unsavedName,
                  owned_codes: unsavedCodes
                    .filter(({ kind, value }) => kind == "owned" && value)
                    .map(({ value }) => value),
                  associated_codes: unsavedCodes
                    .filter(({ kind, value }) => kind == "associated" && value)
                    .map(({ value }) => value),
                  props: unsavedRawProperties,
                });

                if (resp.kind == "problem") {
                  Sentry.captureException(new Error("error saving batch edit"));
                  setSaveState("unsaved");
                  setToastContent({
                    content: <p>{resp.title}</p>,
                    mode: "failure",
                  });
                } else {
                  setSaveState("live");
                  setToastContent({
                    content: <div>Saved!</div>,
                    mode: "success",
                  });
                  const updatedBatch = await api.getBatch(batch_id);
                  const updatedParentSku =
                    updatedBatch.kind == "batch" && updatedBatch.state.sku_id
                      ? await api.getSku(updatedBatch.state.sku_id)
                      : null;
                  const updatedBatchBins =
                    updatedBatch.kind == "batch"
                      ? await updatedBatch.bins()
                      : null;
                  setData((old) => ({
                    ...old,
                    batch: updatedBatch,
                    parentSku: updatedParentSku,
                    batchBins: updatedBatchBins,
                  }));
                  navigate(generatePath("/batch/:id", { id: batch_id }));
                }
              }}
              disabled={saveState == "saving" || !schemaPropertiesValid}
              className="flex-1 py-3 px-6 text-base font-semibold bg-[#26532b] text-white rounded-md hover:bg-[#1e4423] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {saveState == "saving" ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => navigate(generatePath("/batch/:id", { id: batch_id }))}
              className="py-3 px-5 text-base font-medium bg-transparent text-[#6d635d] border border-[#cdd2d6] rounded-md hover:bg-[#cdd2d6] hover:text-[#04151f] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {data.batch.operations.update && (
              <Link
                to={generatePath("/batch/:id/edit", { id: batch_id })}
                className="py-3 px-5 text-base font-semibold bg-[#0c3764] text-white rounded-md hover:bg-[#082441] transition-colors text-center"
              >
                Edit
              </Link>
            )}
            {hasOperation("inventory-operation") && (
              <>
                <Link
                  to={stringifyUrl({ url: "/receive", query: { batch: batch_id } })}
                  className="py-3 px-5 text-base font-medium bg-transparent text-[#04151f] border border-[#cdd2d6] rounded-md hover:bg-[#cdd2d6] transition-colors text-center"
                >
                  Receive
                </Link>
                <Link
                  to={stringifyUrl({ url: "/release", query: { batch: batch_id } })}
                  className="py-3 px-5 text-base font-medium bg-transparent text-[#04151f] border border-[#cdd2d6] rounded-md hover:bg-[#cdd2d6] transition-colors text-center"
                >
                  Release
                </Link>
              </>
            )}
            {data.batch.operations.delete && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="py-3 px-5 text-base font-medium bg-transparent text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
              >
                Delete
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Batch({ editable = false }: { editable?: boolean }) {
  const { id = "" } = useParams<{ id: string }>();

  // Route input may be shorthand.  Re-mount so react-frontload never leaves a
  // prior resource visible while this lookup resolves.
  return <BatchDetails key={id} requestedId={id} editable={editable} />;
}
export default Batch;
