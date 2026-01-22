import * as React from "react";
import { useContext, useState, useCallback, useRef, useEffect } from "react";
import { useFrontload } from "react-frontload";

import { ApiContext, FrontloadContext } from "../api-client/api-client";
import { Category, SchemaField, Mixin, CodeUsageRef } from "../api-client/data-models";
import { ToastContext } from "./Toast";

interface CodeEntry {
  id: string;  // unique key for React
  value: string;
  isOwned: boolean;
  usedBy: CodeUsageRef[];  // other SKUs/batches sharing this code
  isLoading: boolean;
}

import "../styles/form.css";
import "../styles/NewSkuFormDynamic.css";

interface FieldState {
  field: SchemaField;
  value: string;
  source: "category" | "mixin" | "intersection";
}

/**
 * Dynamic SKU creation form with adaptive fields.
 *
 * Single "Item" field serves as both name and category selector:
 * - Type anything: "Antique toothbrush holder", "Battery", "10kΩ Resistor"
 * - If it matches a category, offer to use that item type
 * - The typed value becomes the item name
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

  // Track current mixin trigger value (not a set - only one active at a time)
  const [currentMixinTrigger, setCurrentMixinTrigger] = useState<string | null>(null);

  // Active mixins
  const [activeMixins, setActiveMixins] = useState<Mixin[]>([]);

  // Code labels state - start with one empty entry
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

  // Handle item name change with debounced category search
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

  // Select an existing category (item type)
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

  // Create new item type (no predefined schema)
  const createNewItemType = useCallback(() => {
    setSelectedCategory(null);
    setShowSuggestions(false);
    setSuggestions([]);
    setFieldStates([]);
    setCurrentMixinTrigger(null);
    setActiveMixins([]);
  }, []);

  // Check if typed text exactly matches a suggestion (case insensitive)
  const hasExactMatch = suggestions.some(
    (cat) => cat.name.toLowerCase() === itemName.toLowerCase().trim()
  );

  // Handle field value change
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

  // ==========================================================================
  // Code Labels Handlers
  // ==========================================================================

  // Auto-classify: odd char count = owned, even = associated (for testing)
  const autoClassifyCode = (code: string): boolean => {
    return code.length % 2 === 1;  // odd = owned
  };

  // Handle code value change
  const handleCodeChange = useCallback(
    async (id: string, newValue: string) => {
      const trimmedValue = newValue.trim();

      // Update the value immediately
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

      // Look up code usage if there's a value
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

  // Toggle owned/associated for a code
  const toggleCodeOwnership = useCallback((id: string) => {
    setCodes((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isOwned: !c.isOwned } : c))
    );
  }, []);

  // Remove a code entry (used by × button)
  const removeCode = useCallback((id: string) => {
    setCodes((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      // Always keep at least one row (the "add new" row)
      if (filtered.length === 0) {
        return [{ id: crypto.randomUUID(), value: "", isOwned: true, usedBy: [], isLoading: false }];
      }
      return filtered;
    });
  }, []);

  // Handle blur - remove empty non-last rows
  const handleCodeBlur = useCallback((id: string, index: number) => {
    setCodes((prev) => {
      const code = prev.find((c) => c.id === id);
      const isLastRow = index === prev.length - 1;

      // If empty and not last row, remove it
      if (code && !code.value.trim() && !isLastRow) {
        return prev.filter((c) => c.id !== id);
      }
      return prev;
    });
  }, []);

  // Handle focus - select all content
  const handleCodeFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  }, []);

  // Handle Tab on last row with content - add new row
  const handleCodeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, id: string, index: number) => {
      if (e.key === "Tab" && !e.shiftKey) {
        const currentCode = codes.find((c) => c.id === id);
        const isLastRow = index === codes.length - 1;

        // If this row has content and it's the last row, add a new row
        if (currentCode?.value.trim() && isLastRow) {
          e.preventDefault();
          const newId = crypto.randomUUID();
          setCodes((prev) => [
            ...prev,
            { id: newId, value: "", isOwned: true, usedBy: [], isLoading: false },
          ]);
          // Focus the new input after render
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

  // Handle + button click - add new row if current has content, otherwise focus
  const handlePlusClick = useCallback((id: string) => {
    const currentCode = codes.find((c) => c.id === id);

    if (currentCode?.value.trim()) {
      // Has content - add new row and focus it (like Tab)
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
      // Empty - just focus the input
      const input = document.querySelector(
        `input[data-code-id="${id}"]`
      ) as HTMLInputElement;
      input?.focus();
    }
  }, [codes]);

  // Total options = suggestions + "create new" option (if no exact match)
  const showCreateNew = itemName.trim().length >= 2 && !hasExactMatch;
  const totalOptions = suggestions.length + (showCreateNew ? 1 : 0);
  const createNewIndex = showCreateNew && suggestions.length === 0 ? 0 : suggestions.length;

  // Handle keyboard in item field
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

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Reset form
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

  // Handle form submission
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

    // Collect codes
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

  // Render a dynamic field
  const renderField = (fs: FieldState, index: number) => {
    const { field, value } = fs;
    const inputId = `field-${field.name}`;

    const fieldClasses = fs.source === "intersection"
      ? "dynamic-field dynamic-field--intersection"
      : fs.source === "mixin"
      ? "dynamic-field dynamic-field--mixin"
      : "dynamic-field";

    if (field.type === "enum") {
      return (
        <div key={`${field.name}-${index}`} className={fieldClasses}>
          <label htmlFor={inputId} className="form-label">
            {field.label}
            {field.required && <span className="required-mark">*</span>}
          </label>
          <select
            id={inputId}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className="form-single-code-input"
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
        <div key={`${field.name}-${index}`} className={fieldClasses}>
          <label htmlFor={inputId} className="form-label">
            {field.label}
            {field.required && <span className="required-mark">*</span>}
          </label>
          <div className="unit-input-wrapper">
            <input
              id={inputId}
              type="text"
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              className="form-single-code-input"
              placeholder={`e.g., 10k`}
            />
            {field.unit && <span className="unit-suffix">{field.unit}</span>}
          </div>
        </div>
      );
    }

    return (
      <div key={`${field.name}-${index}`} className={fieldClasses}>
        <label htmlFor={inputId} className="form-label">
          {field.label}
          {field.required && <span className="required-mark">*</span>}
        </label>
        <input
          id={inputId}
          type={field.type === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => handleFieldChange(field.name, e.target.value)}
          className="form-single-code-input"
        />
      </div>
    );
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <h2 className="m-3">New SKU</h2>

      {/* SKU ID */}
      <label htmlFor="sku-id" className="form-label">SKU ID</label>
      <input
        id="sku-id"
        type="text"
        value={skuId}
        onChange={(e) => setSkuId(e.target.value)}
        placeholder={skuIdPlaceholder}
        className="form-single-code-input"
      />

      {/* Item (combined name + category) */}
      <label htmlFor="item-name" className="form-label">Item</label>
      <div className="item-input-container" ref={containerRef}>
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
          className="form-single-code-input"
        />

        {/* Item type suggestions */}
        {showSuggestions && totalOptions > 0 && (
          <ul className="item-suggestions">
            {/* If no matches, show "+ New" at top */}
            {showCreateNew && suggestions.length === 0 && (
              <li
                className={`item-suggestion ${selectedSuggestionIndex === 0 ? "item-suggestion--selected" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  createNewItemType();
                }}
                onMouseEnter={() => setSelectedSuggestionIndex(0)}
              >
                <span className="item-suggestion__plus">+</span>
                <span className="item-suggestion__name">{itemName.trim()}</span>
                <span className="item-suggestion__meta">(new item type)</span>
              </li>
            )}

            {/* Matching suggestions */}
            {suggestions.map((cat, index) => (
              <li
                key={cat.id}
                className={`item-suggestion ${index === selectedSuggestionIndex ? "item-suggestion--selected" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectCategory(cat);
                }}
                onMouseEnter={() => setSelectedSuggestionIndex(index)}
              >
                <span className="item-suggestion__name">{cat.name}</span>
                <span className="item-suggestion__meta">({cat.fields.length} fields)</span>
              </li>
            ))}

            {/* If there are matches but no exact match, show "+ New" at bottom */}
            {showCreateNew && suggestions.length > 0 && (
              <li
                className={`item-suggestion item-suggestion--create ${selectedSuggestionIndex === createNewIndex ? "item-suggestion--selected" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  createNewItemType();
                }}
                onMouseEnter={() => setSelectedSuggestionIndex(createNewIndex)}
              >
                <span className="item-suggestion__plus">+</span>
                <span className="item-suggestion__name">{itemName.trim()}</span>
                <span className="item-suggestion__meta">(new item type)</span>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Dynamic Fields */}
      {fieldStates.length > 0 && (
        <div className="dynamic-fields-section">
          <h3 className="dynamic-fields-title">{selectedCategory?.name} Attributes</h3>
          {fieldStates.map((fs, index) => renderField(fs, index))}
          {activeMixins.length > 0 && (
            <div className="active-mixins">
              Active: {activeMixins.map((m) => m.name).join(", ")}
            </div>
          )}
        </div>
      )}

      {/* Codes Section */}
      <div className="codes-section">
        <h3 className="dynamic-fields-title">Codes</h3>
        <div className="codes-list">
          {codes.map((code, index) => {
            const isLastRow = index === codes.length - 1;
            return (
              <div key={code.id} className="code-row">
                <div className="code-input-wrapper">
                  <input
                    type="text"
                    value={code.value}
                    onChange={(e) => handleCodeChange(code.id, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(e, code.id, index)}
                    onFocus={handleCodeFocus}
                    onBlur={() => handleCodeBlur(code.id, index)}
                    placeholder="Scan or type code..."
                    className="form-single-code-input code-input"
                    data-code-id={code.id}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className={`code-ownership-badge ${code.isOwned ? "code-ownership-badge--owned" : ""}`}
                    onClick={() => toggleCodeOwnership(code.id)}
                    title={code.isOwned ? "Owned (uniquely identifies)" : "Associated (shared)"}
                  >
                    {code.isOwned ? "Owned" : "Assoc"}
                  </button>
                </div>
                {isLastRow ? (
                  <button
                    type="button"
                    tabIndex={-1}
                    className="code-add"
                    onClick={() => handlePlusClick(code.id)}
                    title="Add code"
                  >
                    +
                  </button>
                ) : (
                  <button
                    type="button"
                    tabIndex={-1}
                    className="code-remove"
                    onClick={() => removeCode(code.id)}
                    title="Remove code"
                  >
                    ×
                  </button>
                )}
                {/* Show shared SKUs for associated codes */}
                {!code.isOwned && code.usedBy.length > 0 && !code.isLoading && (
                  <div className="code-shared-info">
                    <span className="code-shared-label">Shared with:</span>
                    {code.usedBy.slice(0, 3).map((ref) => (
                      <a
                        key={ref.id}
                        href={`/${ref.type}/${ref.id}`}
                        className="code-shared-link"
                        onClick={(e) => e.preventDefault()}
                      >
                        {ref.name || ref.id}
                      </a>
                    ))}
                    {code.usedBy.length > 3 && (
                      <span className="code-shared-more">
                        +{code.usedBy.length - 3} more
                      </span>
                    )}
                  </div>
                )}
                {code.isLoading && (
                  <div className="code-loading">...</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Submit */}
      <div className="form-actions">
        <input type="submit" value="Create SKU" className="form-submit" />
        <button type="button" onClick={resetForm} className="form-reset">
          Reset
        </button>
      </div>
    </form>
  );
}

export default NewSkuFormDynamic;
