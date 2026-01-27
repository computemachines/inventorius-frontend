import * as React from "react";
import { useState, useCallback, useContext } from "react";
import { ApiContext } from "../api-client/api-client";
import { CodeUsageRef } from "../api-client/data-models";
import FormSection from "./FormSection";

// Shared Tailwind classes (design system)
const inputClasses =
  "block w-full py-2.5 px-3 border border-[#cdd2d6] rounded-md bg-white text-[#04151f] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0c3764] focus:ring-[3px] focus:ring-[#0c3764]/15 placeholder:text-gray-400";

export interface CodeEntry {
  id: string;
  value: string;
  isOwned: boolean;
  usedBy: CodeUsageRef[];
  isLoading: boolean;
}

interface CodesSectionProps {
  /** Current codes state */
  codes: CodeEntry[];
  /** Update codes state */
  setCodes: React.Dispatch<React.SetStateAction<CodeEntry[]>>;
  /** Optional title override */
  title?: string;
}

/**
 * Auto-classify a code as owned or associated based on heuristics.
 * Currently uses a simple placeholder logic - can be enhanced.
 */
function autoClassifyCode(code: string): boolean {
  // Placeholder: odd length = owned
  return code.length % 2 === 1;
}

/**
 * Creates a new empty code entry.
 */
export function createEmptyCode(): CodeEntry {
  return {
    id: crypto.randomUUID(),
    value: "",
    isOwned: true,
    usedBy: [],
    isLoading: false,
  };
}

/**
 * Codes input section for forms.
 * Handles owned vs associated codes with usage lookup.
 */
