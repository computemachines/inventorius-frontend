import * as React from "react";
import { useState } from "react";

import {
  ProcessDefinitionKind,
  ProcessDefinitionWrite,
  ProcessRequirement,
} from "../../api-client/data-models";
import { normalizeInventoriusId } from "../../identifiers";
import { inputClasses, labelClasses } from "../composites/SchemaFields";
import FormSection from "../primitives/FormSection";
import PageHeading from "../primitives/PageHeading";


export const PROCESS_KIND_LABELS: Record<ProcessDefinitionKind, string> = {
  repackaging: "Packaging or case breakdown",
  assembly: "Assembly",
  disassembly: "Disassembly",
  transformation: "Material transformation",
  blending: "Blending or mixing",
};

const PROCESS_KIND_HELP: Record<ProcessDefinitionKind, string> = {
  repackaging: "Changes package state while retaining the material batch.",
  assembly: "Combines distinguishable components into an assembled output.",
  disassembly: "Takes an assembly apart into distinguishable outputs.",
  transformation: "Consumes material and produces one or more new material batches.",
  blending: "Combines material whose contribution to the outputs must be traced.",
};

interface RequirementDraft {
  key: number;
  role: string;
  sku_id: string;
  quantity: string;
  unit: string;
}

let nextDraftKey = 1;

function requirementDraft(
  requirement?: Partial<ProcessRequirement>
): RequirementDraft {
  return {
    key: nextDraftKey++,
    role: requirement?.role || "",
    sku_id: requirement?.sku_id || "",
    quantity:
      requirement?.quantity === undefined ? "" : String(requirement.quantity),
    unit: requirement?.unit || "each",
  };
}

function initialDrafts(requirements?: ProcessRequirement[]) {
  return requirements?.length
    ? requirements.map((requirement) => requirementDraft(requirement))
    : [requirementDraft()];
}

function serializeRequirements(drafts: RequirementDraft[]): ProcessRequirement[] {
  return drafts.map((draft) => {
    const requirement: ProcessRequirement = {
      role: draft.role.trim(),
      unit: draft.unit.trim(),
    };
    if (draft.sku_id.trim()) {
      requirement.sku_id = normalizeInventoriusId(draft.sku_id);
    }
    if (draft.quantity !== "") {
      requirement.quantity = Number(draft.quantity);
    }
    return requirement;
  });
}

function RequirementEditor({
  title,
  value,
  onChange,
}: {
  title: string;
  value: RequirementDraft[];
  onChange: (requirements: RequirementDraft[]) => void;
}) {
  const update = (
    key: number,
    field: keyof Omit<RequirementDraft, "key">,
    nextValue: string
  ) => {
    onChange(
      value.map((requirement) =>
        requirement.key === key
          ? { ...requirement, [field]: nextValue }
          : requirement
      )
    );
  };

  return (
    <FormSection title={title} bgAccent="bg-accent">
      <div className="space-y-3">
        {value.map((requirement, index) => {
          const prefix = `${title.toLowerCase()}-${requirement.key}`;
          return (
            <fieldset
              key={requirement.key}
              className="rounded-md border border-[#cdd2d6] bg-white p-3"
            >
              <legend className="px-1 text-sm font-semibold text-[#6d635d]">
                {title.slice(0, -1)} {index + 1}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor={`${prefix}-role`} className={labelClasses}>
                    Role or description
                  </label>
                  <input
                    id={`${prefix}-role`}
                    className={inputClasses}
                    value={requirement.role}
                    onChange={(event) =>
                      update(requirement.key, "role", event.target.value)
                    }
                    spellCheck
                    required
                    placeholder={title === "Inputs" ? "Sealed case" : "Boxes"}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={`${prefix}-sku`} className={labelClasses}>
                    SKU <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    id={`${prefix}-sku`}
                    className={inputClasses}
                    value={requirement.sku_id}
                    onChange={(event) =>
                      update(requirement.key, "sku_id", event.target.value)
                    }
                    onBlur={(event) =>
                      update(
                        requirement.key,
                        "sku_id",
                        normalizeInventoriusId(event.target.value)
                      )
                    }
                    autoComplete="off"
                    placeholder="SKU000001 or leave blank for a generic role"
                  />
                </div>
                <div>
                  <label htmlFor={`${prefix}-quantity`} className={labelClasses}>
                    Nominal quantity
                  </label>
                  <input
                    id={`${prefix}-quantity`}
                    type="number"
                    min="0"
                    step="any"
                    className={inputClasses}
                    value={requirement.quantity}
                    onChange={(event) =>
                      update(requirement.key, "quantity", event.target.value)
                    }
                    placeholder="Variable"
                  />
                </div>
                <div>
                  <label htmlFor={`${prefix}-unit`} className={labelClasses}>
                    Unit
                  </label>
                  <input
                    id={`${prefix}-unit`}
                    className={inputClasses}
                    value={requirement.unit}
                    onChange={(event) =>
                      update(requirement.key, "unit", event.target.value)
                    }
                    spellCheck
                    required
                    placeholder="each, case, box, g, mL..."
                  />
                </div>
              </div>
              <button
                type="button"
                className="mt-3 text-sm font-medium text-red-700 disabled:text-gray-400"
                disabled={value.length === 1}
                onClick={() =>
                  onChange(value.filter((item) => item.key !== requirement.key))
                }
              >
                Remove {title.slice(0, -1).toLowerCase()}
              </button>
            </fieldset>
          );
        })}
      </div>
      <button
        type="button"
        className="mt-3 rounded-md border border-[#0c3764] px-3 py-2 text-sm font-semibold text-[#0c3764] hover:bg-[#0c3764]/10"
        onClick={() => onChange([...value, requirementDraft()])}
      >
        Add {title.slice(0, -1).toLowerCase()}
      </button>
    </FormSection>
  );
}

