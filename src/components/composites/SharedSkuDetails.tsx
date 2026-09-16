import * as React from "react";
import { Link } from "react-router-dom";
import type { Sku } from "../../api-client/data-models";
import PropertiesTable, { Property, isUuidString } from "./PropertiesTable";

/** Read-only context: never merge these values into the batch's edit state. */
export default function SharedSkuDetails({ sku }: { sku: Sku }) {
  const entries = Object.entries(sku.state.props || {});
  const descriptions = entries.filter(([name, value]) => name.toLowerCase() === "description" && typeof value === "string");
  const properties = entries.filter(([name]) => !["name", "description", "_mixins"].includes(name.toLowerCase())).map(([name, value]) => {
    let typed: any;
    if (typeof value === "number") typed = { kind: "number", value };
    else if (typeof value === "string" && isUuidString(value)) typed = { kind: "file", value };
    else if (value && typeof value === "object" && "unit" in value && "value" in value) typed = { kind: "string", value: `${value.value} ${value.unit}` };
    else typed = { kind: "string", value: typeof value === "string" ? value : JSON.stringify(value) };
    return new Property({ name, typed });
  });
  return <section aria-label={`Shared details from ${sku.state.id}`} className="mt-7 p-5 rounded-lg border border-[#cdd2d6] bg-[#e8eef2] text-[#04151f]">
    <h3 className="font-semibold">Shared details from <Link className="underline" to={`/sku/${sku.state.id}`}>{sku.state.id}</Link></h3>
    <p className="text-lg font-semibold mt-2">{sku.state.name || sku.state.id}</p>
    <p className="text-sm mt-1 mb-3">These details belong to the SKU and are shared by its batches.</p>
    {descriptions.map(([name, value]) => <p key={name} className="whitespace-pre-wrap break-words mb-3">{String(value)}</p>)}
    {properties.length > 0 && <details className="mt-3">
      <summary className="cursor-pointer font-medium mb-3">Shared properties ({properties.length})</summary>
      <PropertiesTable editable={false} properties={properties} setProperties={() => {}} />
    </details>}
    {sku.operations.update && <Link className="inline-block underline mt-3" to={`/sku/${sku.state.id}/edit`}>Edit SKU</Link>}
  </section>;
}
