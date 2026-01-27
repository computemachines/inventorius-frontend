import * as React from "react";
import { useTypeaheadContext } from "./TypeaheadContext";
import { styles } from "./typeahead.styles";

export interface TypeaheadInputProps {
  id?: string;
  placeholder?: string;
  className?: string;
  /** Show clear button when there's a value */
  clearable?: boolean;
  /** Custom clear button render */
  renderClear?: () => React.ReactNode;
}

/**
 * Input component for typeahead.
 * Automatically connected to the typeahead context.
 */
export function TypeaheadInput({
  id,
  placeholder,
  className = "",
  clearable = false,
  renderClear,
}: TypeaheadInputProps) {
  const typeahead = useTypeaheadContext();
  const inputProps = typeahead.getInputProps();
  const showClear = clearable && typeahead.inputValue;

  return (
    <div className="relative">
      <input
        {...inputProps}
        ref={typeahead.inputRef as React.RefObject<HTMLInputElement>}
        id={id}
        placeholder={placeholder}
        className={`${styles.input} ${showClear ? styles.inputWithClear : ""} ${className}`}
      />
      {showClear && (
        renderClear ? (
          <div onClick={typeahead.clear}>{renderClear()}</div>
        ) : (
          <button
            type="button"
            onClick={typeahead.clear}
            className={styles.clearButton}
            title="Clear"
            tabIndex={-1}
          >
            ×
          </button>
        )
      )}
    </div>
  );
}
