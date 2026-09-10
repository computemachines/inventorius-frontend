import * as React from "react";
import { useContext } from "react";
import { ApiContext } from "../../api-client/api-client";
import { AsyncTypeaheadField } from "./Typeahead";
import { itemReferenceId } from "./item-references";

type Candidate = { id: string; name: string };

/** Shared selector for both a single reference and every row of a reference list. */
export function ItemReferenceInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const api = useContext(ApiContext);
  return (
    <AsyncTypeaheadField<Candidate>
      id={id}
      value={value}
      onChange={onChange}
      onSelect={(item) => onChange(item.id)}
      onSearch={async (query) => {
        const response = await api.getSearchResults({ query, limit: "50" });
        if (response.kind === "problem") throw new Error(response.title);
        return response.state.results
          .filter((item) => itemReferenceId(item.id))
          .map((item) => ({
            id: item.id,
            name: "name" in item ? item.name || item.id : item.id,
          }));
      }}
      getItemText={(item) => item.id}
      getItemKey={(item) => item.id}
      renderItem={(item) => (
        <span>
          {item.name}{" "}
          <span className="font-mono text-sm opacity-70">{item.id}</span>
        </span>
      )}
      placeholder="Search or scan a SKU or batch"
      clearable
    />
  );
}

export function ItemReferenceListInput({
  id,
  label,
  values,
  onChange,
}: {
  id: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const rows = values.length ? values : [""];
  return (
    <div className="space-y-2">
      {rows.map((value, index) => (
        <div key={index} className="flex items-start gap-2 min-w-0">
          <div className="flex-1 min-w-0">
            {index > 0 && (
              <label className="sr-only" htmlFor={`${id}-${index}`}>
                {label} {index + 1}
              </label>
            )}
            <ItemReferenceInput
              id={index === 0 ? id : `${id}-${index}`}
              value={value}
              onChange={(next) => {
                const updated = [...rows];
                updated[index] = next;
                onChange(updated);
              }}
            />
          </div>
          <button
            type="button"
            className="shrink-0 px-2 py-2 text-[#6d635d] hover:text-red-700"
            aria-label={`Remove ${label} ${index + 1}`}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-sm font-semibold text-[#0c3764] underline"
        onClick={() => onChange([...rows, ""])}
      >
        Add item
      </button>
    </div>
  );
}