export default function ProcessDefinitionForm({
  initial,
  heading,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: ProcessDefinitionWrite;
  heading: string;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (definition: ProcessDefinitionWrite) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [kind, setKind] = useState<ProcessDefinitionKind>(
    initial?.kind || "repackaging"
  );
  const [description, setDescription] = useState(initial?.description || "");
  const [inputs, setInputs] = useState<RequirementDraft[]>(
    initialDrafts(initial?.inputs)
  );
  const [outputs, setOutputs] = useState<RequirementDraft[]>(
    initialDrafts(initial?.outputs)
  );
  const [instructions, setInstructions] = useState(
    initial?.instructions?.join("\n") || ""
  );

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit({
          name: name.trim(),
          kind,
          description: description.trim(),
          inputs: serializeRequirements(inputs),
          outputs: serializeRequirements(outputs),
          instructions: instructions
            .split("\n")
            .map((instruction) => instruction.trim())
            .filter(Boolean),
        });
      }}
    >
      <PageHeading>{heading}</PageHeading>

      <label htmlFor="process-name" className={labelClasses}>
        Name
      </label>
      <input
        id="process-name"
        className={`${inputClasses} mb-6`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        spellCheck
        required
        autoFocus
        placeholder="Open glue-stick case"
      />

      <label htmlFor="process-kind" className={labelClasses}>
        Physical process
      </label>
      <select
        id="process-kind"
        className={inputClasses}
        value={kind}
        onChange={(event) => setKind(event.target.value as ProcessDefinitionKind)}
      >
        {Object.entries(PROCESS_KIND_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <p className="mt-1 mb-6 text-sm text-[#6d635d]">{PROCESS_KIND_HELP[kind]}</p>

      <label htmlFor="process-description" className={labelClasses}>
        Description <span className="normal-case font-normal">(optional)</span>
      </label>
      <textarea
        id="process-description"
        className={`${inputClasses} min-h-24 resize-y`}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        spellCheck
        placeholder="What this process accomplishes and when it should be used."
      />

      <RequirementEditor title="Inputs" value={inputs} onChange={setInputs} />
      <RequirementEditor title="Outputs" value={outputs} onChange={setOutputs} />

      <FormSection title="Operator instructions" bgAccent="bg-dark-accent">
        <label htmlFor="process-instructions" className="sr-only">
          Operator instructions, one step per line
        </label>
        <textarea
          id="process-instructions"
          className={`${inputClasses} min-h-32 resize-y`}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          spellCheck
          placeholder={"One instruction per line\nOpen the case\nCount the boxes"}
        />
        <p className="mt-1 text-sm text-[#6d635d]">
          Write one step per line. These are shown to the operator when a run is started.
        </p>
      </FormSection>

      <div className="mt-8 flex gap-3 border-t border-[#cdd2d6] pt-6">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-md bg-[#26532b] px-6 py-3 text-base font-semibold text-white hover:bg-[#1e4423] disabled:opacity-50"
        >
          {submitting ? "Saving..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-[#cdd2d6] px-5 py-3 text-base font-medium text-[#6d635d] hover:bg-[#cdd2d6]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
