import * as React from "react";
import { useTypeahead } from "./useTypeahead";
import { styles } from "./typeahead.styles";

export interface TypeaheadFieldProps {
  /** Available options (strings) */
  items: string[];
  /** Current value */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;
  /** Called when an item is selected from the list */
  onSelect?: (value: string) => void;
  /** Input ID for label association */
  id?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Show clear button */
  clearable?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Simple string-based typeahead field.
 * Pre-built variant for common case of string arrays.
 */
export function TypeaheadField({
  items,
  value,
  onChange,
  onSelect,
  id,
  placeholder,
  clearable = false,
  className = "",
}: TypeaheadFieldProps) {
  const typeahead = useTypeahead<string>({
    items,
    value,
    onChange,
    onSelect,
    getItemText: (item) => item,
    getItemKey: (item) => item,
  });

  const inputProps = typeahead.getInputProps();
  const listProps = typeahead.getListProps();
  const showClear = clearable && typeahead.inputValue;

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

      {typeahead.isOpen && typeahead.items.length > 0 && (
        <ul {...listProps} className={styles.dropdown}>
          {typeahead.items.map((item, index) => {
            const itemProps = typeahead.getItemProps(item, index);
            const isSelected = typeahead.selectedIndex === index;
            return (
              <li
                key={item}
                {...itemProps}
                className={`${styles.item} ${isSelected ? styles.itemSelected : ""}`}
              >
                {item}
              </li>
            );
          })}
        </ul>
      )}

      {typeahead.isOpen && typeahead.isEmpty && (
        <ul {...listProps} className={styles.dropdown}>
          <li className={styles.empty}>No matches found</li>
        </ul>
      )}
    </div>
  );
}
