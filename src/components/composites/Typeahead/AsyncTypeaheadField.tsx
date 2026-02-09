// src/components/composites/Typeahead/AsyncTypeaheadField.tsx
// Fully human reviewed: NO
// Progress: NONE
//
// Conversation:
// > (no discussion yet)


import * as React from "react";
import { useTypeahead } from "./useTypeahead";
import { styles } from "./typeahead.styles";

export interface AsyncTypeaheadFieldProps<T> {
  /** Current input value */
  value: string;
  /** Called when input value changes */
  onChange: (value: string) => void;
  /** Called when an item is selected */
  onSelect?: (item: T) => void;
  /** Async search function */
  onSearch: (query: string) => Promise<T[]>;
  /** Extract display text from item */
  getItemText: (item: T) => string;
  /** Extract unique key from item */
  getItemKey: (item: T) => string;
  /** Custom render function for each item */
  renderItem?: (item: T, isSelected: boolean) => React.ReactNode;
  /** Input ID for label association */
  id?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Show clear button */
  clearable?: boolean;
  /** Allow creating new items when no results */
  allowCreate?: boolean;
  /** Called when "create new" is chosen */
  onCreate?: (inputValue: string) => void;
  /** Debounce delay in ms (default: 150) */
  debounceMs?: number;
  /** Minimum characters before searching (default: 1) */
  minChars?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Async typeahead field with API search.
 * Pre-built variant for common case of server-side search.
 */
export function AsyncTypeaheadField<T>({
  value,
  onChange,
  onSelect,
  onSearch,
  getItemText,
  getItemKey,
  renderItem,
  id,
  placeholder,
  clearable = false,
  allowCreate = false,
  onCreate,
  debounceMs = 150,
  minChars = 1,
  className = "",
}: AsyncTypeaheadFieldProps<T>) {
  const typeahead = useTypeahead<T>({
    value,
    onChange,
    onSelect,
    onSearch,
    getItemText,
    getItemKey,
    allowCreate,
    onCreate,
    debounceMs,
    minChars,
  });

  const inputProps = typeahead.getInputProps();
  const listProps = typeahead.getListProps();
  const showClear = clearable && typeahead.inputValue;
  const showDropdown =
    typeahead.isOpen &&
    (typeahead.items.length > 0 ||
      typeahead.isLoading ||
      typeahead.isEmpty);

  return (
    <div
      ref={typeahead.containerRef}
      className={`${styles.container} ${className}`}
    >
      <div className="relative">
        <input
          {...inputProps}
          ref={typeahead.inputRef}
          id={id}
          placeholder={placeholder}
          className={`${styles.input} ${showClear ? styles.inputWithClear : ""}`}
        />
        {showClear && (
          <button
            type="button"
            onClick={typeahead.clear}
            className={styles.clearButton}
            title="Clear"
            tabIndex={-1}
          >
            ×
          </button>
        )}
      </div>

      {showDropdown && (
        <ul {...listProps} className={styles.dropdown}>
          {/* Loading state */}
          {typeahead.isLoading && (
            <li className={styles.loading}>Loading...</li>
          )}

          {/* Items */}
          {!typeahead.isLoading &&
            typeahead.items.map((item, index) => {
              const itemProps = typeahead.getItemProps(item, index);
              const isSelected = typeahead.selectedIndex === index;
              return (
                <li
                  key={getItemKey(item)}
                  {...itemProps}
                  className={`${styles.item} ${isSelected ? styles.itemSelected : ""}`}
                >
                  {renderItem ? renderItem(item, isSelected) : getItemText(item)}
                </li>
              );
            })}

          {/* Empty state (when not showing create) */}
          {!typeahead.isLoading &&
            typeahead.isEmpty &&
            !typeahead.showCreate && (
              <li className={styles.empty}>No results found</li>
            )}

          {/* Create new option */}
          {!typeahead.isLoading && typeahead.showCreate && (
            <li
              role="option"
              aria-selected={typeahead.selectedIndex === typeahead.items.length}
              onMouseDown={(e) => {
                e.preventDefault();
                typeahead.handleCreate();
              }}
              className={`${styles.create} ${
                typeahead.selectedIndex === typeahead.items.length
                  ? styles.itemSelected
                  : ""
              }`}
            >
              <span className={styles.createIcon}>+</span>
              Create "{typeahead.inputValue.trim()}"
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
