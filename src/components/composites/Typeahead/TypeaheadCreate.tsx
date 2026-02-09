// src/components/composites/Typeahead/TypeaheadCreate.tsx
// Fully human reviewed: NO
// Progress: NONE
//
// Conversation:
// > (no discussion yet)


import * as React from "react";
import { useTypeaheadContext } from "./TypeaheadContext";
import { styles } from "./typeahead.styles";

export interface TypeaheadCreateProps {
  /** Custom render function. Receives the input value. */
  children?: (inputValue: string) => React.ReactNode;
  className?: string;
}

/**
 * "Create new" option shown when no results match.
 * Only renders when showCreate is true.
 */
export function TypeaheadCreate({
  children,
  className = "",
}: TypeaheadCreateProps) {
  const typeahead = useTypeaheadContext();
  const isSelected = typeahead.selectedIndex === typeahead.items.length;

  if (!typeahead.isOpen || !typeahead.showCreate) {
    return null;
  }

  const defaultContent = (
    <>
      <span className={styles.createIcon}>+</span>
      Create "{typeahead.inputValue.trim()}"
    </>
  );

  return (
    <li
      role="option"
      aria-selected={isSelected}
      onMouseDown={(e) => {
        e.preventDefault();
        typeahead.handleCreate();
      }}
      onMouseEnter={() => {
        // Set selected index to the create option (after all items)
        // This is handled by the hook's keyboard navigation
      }}
      className={`${styles.create} ${isSelected ? styles.itemSelected : ""} ${className}`}
    >
      {children ? children(typeahead.inputValue.trim()) : defaultContent}
    </li>
  );
}
