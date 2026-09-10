import * as React from "react";
import { useFrontload } from "react-frontload";
import type { FrontloadContext } from "../../api-client/api-client";

export function BatchNameText({ name, skuName }: { name?: string | null; skuName?: string | null }) {
  return <span className="block">
    <span className="block">{name || skuName || "Unnamed batch"}</span>
    {skuName && <span className="block text-sm font-normal text-[#6d635d]">
      {name && name !== skuName ? `SKU: ${skuName}` : !name ? "Name from SKU" : "Same name as SKU"}
    </span>}
  </span>;
}

/** Use known list data when available; load only the missing batch/SKU context. */
export default function BatchName({ id, batch, skuName }: {
  id: string; batch?: { name?: string; sku_id?: string }; skuName?: string;
}) {
  const { data, frontloadMeta } = useFrontload(`batch-name:${id}:${batch?.sku_id || ""}:${batch?.name || ""}:${skuName || ""}`, async ({ api }: FrontloadContext) => {
    const loaded = batch ? null : await api.getBatch(id);
    const state = batch || (loaded?.kind === "batch" ? loaded.state : null);
    const sku = skuName !== undefined || !state?.sku_id ? null : await api.getSku(state.sku_id);
    return { name: state?.name, skuName: skuName ?? (sku?.kind === "sku" ? sku.state.name : undefined) };
  });
  return <BatchNameText name={frontloadMeta.done && !frontloadMeta.error ? data.name : batch?.name}
    skuName={frontloadMeta.done && !frontloadMeta.error ? data.skuName : skuName} />;
}