export function CodesSection({
  codes,
  setCodes,
  title = "Codes",
}: CodesSectionProps) {
  const api = useContext(ApiContext);

  const handleCodeChange = useCallback(
    async (id: string, newValue: string) => {
      const trimmedValue = newValue.trim();

      setCodes((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                value: newValue,
                isOwned: trimmedValue ? autoClassifyCode(trimmedValue) : c.isOwned,
                isLoading: trimmedValue.length > 0,
              }
            : c
        )
      );

      if (trimmedValue) {
        const result = await api.getCodeUsage(trimmedValue);
        setCodes((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, usedBy: result.usedBy, isLoading: false }
              : c
          )
        );
      } else {
        setCodes((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, usedBy: [], isLoading: false } : c
          )
        );
      }
    },
    [api, setCodes]
  );

  const toggleCodeOwnership = useCallback(
    (id: string) => {
      setCodes((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isOwned: !c.isOwned } : c))
      );
    },
    [setCodes]
  );

  const removeCode = useCallback(
    (id: string) => {
      setCodes((prev) => {
        const filtered = prev.filter((c) => c.id !== id);
        if (filtered.length === 0) {
          return [createEmptyCode()];
        }
        return filtered;
      });
    },
    [setCodes]
  );

  const handleCodeBlur = useCallback(
    (id: string, index: number) => {
      setCodes((prev) => {
        const code = prev.find((c) => c.id === id);
        const isLastRow = index === prev.length - 1;
        if (code && !code.value.trim() && !isLastRow) {
          return prev.filter((c) => c.id !== id);
        }
        return prev;
      });
    },
    [setCodes]
  );

  const handleCodeFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.select();
    },
    []
  );

  const handleCodeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, id: string, index: number) => {
      if (e.key === "Tab" && !e.shiftKey) {
        const currentCode = codes.find((c) => c.id === id);
        const isLastRow = index === codes.length - 1;

        if (currentCode?.value.trim() && isLastRow) {
          e.preventDefault();
          const newCode = createEmptyCode();
          setCodes((prev) => [...prev, newCode]);
          setTimeout(() => {
            const newInput = document.querySelector(
              `input[data-code-id="${newCode.id}"]`
            ) as HTMLInputElement;
            newInput?.focus();
          }, 0);
        }
      }
    },
    [codes, setCodes]
  );

  const handlePlusClick = useCallback(
    (id: string) => {
      const currentCode = codes.find((c) => c.id === id);

      if (currentCode?.value.trim()) {
        const newCode = createEmptyCode();
        setCodes((prev) => [...prev, newCode]);
        setTimeout(() => {
          const newInput = document.querySelector(
            `input[data-code-id="${newCode.id}"]`
          ) as HTMLInputElement;
          newInput?.focus();
        }, 0);
      } else {
        const input = document.querySelector(
          `input[data-code-id="${id}"]`
        ) as HTMLInputElement;
        input?.focus();
      }
    },
    [codes, setCodes]
  );

  return (
    <FormSection title={title} accent="amber">
      <div className="flex flex-col gap-2">
        {codes.map((code, index) => {
          const isLastRow = index === codes.length - 1;
          return (
            <div key={code.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative flex items-stretch">
                  <input
                    type="text"
                    value={code.value}
                    onChange={(e) => handleCodeChange(code.id, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(e, code.id, index)}
                    onFocus={handleCodeFocus}
                    onBlur={() => handleCodeBlur(code.id, index)}
                    placeholder="Scan or type code..."
                    className={`${inputClasses} flex-1 ${code.value ? "pr-20" : ""}`}
                    data-code-id={code.id}
                  />
                  {code.value && (
                    <button
                      type="button"
                      tabIndex={-1}
                      className={`absolute right-1 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                        code.isOwned
                          ? "bg-[#26532b] text-white hover:bg-[#1e4423]"
                          : "bg-[#cdd2d6] text-[#6d635d] hover:bg-[#b8bfc5]"
                      }`}
                      onClick={() => toggleCodeOwnership(code.id)}
                      title={
                        code.isOwned
                          ? "Owned (uniquely identifies)"
                          : "Associated (shared)"
                      }
                    >
                      {code.isOwned ? "Owned" : "Assoc"}
                    </button>
                  )}
                </div>
                {isLastRow ? (
                  <button
                    type="button"
                    tabIndex={-1}
                    className="py-2.5 px-3.5 text-base font-semibold border border-[#cdd2d6] rounded-md bg-transparent text-gray-400 hover:bg-[#e8f4e8] hover:border-[#26532b] hover:text-[#26532b] transition-colors"
                    onClick={() => handlePlusClick(code.id)}
                    title="Add code"
                  >
                    +
                  </button>
                ) : (
                  <button
                    type="button"
                    tabIndex={-1}
                    className="py-2.5 px-3.5 text-base font-semibold border border-[#cdd2d6] rounded-md bg-transparent text-gray-400 hover:bg-red-100 hover:border-red-400 hover:text-red-600 transition-colors"
                    onClick={() => removeCode(code.id)}
                    title="Remove code"
                  >
                    ×
                  </button>
                )}
              </div>
              {/* Show shared items for associated codes */}
              {!code.isOwned && code.usedBy.length > 0 && !code.isLoading && (
                <div className="flex items-center gap-2 text-xs flex-wrap pl-1">
                  <span className="text-[#6d635d]">Shared with:</span>
                  {code.usedBy.slice(0, 3).map((ref) => (
                    <a
                      key={ref.id}
                      href={`/${ref.type}/${ref.id}`}
                      className="px-2 py-0.5 bg-[#082441] text-[#ecebe4] rounded text-xs hover:bg-[#0c3764] transition-colors"
                      onClick={(e) => e.preventDefault()}
                    >
                      {ref.name || ref.id}
                    </a>
                  ))}
                  {code.usedBy.length > 3 && (
                    <span className="text-gray-400 italic">
                      +{code.usedBy.length - 3} more
                    </span>
                  )}
                </div>
              )}
              {code.isLoading && (
                <span className="text-sm text-gray-400 pl-1">...</span>
              )}
            </div>
          );
        })}
      </div>
    </FormSection>
  );
}

export default CodesSection;
