import * as React from "react";
import { useFrontload } from "react-frontload";
import { generatePath, useNavigate, useParams, Link } from "react-router-dom";
import { ApiContext, FrontloadContext } from "../api-client/api-client";
import { Sku as ApiSku, Unit1 } from "../api-client/data-models";
import ReactModal from "react-modal";

import "../styles/infoPanel.css";
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
    <div className="info-panel">
      {/* TODO: Add useBlocker for unsaved changes warning (requires data router) */}
      <ReactModal
        isOpen={showModal}
        onRequestClose={() => setShowModal(false)}
        className="warn-modal"
      >
        <button className="modal-close" onClick={() => setShowModal(false)}>
          X
        </button>
        <h3>Are you sure?</h3>
        <button onClick={() => setShowModal(false)}>Cancel</button>
        <button
          onClick={async () => {
            if (data.sku.kind == "problem") throw "impossible";
            const resp = await api.hydrate(data.sku).delete();
            // setShowModal(false); // this doesn't seem to be necessary?
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
          className="button-danger"
        >
          Delete
        </button>
      </ReactModal>
      <div className="info-item">
        <div className="info-item-title">Sku Label</div>
        <div className="info-item-description">
          <ItemLabel link={false} label={id} />
          <PrintButton value={id} />
        </div>
      </div>

      <div className="info-item">
        <div className="info-item-title">Name</div>
        <div className="info-item-description">
          {editable ? (
            <input
              className="item-description-oneline"
              value={unsavedName}
              onChange={(e) => {
                setSaveState("unsaved");
                setUnsavedName(e.target.value);
              }}
            />
          ) : (
            <div className="item-description-oneline">{unsavedName}</div>
          )}
        </div>
      </div>
      <div className="info-item">
        <div className="info-item-title">Derived Batches</div>
        <div className="info-item-description">
          {data.skuBatches.kind == "sku-batches" ? (
            data.skuBatches.state.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: "1.2em" }}>
                {data.skuBatches.state.map((batchId) => (
                  <li key={batchId}>
                    <ItemLabel link={true} label={batchId} />
                  </li>
                ))}
              </ul>
            ) : (
              "None"
            )
          ) : (
            "Problem loading batches."
          )}
        </div>
      </div>
      <div className="info-item">
        <div className="info-item-title">Locations</div>
        <div className="info-item-description">
          {data.skuBins.kind == "sku-locations" ? (
            <ItemLocations itemLocations={data.skuBins} />
          ) : (
            "Problem loading locations."
          )}
        </div>
      </div>
      <div className="info-item">
        <div className="info-item-title">Codes</div>
        <div className="info-item-description">
          {isCodesEmpty(unsavedCodes) && !editable ? (
            "None"
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
        </div>
      </div>
      <div className="info-item">
        <div className="info-item-title">Properties</div>
        <div className="info-item-description">
          {unsavedProperties.length == 0 && !editable ? (
            "None"
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
        </div>
      </div>
      {editable ? (
        <div className="edit-controls">
          <button
            className="edit-controls-cancel-button"
            onClick={(e) => {
              navigate(generatePath("/sku/:id", { id }));
            }}
          >
            Cancel
          </button>
          <button
            className="edit-controls-save-button"
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
          >
            {saveState == "saving" ? "Saving..." : "Save"}
          </button>
        </div>
      ) : (
        <div className="info-item">
          <div className="info-item-title">Actions</div>
          <div className="info-item-description" style={{ display: "block" }}>
            <Link
              to={generatePath("/sku/:id/edit", { id })}
              className="action-link"
            >
              Edit
            </Link>
            <Link
              to={stringifyUrl({ url: "/receive", query: { item: id } })}
              className="action-link"
            >
              Receive
            </Link>
            <Link
              to={stringifyUrl({
                url: "/release",
                query: { item: id },
              })}
              className="action-link"
            >
              Release
            </Link>
            <Link
              to="#"
              className="action-link"
              onClick={() => setShowModal(true)}
            >
              Delete?
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sku;
