import * as React from "react";
import { useState } from "react";
import { useFrontload } from "react-frontload";
import { Link } from "react-router-dom";

import { FrontloadContext } from "../../api-client/api-client";
import {
  Problem,
  ProcessDefinitionState,
  ProcessRequirement,
} from "../../api-client/data-models";
import { inputClasses, labelClasses } from "../composites/SchemaFields";
import PageHeading from "../primitives/PageHeading";
import { PROCESS_KIND_LABELS } from "./ProcessDefinitionForm";


function requirementSummary(requirements: ProcessRequirement[]) {
  const first = requirements[0];
  if (!first) return "None";
  const amount = first.quantity === undefined
    ? "Variable"
    : `${first.quantity} ${first.unit}`;
  const remaining = requirements.length - 1;
  return `${amount} ${first.role}${remaining ? ` + ${remaining} more` : ""}`;
}

export default function ProcessDefinitionList() {
  const [query, setQuery] = useState("");
  const { data, frontloadMeta } = useFrontload(
    "process-definition-list",
    async ({ api }: FrontloadContext) => ({
      definitions: await api.listProcessDefinitions(),
    })
  );

  if (frontloadMeta.pending) return <p>Loading manufacturing processes...</p>;
  if (frontloadMeta.error) return <p>Unable to load manufacturing processes.</p>;

  const definitions = data?.definitions as ProcessDefinitionState[] | Problem;
  if (!Array.isArray(definitions)) {
    return <p>{definitions?.title || "Unable to load manufacturing processes."}</p>;
  }

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = definitions.filter((definition) =>
    !normalizedQuery ||
    definition.id.toLocaleLowerCase().includes(normalizedQuery) ||
    definition.name.toLocaleLowerCase().includes(normalizedQuery) ||
    definition.description?.toLocaleLowerCase().includes(normalizedQuery)
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageHeading>Manufacturing processes</PageHeading>
          <p className="-mt-3 mb-6 text-[#6d635d]">
            Definitions describe expected work. Each execution will become a separate,
            inspectable process run.
          </p>
        </div>
        <Link
          to="/processes/new"
          className="shrink-0 rounded-md bg-[#26532b] px-4 py-2 font-semibold text-white hover:bg-[#1e4423]"
        >
          New process
        </Link>
      </div>

      <label htmlFor="process-filter" className={labelClasses}>
        Filter processes
      </label>
      <input
        id="process-filter"
        type="search"
        className={`${inputClasses} mb-5`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
        placeholder="Name, description, or PRC label"
      />

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#9ca3af] p-8 text-center text-[#6d635d]">
          {definitions.length === 0
            ? "No manufacturing processes have been defined yet."
            : "No processes match that filter."}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((definition) => (
            <li
              key={definition.id}
              className="rounded-md border border-[#cdd2d6] bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    to={`/processes/${definition.id}`}
                    className="text-lg font-bold text-[#0c3764] hover:underline"
                  >
                    {definition.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-[#6d635d]">
                    <span>{definition.id}</span>
                    <span>Revision {definition.revision}</span>
                    <span>{PROCESS_KIND_LABELS[definition.kind]}</span>
                  </div>
                </div>
                <Link
                  to={`/processes/${definition.id}/edit`}
                  className="rounded border border-[#cdd2d6] px-3 py-1.5 text-sm font-medium text-[#04151f] hover:bg-[#cdd2d6]"
                >
                  Edit
                </Link>
              </div>
              {definition.description && (
                <p className="mt-3 text-sm text-[#04151f]">{definition.description}</p>
              )}
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-[#6d635d]">Input</dt>
                  <dd>{requirementSummary(definition.inputs)}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#6d635d]">Output</dt>
                  <dd>{requirementSummary(definition.outputs)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
