import * as React from "react";
import { useContext, useState, useCallback, useRef, useEffect } from "react";
import { useFrontload } from "react-frontload";

import { ApiContext, FrontloadContext } from "../api-client/api-client";
import { Category, SchemaField, Mixin, CodeUsageRef } from "../api-client/data-models";
import { ToastContext } from "./Toast";

interface CodeEntry {
  id: string;
  value: string;
  isOwned: boolean;
  usedBy: CodeUsageRef[];
  isLoading: boolean;
}

interface FieldState {
  field: SchemaField;
  value: string;
  source: "category" | "mixin" | "intersection";
}

/**
 * Dynamic SKU creation form with adaptive fields.
 *
 * Design system colors:
 * - #04151f deep black (headers)
 * - #082441 dark navy (dropdowns)
 * - #0c3764 medium blue (hover/focus)
 * - #c0771f amber (accents)
 * - #cdd2d6 light gray (borders)
 * - #26532b dark green (primary actions)
 */
export function NewSkuFormDynamic() {
  const { data, frontloadMeta, setData } = useFrontload(
    "new-sku-dynamic",
    async ({ api }: FrontloadContext) => ({
      nextSku: await api.getNextSku(),
    })
  );

  const api = useContext(ApiContext);
  const { setToastContent } = useContext(ToastContext);

  // Form state
  const [skuId, setSkuId] = useState("");
  const [itemName, setItemName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  // Category suggestions
  const [suggestions, setSuggestions] = useState<Category[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(0);

  // Dynamic fields state
  const [fieldStates, setFieldStates] = useState<FieldState[]>([]);

  // Track current mixin trigger value
  const [currentMixinTrigger, setCurrentMixinTrigger] = useState<string | null>(null);

  // Active mixins
  const [activeMixins, setActiveMixins] = useState<Mixin[]>([]);

  // Code labels state
  const [codes, setCodes] = useState<CodeEntry[]>([
    { id: crypto.randomUUID(), value: "", isOwned: true, usedBy: [], isLoading: false }
  ]);

  // Refs
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const skuIdPlaceholder = frontloadMeta.pending
    ? "Loading..."
    : frontloadMeta.error
    ? "Error"
    : data?.nextSku.state || "SKU000001";

  // Tailwind class definitions
  const labelClasses = "block text-[0.85rem] font-semibold text-[#04151f] uppercase tracking-wide mt-5 mb-1.5";
  const inputClasses = "block w-full py-2.5 px-3 border border-[#cdd2d6] rounded-md bg-white text-[#04151f] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0c3764] focus:ring-[3px] focus:ring-[#0c3764]/15 placeholder:text-gray-400";

  // Search categories on item name change
  const searchCategories = useCallback(
    async (query: string) => {
      if (!query.trim() || query.length < 2) {
        setSuggestions([]);
        return;
      }
      const result = await api.searchCategories(query);
      setSuggestions(result.categories);
      setSelectedSuggestionIndex(0);
    },
    [api]
  );

  const handleItemNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setItemName(newValue);
    setShowSuggestions(true);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchCategories(newValue);
    }, 200);
  };

  const selectCategory = useCallback((category: Category) => {
    setItemName(category.name);
    setSelectedCategory(category);
    setShowSuggestions(false);
    setSuggestions([]);
    setCurrentMixinTrigger(null);
    setActiveMixins([]);

    const newFieldStates: FieldState[] = category.fields.map((field) => ({
      field,
      value: field.default?.toString() || "",
      source: "category" as const,
    }));
    setFieldStates(newFieldStates);
  }, []);

  const createNewItemType = useCallback(() => {
    setSelectedCategory(null);
    setShowSuggestions(false);
    setSuggestions([]);
    setFieldStates([]);
    setCurrentMixinTrigger(null);
    setActiveMixins([]);
  }, []);

  const hasExactMatch = suggestions.some(
    (cat) => cat.name.toLowerCase() === itemName.toLowerCase().trim()
  );

  const handleFieldChange = useCallback(
    async (fieldName: string, newValue: string) => {
      setFieldStates((prev) =>
        prev.map((fs) =>
          fs.field.name === fieldName ? { ...fs, value: newValue } : fs
        )
      );

      if (
        selectedCategory &&
        selectedCategory.mixinTriggerField === fieldName
      ) {
        if (newValue === currentMixinTrigger) return;

        setFieldStates((prev) =>
          prev.filter((fs) => fs.source === "category")
        );
        setActiveMixins([]);

        if (!newValue) {
          setCurrentMixinTrigger(null);
          return;
        }

        const result = await api.getMixinsForCategory(
          selectedCategory.id,
          newValue
        );

        setCurrentMixinTrigger(newValue);

        if (result.mixins.length > 0 || result.intersectionFields.length > 0) {
          setActiveMixins(result.mixins);

          const newMixinFields: FieldState[] = result.mixins.flatMap((mixin) =>
            mixin.fields.map((field) => ({
              field,
              value: field.default?.toString() || "",
              source: "mixin" as const,
            }))
          );

          const newIntersectionFields: FieldState[] = result.intersectionFields.map(
            (field) => ({
              field,
              value: field.default?.toString() || "",
              source: "intersection" as const,
            })
          );

          setFieldStates((prev) => [
            ...prev,
            ...newMixinFields,
            ...newIntersectionFields,
          ]);
        }
      }
    },
    [api, selectedCategory, currentMixinTrigger]
  );

  // Code Labels Handlers
  const autoClassifyCode = (code: string): boolean => {
    return code.length % 2 === 1;
  };

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
    [api]
  );

  const toggleCodeOwnership = useCallback((id: string) => {
    setCodes((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isOwned: !c.isOwned } : c))
    );
  }, []);

  const removeCode = useCallback((id: string) => {
    setCodes((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (filtered.length === 0) {
        return [{ id: crypto.randomUUID(), value: "", isOwned: true, usedBy: [], isLoading: false }];
      }
      return filtered;
    });
  }, []);

  const handleCodeBlur = useCallback((id: string, index: number) => {
    setCodes((prev) => {
      const code = prev.find((c) => c.id === id);
      const isLastRow = index === prev.length - 1;
      if (code && !code.value.trim() && !isLastRow) {
        return prev.filter((c) => c.id !== id);
      }
      return prev;
    });
  }, []);

  const handleCodeFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  }, []);

  const handleCodeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, id: string, index: number) => {
      if (e.key === "Tab" && !e.shiftKey) {
        const currentCode = codes.find((c) => c.id === id);
        const isLastRow = index === codes.length - 1;

        if (currentCode?.value.trim() && isLastRow) {
          e.preventDefault();
          const newId = crypto.randomUUID();
          setCodes((prev) => [
            ...prev,
            { id: newId, value: "", isOwned: true, usedBy: [], isLoading: false },
          ]);
          setTimeout(() => {
            const newInput = document.querySelector(
              `input[data-code-id="${newId}"]`
            ) as HTMLInputElement;
            newInput?.focus();
          }, 0);
        }
      }
    },
    [codes]
  );

  const handlePlusClick = useCallback((id: string) => {
    const currentCode = codes.find((c) => c.id === id);

    if (currentCode?.value.trim()) {
      const newId = crypto.randomUUID();
      setCodes((prev) => [
        ...prev,
        { id: newId, value: "", isOwned: true, usedBy: [], isLoading: false },
      ]);
      setTimeout(() => {
        const newInput = document.querySelector(
          `input[data-code-id="${newId}"]`
        ) as HTMLInputElement;
        newInput?.focus();
      }, 0);
    } else {
      const input = document.querySelector(
        `input[data-code-id="${id}"]`
      ) as HTMLInputElement;
      input?.focus();
    }
  }, [codes]);

  const showCreateNew = itemName.trim().length >= 2 && !hasExactMatch;
  const totalOptions = suggestions.length + (showCreateNew ? 1 : 0);
  const createNewIndex = showCreateNew && suggestions.length === 0 ? 0 : suggestions.length;

  const handleItemKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || totalOptions === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          Math.min(prev + 1, totalOptions - 1)
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (showCreateNew && selectedSuggestionIndex === createNewIndex) {
          createNewItemType();
        } else if (suggestions[selectedSuggestionIndex]) {
          selectCategory(suggestions[selectedSuggestionIndex]);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const resetForm = useCallback(async () => {
    setSkuId("");
    setItemName("");
    setSelectedCategory(null);
    setFieldStates([]);
    setSuggestions([]);
    setShowSuggestions(false);
    setCurrentMixinTrigger(null);
    setActiveMixins([]);
    setCodes([
      { id: crypto.randomUUID(), value: "", isOwned: true, usedBy: [], isLoading: false }
    ]);

    try {
      const nextSku = await api.getNextSku();
      setData(() => ({ nextSku }));
    } catch (e) {
      // Ignore - using mock data
    }
  }, [api, setData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const props: Record<string, string> = {};
    for (const fs of fieldStates) {
      if (fs.value) {
        props[fs.field.name] = fs.value;
      }
    }

    if (selectedCategory) {
      props._category = selectedCategory.id;
    }

    const ownedCodes = codes
      .filter((c) => c.value.trim() && c.isOwned)
      .map((c) => c.value.trim());
    const associatedCodes = codes
      .filter((c) => c.value.trim() && !c.isOwned)
      .map((c) => c.value.trim());

    console.log("Creating SKU:", {
      id: skuId || skuIdPlaceholder,
      name: itemName,
      props,
      owned_codes: ownedCodes,
      associated_codes: associatedCodes,
      activeMixins: activeMixins.map((m) => m.id),
    });

    setToastContent({
      content: (
        <div>
          <p style={{ fontWeight: 600 }}>SKU Created (Mock)</p>
          <p style={{ fontSize: "0.875rem" }}>
            {skuId || skuIdPlaceholder}: {itemName || "(unnamed)"}
          </p>
          <pre style={{
            fontSize: "0.75rem",
            marginTop: "0.5rem",
            backgroundColor: "#cdd2d6",
            padding: "0.5rem",
            borderRadius: "0.25rem",
            overflow: "auto",
            maxHeight: "8rem"
          }}>
            {JSON.stringify(props, null, 2)}
          </pre>
        </div>
      ),
      mode: "success",
    });

    await resetForm();
  };

  const renderField = (fs: FieldState, index: number) => {
    const { field, value } = fs;
    const inputId = `field-${field.name}`;

    const fieldWrapperClasses = fs.source === "intersection"
      ? "border-l-[3px] border-l-[#c0771f] pl-4 bg-gradient-to-r from-[#c0771f]/5 to-transparent rounded-r"
      : fs.source === "mixin"
      ? "border-l-[3px] border-l-[#26532b] pl-4 bg-gradient-to-r from-[#26532b]/5 to-transparent rounded-r"
      : "";

    if (field.type === "enum") {
      return (
        <div key={`${field.name}-${index}`} className={`py-2 ${fieldWrapperClasses}`}>
          <label htmlFor={inputId} className={labelClasses} style={{ marginTop: 0 }}>
            {field.label}
            {field.required && <span className="text-[#c0771f] ml-0.5 font-bold">*</span>}
          </label>
          <select
            id={inputId}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={`${inputClasses} cursor-pointer appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2304151f' d='M6 8L1 3h10z'/%3E%3C/svg%3E")] bg-no-repeat bg-[right_0.75em_center] pr-10`}
          >
            <option value="">Select {field.label.toLowerCase()}...</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === "unit") {
      return (
        <div key={`${field.name}-${index}`} className={`py-2 ${fieldWrapperClasses}`}>
          <label htmlFor={inputId} className={labelClasses} style={{ marginTop: 0 }}>
            {field.label}
            {field.required && <span className="text-[#c0771f] ml-0.5 font-bold">*</span>}
          </label>
          <div className="flex items-stretch">
            <input
              id={inputId}
              type="text"
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              className={`${inputClasses} flex-1 rounded-r-none border-r-0`}
              placeholder="e.g., 10k"
            />
            {field.unit && (
              <span className="flex items-center px-3 bg-[#e5e4de] text-[#6d635d] text-sm font-medium border border-[#cdd2d6] border-l-0 rounded-r-md whitespace-nowrap">
                {field.unit}
              </span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={`${field.name}-${index}`} className={`py-2 ${fieldWrapperClasses}`}>
        <label htmlFor={inputId} className={labelClasses} style={{ marginTop: 0 }}>
          {field.label}
          {field.required && <span className="text-[#c0771f] ml-0.5 font-bold">*</span>}
        </label>
        <input
          id={inputId}
          type={field.type === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => handleFieldChange(field.name, e.target.value)}
          className={inputClasses}
        />
      </div>
    );
  };

  return (
    <form className="max-w-[40rem] mx-auto" onSubmit={handleSubmit}>
      <h2 className="text-2xl font-bold text-[#04151f] mb-6 pb-3 border-b-2 border-[#cdd2d6]">
        New SKU
      </h2>

      {/* SKU ID */}
      <label htmlFor="sku-id" className={labelClasses} style={{ marginTop: 0 }}>
        SKU ID
      </label>
      <input
        id="sku-id"
        type="text"
        value={skuId}
        onChange={(e) => setSkuId(e.target.value)}
        placeholder={skuIdPlaceholder}
        className={inputClasses}
      />

      {/* Item (combined name + category) */}
      <label htmlFor="item-name" className={labelClasses}>
        Item
      </label>
      <div className="relative" ref={containerRef}>
        <input
          id="item-name"
          type="text"
          value={itemName}
          onChange={handleItemNameChange}
          onKeyDown={handleItemKeyDown}
          onFocus={() => {
            if (itemName.trim().length >= 2) {
              setShowSuggestions(true);
              searchCategories(itemName);
            }
          }}
          placeholder="Battery, Resistor, Antique toothbrush holder..."
          autoComplete="off"
          className={`${inputClasses} ${showSuggestions && totalOptions > 0 ? 'rounded-b-none border-b-[#082441]' : ''}`}
        />

        {/* Item type suggestions */}
        {showSuggestions && totalOptions > 0 && (
          <ul className="absolute top-full left-0 right-0 m-0 py-1 list-none bg-[#082441] rounded-b-md shadow-[0_10px_25px_rgba(0,0,0,0.25),0_4px_10px_rgba(0,0,0,0.15)] z-[100] max-h-72 overflow-y-auto animate-[slideDown_0.1s_ease-out]">
            {showCreateNew && suggestions.length === 0 && (
              <li
                className={`flex items-center gap-2 py-3 px-4 text-[#ecebe4] cursor-pointer transition-colors ${selectedSuggestionIndex === 0 ? 'bg-[#0c3764]' : 'hover:bg-[#0c3764]'}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  createNewItemType();
                }}
                onMouseEnter={() => setSelectedSuggestionIndex(0)}
              >
                <span className="inline-flex items-center justify-center w-6 h-6 bg-[#c0771f]/20 text-[#c0771f] font-bold text-sm rounded">+</span>
                <span className="font-medium">{itemName.trim()}</span>
                <span className="text-[#ecebe4]/50 text-sm ml-auto">(new item type)</span>
              </li>
            )}

            {suggestions.map((cat, index) => (
              <li
                key={cat.id}
                className={`flex items-center gap-2 py-3 px-4 text-[#ecebe4] cursor-pointer transition-colors ${index === selectedSuggestionIndex ? 'bg-[#0c3764]' : 'hover:bg-[#0c3764]'}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectCategory(cat);
                }}
                onMouseEnter={() => setSelectedSuggestionIndex(index)}
              >
                <span className="font-medium">{cat.name}</span>
                <span className="text-[#ecebe4]/50 text-sm ml-auto">({cat.fields.length} fields)</span>
              </li>
            ))}

            {showCreateNew && suggestions.length > 0 && (
              <li
                className={`flex items-center gap-2 py-3 px-4 text-[#ecebe4] cursor-pointer transition-colors border-t border-[#ecebe4]/10 mt-1 pt-3 ${selectedSuggestionIndex === createNewIndex ? 'bg-[#0c3764]' : 'hover:bg-[#0c3764]'}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  createNewItemType();
                }}
                onMouseEnter={() => setSelectedSuggestionIndex(createNewIndex)}
              >
                <span className="inline-flex items-center justify-center w-6 h-6 bg-[#c0771f]/20 text-[#c0771f] font-bold text-sm rounded">+</span>
                <span className="font-medium">{itemName.trim()}</span>
                <span className="text-[#ecebe4]/50 text-sm ml-auto">(new item type)</span>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Dynamic Fields */}
      {fieldStates.length > 0 && (
        <div className="mt-7 pt-5 border-t-2 border-[#cdd2d6]">
          <h3 className="text-base font-bold text-[#04151f] mb-3 flex items-center gap-2">
            <span className="block w-1 h-5 bg-[#c0771f] rounded-sm"></span>
            {selectedCategory?.name} Attributes
          </h3>
          {fieldStates.map((fs, index) => renderField(fs, index))}
          {activeMixins.length > 0 && (
            <div className="mt-4 py-2 px-3 text-sm text-[#6d635d] bg-[#cdd2d6]/30 rounded inline-block">
              Active: {activeMixins.map((m) => m.name).join(", ")}
            </div>
          )}
        </div>
      )}

      {/* Codes Section */}
      <div className="mt-7 pt-5 border-t-2 border-[#cdd2d6]">
        <h3 className="text-base font-bold text-[#04151f] mb-3 flex items-center gap-2">
          <span className="block w-1 h-5 bg-[#c0771f] rounded-sm"></span>
          Codes
        </h3>
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
                      className={`${inputClasses} flex-1 ${code.value ? 'pr-20' : ''}`}
                      data-code-id={code.id}
                    />
                    {code.value && (
                      <button
                        type="button"
                        tabIndex={-1}
                        className={`absolute right-1 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                          code.isOwned
                            ? 'bg-[#26532b] text-white hover:bg-[#1e4423]'
                            : 'bg-[#cdd2d6] text-[#6d635d] hover:bg-[#b8bfc5]'
                        }`}
                        onClick={() => toggleCodeOwnership(code.id)}
                        title={code.isOwned ? "Owned (uniquely identifies)" : "Associated (shared)"}
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
                {/* Show shared SKUs for associated codes */}
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
      </div>

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
    </form>
  );
}

export default NewSkuFormDynamic;
