import * as React from "react";
import { useFrontload } from "react-frontload";
import { generatePath, useNavigate, useParams, Link } from "react-router-dom";
import { ApiContext, FrontloadContext } from "../api-client/api-client";
import { Sku as ApiSku, Unit1 } from "../api-client/data-models";
import ReactModal from "react-modal";

import CodesInput, { Code } from "./CodesInput";
import { FourOhFour } from "./FourOhFour";
import ItemLabel from "./ItemLabel";
import PrintButton from "./PrintButton";
import ItemLocations from "./ItemLocations";
import { useContext, useEffect, useState } from "react";
import { ToastContext } from "./Toast";
import { stringifyUrl } from "query-string";
import PropertiesTable, {
  api_props_from_properties,
  Property,
} from "./PropertiesTable";
import FormSection from "./FormSection";
import { labelClasses, inputClasses } from "./SchemaFields";

function Sku({ editable = false }: { editable?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const { data, frontloadMeta, setData } = useFrontload(
    "sku-component",
    async ({ api }: FrontloadContext) => {
      const sku = await api.getSku(id);
      const skuBins = sku.kind == "sku" ? await sku.bins() : sku;
      const skuBatches = sku.kind == "sku" ? await sku.batches() : sku;
      return {
        sku,
        skuBins,
        skuBatches,
      };
    }
  );
  const { setToastContent: setAlertContent } = useContext(ToastContext);
  const [showModal, setShowModal] = useState(false);
  const [saveState, setSaveState] = useState<"live" | "unsaved" | "saving">(
    "live"
  );
  const navigate = useNavigate();
  const [unsavedName, setUnsavedName] = useState("");
  const [unsavedCodes, setUnsavedCodes] = useState([]);
  const [unsavedProperties, setUnsavedProperties] = useState<Property[]>([]);
  const api = useContext(ApiContext);

  useEffect(() => {
    if (!editable) setSaveState("live");
  }, [editable]);

  useEffect(() => {
    // if data loads and not editing
    if (
      frontloadMeta.done &&
      !frontloadMeta.error &&
      data.sku.kind != "problem" &&
      saveState == "live"
    ) {
      setUnsavedName(data.sku.state.name);
      const newUnsavedCodes = [
        ...data.sku.state.owned_codes.map((code) => ({
          kind: "owned" as const,
          value: code,
        })),
        ...data.sku.state.associated_codes.map((code) => ({
          kind: "associated" as const,
          value: code,
        })),
      ];
      setUnsavedCodes(newUnsavedCodes);

      // Load props into Property objects
      setUnsavedProperties(
        Object.entries(data.sku.state.props || {}).map(([name, value]) => {
          let typed;
          if (typeof value == "undefined") {
            throw new Error("Api returned empty property: " + name);
          }
          if (typeof value == "number") {
            typed = { kind: "number", value: value };
          } else if (typeof value == "string") {
            typed = { kind: "string", value: value };
          } else if (typeof value == "object") {
            if ("unit" in value && "value" in value) {
              const physical = new Unit1(
                value as { unit: string; value: number }
              );
              switch (physical.unit) {
                case "USD":
                  typed = { kind: "currency", value: physical.value };
                  break;
                default:
                  throw new Error("Unsupported api unit type: " + physical.unit);
              }
            } else {
              // Generic object - stringify it
              typed = { kind: "string", value: JSON.stringify(value) };
            }
          } else {
            typed = { kind: "string", value: String(value) };
          }
          return new Property({ name, typed });
        })
      );
    }
  }, [frontloadMeta, saveState, data]);

  if (frontloadMeta.pending) {
    return <div>Loading...</div>;
  }
  if (frontloadMeta.error) {
    return <div>Connection Error</div>;
  }
  if (data.sku.kind == "problem") {
    if (data.sku.type == "missing-resource") return <FourOhFour />;
    else return <h2>{data.sku.title}</h2>;
  }

  function isCodesEmpty(codes: Code[]): boolean {
    return codes.length == 0 || codes.every(({ value }) => value == "");
  }

  return (
    <div className="max-w-[40rem] mx-auto">
      {/* Delete confirmation modal */}
      <ReactModal
        isOpen={showModal}
        onRequestClose={() => setShowModal(false)}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow-xl max-w-md w-full"
        overlayClassName="fixed inset-0 bg-black/50"
      >
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          onClick={() => setShowModal(false)}
        >
          ✕
        </button>
        <h3 className="text-lg font-bold text-[#04151f] mb-4">Are you sure?</h3>
        <p className="text-[#6d635d] mb-6">This action cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setShowModal(false)}
            className="py-2 px-4 text-sm font-medium bg-transparent text-[#6d635d] border border-[#cdd2d6] rounded-md hover:bg-[#cdd2d6] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (data.sku.kind == "problem") throw "impossible";
              const resp = await api.hydrate(data.sku).delete();
              if (resp.kind == "status") {
                setAlertContent({ content: <p>Deleted</p>, mode: "success" });
                const updatedSku = await api.getSku(id);
                const updatedSkuBins =
                  updatedSku.kind == "sku" ? await updatedSku.bins() : updatedSku;
                const updatedSkuBatches =
                  updatedSku.kind == "sku" ? await updatedSku.batches() : updatedSku;
                setData(() => ({ sku: updatedSku, skuBins: updatedSkuBins, skuBatches: updatedSkuBatches }));
              } else {
                setAlertContent({
                  content: <p>{resp.title}</p>,
                  mode: "failure",
                });
              }
            }}
            className="py-2 px-4 text-sm font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors cursor-pointer"
          >
            Delete
          </button>
        </div>
      </ReactModal>

      {/* Page Header */}
      <h2 className="text-2xl font-bold text-[#04151f] mb-6 pb-3 border-b-2 border-[#cdd2d6]">
        {editable ? "Edit SKU" : "SKU Details"}
      </h2>

      {/* SKU Label */}
      <label className={labelClasses}>SKU Label</label>
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xl font-mono">
          <ItemLabel link={false} label={id} />
        </span>
        <PrintButton value={id} />
      </div>

      {/* Name */}
      <label htmlFor="sku-name" className={labelClasses}>Name</label>
      {editable ? (
        <input
          id="sku-name"
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

      {/* Derived Batches */}
      <FormSection title="Derived Batches" accent="blue" withSeparator={true}>
        {data.skuBatches.kind == "sku-batches" ? (
          data.skuBatches.state.length > 0 ? (
            <ul className="list-disc list-inside space-y-1">
              {data.skuBatches.state.map((batchId) => (
                <li key={batchId}>
                  <ItemLabel link={true} label={batchId} />
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-[#6d635d] italic">None</span>
          )
        ) : (
          <span className="text-red-600">Problem loading batches.</span>
        )}
      </FormSection>

      {/* Locations */}
      <FormSection title="Locations" accent="blue">
        {data.skuBins.kind == "sku-locations" ? (
          <ItemLocations itemLocations={data.skuBins} />
        ) : (
          <span className="text-red-600">Problem loading locations.</span>
        )}
      </FormSection>

      {/* Codes */}
      <FormSection title="Codes" accent="amber">
        {isCodesEmpty(unsavedCodes) && !editable ? (
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
      <FormSection title="Properties" accent="amber">
        {unsavedProperties.length == 0 && !editable ? (
          <span className="text-[#6d635d] italic">None</span>
        ) : (
          <PropertiesTable
            editable={editable}
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
                if (data.sku.kind == "problem") throw Error("impossible");
                setSaveState("saving");
                const resp = await api.hydrate(data.sku).update({
                  name: unsavedName,
                  owned_codes: unsavedCodes
                    .filter(({ kind, value }) => kind == "owned" && value)
                    .map(({ value }) => value),
                  associated_codes: unsavedCodes
                    .filter(({ kind, value }) => kind == "associated" && value)
                    .map(({ value }) => value),
                  props: api_props_from_properties(unsavedProperties),
                });

                if (resp.kind == "problem") {
                  setSaveState("unsaved");
                  setAlertContent({
                    content: <p>{resp.title}</p>,
                    mode: "failure",
                  });
                } else {
                  setSaveState("live");
                  setAlertContent({
                    content: <div>{resp.status}</div>,
                    mode: "success",
                  });

                  const updatedSku = await api.getSku(id);

                  setData(({ skuBins, skuBatches }) => ({
                    sku: updatedSku,
                    skuBins,
                    skuBatches,
                  }));

                  navigate(generatePath("/sku/:id", { id }));
                }
              }}
              disabled={saveState == "saving"}
              className="flex-1 py-3 px-6 text-base font-semibold bg-[#26532b] text-white rounded-md hover:bg-[#1e4423] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {saveState == "saving" ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => navigate(generatePath("/sku/:id", { id }))}
              className="py-3 px-5 text-base font-medium bg-transparent text-[#6d635d] border border-[#cdd2d6] rounded-md hover:bg-[#cdd2d6] hover:text-[#04151f] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <Link
              to={generatePath("/sku/:id/edit", { id })}
              className="py-3 px-5 text-base font-semibold bg-[#0c3764] text-white rounded-md hover:bg-[#082441] transition-colors text-center"
            >
              Edit
            </Link>
            <Link
              to={stringifyUrl({ url: "/receive", query: { item: id } })}
              className="py-3 px-5 text-base font-medium bg-transparent text-[#04151f] border border-[#cdd2d6] rounded-md hover:bg-[#cdd2d6] transition-colors text-center"
            >
              Receive
            </Link>
            <Link
              to={stringifyUrl({ url: "/release", query: { item: id } })}
              className="py-3 px-5 text-base font-medium bg-transparent text-[#04151f] border border-[#cdd2d6] rounded-md hover:bg-[#cdd2d6] transition-colors text-center"
            >
              Release
            </Link>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="py-3 px-5 text-base font-medium bg-transparent text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default Sku;
